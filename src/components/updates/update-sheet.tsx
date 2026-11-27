import { useEffect, useRef } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useActiveWorkout } from '@/lib/data/queries';
import { formatMegabytes } from '@/lib/updates-core';
import {
  checkForUpdate,
  closeUpdateSheet,
  installedVersion,
  installUpdate,
  updatesSupported,
  useUpdateState,
} from '@/lib/updates';
import { radius, space, useColors } from '@/theme';

/** Background checks run at most this often (on launch and when the app comes back). */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * "Update available" sheet for the Android APK. Checks GitHub Releases on launch and on
 * returning to the app (not in dev builds, and not during a workout); Profile → "Check for
 * updates" opens it on demand.
 */
export function UpdateSheet() {
  const working = !!useActiveWorkout();
  useAutoCheck(updatesSupported && !__DEV__ && !working);
  const s = useUpdateState();
  const c = useColors();
  const insets = useSafeAreaInsets();
  if (!updatesSupported || !s.release) return null;

  const busy = s.phase === 'downloading' || s.phase === 'installing';
  const pct = s.progress == null ? null : Math.round(s.progress * 100);
  const label =
    s.phase === 'downloading'
      ? pct == null
        ? 'Downloading…'
        : `Downloading… ${pct}%`
      : s.phase === 'installing'
        ? 'Opening installer…'
        : 'Update';

  return (
    <Modal
      visible={s.sheet}
      transparent
      animationType="fade"
      onRequestClose={closeUpdateSheet}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeUpdateSheet} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Icon name="download" size={22} color={c.onAccent} />
            </View>
            <View style={styles.flex}>
              <Text variant="headline">Update available</Text>
              <Text variant="label" tone="textSecondary">
                {installedVersion ? `${installedVersion} → ` : ''}
                {s.release.version}
                {s.release.sizeBytes > 0 ? ` · ${formatMegabytes(s.release.sizeBytes)}` : ''}
              </Text>
            </View>
          </View>

          {s.release.notes ? (
            <ScrollView style={[styles.notes, { backgroundColor: c.field }]} contentContainerStyle={styles.notesContent}>
              <Text variant="caption" tone="textMuted">
                WHAT&apos;S NEW
              </Text>
              <Text variant="body" tone="textSecondary">
                {s.release.notes}
              </Text>
            </ScrollView>
          ) : null}

          {s.phase === 'downloading' ? (
            <View style={[styles.track, { backgroundColor: c.field }]}>
              <View style={[styles.fill, { backgroundColor: c.accent, width: `${pct ?? 100}%`, opacity: pct == null ? 0.5 : 1 }]} />
            </View>
          ) : null}

          {s.error ? (
            <Text variant="label" style={{ color: c.danger }}>
              {s.error}
            </Text>
          ) : null}

          <Text variant="caption" tone="textMuted">
            Android will ask you to confirm the install. Your workouts stay on this device and in your account.
          </Text>

          <Button label={label} variant="primary" icon="download" loading={busy} onPress={installUpdate} />
          <Button label="Later" variant="ghost" onPress={closeUpdateSheet} />
        </View>
      </View>
    </Modal>
  );
}

function useAutoCheck(enabled: boolean) {
  const last = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (Date.now() - last.current < CHECK_EVERY_MS) return;
      last.current = Date.now();
      checkForUpdate({ manual: false });
    };
    run();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => sub.remove();
  }, [enabled]);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  notes: { maxHeight: 220, borderRadius: radius.card },
  notesContent: { padding: space.md, gap: space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
