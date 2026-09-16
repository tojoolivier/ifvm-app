import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listLieuxAeriens, LieuAerien } from '@/lib/referentiel-db';
import { getCurrentPosition } from '@/lib/location';
import { useAsyncAction } from '@/hooks/use-async-action';

interface LieuAerienFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  focusedField: string | null;
  setFocusedField: Dispatch<SetStateAction<string | null>>;
}

const GREEN = '#235a36';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const FILL_BG = '#fdf6e3';

const TYPES_LIEU: { value: 'principale' | 'secondaire' | 'stand'; label: string }[] = [
  { value: 'principale', label: 'Principale' },
  { value: 'secondaire', label: 'Secondaire' },
  { value: 'stand', label: 'Stand' },
];

/**
 * Remplace le `AerienField` texte libre du champ « Base » de la Prospection
 * Extensive Aérienne (#prospection-extensive-aerienne-lieu-aerien) : reste du
 * texte libre (aucune FK réintroduite — décision produit des migrations 0054/
 * 0063 non défaite), mais suggère les lieux du référentiel `lieu_aerien` déjà
 * en base (lus hors-ligne via le cache local, `listLieuxAeriens` —
 * référentiel-db.ts, jusqu'ici jamais consommé côté mobile) et permet d'en
 * créer un nouveau (`POST /lieux-aeriens`, en ligne uniquement, comme le Web).
 * Choisir ou créer un lieu ne fait que remplir le texte libre avec son nom.
 */
export function LieuAerienField({ label, value, onChangeText, focusedField, setFocusedField }: LieuAerienFieldProps) {
  const token = useAuthStore((s) => s.token);
  const isFocused = focusedField === label;

  const [lieux, setLieux] = useState<LieuAerien[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [liste, setListe] = useState(false);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [typeLieu, setTypeLieu] = useState<'principale' | 'secondaire' | 'stand'>('principale');
  const [position, setPosition] = useState<{ latitude: number; longitude: number; altitude: number | null } | null>(null);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run: runCreation, isRunning: isCreating } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          setLieux(await listLieuxAeriens());
          setLoaded(true);
        },
        { screen: 'lieu-aerien-field' }
      ),
    [runChargement]
  );

  const ouvrirListe = () => {
    setListe(true);
    setCreation(false);
    if (!loaded) void charger();
  };

  const capturerPosition = () =>
    runGps(
      async () => {
        const pos = await getCurrentPosition();
        setPosition({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      },
      { screen: 'lieu-aerien-field' }
    );

  const ouvrirCreation = () => {
    setCreation(true);
    setListe(false);
    setNom(value);
    if (!position) void capturerPosition();
  };

  const creer = () =>
    runCreation(
      async () => {
        const cree = await apiClient.createLieuAerien(token!, {
          type_lieu: typeLieu,
          nom: nom.trim(),
          latitude: position!.latitude,
          longitude: position!.longitude,
          altitude: position!.altitude,
        });
        setLieux((precedents) => [...precedents, { id: cree.id, type_lieu: cree.type_lieu, nom: cree.nom }]);
        onChangeText(cree.nom);
        setCreation(false);
        setNom('');
        setPosition(null);
      },
      {
        screen: 'lieu-aerien-field',
        precondition: !!token && nom.trim().length > 0 && !!position,
        preconditionMessage: 'Renseignez le nom et attendez la position GPS avant de créer le lieu.',
      }
    );

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, isFocused && styles.boxFocused]}>
        <TextInput
          testID={`aerien-field-${label}`}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocusedField(label)}
          onBlur={() => setFocusedField((current) => (current === label ? null : current))}
          placeholderTextColor={TEXT_SECONDARY}
          style={styles.input}
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={ouvrirListe} accessibilityRole="button">
          <Text style={styles.actionLink}>Choisir un lieu existant ›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={ouvrirCreation} accessibilityRole="button">
          <Text style={styles.actionLink}>+ Nouveau lieu aérien</Text>
        </TouchableOpacity>
      </View>

      {liste && (
        <View style={styles.panel}>
          {isChargement && <ActivityIndicator color={GREEN} />}
          {loaded && lieux.length === 0 && <Text style={styles.vide}>Aucun lieu aérien enregistré.</Text>}
          {loaded &&
            lieux.map((lieu) => (
              <TouchableOpacity
                key={lieu.id}
                style={styles.option}
                onPress={() => {
                  onChangeText(lieu.nom);
                  setListe(false);
                }}
                accessibilityRole="button"
              >
                <Text style={styles.optionText}>
                  {lieu.nom} <Text style={styles.optionType}>({lieu.type_lieu})</Text>
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {creation && (
        <View style={styles.panel}>
          <TextInput
            value={nom}
            onChangeText={setNom}
            placeholder="Nom du lieu"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.creationInput}
          />
          <View style={styles.typeRow}>
            {TYPES_LIEU.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typeChip, typeLieu === type.value && styles.typeChipSelectionne]}
                onPress={() => setTypeLieu(type.value)}
                accessibilityRole="button"
              >
                <Text style={[styles.typeChipText, typeLieu === type.value && styles.typeChipTextSelectionne]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsRowText}>Coordonnées (auto)</Text>
            <Text style={styles.gpsValue}>
              {isGpsLoading
                ? 'Localisation…'
                : position
                  ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.creationActionsRow}>
            <TouchableOpacity onPress={() => setCreation(false)} accessibilityRole="button">
              <Text style={styles.annulerText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.creerButton, isCreating && styles.creerButtonDisabled]}
              onPress={creer}
              disabled={isCreating}
              accessibilityRole="button"
            >
              <Text style={styles.creerButtonText}>{isCreating ? 'Création…' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 4 },
  box: { backgroundColor: FILL_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  boxFocused: { borderColor: GREEN, borderWidth: 1.5 },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, padding: 0 },
  actionsRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
  actionLink: { fontSize: 11.5, fontWeight: '700', color: GREEN },
  panel: { marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 9, padding: 9, gap: 7 },
  vide: { fontSize: 12, color: TEXT_SECONDARY, fontStyle: 'italic' },
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: FILL_BG },
  optionText: { fontSize: 12.5, fontWeight: '600', color: TEXT },
  optionType: { fontSize: 10.5, fontWeight: '500', color: TEXT_SECONDARY },
  creationInput: { fontSize: 13, fontWeight: '600', color: TEXT, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8 },
  typeRow: { flexDirection: 'row', gap: 6 },
  typeChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  typeChipSelectionne: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  typeChipText: { fontSize: 11.5, fontWeight: '600', color: TEXT_SECONDARY },
  typeChipTextSelectionne: { color: GREEN },
  gpsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsRowText: { fontSize: 11, color: TEXT_SECONDARY },
  gpsValue: { fontSize: 12, fontWeight: '700', color: TEXT },
  creationActionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', alignItems: 'center' },
  annulerText: { fontSize: 12.5, fontWeight: '600', color: TEXT_SECONDARY },
  creerButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  creerButtonDisabled: { opacity: 0.6 },
  creerButtonText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
});
