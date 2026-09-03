import { useMemo, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Pesticide } from '@/lib/referentiel-db';
import { traitementColors, traitementFonts, traitementRadii, traitementSpacing, traitementTypeSizes } from './tokens';
import { formStyles } from './TraitementFormStyles';

interface ProduitSelectFieldProps {
  pesticides: Pesticide[];
  selectedId: string | null | undefined;
  onSelect: (pesticide: Pesticide) => void;
  readOnly?: boolean;
  placeholder?: string;
}

/**
 * Champ « Produit / matières actives » : un déclencheur affichant le produit choisi
 * (ou un placeholder), qui ouvre une liste de sélection avec recherche — remplace
 * l'ancien affichage en chips (tous les produits visibles simultanément), illisible
 * avec les 54 entrées du référentiel `pesticide`. Un seul produit sélectionnable à
 * la fois ; réutilisé à l'identique par TerrestreForm et AerienForm.
 */
export function ProduitSelectField({
  pesticides,
  selectedId,
  onSelect,
  readOnly,
  placeholder = 'Sélectionner un produit',
}: ProduitSelectFieldProps) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');

  const selectionne = useMemo(() => pesticides.find((p) => p.id === selectedId) ?? null, [pesticides, selectedId]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return pesticides;
    return pesticides.filter((p) => p.nom.toLowerCase().includes(q));
  }, [pesticides, recherche]);

  function fermer() {
    setOuvert(false);
    setRecherche('');
  }

  return (
    <View>
      <TouchableOpacity
        disabled={readOnly}
        accessibilityRole="button"
        onPress={() => setOuvert(true)}
        style={[formStyles.input, styles.declencheur]}
      >
        <Text style={[styles.declencheurTexte, !selectionne && styles.placeholder]} numberOfLines={1}>
          {selectionne ? selectionne.nom : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={ouvert} onRequestClose={fermer}>
        <View style={styles.voile}>
          <View style={styles.carte} accessibilityRole="none">
            <Text style={styles.titre}>Produits disponibles</Text>
            <TextInput
              style={formStyles.input}
              placeholder="Rechercher un produit"
              value={recherche}
              onChangeText={setRecherche}
              autoFocus
            />
            <FlatList
              data={filtres}
              keyExtractor={(p) => p.id}
              style={styles.liste}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.vide}>Aucun produit ne correspond.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.ligne}
                  onPress={() => {
                    onSelect(item);
                    fermer();
                  }}
                >
                  <Text style={styles.ligneTexte}>{item.nom}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity accessibilityRole="button" onPress={fermer}>
              <Text style={styles.lien}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  declencheur: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  declencheurTexte: { flex: 1, fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  placeholder: { color: traitementColors.texteLabel },
  chevron: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire, marginLeft: 8 },
  voile: { flex: 1, backgroundColor: 'rgba(22,32,26,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  carte: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    backgroundColor: traitementColors.carte,
    borderRadius: traitementRadii.carte,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    padding: traitementSpacing.paddingCarte * 1.5,
    gap: traitementSpacing.gapLarge,
  },
  titre: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  liste: { flexGrow: 0 },
  vide: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteLabel, padding: 12 },
  ligne: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: traitementColors.bordure },
  ligneTexte: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  lien: { color: traitementColors.texteSecondaire, fontSize: traitementTypeSizes.corps, fontFamily: traitementFonts.uiSemiBold, textAlign: 'center', paddingVertical: 8 },
});
