import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { EquipeLocale } from '@/lib/referentiel-db';
import { BadgeTypeEquipe } from './EquipeBadge';
import { EQ } from './tokens';

interface Props {
  equipes: EquipeLocale[];
  equipeId: string | null;
  onChoisir: (equipeId: string) => void;
}

/**
 * Liste à choix unique de l'équipe de travail (#641, Figma « Paramètres ») : le choix s'applique
 * tout de suite, sans bouton de confirmation. L'avertissement rappelle la portée du choix.
 */
export function EquipeRadioList({ equipes, equipeId, onChoisir }: Props) {
  return (
    <View style={styles.racine}>
      {equipes.map((equipe) => {
        const choisie = equipe.id === equipeId;
        return (
          <TouchableOpacity
            key={equipe.id}
            style={[styles.carte, choisie && styles.carteChoisie]}
            onPress={() => onChoisir(equipe.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: choisie }}
          >
            <View style={[styles.radio, choisie && styles.radioChoisi]}>{choisie && <View style={styles.point} />}</View>
            <View style={styles.texte}>
              <ThemedText style={styles.nom}>{equipe.nom}</ThemedText>
              <ThemedText style={styles.meta}>
                {equipe.type === 'aerien' ? 'Aérienne' : 'Terrestre'} · {equipe.nb_membres} membres
              </ThemedText>
            </View>
            <BadgeTypeEquipe type={equipe.type} />
          </TouchableOpacity>
        );
      })}
      <View style={styles.avertissement}>
        <ThemedText style={styles.avertissementTexte}>
          Utilisée par défaut pour les prospections, traitements, vols et mouvements de stock. Les brouillons
          gardent leur équipe d&apos;origine.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { gap: 7 },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  carteChoisie: { borderWidth: 1.5, borderColor: EQ.vert },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: EQ.bordure, alignItems: 'center', justifyContent: 'center' },
  radioChoisi: { borderColor: EQ.vert },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: EQ.vert },
  texte: { flex: 1, gap: 2 },
  nom: { fontSize: 13, fontWeight: '700', color: EQ.encre },
  meta: { fontSize: 10.5, fontWeight: '500', color: EQ.attenue },
  avertissement: { marginTop: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  avertissementTexte: { fontSize: 11, fontWeight: '500', lineHeight: 15, color: EQ.ambre },
});
