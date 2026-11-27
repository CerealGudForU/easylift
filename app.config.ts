// Extends app.json. A release build passes its git tag as APP_VERSION (e.g. "1.2.3" from
// tag v1.2.3); the version shown to users comes from it, and Android's versionCode is
// derived from it (1.2.3 -> 10203), so every newer tag installs over the older APK.
import type { ConfigContext, ExpoConfig } from 'expo/config';

export function versionCode(version: string): number {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`APP_VERSION must look like 1.2.3, got "${version}"`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error(`minor and patch must be at most 99: ${version}`);
  return major * 10000 + minor * 100 + patch;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const version = (process.env.APP_VERSION || config.version || '0.1.0').replace(/^v/, '');
  return {
    ...(config as ExpoConfig),
    version,
    android: { ...config.android, versionCode: versionCode(version) },
  };
};
