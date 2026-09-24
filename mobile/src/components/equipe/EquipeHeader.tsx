import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { EQ } from './tokens';

interface Props {
  titre: string;
  sousTitre?: string;
  onRetour: () => void;
  /** `liste` : bandeau vert (M/Header liste) ; `formulaire` : sur le fond clair (M/Header formulaire). */
  variante?: 'liste' | 'formulaire';
  action?: { libelle: string; onPress: () => void };
}

/** En-tête des écrans Équipes (#641) : flèche de retour, titre, sous-titre, action facultative. */
export function EquipeHeader({ titre, sousTitre, onRetour, variante = 'liste', action }: Props) {
  const liste = variante === 'liste';
  return (
    <SafeAreaView edges={['top']} style={liste ? styles.zoneListe : styles.zoneFormulaire}>
      <View style={styles.ligne}>
        <TouchableOpacity onPress={onRetour} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={12}>
          <ThemedText style={[styles.fleche, { color: liste ? EQ.surMarque : EQ.attenue }]}>←</ThemedText>
        </TouchableOpacity>
        <View style={styles.titres}>
          <ThemedText style={[liste ? styles.titreListe : styles.titreFormulaire, { color: liste ? EQ.surMarque : EQ.encre }]}>
            {titre}
          </ThemedText>
          {sousTitre ? (
            <ThemedText style={[styles.sousTitre, { color: liste ? EQ.surMarque : EQ.attenue }]}>{sousTitre}</ThemedText>
          ) : null}
        </View>
        {action && (
          <TouchableOpacity onPress={action.onPress} accessibilityRole="button">
            <ThemedText style={[styles.action, { color: liste ? EQ.surMarque : EQ.vert }]}>{action.libelle}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  zoneListe: { backgroundColor: EQ.vert },
  zoneFormulaire: { backgroundColor: EQ.fond },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  fleche: { fontSize: 20, fontWeight: '700' },
  titres: { flex: 1, gap: 1 },
  // Interlignes explicites : sans elles `ThemedText` impose 24 px et le bandeau dépasse les 56 px du Figma.
  titreListe: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  titreFormulaire: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  sousTitre: { fontSize: 10.5, lineHeight: 13, opacity: 0.85 },
  action: { fontSize: 12, lineHeight: 15, fontWeight: '700' },
});
