
import './global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const isOnSplash = !segments[0] || segments[0] === 'index';
      const isOnAuthScreen = segments[0] === 'login' || segments[0] === 'register';
      const inTabsArea = segments[0] === '(tabs)';
      
      // Let splash screen be shown - don't interfere
      if (isOnSplash) {
        return;
      }

      // Only redirect if user tries to access tabs without auth
      if (inTabsArea && !user) {
        router.replace('/login');
      }
      // Don't redirect from login/register - let those screens handle auth checks
      // (They will show the form if not authenticated, or redirect if already authenticated)
    });

    return unsubscribe;
  }, [segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-group" />
      <Stack.Screen name="group-details" />
      <Stack.Screen name="all-groups" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}