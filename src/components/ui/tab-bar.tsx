// EasyLift's bottom tab bar, with the "workout in progress" bar above it.
//
// Drawn by hand instead of React Navigation's BottomTabBar: that one renders every
// icon twice (active + inactive) in wrappers that fade between opacity 1 and 0. On
// Android (Fabric) the flattening of those wrappers re-parents the icon text on each
// tab switch, and after finishing or discarding a workout that crashed the app with
// "addViewAt: … The specified child already has a parent". Here each tab is one icon
// whose colour changes, so nothing moves between parents.
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActiveWorkoutBar } from '@/components/workout/active-workout-bar';
import { fonts, space, useColors } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Feed', icon: 'account-group-outline' },
  workout: { label: 'Workout', icon: 'dumbbell' },
  profile: { label: 'Profile', icon: 'account-outline' },
};

export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const c = useColors();
  return (
    <View collapsable={false}>
      <ActiveWorkoutBar />
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          { backgroundColor: c.surfaceRaised, borderTopColor: c.border, paddingBottom: insets.bottom },
        ]}>
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const color = focused ? c.accent : c.textMuted;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.tab}>
              <Icon name={tab.icon} size={26} color={color} />
              <Text variant="caption" style={[styles.label, { color }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56, paddingTop: space.xs },
  label: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0 },
});
