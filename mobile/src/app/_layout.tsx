import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { useDebugStore } from '@/lib/debug-store';
import { getDb } from '@/lib/prospection-db';
import { useReferentielAutoSync } from '@/hooks/use-referentiel-auto-sync';
import { ErrorBanner } from '@/components/error-banner';
import { ErrorBoundary } from '@/components/error-boundary';
import { installGlobalErrorHandlers } from '@/lib/global-error-handler';
import { demarrerApp } from '@/lib/app-startup';
import '../global.css';

function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isAuthenticated, isInitialized, segments, router]);
}

export default function RootLayout() {
  useAuthGuard();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const token = useAuthStore((s) => s.token);
  
  // Hook de synchronisation automatique du référentiel
  useReferentielAutoSync(token);

  useEffect(() => {
    // Ces deux tâches étaient des promesses flottantes : un échec de migration
    // SQLite n'avait aucun capteur. `demarrerApp` les passe derrière `runTask`
    // et ne rejette jamais — le `void` dit que c'est délibéré, pas oublié.
    void demarrerApp({
      ouvrirBase: getDb,
      initDebug: () => useDebugStore.getState().init(),
      installerFiletGlobal: installGlobalErrorHandlers,
    });
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Stack>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(prospection)" options={{ headerShown: false }} />
          <Stack.Screen name="(traitement)" options={{ headerShown: false }} />
        </Stack>
      </ErrorBoundary>
      <ErrorBanner />
    </GestureHandlerRootView>
  );
}