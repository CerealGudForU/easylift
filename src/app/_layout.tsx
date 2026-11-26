import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { fonts, useColors, useScheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // On Android the fonts are already embedded by the expo-font plugin; this mainly loads them on web.
  const [loaded, error] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const scheme = useScheme();
  const c = useColors();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surfaceRaised, text: c.text, border: c.border, primary: c.accent },
  };

  const tabIcon = (name: IconName) =>
    function TabIcon({ color }: { color: unknown }) {
      return <Icon name={name} size={26} color={String(color)} />;
    };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
    </ThemeProvider>
  );
}
