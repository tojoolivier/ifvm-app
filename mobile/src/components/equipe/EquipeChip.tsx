import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { EquipeLocale } from '@/lib/referentiel-db';
import { EquipeBadge } from './EquipeBadge';
import { EQ } from './tokens';

interface Props {
  equipe: EquipeLocale | null;
  onChanger: () => void;
}

/**
 * Puce « Équipe active » de l'en-tête de l'Accueil (Figma « EquipeChip ») : l'équipe reprise par
 * toute nouvelle saisie, ou une invitation à en définir une. Ouvre la feuille de choix d'équipe.
 */
export function EquipeChip({ equipe, onChanger }: Props) {
  if (!equipe) {
    return (
      <View style={[styles.chip, styles.chipVide]} testID="equipe-chip-vide">
        <View style={styles.texte}>
          <ThemedText style={[styles.etiquette, styles.etiquetteVide]}>AUCUNE ÉQUIPE ACTIVE</ThemedText>
          <ThemedText style={[styles.aide, styles.aideVide]}>Choisissez ou créez votre équipe</ThemedText>
        </View>
        <TouchableOpacity style={styles.definir} onPress={onChanger} accessibilityRole="button">
          <ThemedText style={styles.definirTexte}>Définir l’équipe</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.chip} testID="equipe-chip">
      <View style={styles.texte}>
        <ThemedText style={styles.etiquette}>ÉQUIPE ACTIVE</ThemedText>
        <ThemedText style={styles.nom} numberOfLines={1}>
          {equipe.nom}
        </ThemedText>
      </View>
      {/* `EquipeBadge` s'aligne en haut (`alignSelf: flex-start`) : ce conteneur le recentre avec le reste de la ligne. */}
      <View style={styles.badgeCentre}>
        <EquipeBadge texte={equipe.type === 'aerien' ? 'AÉRIENNE' : 'TERRESTRE'} ton={equipe.type === 'aerien' ? 'vertDoux' : 'ambre'} />
      </View>
      <TouchableOpacity
        onPress={onChanger}
        accessibilityRole="button"
        accessibilityLabel="Changer d'équipe de travail"
        hitSlop={8}
      >
        <ThemedText style={styles.changer}>Changer ›</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: EQ.surVertClair,
  },
  chipVide: {
    backgroundColor: EQ.ambreFond,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: EQ.ambre,
  },
  etiquetteVide: { color: EQ.ambre, opacity: 1 },
  aideVide: { color: EQ.ambre },
  texte: { flex: 1, gap: 2 },
  badgeCentre: { alignSelf: 'center' },
  etiquette: { fontSize: 9, fontWeight: '500', opacity: 0.75, color: EQ.surMarque },
  nom: { fontSize: 12, fontWeight: '600', color: EQ.surMarque },
  aide: { fontSize: 10.5, color: EQ.surMarque },
  changer: { fontSize: 9, fontWeight: '700', color: EQ.surMarque },
  definir: { backgroundColor: EQ.ambre, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  definirTexte: { fontSize: 9, fontWeight: '700', color: EQ.surMarque },
});
