import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ProspectionScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <ThemedText type="title" style={{ fontSize: 32 }}>Prospection</ThemedText>
      <ThemedText type="default" style={{ marginTop: 8, textAlign: 'center' }}>
        Gestion des postes acridiens et cartes de prospection
      </ThemedText>
    </ThemedView>
  );
}
