import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/tabs';

import { Icon, type IconName } from '@/components/ui/icon';
import { ActiveWorkoutBar } from '@/components/workout/active-workout-bar';
import { fonts, useColors } from '@/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color }: { color: unknown }) {
    return <Icon name={name} size={26} color={String(color)} />;
  };

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => (
        <>
          <ActiveWorkoutBar />
          <BottomTabBar {...props} />
        </>
      )}
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
