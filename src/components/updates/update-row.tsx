import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { checkForUpdate, installedVersion, updatesSupported, useUpdateState } from '@/lib/updates';
import { radius, space, useColors } from '@/theme';
import { setUpdateState } from '@/lib/updates-store';

/** Profile row: the installed version and "Check for updates" (Android app only). */
export function UpdateRow() {
  const c = useColors();
  const s = useUpdateState();
  if (!updatesSupported) return null;

  const status =
    s.phase === 'checking'
      ? 'Checking…'
      : s.phase === 'current'
        ? "You're up to date"
        : s.phase === 'error'
          ? (s.error ?? "Couldn't check")
          : s.release
            ? `Version ${s.release.version} is available`
            : 'Check for updates';

  const onPress = () => {
    if (s.release && s.phase !== 'checking') setUpdateState({ sheet: true });
    else checkForUpdate({ manual: true });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={s.phase === 'checking'}
      accessibilityRole="button"
      accessibilityLabel={`EasyLift ${installedVersion ?? ''}. ${status}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
      <Icon name={s.release ? 'download' : 'update'} size={22} color={s.release ? c.accent : c.textSecondary} />
      <View style={styles.flex}>
        <Text variant="headline">EasyLift {installedVersion}</Text>
        <Text variant="label" tone={s.phase === 'error' ? 'danger' : s.release ? 'accent' : 'textMuted'} numberOfLines={2}>
          {status}
        </Text>
      </View>
      {s.phase === 'checking' ? <ActivityIndicator color={c.textMuted} /> : <Icon name="chevron-right" size={22} color={c.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    minHeight: 64,
  },
  flex: { flex: 1, gap: 2 },
});
