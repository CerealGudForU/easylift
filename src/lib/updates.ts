// Web and iOS: no APK updates (the PWA updates through its service worker).
// The Android version is updates.android.ts.
export { closeUpdateSheet, useUpdateState } from './updates-store';

export const updatesSupported = false;
export const installedVersion: string | null = null;

export async function checkForUpdate(_opts: { manual: boolean }): Promise<void> {}
export async function installUpdate(): Promise<void> {}
