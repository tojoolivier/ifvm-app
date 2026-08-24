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
import { demarrerApp, messageDeDemarrageManque } from '@/lib/app-startup';
import { installerTransportJournal, purgerJournal } from '@/lib/journal-db';
import { useErrorStore } from '@/lib/error-store';
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
    // Le journal en premier, et de façon synchrone : ce qui échoue avant que
    // le transport ne soit branché reste dans l'anneau mémoire et disparaît à
    // la fermeture de l'app — donc n'atteint jamais le support.
    installerTransportJournal();

    // Posé ensuite, et de façon synchrone : la phase la plus risquée du cycle
    // de vie est celle qui suit immédiatement, pas celle qui la précède.
    installGlobalErrorHandlers();

    // `demarrerApp` ne rejette jamais — le `void` dit que c'est délibéré, pas
    // oublié. Le traitement de `essential` est INFORMER : l'agent continue son
    // travail, mais il doit savoir que l'appareil n'a pas ouvert son stockage.
    void demarrerApp({
      ouvrirBase: getDb,
      initDebug: () => useDebugStore.getState().init(),
      // Le flag debug n'est plus un gate d'écriture (ADR-012 décision 4) : il
      // ne fait qu'allonger la rétention des `detail`. Il est relu ici, après
      // `initDebug`, parce que `demarrerApp` séquence la purge derrière lui.
      purgerJournal: () => purgerJournal({ verbeux: useDebugStore.getState().enabled }),
    }).then((outcome) => {
      const message = messageDeDemarrageManque(outcome);
      if (message) useErrorStore.getState().showError({ message });
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