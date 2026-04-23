import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, ThemeProvider } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LightTheme, DarkTheme } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View, AppState } from 'react-native';
import { syncQueue } from '@/services/syncQueue';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = 'light'; // Force light mode to match UI requirements
  const initialize = useAuthStore((s) => s.initialize);
  const paperTheme = LightTheme;

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, []);

  // Flush queued offline actions whenever the app becomes active (i.e. user returns from background)
  useEffect(() => {
    // Attempt flush on startup
    syncQueue.flush().then(({ success, failed }) => {
      if (success > 0) console.log(`[Sync] Flushed ${success} queued action(s) on startup`);
      if (failed > 0) console.warn(`[Sync] ${failed} action(s) still pending`);
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncQueue.flush().then(({ success, failed }) => {
          if (success > 0) console.log(`[Sync] Flushed ${success} queued action(s) on resume`);
          if (failed > 0) console.warn(`[Sync] ${failed} action(s) still pending`);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={NavDefaultTheme}>
          <AuthGate>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="trip/create" options={{ presentation: 'modal', title: 'New Trip' }} />
              <Stack.Screen name="trip/map/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </AuthGate>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
