import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';

import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Text } from './text';

type Props = {
  screenTitle: string;
  icon: IconName;
  headline: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

/** A full-screen placeholder: screen title, then a composed empty state with one action. */
export function EmptyScreen({ screenTitle, icon, headline, body, action }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.lg }]}>
      <Text variant="title">{screenTitle}</Text>
      <View style={styles.center}>
        <View style={[styles.badge, { backgroundColor: c.field }]}>
          <Icon name={icon} size={32} color={c.accent} />
        </View>
        <Text variant="headline" style={styles.text}>{headline}</Text>
        <Text variant="body" tone="textSecondary" style={styles.text}>{body}</Text>
        {action ? <Button label={action.label} variant="primary" onPress={action.onPress} style={styles.cta} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingBottom: space.huge },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center', maxWidth: 300 },
  cta: { marginTop: space.sm, alignSelf: 'stretch' },
});
