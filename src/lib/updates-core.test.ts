import { describe, expect, it } from 'vitest';

import { cleanNotes, isNewer, parseVersion, toRelease } from './updates-core';

describe('parseVersion / isNewer', () => {
  it('reads tags with or without v', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('0.1.0')).toEqual([0, 1, 0]);
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });

  it('compares numerically, not as text', () => {
    expect(isNewer('v0.1.1', '0.1.0')).toBe(true);
    expect(isNewer('v0.10.0', '0.9.9')).toBe(true);
    expect(isNewer('v1.0.0', '0.99.99')).toBe(true);
    expect(isNewer('v0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('v0.1.0', '0.1.1')).toBe(false);
    expect(isNewer('v0.1.1', null)).toBe(false);
  });
});

describe('toRelease', () => {
  const base = {
    tag_name: 'v0.1.1',
    body: '## What\'s new\r\n- **Faster** feed\r\n- See [notes](https://x.y)',
    html_url: 'https://github.com/x/y/releases/tag/v0.1.1',
    assets: [
      { name: 'EasyLift-0.1.1.apk', browser_download_url: 'https://dl/versioned.apk', size: 1 },
      { name: 'EasyLift.apk', browser_download_url: 'https://dl/fixed.apk', size: 52_000_000 },
    ],
  };

  it('prefers the fixed-name APK', () => {
    expect(toRelease(base)).toEqual({
      version: '0.1.1',
      notes: "What's new\n• Faster feed\n• See notes",
      apkUrl: 'https://dl/fixed.apk',
      sizeBytes: 52_000_000,
      url: base.html_url,
    });
  });

  it('skips drafts, pre-releases, bad tags and releases without an APK', () => {
    expect(toRelease({ ...base, draft: true })).toBeNull();
    expect(toRelease({ ...base, prerelease: true })).toBeNull();
    expect(toRelease({ ...base, tag_name: 'latest' })).toBeNull();
    expect(toRelease({ ...base, assets: [{ name: 'notes.txt', browser_download_url: 'x' }] })).toBeNull();
    expect(toRelease({ message: 'Not Found' })).toBeNull();
  });

  it('cleans notes', () => {
    expect(cleanNotes('# A\n\n\n\n* b <!-- hidden -->')).toBe('A\n\n• b');
  });
});
