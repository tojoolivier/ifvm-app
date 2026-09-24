import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { AffectationLocale } from '@/lib/equipe-db';
import { jourMoisAnnee, joursDepuis } from '@/lib/equipe-regles';
import { EQ } from './tokens';

interface Props {
  affectation: Pick<AffectationLocale, 'immatriculation' | 'societe' | 'date_debut'>;
  /** Date du jour (AAAA-MM-JJ) : la durée est calculée d'ici, pas par chaque écran. */
  aujourdhui: string;
  equipeNom?: string | null;
}

/** Carte « AFFECTATION ACTIVE » du parc aéronefs (Figma 81:692) : l'appareil en service mis en avant. */
export function AffectationActiveCard({ affectation, aujourdhui, equipeNom }: Props) {
  const { immatriculation, societe, date_debut } = affectation;
  const jours = joursDepuis(date_debut, aujourdhui);
  return (
    <View style={styles.carte} accessibilityLabel={`Affectation active : ${immatriculation}`}>
      <ThemedText style={styles.etiquette}>AFFECTATION ACTIVE</ThemedText>
      <ThemedText style={styles.immat}>{immatriculation}</ThemedText>
      <ThemedText style={styles.societe}>{societe}</ThemedText>
      {equipeNom ? <ThemedText style={styles.equipe}>{equipeNom}</ThemedText> : null}
      <View style={styles.meta}>
        <ThemedText style={styles.depuis}>{`Depuis le ${jourMoisAnnee(date_debut)}`}</ThemedText>
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
