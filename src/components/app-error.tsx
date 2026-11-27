// Shown when a screen crashes (exported as the root layout's ErrorBoundary), instead of a
// blank, frozen screen. Workouts are stored on the device, so reloading loses nothing.
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { space, useColors } from '@/theme';

export function AppError({ error, retry }: ErrorBoundaryProps) {
  const c = useColors();
  // The crash may have happened before the splash screen was hidden.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const reload = () => {
    if (process.env.EXPO_OS === 'web') location.reload();
    else retry();
  };
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Icon name="alert-circle-outline" size={40} color={c.accent} />
      <Text variant="title" style={styles.center}>
        Something went wrong
      </Text>
      <Text variant="body" tone="textSecondary" style={styles.center}>
        Your workouts are saved on this device. Reload to carry on.
      </Text>
      <Button label="Reload" variant="primary" icon="refresh" onPress={reload} />
      <Text variant="caption" tone="textMuted" style={styles.center} numberOfLines={3}>
        {error.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl },
  center: { textAlign: 'center' },
});
