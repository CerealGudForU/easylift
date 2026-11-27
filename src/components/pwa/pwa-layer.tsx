// Web/PWA only (the native app uses pwa-layer.native.tsx, which renders nothing).
// - Registers the service worker that lets the installed app open offline.
// - Shows "New version available" when an update has downloaded. It only reloads when
//   tapped (an active workout is stored on the device, so it survives the reload).
// - On iPhone/iPad in the browser, explains how to add EasyLift to the Home Screen.
// - Keeps the screen awake while a workout is in progress.
// - Asks the browser to keep this site's data (the offline workout log) from being evicted.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useActiveWorkout } from '@/lib/data/queries';
import { radius, size, space, useColors } from '@/theme';

const INSTALL_DISMISSED = 'easylift:install-guide-dismissed';

export function PwaLayer() {
  const insets = useSafeAreaInsets();
  const working = !!useActiveWorkout();
  const update = useServiceWorker();
  const [install, setInstall] = useState(shouldShowInstallGuide);
  useWakeLock(working);

  const showUpdate = !!update;
  if (!showUpdate && !install) return null;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { paddingTop: insets.top + space.sm }]}>
      {showUpdate ? <UpdateBanner onReload={update} /> : null}
      {install && !showUpdate ? (
        <InstallGuide
          onClose={() => {
            setInstall(false);
            try {
              localStorage.setItem(INSTALL_DISMISSED, '1');
            } catch {}
          }}
        />
      ) : null}
    </View>
  );
}

function UpdateBanner({ onReload }: { onReload: () => void }) {
  const c = useColors();
  return (
    <View accessibilityRole="alert" style={[styles.card, styles.row, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
      <Icon name="update" size={22} color={c.accent} />
      <Text variant="headline" style={styles.flex}>
        New version available
      </Text>
      <Button label="Reload" variant="primary" compact onPress={onReload} />
    </View>
  );
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
      <View style={styles.row}>
        <Text variant="headline" style={styles.flex}>
          Install EasyLift
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close install guide" style={styles.close}>
          <Icon name="close" size={22} color={c.textSecondary} />
        </Pressable>
      </View>
      <Text variant="body" tone="textSecondary">
        Add it to your Home Screen to use it full screen and offline:
      </Text>
      <View style={styles.step}>
        <Text variant="body">1. Tap</Text>
        <Icon name="export-variant" size={20} color={c.accent} accessibilityLabel="Share" />
        <Text variant="body">Share in the browser bar</Text>
      </View>
      <View style={styles.step}>
        <Text variant="body">2. Choose</Text>
        <Icon name="plus-box-outline" size={20} color={c.accent} />
        <Text variant="body">Add to Home Screen</Text>
      </View>
    </View>
  );
}

/** iPhone/iPad, in a browser tab (not already opened from the Home Screen), not dismissed. */
function shouldShowInstallGuide(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  try {
    return ios && !standalone && localStorage.getItem(INSTALL_DISMISSED) !== '1';
  } catch {
    return ios && !standalone;
  }
}

/**
 * Registers sw.js (production builds only: in development Metro serves changing files).
 * A new version downloads in the background and takes over the service worker at once;
 * this page keeps running its current code. Returns a reload function once that has
 * happened (for the "New version available" banner), otherwise null.
 */
function useServiceWorker(): (() => void) | null {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
    if (__DEV__ || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    let reg: ServiceWorkerRegistration | undefined;
    // The very first install also takes control, but that isn't an update.
    let hadController = !!sw.controller;

    const onController = () => {
      if (hadController) setUpdated(true);
      hadController = true;
    };
    // Look for a new version whenever the app comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };

    sw.register('/sw.js')
      .then((r) => {
        reg = r;
      })
      .catch(() => {});
    document.addEventListener('visibilitychange', onVisible);
    sw.addEventListener('controllerchange', onController);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      sw.removeEventListener('controllerchange', onController);
    };
  }, []);

  return updated ? () => location.reload() : null;
}

/** Keeps the screen on while `on` (Screen Wake Lock API; re-acquired when the app returns). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const acquire = async () => {
      if (done || lock || document.visibilityState !== 'visible') return;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (done) {
          l.release().catch(() => {});
          return;
        }
        lock = l;
        l.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // Refused (e.g. low battery mode): the workout still works, the screen may dim.
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', acquire);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  close: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center', margin: -space.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
});
