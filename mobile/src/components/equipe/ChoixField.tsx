import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { EQ } from './tokens';

export interface OptionChoix {
  valeur: string;
  libelle: string;
}

interface Props {
  etiquette: string;
  valeur: string | null;
  options: OptionChoix[];
  onChoisir: (valeur: string) => void;
  placeholder?: string;
  /** Fond vert doux des maquettes pour le champ mis en avant (aéronef). */
  accent?: boolean;
}

/**
 * Champ à liste déroulante des maquettes (« ▼ ») : un libellé en petites capitales, la valeur
 * choisie, et une feuille de choix. Hors-ligne : les options viennent du référentiel local.
 */
export function ChoixField({ etiquette, valeur, options, onChoisir, placeholder = '— choisir —', accent = false }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const courante = options.find((o) => o.valeur === valeur);
  return (
    <>
      <TouchableOpacity
        style={[styles.champ, accent && styles.champAccent]}
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel={etiquette}
      >
        <View style={styles.texte}>
          <ThemedText style={[styles.etiquette, accent && { color: EQ.vert }]}>{etiquette}</ThemedText>
          <ThemedText style={styles.valeur}>{courante?.libelle ?? placeholder}</ThemedText>
        </View>
        <ThemedText style={styles.fleche}>▼</ThemedText>
      </TouchableOpacity>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.voile} onPress={() => setOuvert(false)} accessibilityLabel="Fermer" />
        <View style={styles.feuille}>
          <ThemedText style={styles.titre}>{etiquette}</ThemedText>
          <ScrollView>
            {options.length === 0 && <ThemedText style={styles.vide}>Aucun choix disponible.</ThemedText>}
            {options.map((option) => (
              <TouchableOpacity
                key={option.valeur}
                style={styles.option}
                onPress={() => {
                  onChoisir(option.valeur);
                  setOuvert(false);
                }}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.optionTexte, option.valeur === valeur && { color: EQ.vert }]}>
                  {option.libelle}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  champ: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  champAccent: { backgroundColor: EQ.vertDoux, borderColor: EQ.vertBordure },
  texte: { flex: 1, gap: 2 },
  etiquette: { fontSize: 9, fontWeight: '500', textTransform: 'uppercase', color: EQ.etiquette },
  valeur: { fontSize: 13, fontWeight: '700', color: EQ.encre },
  fleche: { fontSize: 10, color: EQ.etiquette },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  feuille: { maxHeight: '60%', padding: 16, backgroundColor: EQ.fond, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  titre: { marginBottom: 8, fontSize: 15, fontWeight: '700', color: EQ.encre },
  vide: { paddingVertical: 12, fontSize: 12, color: EQ.attenue },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: EQ.separateur },
  optionTexte: { fontSize: 13, fontWeight: '600', color: EQ.encre },
});
