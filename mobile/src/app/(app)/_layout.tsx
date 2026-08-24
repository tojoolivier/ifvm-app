import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error-boundary';
import { useReferentielAutoSync } from '@/hooks/use-referentiel-auto-sync';
import { useAuthStore } from '@/lib/auth-store';

export default function TabLayout() {
  const token = useAuthStore((s) => s.token);
  
  // Synchronisation automatique des référentiels au démarrage
  useReferentielAutoSync(token);
  
  return (
    <RouteErrorBoundary zone="app">
      <Stack screenOptions={{ headerShown: false }} />
    </RouteErrorBoundary>
  );
}