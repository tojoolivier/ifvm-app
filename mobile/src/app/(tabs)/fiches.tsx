import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function FichesScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <ThemedText type="title" style={{ fontSize: 32 }}>Fiches</ThemedText>
      <ThemedText type="default" style={{ marginTop: 8, textAlign: 'center' }}>
        Gestion des fiches d'observation
      </ThemedText>
    </ThemedView>
  );
}
