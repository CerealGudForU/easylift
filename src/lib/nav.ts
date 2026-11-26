import { router } from 'expo-router';

/** Back, or to the Workout tab when there's no history (e.g. a refreshed web page). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/workout');
}
