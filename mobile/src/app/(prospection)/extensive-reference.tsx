import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentPosition } from '@/lib/location';
import { useAuthStore } from '@/lib/auth-store';
import {
  OperationAerienneRow,
  listOperationsAeriennes,
  saveOperationsAeriennes,
  updateProspectionExtensiveReference,
} from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import {
  BIOTOPE_EXTENSIVE_OPTIONS,
  HEURE_STRICTE_RE,
  TYPE_OPERATION_OPTIONS,
  TypeOperationAerienne,
  calculerDureeMinutes,
  formatDuree,
  parseSelectionMultiple,
} from '@/lib/prospection-extensive';
import { TimeField } from '@/components/TimeField';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const AUTO_BG = '#eaf2ec';
const INACTIVE_BG = '#efeada';
// Teinte dédiée aux zones à REMPLIR du bloc aéronef/équipe (distincte du vert
// AUTO_BG déjà réservé aux informations auto-remplies À LIRE) — un crème plus
// doré que le fond de page (BG), volontairement subtil (cf. demande UX : « ne
// pas utiliser des couleurs trop fortes »).
const FILL_BG = '#fdf6e3';

/** Auto-généré côté client comme n_fiche (cf. reference.tsx), faute de numérotation serveur pour l'extensif. */
function generateNumeroMessage(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${datePart}-${idPart}`;
}

// ==========================================
// Mode aérien — opérations (saisie locale, HH:MM en texte comme le reste de l'écran)
// ==========================================

interface OperationDraft {
  typeOperation: TypeOperationAerienne | null;
  /** Pertinent seulement si typeOperation === 'divers'. Jamais effacé quand
   * l'agent bascule momentanément vers un autre type : rendu (masqué) mais pas
   * perdu, pour pouvoir le retrouver s'il revient sur Divers (cf. requête UX). */
  motifDivers: string;
  debutHeure: string;
  debutTemperature: string;
  debutVent: string;
  finHeure: string;
  finTemperature: string;
  finVent: string;
}

function emptyOperation(): OperationDraft {
  return {
    typeOperation: null,
    motifDivers: '',
    debutHeure: '',
    debutTemperature: '',
    debutVent: '',
    finHeure: '',
    finTemperature: '',
    finVent: '',
  };
}

function operationFromRow(row: OperationAerienneRow): OperationDraft {
  return {
    typeOperation: row.type_operation as TypeOperationAerienne,
    motifDivers: row.motif_divers ?? '',
    debutHeure: row.debut_heure,
    debutTemperature: row.debut_temperature_c != null ? String(row.debut_temperature_c) : '',
    debutVent: row.debut_vent_ms != null ? String(row.debut_vent_ms) : '',
    finHeure: row.fin_heure,
    finTemperature: row.fin_temperature_c != null ? String(row.fin_temperature_c) : '',
    finVent: row.fin_vent_ms != null ? String(row.fin_vent_ms) : '',
  };
}

/** Une opération jamais touchée par l'agent — ni sauvegardée, ni bloquante à Continuer. */
function operationEstVide(op: OperationDraft): boolean {
  return (
    !op.typeOperation &&
    !op.motifDivers &&
    !op.debutHeure &&
    !op.debutTemperature &&
    !op.debutVent &&
    !op.finHeure &&
    !op.finTemperature &&
    !op.finVent
  );
}

/** `null` si début/fin ne sont pas deux `HH:MM` valides — la carte affiche alors « — » plutôt qu'un calcul erroné. */
function dureeDeOperation(op: OperationDraft): number | null {
  if (!HEURE_STRICTE_RE.test(op.debutHeure) || !HEURE_STRICTE_RE.test(op.finHeure)) return null;
  return calculerDureeMinutes(op.debutHeure, op.finHeure);
}

/**
 * Un champ du bloc « Informations aéronef / équipe » — label toujours visible
 * au-dessus (jamais seulement en placeholder), zone de saisie teintée pour la
 * distinguer d'une simple information à lire, état focus visible (bordure verte).
 * `focusedField`/`setFocusedField` sont partagés par tous les champs du bloc :
 * un seul TextInput est focus à la fois, pas besoin d'un état par champ.
 */
function AerienField({
  label,
  value,
  onChangeText,
  focusedField,
  setFocusedField,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  focusedField: string | null;
  setFocusedField: Dispatch<SetStateAction<string | null>>;
  style?: StyleProp<ViewStyle>;
}) {
  const isFocused = focusedField === label;
  return (
    <View style={[styles.aerienFieldGroup, style]}>
      <Text style={styles.aerienFieldLabel}>{label}</Text>
      <View style={[styles.aerienFieldBox, isFocused && styles.aerienFieldBoxFocused]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocusedField(label)}
          onBlur={() => setFocusedField((current) => (current === label ? null : current))}
          placeholderTextColor={TEXT_SECONDARY}
          style={styles.aerienFieldInput}
        />
      </View>
    </View>
  );
}

export default function ExtensiveReferenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const user = useAuthStore((s) => s.user);
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const isValidation = draft?.type_prospection === 'validation';
  // Terrestre implicite (NULL) comme fiche extensive : le bloc aérien n'apparaît
  // que si le mode a été explicitement choisi sur extensive-mode-chooser.tsx — le
  // reste de cet écran (et de la fiche) reste identique dans tous les autres cas.
  const isAerien = draft?.mode_extensif === 'aerien';
  const signalerChargement = useSignalerChargement('extensive-reference');

  const [latitude, setLatitude] = useState<string>(draft?.latitude != null ? String(draft.latitude) : '');
  const [longitude, setLongitude] = useState<string>(draft?.longitude != null ? String(draft.longitude) : '');
  const [isLoadingGps, setIsLoadingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [stationLibre, setStationLibre] = useState(draft?.station_libre ?? '');
  // Type de station / biotope (#biotope-multi) : sélection multiple, reste
  // facultatif (aucun contrôle « au moins un » — comportement inchangé).
  const [selectedTypeStation, setSelectedTypeStation] = useState<string[]>(
    parseSelectionMultiple(draft?.type_station ?? null)
  );
  const toggleTypeStation = (value: string) => {
    setSelectedTypeStation((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };
  const [surfaceStation, setSurfaceStation] = useState(draft?.surface_station != null ? String(draft.surface_station) : '');
  const [surfaceInfestee, setSurfaceInfestee] = useState(draft?.surface_infestee != null ? String(draft.surface_infestee) : '');
  const [nMessage, setNMessage] = useState(
    draft?.n_message ?? (draftId && draft ? generateNumeroMessage(draftId, draft.date_prospection) : '')
  );
  // Horodatage technique (ISO) de l'heure d'observation — même mécanisme que
  // observations.tsx côté Intensif (`getCurrentPosition().timestamp`, colonne
  // partagée `prospection.heure_observation_at`), mais capturé ici : l'Extensif
  // n'a pas d'écran Infestation séparé, et c'est déjà sur cet écran Référence
  // que se fait l'acquisition GPS.
  const [heureObservationAt, setHeureObservationAt] = useState<string | null>(draft?.heure_observation_at ?? null);
  // Mode aérien uniquement — cf. bloc "Informations aéronef/équipe" et "Opérations"
  // ci-dessous, invisibles et jamais lus/écrits en mode terrestre (isAerien === false).
  const [societe, setSociete] = useState(draft?.societe ?? '');
  const [immatriculeAeronef, setImmatriculeAeronef] = useState(draft?.immatricule_aeronef ?? '');
  const [pilote, setPilote] = useState(draft?.pilote ?? '');
  const [mecanicien, setMecanicien] = useState(draft?.mecanicien ?? '');
  const [chefDeBase, setChefDeBase] = useState(draft?.chef_de_base ?? '');
  const [base, setBase] = useState(draft?.base ?? '');
  const [baseSecondaire, setBaseSecondaire] = useState(draft?.base_secondaire ?? '');
  // Label du champ actuellement focus dans le bloc aéronef/équipe (un seul à la
  // fois) — pilote uniquement l'état visuel (bordure) de `AerienField`.
  const [focusedAerienField, setFocusedAerienField] = useState<string | null>(null);
  const [operations, setOperations] = useState<OperationDraft[]>([emptyOperation()]);
  const { run, isRunning: isSaving } = useAsyncAction();

  // Récupération automatique des coordonnées GPS
  useEffect(() => {
    let isMounted = true;

    const fetchGpsPosition = async () => {
      // Si les coordonnées existent déjà dans le brouillon, on les utilise
      // (une heure d'observation déjà enregistrée est restaurée telle quelle,
      // sans jamais relancer d'acquisition GPS simplement parce que l'écran
      // est remonté — même règle que observations.tsx).
      if (draft?.latitude && draft?.longitude) {
        if (isMounted) {
          setLatitude(String(draft.latitude));
          setLongitude(String(draft.longitude));
          if (draft.heure_observation_at) setHeureObservationAt(draft.heure_observation_at);
        }
        return;
      }

      // Sinon, on récupère la position GPS
      if (isMounted) {
        setIsLoadingGps(true);
        setGpsError('');
      }

      try {
        const position = await getCurrentPosition();
        if (isMounted) {
          setLatitude(String(position.latitude));
          setLongitude(String(position.longitude));
          setHeureObservationAt(new Date(position.timestamp).toISOString());
          setGpsError('');
        }
      } catch (error) {
        // Best-effort délibéré : déjà visible via `gpsError`, l'agent peut
        // saisir les coordonnées à la main.
        logger.ignore(error, 'position GPS indisponible, saisie manuelle possible');
        if (isMounted) {
          setGpsError('Impossible de récupérer la position GPS');
        }
      } finally {
        if (isMounted) {
          setIsLoadingGps(false);
        }
      }
    };

    void fetchGpsPosition();

    return () => {
      isMounted = false;
    };
  }, [draft?.latitude, draft?.longitude, draft?.heure_observation_at]);

  // Station saisie librement, type de station, surface et n° message : de simples
  // `useState(draft?.x)` d'initialisation ne se remettent jamais à jour si `draft`
  // n'est pas encore hydraté au moment du montage (deep-link, app relancée en plein
  // parcours — cf. le commentaire de `fiche-routing.ts` sur cet écran qui, contrairement
  // à `reference.tsx`, ne s'auto-hydrate pas). Restaure une seule fois par fiche chargée
  // pour ne pas écraser une saisie en cours si `draft` est republié entre-temps.
  const refHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || refHydratedRef.current === draft.id) return;
    refHydratedRef.current = draft.id;
    void Promise.resolve().then(() => {
      setStationLibre(draft.station_libre ?? '');
      setSelectedTypeStation(parseSelectionMultiple(draft.type_station));
      setSurfaceStation(draft.surface_station != null ? String(draft.surface_station) : '');
      setSurfaceInfestee(draft.surface_infestee != null ? String(draft.surface_infestee) : '');
      setNMessage(draft.n_message ?? generateNumeroMessage(draft.id, draft.date_prospection));
      if (draft.heure_observation_at) setHeureObservationAt(draft.heure_observation_at);
      // Mode aérien uniquement — sans effet sur une fiche terrestre (colonnes NULL).
      setSociete(draft.societe ?? '');
      setImmatriculeAeronef(draft.immatricule_aeronef ?? '');
      setPilote(draft.pilote ?? '');
      setMecanicien(draft.mecanicien ?? '');
      setChefDeBase(draft.chef_de_base ?? '');
      setBase(draft.base ?? '');
      setBaseSecondaire(draft.base_secondaire ?? '');
    });
  }, [draft, draftId]);

  // Opérations aériennes déjà enregistrées (fiche reprise) — lues une seule fois par
  // fiche chargée, même garde que l'effet ci-dessus. Sans opération sauvegardée, on
  // part d'une carte vide plutôt qu'une liste vide (cf. emptyOperation, l'agent voit
  // tout de suite où saisir au lieu de devoir cliquer "+ Ajouter" en premier geste).
  const operationsHydrateesRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || !isAerien || operationsHydrateesRef.current === draft.id) return;
    operationsHydrateesRef.current = draft.id;
    void listOperationsAeriennes(draftId)
      .then((rows) => {
        if (rows.length > 0) setOperations(rows.map(operationFromRow));
      })
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draft, draftId, isAerien, signalerChargement]);

  const updateOperation = (index: number, patch: Partial<OperationDraft>) => {
    setOperations((current) => current.map((op, i) => (i === index ? { ...op, ...patch } : op)));
  };

  const addOperation = () => {
    setOperations((current) => [...current, emptyOperation()]);
  };

  const removeOperation = (index: number) => {
    const op = operations[index];
    const confirmerSuppression = () => setOperations((current) => current.filter((_, i) => i !== index));
    // Confirmation seulement si l'opération contient déjà des données — en supprimer
    // une vide (juste ajoutée par erreur) ne mérite pas une boîte de dialogue.
    if (operationEstVide(op)) {
      confirmerSuppression();
      return;
    }
    Alert.alert('Supprimer cette opération ?', 'Les données saisies pour cette opération seront perdues.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: confirmerSuppression },
    ]);
  };

  const totalJourMinutes = operations.reduce((sum, op) => sum + (dureeDeOperation(op) ?? 0), 0);

  // Opérations réellement saisies (ignore les cartes jamais touchées, cf. commentaire
  // de `emptyOperation` dans l'effet de chargement) — celles-là seules sont validées
  // et enregistrées ; en laisser une intégralement vide ne bloque jamais Continuer.
  const operationsRenseignees = operations.filter((op) => !operationEstVide(op));

  const handleContinue = () => {
    if (isAerien) {
      for (let i = 0; i < operationsRenseignees.length; i++) {
        const op = operationsRenseignees[i];
        if (!op.typeOperation) {
          Alert.alert('Opération incomplète', `Opération ${i + 1} : choisissez un type d'opération.`);
          return;
        }
        if (!HEURE_STRICTE_RE.test(op.debutHeure) || !HEURE_STRICTE_RE.test(op.finHeure)) {
          Alert.alert('Opération incomplète', `Opération ${i + 1} : l'heure de début et de fin doivent être renseignées (HH:MM).`);
          return;
        }
      }
    }

    return run(
      async () => {
        // #biotope-multi : même normalisation qu'avant (minuscules, espaces →
        // underscores), appliquée à chaque élément du tableau plutôt qu'à une
        // chaîne scalaire ; stocké en JSON, comme `sol.texture` (cf. veg.tsx).
        const normalizedTypeStation = selectedTypeStation.map((v) => v.toLowerCase().replace(/\s+/g, '_'));

        const updated = await updateProspectionExtensiveReference(draftId, {
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          stationLibre: stationLibre || null,
          typeStation: normalizedTypeStation.length > 0 ? JSON.stringify(normalizedTypeStation) : null,
          surfaceStation: surfaceStation ? parseFloat(surfaceStation) : null,
          surfaceInfestee: surfaceInfestee ? parseFloat(surfaceInfestee) : null,
          nMessage: nMessage || null,
          heureObservationAt,
          societe: isAerien ? societe || null : null,
          immatriculeAeronef: isAerien ? immatriculeAeronef || null : null,
          pilote: isAerien ? pilote || null : null,
          mecanicien: isAerien ? mecanicien || null : null,
          chefDeBase: isAerien ? chefDeBase || null : null,
          base: isAerien ? base || null : null,
          baseSecondaire: isAerien ? baseSecondaire || null : null,
        });

        if (isAerien) {
          await saveOperationsAeriennes(
            draftId,
            operationsRenseignees.map((op) => ({
              type_operation: op.typeOperation as string,
              motif_divers: op.typeOperation === 'divers' ? op.motifDivers || null : null,
              debut_heure: op.debutHeure,
              debut_temperature_c: op.debutTemperature ? parseFloat(op.debutTemperature) : null,
              debut_vent_ms: op.debutVent ? parseFloat(op.debutVent) : null,
              fin_heure: op.finHeure,
              fin_temperature_c: op.finTemperature ? parseFloat(op.finTemperature) : null,
              fin_vent_ms: op.finVent ? parseFloat(op.finVent) : null,
              duree_minutes: calculerDureeMinutes(op.debutHeure, op.finHeure),
            }))
          );
        }

        setDraft(updated);
        router.push({ pathname: '/(prospection)/extensive-imagos' as any, params: { draftId } });
      },
      {
        screen: 'extensive-reference',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Références</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            {isValidation && draft?.signalement_description && (
              <View style={styles.quoteBanner}>
                <Text style={styles.quoteText}>
                  « {draft.signalement_description} » — signalé par {draft.signalement_source}
                  {draft.signalement_date ? `, ${draft.signalement_date}` : ''}.
                </Text>
              </View>
            )}

            <View style={styles.autoCard}>
              <Text style={styles.autoLabel}>Prospecteur (connecté)</Text>
              <Text style={styles.autoValue}>{user ? `${user.prenom} ${user.nom}` : '—'}</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Date</Text>
                <Text style={styles.autoValueMono}>{draft?.date_prospection ?? '—'}</Text>
              </View>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>N° message</Text>
                <TextInput value={nMessage} onChangeText={setNMessage} style={styles.autoInputMono} />
              </View>
            </View>

            <View style={styles.card}>
              {/* Prospection extensive = pas de station fixe du référentiel : nom saisi
                  librement sur place, ses coordonnées restant récupérées automatiquement
                  par GPS ci-dessous (contrairement à l'intensif, cf. reference.tsx). */}
              <Text style={styles.label}>Station (saisie libre)</Text>
              <TextInput
                value={stationLibre}
                onChangeText={setStationLibre}
                placeholder="Nom du lieu-dit / repère local"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Latitude S</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS...</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{latitude || '—'}</Text>
                )}
                {gpsError ? (
                  <Text style={styles.gpsErrorText}>{gpsError}</Text>
                ) : null}
              </View>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Longitude E</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS...</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{longitude || '—'}</Text>
                )}
                {gpsError ? (
                  <Text style={styles.gpsErrorText}>{gpsError}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.autoCard}>
              <Text style={styles.autoLabel}>🕐 Heure d&apos;observation (GPS)</Text>
              {isLoadingGps ? (
                <Text style={styles.gpsLoading}>Récupération GPS...</Text>
              ) : (
                <Text style={styles.autoValueMono}>{formatHeureLocale(heureObservationAt)}</Text>
              )}
            </View>

            {isAerien && (
              <>
                <View style={styles.aerienInfoBlock}>
                  <View style={styles.aerienInfoHeaderRow}>
                    <Text style={styles.aerienInfoIcon}>✈</Text>
                    <Text style={styles.aerienInfoTitle}>INFORMATIONS AÉRONEF / ÉQUIPE</Text>
                  </View>

                  <Text style={styles.aerienSubgroupLabel}>Aéronef</Text>
                  <AerienField
                    label="Société"
                    value={societe}
                    onChangeText={setSociete}
                    focusedField={focusedAerienField}
                    setFocusedField={setFocusedAerienField}
                  />
                  <AerienField
                    label="Immatricule Aéronef"
                    value={immatriculeAeronef}
                    onChangeText={setImmatriculeAeronef}
                    focusedField={focusedAerienField}
                    setFocusedField={setFocusedAerienField}
                  />

                  <Text style={styles.aerienSubgroupLabel}>Équipe</Text>
                  <View style={styles.aerienFieldRowSplit}>
                    <AerienField
                      label="Pilote"
                      value={pilote}
                      onChangeText={setPilote}
                      focusedField={focusedAerienField}
                      setFocusedField={setFocusedAerienField}
                      style={[styles.flex1, styles.aerienFieldNoMargin]}
                    />
                    <AerienField
                      label="Mécanicien"
                      value={mecanicien}
                      onChangeText={setMecanicien}
                      focusedField={focusedAerienField}
                      setFocusedField={setFocusedAerienField}
                      style={[styles.flex1, styles.aerienFieldNoMargin]}
                    />
                  </View>
                  <AerienField
                    label="Chef de base"
                    value={chefDeBase}
                    onChangeText={setChefDeBase}
                    focusedField={focusedAerienField}
                    setFocusedField={setFocusedAerienField}
                  />

                  <Text style={styles.aerienSubgroupLabel}>Base</Text>
                  <View style={[styles.aerienFieldRowSplit, styles.aerienFieldRowSplitLast]}>
                    <AerienField
                      label="Base"
                      value={base}
                      onChangeText={setBase}
                      focusedField={focusedAerienField}
                      setFocusedField={setFocusedAerienField}
                      style={[styles.flex1, styles.aerienFieldNoMargin]}
                    />
                    <AerienField
                      label="Base secondaire"
                      value={baseSecondaire}
                      onChangeText={setBaseSecondaire}
                      focusedField={focusedAerienField}
                      setFocusedField={setFocusedAerienField}
                      style={[styles.flex1, styles.aerienFieldNoMargin]}
                    />
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Opérations</Text>
                {operations.map((op, index) => {
                  const duree = dureeDeOperation(op);
                  return (
                    <View key={index} style={styles.card}>
                      <View style={styles.operationHeaderRow}>
                        <Text style={styles.operationTitle}>OPÉRATION {index + 1}</Text>
                        {operations.length > 1 && (
                          <TouchableOpacity onPress={() => removeOperation(index)} activeOpacity={0.7}>
                            <Text style={styles.operationRemove}>Supprimer</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={[styles.label, styles.operationSubLabel]}>Type d&apos;opération</Text>
                      <View style={styles.chipsRow}>
                        {TYPE_OPERATION_OPTIONS.map((option) => {
                          const active = option.value === op.typeOperation;
                          return (
                            <TouchableOpacity
                              key={option.value}
                              onPress={() => updateOperation(index, { typeOperation: option.value })}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {op.typeOperation === 'divers' && (
                        <View style={[styles.aerienFieldGroup, styles.operationMotifDivers]}>
                          <Text style={styles.aerienFieldLabel}>Motif du divers</Text>
                          <View style={styles.aerienFieldBox}>
                            <TextInput
                              value={op.motifDivers}
                              onChangeText={(v) => updateOperation(index, { motifDivers: v })}
                              placeholder="Ex. Rinçage, maintenance, vérification…"
                              placeholderTextColor={TEXT_SECONDARY}
                              style={styles.aerienFieldInput}
                            />
                          </View>
                        </View>
                      )}

                      <Text style={[styles.label, styles.operationSubLabel]}>Début opération</Text>
                      <View style={styles.operationRow}>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Heure</Text>
                          <TimeField
                            value={op.debutHeure || null}
                            onChange={(v) => updateOperation(index, { debutHeure: v })}
                          />
                        </View>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Température (°C)</Text>
                          <TextInput
                            value={op.debutTemperature}
                            onChangeText={(v) => updateOperation(index, { debutTemperature: v })}
                            keyboardType="decimal-pad"
                            style={styles.operationInput}
                          />
                        </View>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Vent (m/s)</Text>
                          <TextInput
                            value={op.debutVent}
                            onChangeText={(v) => updateOperation(index, { debutVent: v })}
                            keyboardType="decimal-pad"
                            style={styles.operationInput}
                          />
                        </View>
                      </View>

                      <Text style={[styles.label, styles.operationSubLabel]}>Fin opération</Text>
                      <View style={styles.operationRow}>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Heure</Text>
                          <TimeField
                            value={op.finHeure || null}
                            onChange={(v) => updateOperation(index, { finHeure: v })}
                          />
                        </View>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Température (°C)</Text>
                          <TextInput
                            value={op.finTemperature}
                            onChangeText={(v) => updateOperation(index, { finTemperature: v })}
                            keyboardType="decimal-pad"
                            style={styles.operationInput}
                          />
                        </View>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Vent (m/s)</Text>
                          <TextInput
                            value={op.finVent}
                            onChangeText={(v) => updateOperation(index, { finVent: v })}
                            keyboardType="decimal-pad"
                            style={styles.operationInput}
                          />
                        </View>
                      </View>

                      <View style={styles.operationTotalRow}>
                        <Text style={styles.operationTotalLabel}>Total heure de vol</Text>
                        <Text style={styles.operationTotalValue}>{duree != null ? formatDuree(duree) : '—'}</Text>
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addOperationButton} onPress={addOperation} activeOpacity={0.7}>
                  <Text style={styles.addOperationButtonText}>+ Ajouter une opération</Text>
                </TouchableOpacity>

                <View style={styles.totalJourCard}>
                  <Text style={styles.totalJourLabel}>TOTAL JOUR</Text>
                  <Text style={styles.totalJourValue}>{formatDuree(totalJourMinutes)}</Text>
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>Biotopes (type de station) — sélection multiple</Text>
            <View style={styles.chipsRow}>
              {BIOTOPE_EXTENSIVE_OPTIONS.map((option) => {
                const active = selectedTypeStation.includes(option.value);
                return (
                  <TouchableOpacity key={option.value} onPress={() => toggleTypeStation(option.value)} activeOpacity={0.7}>
                    <Text style={[styles.chip, active && styles.chipActive]}>
                      {option.label}
                      {active && ' ✓'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { marginTop: 10 }]}>
              <Text style={styles.label}>Surface prospectée (ha)</Text>
              <TextInput
                value={surfaceStation}
                onChangeText={setSurfaceStation}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <View style={[styles.card, { marginTop: 8 }]}>
              <Text style={styles.label}>Surface infestée (ha)</Text>
              <TextInput
                value={surfaceInfestee}
                onChangeText={setSurfaceInfestee}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <Text style={styles.hintText}>Vert = auto-rempli par GPS/session ; blanc = à confirmer ou saisir.</Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Suivant : Imagos ›</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  quoteBanner: { backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 10, padding: 11, marginBottom: 10 },
  quoteText: { fontSize: 11.5, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  autoCard: { backgroundColor: AUTO_BG, borderRadius: 10, padding: 9, marginBottom: 8 },
  autoLabel: { fontSize: 9, fontWeight: '600', color: GREEN, textTransform: 'uppercase' },
  autoValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  autoValueMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  autoInputMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9, marginBottom: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, padding: 0 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { 
    fontSize: 11.5, 
    fontWeight: '600', 
    color: TEXT_SECONDARY, 
    backgroundColor: INACTIVE_BG, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    overflow: 'hidden' 
  },
  chipActive: { 
    backgroundColor: GREEN, 
    color: '#fff', 
    fontWeight: '700' 
  },
  hintText: { fontSize: 10.5, color: '#9a9484', marginTop: 8, marginBottom: 10 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  gpsLoading: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: TEXT_SECONDARY,
    fontStyle: 'italic'
  },
  gpsErrorText: {
    fontSize: 10,
    color: '#d32f2f',
    marginTop: 2
  },
  // ===== Mode aérien =====
  // Bloc « Informations aéronef / équipe » (#ux-aerien) : un conteneur visuel
  // dédié — icône + titre, sous-groupes Aéronef/Équipe/Base — pour que l'agent
  // identifie la zone d'un coup d'œil, plutôt que des champs mêlés au reste.
  aerienInfoBlock: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, marginBottom: 10 },
  aerienInfoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: BORDER },
  aerienInfoIcon: { fontSize: 14, color: GREEN },
  aerienInfoTitle: { fontSize: 11, fontWeight: '800', color: GREEN, letterSpacing: 0.5, textTransform: 'uppercase' },
  aerienSubgroupLabel: { fontSize: 9, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  // Zone À REMPLIR (vs. les `autoCard`/`card` de lecture ailleurs sur cet écran) :
  // fond FILL_BG, bordure GREEN en focus — cf. commentaire de FILL_BG plus haut.
  aerienFieldGroup: { marginBottom: 10 },
  aerienFieldNoMargin: { marginBottom: 0 },
  aerienFieldLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 4 },
  aerienFieldBox: { backgroundColor: FILL_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  aerienFieldBoxFocused: { borderColor: GREEN, borderWidth: 1.5 },
  aerienFieldInput: { fontSize: 13, fontWeight: '600', color: TEXT, padding: 0 },
  aerienFieldRowSplit: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  aerienFieldRowSplitLast: { marginBottom: 0 },
  // « Motif du divers » (#ux-aerien) : même style de zone à remplir que le bloc
  // aéronef/équipe, réutilisé ici pour rester cohérent visuellement.
  operationMotifDivers: { marginTop: 4 },
  operationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  operationTitle: { fontSize: 11, fontWeight: '800', color: GREEN, letterSpacing: 0.4 },
  operationRemove: { fontSize: 11, fontWeight: '700', color: '#c0412b' },
  operationSubLabel: { marginTop: 10, marginBottom: 6 },
  operationRow: { flexDirection: 'row', gap: 8 },
  operationCell: { flex: 1, backgroundColor: AUTO_BG, borderRadius: 8, padding: 8 },
  operationCellLabel: { fontSize: 8.5, fontWeight: '600', color: GREEN, textTransform: 'uppercase', marginBottom: 3 },
  operationInput: { fontSize: 13, fontWeight: '700', color: TEXT, padding: 0 },
  operationTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  operationTotalLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase' },
  operationTotalValue: { fontSize: 15, fontWeight: '800', color: GREEN, fontFamily: 'monospace' },
  addOperationButton: { borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  addOperationButtonText: { fontSize: 13, fontWeight: '700', color: GREEN },
  totalJourCard: { backgroundColor: GREEN, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalJourLabel: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  totalJourValue: { fontSize: 20, fontWeight: '800', color: '#fff', fontFamily: 'monospace' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
