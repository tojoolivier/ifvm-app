import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listLieuxAeriens, LieuAerien } from '@/lib/referentiel-db';
import { getCurrentPosition } from '@/lib/location';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

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
  // Équipes aériennes (en ligne uniquement, comme `BaseAerienneField`) : un lieu doit
  // appartenir à une équipe — l'équipe existe donc avant ses lieux.
  const [equipes, setEquipes] = useState<{ id: string; nom: string }[]>([]);
  const [equipeId, setEquipeId] = useState<string | null>(null);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();
  const { run: runEquipes, isRunning: isChargementEquipes } = useAsyncAction();
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run: runCreation, isRunning: isCreating } = useAsyncAction();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

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

  const chargerEquipes = useCallback(
    () =>
      runEquipes(
        async () => {
          const liste = await apiClient.listEquipesAeriennes(token!);
          setEquipes(liste.map((e) => ({ id: e.id, nom: e.nom })));
        },
        { screen: 'lieu-aerien-field', precondition: !!token }
      ),
    [runEquipes, token]
  );

  const ouvrirCreation = () => {
    setCreation(true);
    setListe(false);
    setNom(value);
    if (!position) void capturerPosition();
    // Retente tant que la liste est vide (échec réseau précédent, ou aucune équipe encore créée).
    if (equipes.length === 0) void chargerEquipes();
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
          equipe_aerienne_id: equipeId!,
        });
        setLieux((precedents) => [...precedents, { id: cree.id, type_lieu: cree.type_lieu, nom: cree.nom }]);
        onChangeText(cree.nom);
        setCreation(false);
        setNom('');
        setPosition(null);
      },
      {
        screen: 'lieu-aerien-field',
        precondition: !!token && nom.trim().length > 0 && !!position && !!equipeId,
        preconditionMessage:
          "Renseignez le nom, choisissez l'équipe aérienne et attendez la position GPS avant de créer le lieu.",
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
          <Text style={styles.equipeLabel}>Équipe aérienne *</Text>
          {isChargementEquipes && <ActivityIndicator color={GREEN} />}
          {!isChargementEquipes && equipes.length === 0 && (
            <Text style={styles.vide}>
              Aucune équipe aérienne disponible : elle doit être créée avant ses lieux.
            </Text>
          )}
          <View style={styles.equipeRow}>
            {equipes.map((equipe) => (
              <TouchableOpacity
                key={equipe.id}
                style={[styles.typeChip, equipeId === equipe.id && styles.typeChipSelectionne]}
                onPress={() => setEquipeId(equipe.id)}
                accessibilityRole="button"
              >
                <Text style={[styles.typeChipText, equipeId === equipe.id && styles.typeChipTextSelectionne]}>
                  {equipe.nom}
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

const BASE_TYPE_SIZES = {
  label: 9,
  input: 13,
  actionLink: 11.5,
  vide: 12,
  optionText: 12.5,
  optionType: 10.5,
  creationInput: 13,
  equipeLabel: 9,
  typeChipText: 11.5,
  gpsRowText: 11,
  gpsValue: 12,
  annulerText: 12.5,
  creerButtonText: 12.5,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    group: { marginBottom: 10 },
    label: { fontSize: typeSizes.label, fontWeight: '600', color: theme.faint, textTransform: 'uppercase', marginBottom: 4 },
    box: { backgroundColor: FILL_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
    boxFocused: { borderColor: GREEN, borderWidth: 1.5 },
    input: { fontSize: typeSizes.input, fontWeight: '600', color: TEXT, padding: 0 },
    actionsRow: { flexDirection: 'row', gap: 14, marginTop: 6 },
    actionLink: { fontSize: typeSizes.actionLink, fontWeight: '700', color: GREEN },
    panel: { marginTop: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: BORDER, borderRadius: 9, padding: 9, gap: 7 },
    vide: { fontSize: typeSizes.vide, color: TEXT_SECONDARY, fontStyle: 'italic' },
    option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: FILL_BG },
    optionText: { fontSize: typeSizes.optionText, fontWeight: '600', color: TEXT },
    optionType: { fontSize: typeSizes.optionType, fontWeight: '500', color: TEXT_SECONDARY },
    creationInput: {
      fontSize: typeSizes.creationInput,
      fontWeight: '600',
      color: TEXT,
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 8,
      padding: 8,
    },
    typeRow: { flexDirection: 'row', gap: 6 },
    equipeLabel: { fontSize: typeSizes.equipeLabel, fontWeight: '600', color: theme.faint, textTransform: 'uppercase' },
    equipeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
    typeChipSelectionne: { borderColor: GREEN, backgroundColor: theme.successBg },
    typeChipText: { fontSize: typeSizes.typeChipText, fontWeight: '600', color: TEXT_SECONDARY },
    typeChipTextSelectionne: { color: GREEN },
    gpsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gpsRowText: { fontSize: typeSizes.gpsRowText, color: TEXT_SECONDARY },
    gpsValue: { fontSize: typeSizes.gpsValue, fontWeight: '700', color: TEXT },
    creationActionsRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', alignItems: 'center' },
    annulerText: { fontSize: typeSizes.annulerText, fontWeight: '600', color: TEXT_SECONDARY },
    creerButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
    creerButtonDisabled: { opacity: 0.6 },
    creerButtonText: { fontSize: typeSizes.creerButtonText, fontWeight: '700', color: '#fff' },
  });
}
