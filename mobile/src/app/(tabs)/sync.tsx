import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SyncScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <ThemedText type="title" style={{ fontSize: 32 }}>Synchronisation</ThemedText>
      <ThemedText type="default" style={{ marginTop: 8, textAlign: 'center' }}>
        Synchronisation des données hors-ligne
      </ThemedText>
    </ThemedView>
  );
}
