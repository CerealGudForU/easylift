import * as Haptics from 'expo-haptics';

// Haptics are punctuation: one per user action, never the only feedback. No-ops on web.
const enabled = process.env.EXPO_OS !== 'web';

export const haptic = {
  select: () => enabled && Haptics.selectionAsync().catch(() => {}),
  success: () =>
    enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  heavy: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
};
