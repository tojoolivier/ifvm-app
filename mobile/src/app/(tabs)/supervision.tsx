import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SupervisionScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <ThemedText type="title" style={{ fontSize: 32 }}>Supervision</ThemedText>
      <ThemedText type="default" style={{ marginTop: 8, textAlign: 'center' }}>
        Supervision de l&apos;équipe terrain
      </ThemedText>
    </ThemedView>
  );
}
