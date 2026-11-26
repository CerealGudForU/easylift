// A person's initial in a circle. Photo avatars come later (avatars bucket).
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useColors } from '@/theme';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const c = useColors();
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.field }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text variant="headline" tone="accent" style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
