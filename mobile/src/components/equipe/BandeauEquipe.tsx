import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';
import type { EquipeLocale } from '@/lib/referentiel-db';
import { BadgeTypeEquipe } from './EquipeBadge';
import { EQ } from './tokens';

interface Props {
  equipe: Pick<EquipeLocale, 'nom' | 'type'> | null;
  /** Par défaut ouvre la feuille globale ; à fournir quand l'appelant doit d'abord fermer sa propre modale. */
  onChanger?: () => void;
}

/**
 * Bandeau « Équipe · type · Changer » (#678) : rappelle l'équipe de travail qui sert de contexte à
 * l'écran — menu « Nouvelle fiche », « Mes fiches » — et permet d'en changer sans passer par
 * l'Accueil. Version compacte de l'`EquipeChip` de l'en-tête, pour un fond clair.
 */
export function BandeauEquipe({ equipe, onChanger }: Props) {
  const ouvrir = useEquipeSheetStore((s) => s.ouvrir);
  const changer = onChanger ?? ouvrir;

  if (!equipe) {
    return (
      <TouchableOpacity
        testID="bandeau-equipe-vide"
        style={[styles.bandeau, styles.vide]}
        onPress={changer}
        accessibilityRole="button"
      >
        <ThemedText style={styles.videTexte}>Aucune équipe active</ThemedText>
        <ThemedText style={styles.videAction}>Définir l’équipe ›</ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <View testID="bandeau-equipe" style={styles.bandeau}>
      <ThemedText style={styles.nom} numberOfLines={1}>
        {equipe.nom}
      </ThemedText>
      {/* `EquipeBadge` s'aligne en haut (`alignSelf: flex-start`) : ce conteneur le recentre sur la ligne. */}
      <View style={styles.badgeCentre}>
        <BadgeTypeEquipe type={equipe.type} />
      </View>
      <TouchableOpacity onPress={changer} accessibilityRole="button" accessibilityLabel="Changer d'équipe de travail" hitSlop={8}>
        <ThemedText style={styles.changer}>Changer ›</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.vertBordure,
    backgroundColor: EQ.vertLeger,
  },
  vide: {
    justifyContent: 'space-between',
    borderStyle: 'dashed',
    borderColor: EQ.ambre,
    backgroundColor: EQ.ambreFond,
  },
  badgeCentre: { alignSelf: 'center' },
  nom: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: EQ.vert },
  changer: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.vert },
  videTexte: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: EQ.ambre },
  videAction: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: EQ.ambre },
});
