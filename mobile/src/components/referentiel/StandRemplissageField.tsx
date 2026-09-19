import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getCurrentPosition } from '@/lib/location';
import { useAsyncAction } from '@/hooks/use-async-action';
import { peutCreerLieuAerien } from '@/lib/fiche-vol-access';

export interface StandRemplissageOption {
  id: string;
  numero: string;
  localite: string;
  equipe_aerienne_id: string | null;
}

interface StandRemplissageFieldProps {
  value: string | null;
  onChange: (id: string, option: StandRemplissageOption) => void;
  label?: string;
  /** Équipe aérienne choisie sur la fiche : seuls ses stands sont proposés. Absente : tous. */
  equipeId?: string | null;
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Sélecteur + création rapide de stand de remplissage (#fiche-vol-referentiel-
 * creation-mobile) — même contrat que le web (ReferentielsPage.tsx : POST
 * /stands-remplissage, en ligne uniquement, `numero`/`localite` saisis à la main,
 * pas d'auto-génération côté backend). Un stand créé ici est immédiatement
 * disponible côté web (même table) et réciproquement — aucune synchronisation
 * hors-ligne pour ce référentiel, contrairement aux fiches (prospection,
 * traitement, fiche de vol) : la création exige donc une connexion.
 *
 * Coordonnées capturées automatiquement par le GPS de l'appareil et verrouillées
 * (non modifiables) une fois acquises — seuls `numero`/`localite` restent en
 * texte libre, même principe que la capture GPS des écrans de référence
 * existants (extensive-reference.tsx, traitement/references.tsx).
 */
export function StandRemplissageField({ value, onChange, label = 'Stand de remplissage', equipeId }: StandRemplissageFieldProps) {
  const token = useAuthStore((s) => s.token);
  const peutCreer = peutCreerLieuAerien(useAuthStore((s) => s.user?.role));
  const [stands, setStands] = useState<StandRemplissageOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creation, setCreation] = useState(false);
  const [numero, setNumero] = useState('');
  const [localite, setLocalite] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number; altitude: number | null } | null>(null);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run: runCreation, isRunning: isCreating } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listStandsRemplissage(token!);
          setStands(
            resultat.map((s) => ({
              id: s.id,
              numero: s.numero,
              localite: s.localite,
              equipe_aerienne_id: s.equipe_aerienne_id ?? null,
            }))
          );
          setLoaded(true);
        },
        { screen: 'stand-remplissage-field', precondition: !!token }
      ),
    [runChargement, token]
  );

  // Chargée automatiquement à l'ouverture (#referentiel-creation-sans-recharger)
  // — plus de bouton « Charger la liste » à taper avant d'atteindre le
  // formulaire de création d'un stand.
  useFocusEffect(useCallback(() => {
    void charger();
  }, [charger]));

  const capturerPosition = () =>
    runGps(
      async () => {
        const pos = await getCurrentPosition();
        setPosition({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      },
      { screen: 'stand-remplissage-field' }
    );

  // Un stand « sans équipe » (antérieur à la migration 0075) n'appartient à personne :
  // il n'est proposé à aucune équipe tant qu'un admin ne l'a pas rattaché.
  const standsVisibles = equipeId ? stands.filter((s) => s.equipe_aerienne_id === equipeId) : stands;

  const ouvrirCreation = () => {
    setCreation(true);
    if (!position) void capturerPosition();
  };

  const creer = () =>
    runCreation(
      async () => {
        const cree = await apiClient.createStandRemplissage(token!, {
          numero: numero.trim(),
          localite: localite.trim(),
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          altitude: position?.altitude ?? null,
        });
        const option = {
          id: cree.id,
          numero: cree.numero,
          localite: cree.localite,
          equipe_aerienne_id: cree.equipe_aerienne_id ?? null,
        };
        setStands((precedents) => [...precedents, option]);
        onChange(cree.id, option);
        setCreation(false);
        setNumero('');
        setLocalite('');
        setPosition(null);
      },
      {
        screen: 'stand-remplissage-field',
        precondition: !!token && numero.trim().length > 0 && localite.trim().length > 0,
        preconditionMessage: 'Renseignez le numéro et la localité avant de créer le stand.',
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
          {standsVisibles.map((stand) => (
            <TouchableOpacity
              key={stand.id}
              style={[styles.option, value === stand.id && styles.optionSelectionnee]}
              onPress={() => onChange(stand.id, stand)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, value === stand.id && styles.optionTextSelectionnee]}>
                {stand.numero} — {stand.localite}
              </Text>
            </TouchableOpacity>
          ))}
          {peutCreer && (
            <TouchableOpacity style={styles.nouveauLink} onPress={ouvrirCreation} accessibilityRole="button">
              <Text style={styles.nouveauLinkText}>+ Nouveau stand de remplissage</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {creation && (
        <View style={styles.formulaire}>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            placeholder="Numéro (ex. STD01)"
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
  formulaire: { gap: 8 },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8 },
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
