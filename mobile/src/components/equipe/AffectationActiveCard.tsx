import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { EQ } from './tokens';

interface Props {
  immatriculation: string;
  societe: string;
  equipeNom?: string | null;
  /** Début de l'affectation, déjà formaté (« 01/09/2026 »). */
  depuis: string;
  jours: number;
}

/** Carte « AFFECTATION ACTIVE » du parc aéronefs (Figma 81:692) : l'appareil en service mis en avant. */
export function AffectationActiveCard({ immatriculation, societe, equipeNom, depuis, jours }: Props) {
  return (
    <View style={styles.carte} accessibilityLabel={`Affectation active : ${immatriculation}`}>
      <ThemedText style={styles.etiquette}>AFFECTATION ACTIVE</ThemedText>
      <ThemedText style={styles.immat}>{immatriculation}</ThemedText>
      <ThemedText style={styles.societe}>{societe}</ThemedText>
      {equipeNom ? <ThemedText style={styles.equipe}>{equipeNom}</ThemedText> : null}
      <View style={styles.meta}>
        <ThemedText style={styles.depuis}>{`Depuis le ${depuis}`}</ThemedText>
        <ThemedText style={styles.jours}>{jours <= 1 ? `${jours} jour` : `${jours} jours`}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: 13, borderWidth: 1.5, borderColor: EQ.vert, backgroundColor: EQ.carte, padding: 8, gap: 2 },
  etiquette: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: EQ.vert },
  immat: { fontSize: 16, fontWeight: '700', fontFamily: 'monospace', color: EQ.encre },
  societe: { fontSize: 10.5, fontWeight: '500', color: EQ.attenue },
  equipe: { fontSize: 10.5, fontWeight: '600', color: EQ.vert },
  meta: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    backgroundColor: EQ.fond,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  depuis: { fontSize: 9, fontWeight: '500', color: EQ.etiquette },
  jours: { fontSize: 9, fontWeight: '600', color: EQ.encre },
});
