import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppError } from '@/components/app-error';
import { PwaLayer } from '@/components/pwa/pwa-layer';
import { WebSafeArea } from '@/components/pwa/safe-area';
import { useDataReady } from '@/lib/data/provider';
import { QueryProvider } from '@/lib/query';
import { SessionProvider, useSession } from '@/lib/session';
import { useColors, useScheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// A crash on any screen shows a "Something went wrong · Reload" screen, not a blank one.
export { AppError as ErrorBoundary };

export default function RootLayout() {
  return (
    <WebSafeArea>
      <SessionProvider>
        <QueryProvider>
          <RootNavigator />
        </QueryProvider>
      </SessionProvider>
    </WebSafeArea>
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
          <Stack.Screen name="workout/active" options={{ gestureEnabled: false }} />
          <Stack.Screen name="workout/[id]" />
          {/* Slides up when adding to a workout or routine; "New routine" opens it like any other screen. */}
          <Stack.Screen
            name="exercises/pick"
            options={({ route }) => ({
              animation: (route.params as { new?: string } | undefined)?.new === '1' ? 'default' : 'slide_from_bottom',
            })}
          />
          <Stack.Screen name="exercises/new" />
          <Stack.Screen name="exercises/[id]" />
          <Stack.Screen name="routine/[id]" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="share/[id]" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="user/exercises/[id]" />
          <Stack.Screen name="photo-crop" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>
      <PwaLayer />
    </ThemeProvider>
  );
}
