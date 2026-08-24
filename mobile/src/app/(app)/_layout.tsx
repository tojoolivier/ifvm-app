import { Stack } from 'expo-router';
import { useReferentielAutoSync } from '@/hooks/use-referentiel-auto-sync';
import { useAuthStore } from '@/lib/auth-store';

export default function TabLayout() {
  const token = useAuthStore((s) => s.token);
  
  // Synchronisation automatique des référentiels au démarrage
  useReferentielAutoSync(token);
  
  return <Stack screenOptions={{ headerShown: false }} />;
}