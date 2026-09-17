import { StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Styles partagés entre AerienForm et TerrestreForm (écran C, extrait de
 * traitement.tsx — #91). Les deux branches aérien/terrestre du formulaire
 * réutilisaient déjà exactement les mêmes tokens avant la scission.
 */
export const formStyles = StyleSheet.create({
  // Semi-gras (au lieu de uiMedium) : demande explicite, titres de champ plus
  // visibles sur les fiches de traitement (Équipe, Pesticides & rotations).
  label: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
  // Enveloppe du <Picker> natif (référentiel lieu_aerien, #equipe-slide-aerien) —
  // même gabarit que `input`, sans hauteur fixe : le Picker natif porte sa propre
  // hauteur tactile (~44-50), un `minHeight` en plus créerait un double espacement
  // (même remarque que `aerienFieldPickerBox` côté prospection extensive-reference.tsx).
  pickerBox: {
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  picker: { color: traitementColors.texteTitre },
  warningText: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.avertissementTexte },
  rotationCard: { gap: 8 },
  rotationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rotationTitle: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  removeButton: { fontFamily: traitementFonts.uiBold, fontSize: 18, color: traitementColors.danger, padding: 6 },
  addButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.chip,
  },
  addButtonText: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal, fontSize: traitementTypeSizes.corps },
  derivedValue: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.valeurDerivee, color: traitementColors.vertPrincipal },
  restanteCard: { backgroundColor: traitementColors.avertissementTexte },
});
