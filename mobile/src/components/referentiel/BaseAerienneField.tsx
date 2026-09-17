import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getCurrentPosition } from '@/lib/location';
import { useAsyncAction } from '@/hooks/use-async-action';

export interface BaseAerienneOption {
  id: string;
  numero: string;
  localite: string;
  parent_base_id: string | null;
  equipe_id: string | null;
}

interface BaseAerienneFieldProps {
  value: string | null;
  onChange: (id: string, option: BaseAerienneOption) => void;
  label?: string;
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Sélecteur + création rapide de base aérienne (#fiche-vol-referentiel-creation-
 * mobile) — même contrat que le web (ReferentielsPage.tsx : POST /bases-
 * aeriennes, en ligne uniquement, `numero`/`localite` saisis à la main). Une
 * base créée ici est immédiatement disponible côté web (même table) et
 * réciproquement — aucune synchronisation hors-ligne pour ce référentiel,
 * contrairement aux fiches : la création exige donc une connexion.
 *
 * `parent_base_id` (NULL = principale, sinon secondaire d'une base
 * principale existante, cf. migration backend 0064). La création rapide
 * intégrée ici ne crée que des bases **secondaires** (#equipe-aerienne,
 * migration 0066) : une principale doit désormais appartenir à une équipe
 * aérienne, un rattachement hors sujet pour ce champ embarqué — elle se crée
 * depuis l'écran « Référentiels aériens », qui gère ce contexte. Si aucune
 * principale n'existe encore, la création reste désactivée avec un renvoi
 * vers cet écran plutôt que de proposer un formulaire cassé.
 *
 * Coordonnées capturées automatiquement par le GPS de l'appareil et
 * verrouillées (non modifiables) une fois acquises.
 */
export function BaseAerienneField({ value, onChange, label = 'Base aérienne' }: BaseAerienneFieldProps) {
  const token = useAuthStore((s) => s.token);
  const [bases, setBases] = useState<BaseAerienneOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creation, setCreation] = useState(false);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const [parentBaseId, setParentBaseId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; altitude: number | null } | null>(null);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run: runCreation, isRunning: isCreating } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listBasesAeriennes(token!);
          setBases(
            resultat.map((b) => ({
              id: b.id,
              numero: b.numero,
              localite: b.localite,
              parent_base_id: b.parent_base_id,
              equipe_id: b.equipe_id,
            }))
          );
          setLoaded(true);
        },
        { screen: 'base-aerienne-field', precondition: !!token }
      ),
    [runChargement, token]
  );

  // Chargée automatiquement à l'ouverture (#referentiel-creation-sans-recharger)
  // — plus de bouton « Charger la liste » à taper avant d'atteindre le
  // formulaire de création d'une base secondaire.
  useFocusEffect(useCallback(() => {
    void charger();
  }, [charger]));

  const capturerPosition = () =>
    runGps(
      async () => {
        const pos = await getCurrentPosition();
        setPosition({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      },
      { screen: 'base-aerienne-field' }
    );

  // Seules les bases principales (sans parent) peuvent recevoir une secondaire —
  // pas de secondaire d'une secondaire, même limite que côté backend.
  const basesPrincipales = bases.filter((b) => b.parent_base_id === null);

  const ouvrirCreation = () => {
    if (basesPrincipales.length === 0) return;
    setCreation(true);
    setParentBaseId(basesPrincipales[0].id);
    if (!position) void capturerPosition();
  };

  const creer = () =>
    runCreation(
      async () => {
        const cree = await apiClient.createBaseAerienne(token!, {
          numero: numero.trim(),
          localite: localite.trim(),
          parent_base_id: parentBaseId,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          altitude: position?.altitude ?? null,
        });
        const option = {
          id: cree.id,
          numero: cree.numero,
          localite: cree.localite,
          parent_base_id: cree.parent_base_id,
          equipe_id: cree.equipe_id,
        };
        setBases((precedentes) => [...precedentes, option]);
        onChange(cree.id, option);
        setCreation(false);
        setNumero('');
        setLocalite('');
        setParentBaseId(null);
        setPosition(null);
      },
      {
        screen: 'base-aerienne-field',
        precondition: !!token && numero.trim().length > 0 && localite.trim().length > 0 && !!parentBaseId,
        preconditionMessage: 'Renseignez le numéro, la localité et la base principale avant de créer la base.',
      }
    );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      {!loaded && !isChargement && (
        <TouchableOpacity style={styles.chargerLink} onPress={charger}>
          <Text style={styles.chargerLinkText}>Charger la liste ›</Text>
        </TouchableOpacity>
      )}
      {isChargement && <ActivityIndicator color={GREEN} />}

      {loaded && !creation && (
        <View style={styles.liste}>
          {bases.map((base) => (
            <TouchableOpacity
              key={base.id}
              style={[styles.option, value === base.id && styles.optionSelectionnee]}
              onPress={() => onChange(base.id, base)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, value === base.id && styles.optionTextSelectionnee]}>
                {base.numero} — {base.localite}
                {base.parent_base_id ? ' (secondaire)' : ''}
              </Text>
            </TouchableOpacity>
          ))}
          {basesPrincipales.length > 0 ? (
            <TouchableOpacity style={styles.nouveauLink} onPress={ouvrirCreation} accessibilityRole="button">
              <Text style={styles.nouveauLinkText}>+ Nouvelle base secondaire</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hint}>
              Créez d&apos;abord une base principale (avec son équipe) depuis Référentiels aériens.
            </Text>
          )}
        </View>
      )}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Numéro (ex. IHO01)"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />
          <TextInput
            value={localite}
            onChangeText={setLocalite}
            placeholder="Localité"
            placeholderTextColor={TEXT_SECONDARY}
            style={styles.input}
          />

          <Text style={styles.sousLabel}>Secondaire de…</Text>
          <View style={styles.typeRow}>
            {basesPrincipales.map((principale) => (
              <TouchableOpacity
                key={principale.id}
                style={[styles.typeChip, parentBaseId === principale.id && styles.typeChipSelectionne]}
                onPress={() => setParentBaseId(principale.id)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.typeChipText,
                    parentBaseId === principale.id && styles.typeChipTextSelectionne,
                  ]}
                >
                  {principale.numero}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.gpsRow}>
            <Text style={styles.gpsRowText}>Coordonnées (auto, verrouillées)</Text>
            <Text style={styles.gpsValue}>
              {isGpsLoading
                ? 'Localisation…'
                : position
                  ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
                  : '—'}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.annulerButton}
              onPress={() => setCreation(false)}
              accessibilityRole="button"
            >
              <Text style={styles.annulerButtonText}>Annuler</Text>
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, gap: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  chargerLink: { paddingVertical: 6 },
  chargerLinkText: { fontSize: 13, fontWeight: '700', color: GREEN },
  liste: { gap: 6 },
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG },
  optionSelectionnee: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  optionText: { fontSize: 13, fontWeight: '600', color: TEXT },
  optionTextSelectionnee: { color: GREEN },
  nouveauLink: { paddingVertical: 8, alignItems: 'center' },
  nouveauLinkText: { fontSize: 13, fontWeight: '700', color: GREEN },
  hint: { fontSize: 11.5, color: TEXT_SECONDARY, fontStyle: 'italic', paddingVertical: 6 },
  formulaire: { gap: 8 },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8 },
  sousLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  typeChipSelectionne: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  typeChipTextSelectionne: { color: GREEN },
  gpsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsRowText: { fontSize: 11.5, color: TEXT_SECONDARY },
  gpsValue: { fontSize: 12, fontWeight: '700', color: TEXT },
  actionsRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  annulerButton: { paddingVertical: 8, paddingHorizontal: 12 },
  annulerButtonText: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY },
  creerButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  creerButtonDisabled: { opacity: 0.6 },
  creerButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
