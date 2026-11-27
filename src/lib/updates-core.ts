// Pure helpers for the Android in-app updater (no native modules, so Vitest can run them).

/** The GitHub repository the APKs are released from. */
export const RELEASES_REPO = 'CerealGudForU/easylift';
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
/** The release asset with a fixed name (the workflow uploads it next to EasyLift-<version>.apk). */
export const APK_ASSET = 'EasyLift.apk';

export type Release = {
  version: string;
  notes: string;
  apkUrl: string;
  sizeBytes: number;
  url: string;
};

/** "v1.2.3" or "1.2.3" -> [1, 2, 3]; null for anything else. */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec((v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `candidate` is a strictly newer version than `installed`. */
export function isNewer(candidate: string, installed: string | null | undefined): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(installed);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

type GitHubRelease = {
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name?: string; browser_download_url?: string; size?: number }[];
};

/** Reads GitHub's "latest release" JSON; null when it isn't a usable APK release. */
export function toRelease(json: unknown): Release | null {
  const r = json as GitHubRelease | null;
  if (!r || r.draft || r.prerelease || !parseVersion(r.tag_name)) return null;
  const apk = r.assets?.find((a) => a.name === APK_ASSET) ?? r.assets?.find((a) => a.name?.endsWith('.apk'));
  if (!apk?.browser_download_url) return null;
  return {
    version: r.tag_name!.replace(/^v/, ''),
    notes: cleanNotes(r.body ?? ''),
    apkUrl: apk.browser_download_url,
    sizeBytes: apk.size ?? 0,
    url: r.html_url ?? '',
  };
}

/** Release notes are Markdown; show them as plain text (headings, bold, links unwrapped). */
export function cleanNotes(md: string): string {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}
