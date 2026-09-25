import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { EQ } from '@/components/equipe/tokens';

interface ChampsProps {
  numero: string;
  localite: string;
  onNumero: (valeur: string) => void;
  onLocalite: (valeur: string) => void;
  /** `testID`/étiquettes accessibles : un écran porte plusieurs sites (principal, stand, base). */
  id: string;
  /** Déplacement d'un secondaire : le numéro est repris tel quel (« Numéro » sans astérisque). */
  numeroObligatoire?: boolean;
}

/** Numéro + localité (Figma NumInput / LocInput) : 76 px pour le numéro, le reste pour la localité. */
export function ChampsSite({ numero, localite, onNumero, onLocalite, id, numeroObligatoire = true }: ChampsProps) {
  return (
    <View style={styles.ligne}>
      <View style={styles.numero}>
        <ThemedText style={styles.etiquette}>{numeroObligatoire ? 'Numéro *' : 'Numéro'}</ThemedText>
        <TextInput
          style={styles.saisie}
          value={numero}
          onChangeText={onNumero}
          placeholder="03"
          placeholderTextColor={EQ.etiquette}
          accessibilityLabel={`Numéro ${id}`}
          testID={`${id}-numero`}
        />
      </View>
      <View style={styles.localite}>
        <ThemedText style={styles.etiquette}>Localité *</ThemedText>
        <TextInput
          style={styles.saisie}
          value={localite}
          onChangeText={onLocalite}
          placeholder="Isoanala"
          placeholderTextColor={EQ.etiquette}
          accessibilityLabel={`Localité ${id}`}
          testID={`${id}-localite`}
        />
      </View>
    </View>
  );
}

interface CaseProps {
  coche: boolean;
  onChange: (coche: boolean) => void;
  libelle: string;
  detail?: string;
  testID: string;
}

/** Ligne à case à cocher des maquettes (Figma « Déplacer aussi ») : case 18 px, libellé, détail. */
export function CaseALigne({ coche, onChange, libelle, detail, testID }: CaseProps) {
  return (
    <TouchableOpacity
      style={styles.caseLigne}
      onPress={() => onChange(!coche)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: coche }}
      accessibilityLabel={libelle}
      testID={testID}
    >
      <View style={[styles.case, coche && styles.caseCochee]}>
        {coche && <ThemedText style={styles.coche}>✓</ThemedText>}
      </View>
      <View style={styles.caseTexte}>
        <ThemedText style={styles.caseLibelle}>{libelle}</ThemedText>
        {detail ? <ThemedText style={styles.caseDetail}>{detail}</ThemedText> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 8 },
  numero: { width: 76 },
  localite: { flex: 1 },
  etiquette: { marginBottom: 4, fontSize: 10.5, lineHeight: 13, fontWeight: '600', color: EQ.attenue },
  saisie: {
    height: 36,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
    fontSize: 13,
    fontWeight: '700',
    color: EQ.encre,
  },
  caseLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  case: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseCochee: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  coche: { fontSize: 12, fontWeight: '700', color: EQ.surMarque, lineHeight: 14 },
  caseTexte: { flex: 1, gap: 1 },
  caseLibelle: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: EQ.encre },
  caseDetail: { fontSize: 10.5, lineHeight: 13, fontWeight: '500', color: EQ.etiquette },
});
