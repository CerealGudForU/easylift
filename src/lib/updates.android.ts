// Android in-app updater: checks the latest GitHub Release, downloads its APK into the
// cache and hands it to Android's package installer, which always asks the user to confirm.
// A newer versionCode signed with the same release key installs over the current app.
import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';

import { isNewer, LATEST_RELEASE_URL, toRelease } from './updates-core';
import { getUpdateState, setUpdateState } from './updates-store';

export { closeUpdateSheet, useUpdateState } from './updates-store';

export const updatesSupported = true;
export const installedVersion: string | null = Application.nativeApplicationVersion;

const FLAG_GRANT_READ_URI_PERMISSION = 0x1;
const APK_MIME = 'application/vnd.android.package-archive';

export async function checkForUpdate({ manual }: { manual: boolean }): Promise<void> {
  const busy = ['checking', 'downloading', 'installing'];
  if (busy.includes(getUpdateState().phase)) {
    if (manual) setUpdateState({ sheet: getUpdateState().phase !== 'checking' });
    return;
  }
  setUpdateState({ phase: 'checking', error: undefined });
  try {
    const res = await fetch(LATEST_RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    // 404 = no release published yet.
    if (res.status === 404) return setUpdateState({ phase: 'current', release: undefined });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const release = toRelease(await res.json());
    if (release && isNewer(release.version, installedVersion)) {
      setUpdateState({ phase: 'available', release, sheet: true });
    } else {
      setUpdateState({ phase: 'current', release: undefined });
    }
  } catch (e) {
    // A failed background check stays silent; a manual one shows why.
    setUpdateState({ phase: manual ? 'error' : 'idle', error: manual ? message(e) : undefined });
  }
}

export async function installUpdate(): Promise<void> {
  const { release, phase } = getUpdateState();
  if (!release || phase === 'downloading' || phase === 'installing') return;
  try {
    const file = new File(Paths.cache, `EasyLift-${release.version}.apk`);
    // Reuse a finished download (e.g. the user backed out of the installer once).
    if (!(file.exists && release.sizeBytes > 0 && file.size === release.sizeBytes)) {
      if (file.exists) file.delete();
      setUpdateState({ phase: 'downloading', progress: 0, error: undefined });
      await File.downloadFileAsync(release.apkUrl, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          const total = totalBytes > 0 ? totalBytes : release.sizeBytes;
          setUpdateState({ progress: total > 0 ? Math.min(1, bytesWritten / total) : null });
        },
      });
    }
    setUpdateState({ phase: 'installing', progress: 1 });
    // Opens the system installer. If the user installs, Android replaces and restarts the app;
    // if they cancel, we come back here and the sheet offers the update again.
    await startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
    setUpdateState({ phase: 'available' });
  } catch (e) {
    setUpdateState({ phase: 'available', error: message(e) });
  }
}

function message(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return /network|fetch|timed? ?out|unable to resolve/i.test(text) ? 'No connection. Try again when you are online.' : text;
}
