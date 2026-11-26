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
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useDataReady } from '@/lib/data/provider';
import { SessionProvider, useSession } from '@/lib/session';
import { useColors, useScheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  // On Android the fonts are already embedded by the expo-font plugin; this mainly loads them on web.
  const [loaded, error] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const { session, loading } = useSession();
  const scheme = useScheme();
  const c = useColors();
  const dataReady = useDataReady();
  const ready = (loaded || !!error) && !loading && dataReady;

  // Keep the splash up until fonts and the stored session are both ready, so there's
  // no flash of the sign-in screen for someone who is already signed in (and their
  // local data is loaded before the first screen renders).
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surfaceRaised, text: c.text, border: c.border, primary: c.accent },
  };
  const signedIn = !!session;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="workout/[id]" />
          <Stack.Screen name="exercises/pick" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="exercises/new" />
          <Stack.Screen name="exercises/all" />
          <Stack.Screen name="exercises/[id]" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="routine/[id]" options={{ animation: 'slide_from_bottom' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
