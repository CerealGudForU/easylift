// A pushed screen's top bar: back arrow and an optional title.
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '@/lib/nav';
import { size, space, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export function ScreenHeader({ title }: { title?: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm, backgroundColor: c.bg }]}>
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Icon name="arrow-left" size={26} color={c.textSecondary} />
      </Pressable>
      {title ? (
        <Text variant="headline" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xs },
  back: { width: size.touch, height: size.touch, justifyContent: 'center' },
  title: { flex: 1 },
});
