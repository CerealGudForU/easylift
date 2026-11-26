import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, size, space, useColors } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export type SheetAction = { label: string; icon?: IconName; destructive?: boolean; onPress: () => void };

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
};

/**
 * A bottom sheet of actions, also used for confirmations. Works the same on Android
 * and web (React Native's Alert can't show buttons on web).
 */
export function ActionSheet({ visible, title, message, actions, onClose }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          style={[styles.sheet, { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + space.md }]}>
          {title || message ? (
            <View style={styles.head}>
              {title ? <Text variant="headline">{title}</Text> : null}
              {message ? (
                <Text variant="body" tone="textSecondary">
                  {message}
                </Text>
              ) : null}
            </View>
          ) : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onClose();
                a.onPress();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.field : 'transparent' }]}>
              {a.icon ? <Icon name={a.icon} size={22} color={a.destructive ? c.danger : c.textSecondary} /> : null}
              <Text variant="headline" style={{ color: a.destructive ? c.danger : c.text }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancel, { backgroundColor: c.field, opacity: pressed ? 0.75 : 1 }]}>
            <Text variant="headline">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.xs,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  head: { gap: space.xs, paddingBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + 4,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
  },
  cancel: {
    minHeight: size.touch,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
});
