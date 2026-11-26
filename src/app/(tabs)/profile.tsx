import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { signOut } from '@/lib/auth';
import { useUsername } from '@/lib/session';
import { space, useColors } from '@/theme';

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const username = useUsername();

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.lg }]}>
      <Text variant="title">Profile</Text>

      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={[styles.avatar, { backgroundColor: c.field }]}>
          <Text variant="title" tone="accent">
            {(username ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="headline">{username ?? 'Signed in'}</Text>
          <Text variant="caption" tone="textMuted">
            Friends find you by this username
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <Icon name="chart-line" size={32} color={c.accent} />
        <Text variant="headline" style={styles.text}>
          Your progress lives here
        </Text>
        <Text variant="body" tone="textSecondary" style={styles.text}>
          Finish your first workout to see volume, records, and streaks.
        </Text>
      </View>

      <Button label="Sign out" variant="destructive" icon="logout" onPress={signOut} style={styles.signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.lg, gap: space.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 16, borderCurve: 'continuous' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  text: { textAlign: 'center', maxWidth: 300 },
  signOut: { marginBottom: space.lg },
});
