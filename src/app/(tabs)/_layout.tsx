import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/icon';
import { fonts, useColors } from '@/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color }: { color: unknown }) {
    return <Icon name={name} size={26} color={String(color)} />;
  };

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surfaceRaised, borderTopColor: c.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: tabIcon('account-group-outline') }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout', tabBarIcon: tabIcon('dumbbell') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('account-outline') }} />
    </Tabs>
  );
}
