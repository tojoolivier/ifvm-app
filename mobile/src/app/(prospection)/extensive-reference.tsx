import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
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
import { getCurrentPosition, reverseGeocode } from '@/lib/location';
import { validateGpsPosition } from '@/lib/prospection-validation';
import { useAuthStore } from '@/lib/auth-store';
import {
  OperationAerienneRow,
  listOperationsAeriennes,
  saveOperationsAeriennes,
  updateProspectionExtensiveReference,
  updateProspectionGpsPosition,
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
import { DateField } from '@/components/DateField';
import { LieuAerienField } from '@/components/referentiel/LieuAerienField';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const GREEN = '#235a36';
const TEXT_SECONDARY = '#6f6a59';
// Teinte dédiée aux zones à REMPLIR du bloc aéronef/équipe (distincte du vert
// AUTO_BG déjà réservé aux informations auto-remplies À LIRE) — un crème plus
// doré que le fond de page (BG), volontairement subtil (cf. demande UX : « ne
// pas utiliser des couleurs trop fortes »).

/**
 * Auto-généré côté client comme n_fiche (cf. reference.tsx), faute de
 * numérotation serveur pour l'extensif. #sigle-utilisateur-numero-fiche : le
 * sigle de l'utilisateur connecté s'insère entre la date et le suffixe final
 * quand il est renseigné — jamais une chaîne vide (pas de tiret orphelin).
 *
 * #numero-fiche-extensive-terr-aer : `suffixeMode` ajoute « -TERR »/« -AER »
 * en toute fin, pour une fiche de prospection Extensive (jamais une
 * vérification de signalement — cf. appelant) — distingue les deux modes
 * d'un seul coup d'œil sur le numéro, sans ouvrir la fiche.
 */
function generateNumeroMessage(
  draftId: string,
  dateProspection: string,
  sigle?: string | null,
  suffixeMode?: 'TERR' | 'AER' | null
): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 4).toUpperCase();
  const sigleParts = sigle ? `${sigle}-` : '';
  const suffixe = suffixeMode ? `-${suffixeMode}` : '';
  return `${datePart}-${sigleParts}${idPart}${suffixe}`;
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
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  focusedField: string | null;
  setFocusedField: Dispatch<SetStateAction<string | null>>;
  style?: StyleProp<ViewStyle>;
  keyboardType?: 'default' | 'number-pad';
}) {
  const isFocused = focusedField === label;
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
  return (
    <View style={[styles.aerienFieldGroup, style]}>
      <Text style={styles.aerienFieldLabel}>{label}</Text>
      <View style={[styles.aerienFieldBox, isFocused && styles.aerienFieldBoxFocused]}>
        <TextInput
          testID={`aerien-field-${label}`}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocusedField(label)}
          onBlur={() => setFocusedField((current) => (current === label ? null : current))}
          placeholderTextColor={TEXT_SECONDARY}
          style={styles.aerienFieldInput}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

/** Bouton de localisation manuelle + affichage des coordonnées déjà captées
 * (Base principale/secondaire, #base-principale-secondaire-numero-date-gps) —
 * jamais de capture automatique, contrairement à la position GPS de la fiche
 * elle-même. */
function LocalisationBaseField({
  position,
  onLocaliser,
  isLoading,
}: {
  position: { latitude: number; longitude: number } | null;
  onLocaliser: () => void;
  isLoading: boolean;
}) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
  return (
    <View style={styles.gpsBaseRow}>
      <TouchableOpacity
        onPress={onLocaliser}
        style={styles.gpsBaseButton}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        <Text style={styles.gpsBaseButtonText}>📍 {isLoading ? 'Localisation…' : 'Localiser'}</Text>
      </TouchableOpacity>
      <Text style={styles.gpsBaseValue}>
        {position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Coordonnées non renseignées'}
      </Text>
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
  // #numero-fiche-extensive-terr-aer : jamais pour une vérification de
  // signalement (`isValidation`) — seulement la prospection Extensive
  // elle-même, comme demandé.
  const suffixeNumeroMode: 'TERR' | 'AER' | null = isValidation ? null : isAerien ? 'AER' : 'TERR';
  // #revalidation-verrouillage-localisation : une fiche née de « Prospections
  // à revalider » (`demarrerRevalidation`) documente la MÊME localisation que
  // la fiche périmée qu'elle revalide — revérifier une situation ne veut pas
  // dire la déplacer. Seule la Station (le seul champ de localisation
  // réellement modifiable ici ; GPS et Région/District/Commune ne sont de
  // toute façon que des affichages, jamais des champs de saisie) est donc
  // verrouillée pour ce cas précis.
  const estRevalidation = draft?.revalide_de_id != null;
  const signalerChargement = useSignalerChargement('extensive-reference');

  const [latitude, setLatitude] = useState<string>(draft?.latitude != null ? String(draft.latitude) : '');
  const [longitude, setLongitude] = useState<string>(draft?.longitude != null ? String(draft.longitude) : '');
  const [isLoadingGps, setIsLoadingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  // Région/District/Commune — même mécanisme que reference.tsx (Intensif) :
  // dérivés du géocodage inverse (`reverseGeocode`) dès l'acquisition GPS,
  // purement informatifs (pas de champ à saisir), affichés sous Latitude/
  // Longitude. Colonnes déjà persistées à la capture (`updateProspectionGpsPosition`
  // ci-dessous, #localite-traitement-poste-acridien-autre-agent) — cet état
  // local n'est que l'affichage, restauré depuis `draft` sur une fiche
  // rouverte (la persistance immédiate ne met jamais à jour le store, cf.
  // commentaire plus bas sur ce même principe pour `position`).
  const [adminArea, setAdminArea] = useState<{ region: string | null; district: string | null; commune: string | null }>({
    region: draft?.region ?? null,
    district: draft?.district ?? null,
    commune: draft?.commune ?? null,
  });
  const [stationLibre, setStationLibre] = useState(draft?.station_libre ?? '');
  // #station-gps-auto : indicateur du géocodage inverse en cours, distinct de
  // `isLoadingGps` (l'acquisition GPS elle-même) — le champ Station reste
  // éditable pendant ce temps, ce n'est qu'un texte informatif sous le champ.
  const [isDetectingStation, setIsDetectingStation] = useState<boolean>(false);
  // Type de station / biotope (#biotope-multi) : sélection multiple,
  // désormais TOUJOURS obligatoire (au moins un sélectionné) — même règle
  // que Biotope sur reference.tsx (Intensif), contrôlée dans handleContinue.
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
    draft?.n_message ??
      (draftId && draft ? generateNumeroMessage(draftId, draft.date_prospection, user?.sigle, suffixeNumeroMode) : '')
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
  // Saisie manuelle (migration backend 0063, défait la FK vers le référentiel
  // lieu_aerien posée en 0047) ; une opération aérienne « généralisée » n'en a
  // aucune (champ facultatif). Libellé « Base principale » côté affichage
  // (migration backend 0068).
  const [base, setBase] = useState(draft?.base ?? '');
  const [baseNumero, setBaseNumero] = useState(draft?.base_numero != null ? String(draft.base_numero) : '');
  const [baseDateInstallation, setBaseDateInstallation] = useState<string | null>(draft?.base_date_installation ?? null);
  const [basePosition, setBasePosition] = useState<{ latitude: number; longitude: number } | null>(
    draft?.base_latitude != null && draft?.base_longitude != null
      ? { latitude: draft.base_latitude, longitude: draft.base_longitude }
      : null
  );
  // Base secondaire (migration backend 0068) — texte libre, même schéma que la
  // base principale (date d'installation + coordonnées GPS propres).
  const [baseSecondaire, setBaseSecondaire] = useState(draft?.base_secondaire ?? '');
  const [baseSecondaireDateInstallation, setBaseSecondaireDateInstallation] = useState<string | null>(
    draft?.base_secondaire_date_installation ?? null
  );
  const [baseSecondairePosition, setBaseSecondairePosition] = useState<{ latitude: number; longitude: number } | null>(
    draft?.base_secondaire_latitude != null && draft?.base_secondaire_longitude != null
      ? { latitude: draft.base_secondaire_latitude, longitude: draft.base_secondaire_longitude }
      : null
  );
  // Label du champ actuellement focus dans le bloc aéronef/équipe (un seul à la
  // fois) — pilote uniquement l'état visuel (bordure) de `AerienField`.
  const [focusedAerienField, setFocusedAerienField] = useState<string | null>(null);
  const [operations, setOperations] = useState<OperationDraft[]>([emptyOperation()]);
  const { run, isRunning: isSaving } = useAsyncAction();
  const { run: runCapturerPositionBase, isRunning: isRunningCapturerPositionBase } = useAsyncAction();
  const { run: runCapturerPositionBaseSecondaire, isRunning: isRunningCapturerPositionBaseSecondaire } = useAsyncAction();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  // Récupération automatique des coordonnées GPS
  useEffect(() => {
    let isMounted = true;

    const fetchGpsPosition = async () => {
      // Si les coordonnées existent déjà dans le brouillon, on les utilise
      // (une heure d'observation déjà enregistrée est restaurée telle quelle,
      // sans jamais relancer d'acquisition GPS simplement parce que l'écran
      // est remonté — même règle que observations.tsx).
      if (draft?.latitude != null && draft?.longitude != null) {
        if (isMounted) {
          setLatitude(String(draft.latitude));
          setLongitude(String(draft.longitude));
          if (draft.heure_observation_at) setHeureObservationAt(draft.heure_observation_at);
          setAdminArea({ region: draft.region ?? null, district: draft.district ?? null, commune: draft.commune ?? null });
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

        // #station-gps-auto : localité auto-détectée depuis les coordonnées qu'on
        // vient d'acquérir — uniquement sur une acquisition FRAÎCHE (jamais sur
        // une fiche rouverte, cf. le retour anticipé ci-dessus quand
        // `draft.latitude`/`draft.longitude` existent déjà), et jamais si la
        // fiche a été fermée entre-temps (`isMounted`).
        //
        // `reverseGeocode` (lib/location.ts) est le même best-effort déjà
        // utilisé par reference.tsx (Intensif) et (traitement)/references.tsx :
        // il ne lève jamais, rend des null en cas d'échec (hors ligne, service
        // indisponible, localité indéterminable) — la fiche continue alors
        // normalement, Station restant à saisir à la main comme aujourd'hui.
        //
        // `current || localite` ne remplit que si le champ est encore vide au
        // moment où la réponse arrive : jamais d'écrasement d'une saisie
        // manuelle déjà commencée pendant l'attente, ni de la valeur restaurée
        // par l'effet d'hydratation d'une fiche existante.
        if (isMounted) setIsDetectingStation(true);
        const zone = await reverseGeocode(position.latitude, position.longitude);
        const localite = zone.commune || zone.district || zone.region;
        if (isMounted) {
          if (localite) setStationLibre((current) => current || localite);
          setIsDetectingStation(false);
          // Région/District/Commune — purement informatifs (cf. commentaire sur
          // `adminArea` plus haut), même valeurs que celles persistées ci-dessous.
          setAdminArea({ region: zone.region, district: zone.district, commune: zone.commune });
        }

        // #brouillon-gps-persistance-immediate : même garde-fou que
        // reference.tsx (Intensif) — persiste la position dès sa capture,
        // indépendamment du reste du formulaire (station, surfaces…), jamais
        // encore renseigné à ce stade sur une fiche neuve. Sans ça, la position
        // ne survivait qu'en état React local : quitter la fiche avant
        // « Suivant » la perdait, et une réouverture relançait une nouvelle
        // capture GPS au lieu de restaurer celle déjà obtenue.
        //
        // region/district/commune (issus de `zone` ci-dessus) sont désormais
        // persistés ici aussi, comme pour l'Intensif : sans ça, la liste
        // « Nouvelle fiche de traitement » (prospection-picker.tsx) affichait
        // « localisation non renseignée » pour toute fiche Extensive validée,
        // alors que la localité était bien connue (juste jamais écrite dans
        // ces colonnes, seulement dans `station_libre`).
        if (draftId) {
          try {
            // Ne met pas à jour le store (`setDraft`) : `draft.latitude`/
            // `draft.longitude` sont des dépendances de cet effet, et les
            // mettre à jour ici le referait tourner aussitôt avec des
            // coordonnées désormais non nulles, basculant à tort sur la
            // branche « déjà restauré » juste après la capture. La
            // persistance SQLite suffit — une réouverture ultérieure la lit
            // via `hydrateFromDraft`, sans dépendre de l'état mémoire courant.
            await updateProspectionGpsPosition(draftId, {
              latitude: position.latitude,
              longitude: position.longitude,
              altitude: null,
              region: zone.region,
              district: zone.district,
              commune: zone.commune,
            });
          } catch (error) {
            logger.ignore(error, 'Persistance immédiate de la position GPS impossible, position conservée en mémoire');
          }
        }
      } catch (error) {
        // Best-effort délibéré : déjà visible via `gpsError`, l'agent peut
        // saisir les coordonnées — et la station — à la main.
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
  }, [draft?.latitude, draft?.longitude, draft?.heure_observation_at, draftId]);

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
      setNMessage(
        draft.n_message ??
          generateNumeroMessage(
            draft.id,
            draft.date_prospection,
            user?.sigle,
            draft.type_prospection === 'validation' ? null : draft.mode_extensif === 'aerien' ? 'AER' : 'TERR'
          )
      );
      if (draft.heure_observation_at) setHeureObservationAt(draft.heure_observation_at);
      // Mode aérien uniquement — sans effet sur une fiche terrestre (colonnes NULL).
      setSociete(draft.societe ?? '');
      setImmatriculeAeronef(draft.immatricule_aeronef ?? '');
      setPilote(draft.pilote ?? '');
      setMecanicien(draft.mecanicien ?? '');
      setChefDeBase(draft.chef_de_base ?? '');
      setBase(draft.base ?? '');
      setBaseNumero(draft.base_numero != null ? String(draft.base_numero) : '');
      setBaseDateInstallation(draft.base_date_installation ?? null);
      setBasePosition(
        draft.base_latitude != null && draft.base_longitude != null
          ? { latitude: draft.base_latitude, longitude: draft.base_longitude }
          : null
      );
      setBaseSecondaire(draft.base_secondaire ?? '');
      setBaseSecondaireDateInstallation(draft.base_secondaire_date_installation ?? null);
      setBaseSecondairePosition(
        draft.base_secondaire_latitude != null && draft.base_secondaire_longitude != null
          ? { latitude: draft.base_secondaire_latitude, longitude: draft.base_secondaire_longitude }
          : null
      );
    });
  }, [draft, draftId, user?.sigle]);

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

  // Localisation manuelle de la Base principale/secondaire (#base-principale-
  // secondaire-numero-date-gps) — sur demande explicite (bouton), jamais
  // automatique : contrairement à la position GPS de la fiche elle-même
  // (capturée à l'ouverture de l'écran), une base n'est pas forcément là où
  // l'agent se trouve au moment de remplir la fiche. `getCurrentPosition`
  // (lib/location.ts) fonctionne hors ligne (GPS de l'appareil, pas un
  // service réseau) — cohérent avec « généré par le gps hors ligne ».
  const capturerPositionBase = () =>
    runCapturerPositionBase(
      async () => {
        const pos = await getCurrentPosition();
        setBasePosition({ latitude: pos.latitude, longitude: pos.longitude });
      },
      { screen: 'extensive-reference', context: { champ: 'base_principale' } }
    );

  const capturerPositionBaseSecondaire = () =>
    runCapturerPositionBaseSecondaire(
      async () => {
        const pos = await getCurrentPosition();
        setBaseSecondairePosition({ latitude: pos.latitude, longitude: pos.longitude });
      },
      { screen: 'extensive-reference', context: { champ: 'base_secondaire' } }
    );

  const handleContinue = () => {
    // #position-hors-madagascar : même garde-fou que reference.tsx (Intensif),
    // absente jusqu'ici sur l'Extensif/la Validation — une position hors de
    // Madagascar (y compris en pleine mer) n'est jamais acceptée.
    const latNum = latitude ? parseFloat(latitude) : null;
    const lonNum = longitude ? parseFloat(longitude) : null;
    if (latNum != null && lonNum != null) {
      const { blocages: gpsBlocages } = validateGpsPosition({ latitude: latNum, longitude: lonNum, accuracy: null });
      if (gpsBlocages.length > 0) {
        Alert.alert('⚠️ Position GPS invalide', gpsBlocages.join('\n'));
        return;
      }
    }

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

    // Cohérence relationnelle prospectée >= infestée (ADR-006), même règle que
    // reference.tsx (Intensif) — cet écran ne collecte jamais `surface_prospectee`
    // (l'Extensif/la Validation ne connaissent que Station et Infestée), mais la
    // colonne peut déjà porter une valeur héritée d'une revalidation
    // (`demarrerRevalidation` clone TOUTES les colonnes sauf celles listées dans
    // `COLONNES_REVALIDATION_NON_CLONEES`, y compris `surface_prospectee`). Sans
    // ce contrôle, une fiche revalidée où l'agent relève une surface infestée plus
    // grande qu'avant échouait silencieusement à la synchronisation
    // (`SurfaceInfesteeSuperieureError`, backend) sans qu'aucun champ visible ici
    // n'explique pourquoi.
    const surfaceInfesteeNum = surfaceInfestee ? parseFloat(surfaceInfestee) : 0;
    if (draft?.surface_prospectee != null && surfaceInfesteeNum > draft.surface_prospectee) {
      Alert.alert(
        'Surface infestée invalide',
        `La surface infestée (${surfaceInfesteeNum} ha) ne peut pas dépasser la surface prospectée (${draft.surface_prospectee} ha) déjà connue pour cette fiche.`
      );
      return;
    }

    // Biotope est TOUJOURS obligatoire (#biotope-multi : au moins un sélectionné)
    // — même règle que reference.tsx (Intensif), désormais alignée sur l'Extensif.
    if (selectedTypeStation.length === 0) {
      Alert.alert('Biotope requis', 'Choisissez au moins un type de biotope (station).');
      return;
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
          // Facultative, 0 par défaut si non saisie (aucune infestation) — même
          // règle que reference.tsx (Intensif) : sans ça, la Cible de traitement
          // dérivée (surface_infestee_ha) affichait "non renseigné" au lieu de 0
          // pour toute fiche Extensif/Validation où l'agent n'a rien à reporter ici.
          surfaceInfestee: surfaceInfestee ? parseFloat(surfaceInfestee) : 0,
          nMessage: nMessage || null,
          heureObservationAt,
          societe: isAerien ? societe || null : null,
          immatriculeAeronef: isAerien ? immatriculeAeronef || null : null,
          pilote: isAerien ? pilote || null : null,
          mecanicien: isAerien ? mecanicien || null : null,
          chefDeBase: isAerien ? chefDeBase || null : null,
          base: isAerien ? base || null : null,
          baseNumero: isAerien && baseNumero ? parseInt(baseNumero, 10) : null,
          baseDateInstallation: isAerien ? baseDateInstallation : null,
          baseLatitude: isAerien ? basePosition?.latitude ?? null : null,
          baseLongitude: isAerien ? basePosition?.longitude ?? null : null,
          baseSecondaire: isAerien ? baseSecondaire || null : null,
          baseSecondaireDateInstallation: isAerien ? baseSecondaireDateInstallation : null,
          baseSecondaireLatitude: isAerien ? baseSecondairePosition?.latitude ?? null : null,
          baseSecondaireLongitude: isAerien ? baseSecondairePosition?.longitude ?? null : null,
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
              {/* Prospection extensive = pas de station fixe du référentiel : nom pré-rempli
                  par géocodage inverse dès que le GPS ci-dessous obtient un fix
                  (#station-gps-auto), mais reste un champ texte librement modifiable —
                  contrairement à l'intensif (station_id, référentiel, cf. reference.tsx). */}
              <Text style={styles.label}>Station (saisie libre)</Text>
              <TextInput
                value={stationLibre}
                onChangeText={setStationLibre}
                placeholder="Nom du lieu-dit / repère local"
                placeholderTextColor={TEXT_SECONDARY}
                editable={!estRevalidation}
                style={[styles.input, estRevalidation && styles.inputLocked]}
              />
              {estRevalidation ? (
                <Text style={styles.stationAutoHint}>
                  Localisation reprise de la fiche revalidée — non modifiable.
                </Text>
              ) : isDetectingStation ? (
                <Text style={styles.stationAutoHint}>Détection automatique de la localité…</Text>
              ) : null}
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
              <Text style={styles.autoLabel}>Région / District / Commune</Text>
              {isLoadingGps ? (
                <Text style={styles.gpsLoading}>Récupération GPS...</Text>
              ) : (
                <Text style={styles.autoValue}>
                  {[adminArea.region, adminArea.district, adminArea.commune].filter(Boolean).join(' · ') || '—'}
                </Text>
              )}
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

                  {/* Le champ reste du texte libre (migration backend 0063, défait
                   * la FK vers le référentiel lieu_aerien posée en 0047, même
                   * décision produit que le Traitement Aérien en 0054) — jamais
                   * bloquant si le référentiel est vide ou hors-ligne. Mais
                   * `LieuAerienField` (#prospection-extensive-aerienne-lieu-
                   * aerien) suggère désormais les lieux déjà enregistrés et
                   * permet d'en créer un nouveau, sans réintroduire la FK.
                   * Facultatif : une opération aérienne « généralisée » n'est
                   * rattachée à aucune base. */}
                  <LieuAerienField
                    label="Base principale"
                    value={base}
                    onChangeText={setBase}
                    focusedField={focusedAerienField}
                    setFocusedField={setFocusedAerienField}
                  />
                  <View style={styles.aerienFieldRowSplit}>
                    <AerienField
                      label="Numéro de base"
                      value={baseNumero}
                      onChangeText={(v) => setBaseNumero(v.replace(/[^0-9]/g, ''))}
                      focusedField={focusedAerienField}
                      setFocusedField={setFocusedAerienField}
                      style={[styles.flex1, styles.aerienFieldNoMargin]}
                      keyboardType="number-pad"
                    />
                    <View style={[styles.aerienFieldGroup, styles.flex1, styles.aerienFieldNoMargin]}>
                      <Text style={styles.aerienFieldLabel}>Date d&apos;installation</Text>
                      <DateField value={baseDateInstallation} onChange={setBaseDateInstallation} />
                    </View>
                  </View>
                  <LocalisationBaseField
                    position={basePosition}
                    onLocaliser={capturerPositionBase}
                    isLoading={isRunningCapturerPositionBase}
                  />

                  <Text style={styles.aerienSubgroupLabel}>Base secondaire</Text>
                  <AerienField
                    label="Base secondaire"
                    value={baseSecondaire}
                    onChangeText={setBaseSecondaire}
                    focusedField={focusedAerienField}
                    setFocusedField={setFocusedAerienField}
                  />
                  <View style={styles.aerienFieldGroup}>
                    <Text style={styles.aerienFieldLabel}>Date d&apos;installation</Text>
                    <DateField value={baseSecondaireDateInstallation} onChange={setBaseSecondaireDateInstallation} />
                  </View>
                  <LocalisationBaseField
                    position={baseSecondairePosition}
                    onLocaliser={capturerPositionBaseSecondaire}
                    isLoading={isRunningCapturerPositionBaseSecondaire}
                  />
                </View>

                <Text style={styles.sectionLabel}>Informations sur les heures de vol</Text>
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
                        {/* « Convoyage » et « Divers » retirés définitivement de la saisie
                         * (#operations-heures-vol, puis #type-operation-prospection-seule) — pour la
                         * prospection, le seul type d'opération est « Prospection ». Les deux valeurs
                         * restent dans `TYPE_OPERATION_OPTIONS`/`TypeOperationAerienne` pour que les
                         * opérations déjà enregistrées avec l'un de ces types continuent de s'afficher
                         * correctement (récap, `typeOperationLabel`). Filtrage au seul point de rendu
                         * du picker. */}
                        {TYPE_OPERATION_OPTIONS.filter((option) => option.value === 'prospection').map((option) => {
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

                      {/* Température/Vent retirés de la saisie (#operations-heures-vol) — seules les
                       * heures début/fin restent, affichées côte à côte sur une même ligne pour une
                       * présentation plus compacte. Les colonnes SQLite/backend correspondantes restent
                       * nullables et inchangées : les opérations déjà enregistrées avec ces valeurs
                       * continuent de s'afficher normalement dans le récap. */}
                      <View style={styles.operationRow}>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Heure début opération</Text>
                          <TimeField
                            value={op.debutHeure || null}
                            onChange={(v) => updateOperation(index, { debutHeure: v })}
                          />
                        </View>
                        <View style={styles.operationCell}>
                          <Text style={styles.operationCellLabel}>Heure fin opération</Text>
                          <TimeField
                            value={op.finHeure || null}
                            onChange={(v) => updateOperation(index, { finHeure: v })}
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
                  <Text style={styles.totalJourLabel}>TOTAL HEURES</Text>
                  <Text style={styles.totalJourValue}>{formatDuree(totalJourMinutes)}</Text>
                </View>
              </>
            )}

            <Text style={[styles.sectionLabel, styles.requiredLabel]}>Biotopes (type de station) — sélection multiple *</Text>
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

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  quoteText: 11.5,
  autoLabel: 9,
  autoValue: 13,
  autoValueMono: 13,
  autoInputMono: 13,
  label: 9,
  input: 13,
  sectionLabel: 10,
  chip: 11.5,
  hintText: 10.5,
  continueButtonText: 15,
  gpsLoading: 13,
  gpsErrorText: 10,
  stationAutoHint: 10,
  aerienInfoIcon: 14,
  aerienInfoTitle: 11,
  aerienSubgroupLabel: 9,
  aerienFieldLabel: 9,
  aerienFieldInput: 13,
  gpsBaseButtonText: 12,
  gpsBaseValue: 11.5,
  operationTitle: 11,
  operationRemove: 11,
  operationCellLabel: 8.5,
  operationInput: 13,
  operationTotalLabel: 11,
  operationTotalValue: 15,
  addOperationButtonText: 13,
  totalJourLabel: 12,
  totalJourValue: 20,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.screen },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: typeSizes.back, fontWeight: '700', color: theme.muted },
  title: { fontSize: typeSizes.title, fontWeight: '700', color: theme.text },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.chipBg },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  quoteBanner: { backgroundColor: theme.warnBg, borderWidth: 1, borderColor: theme.warnBorder, borderRadius: 10, padding: 11, marginBottom: 10 },
  quoteText: { fontSize: typeSizes.quoteText, lineHeight: 16, color: theme.warn, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  autoCard: { backgroundColor: theme.successBg, borderRadius: 10, padding: 9, marginBottom: 8 },
  autoLabel: { fontSize: typeSizes.autoLabel, fontWeight: '600', color: GREEN, textTransform: 'uppercase' },
  autoValue: { fontSize: typeSizes.autoValue, fontWeight: '700', color: theme.text },
  autoValueMono: { fontSize: typeSizes.autoValueMono, fontWeight: '700', color: theme.text, fontFamily: 'monospace' },
  autoInputMono: { fontSize: typeSizes.autoInputMono, fontWeight: '700', color: theme.text, fontFamily: 'monospace', padding: 0 },
  card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 10, padding: 9, marginBottom: 8 },
  label: { fontSize: typeSizes.label, fontWeight: '600', color: theme.faint, textTransform: 'uppercase' },
  input: { fontSize: typeSizes.input, fontWeight: '600', color: theme.text, padding: 0 },
  // #revalidation-verrouillage-localisation : Station non modifiable.
  inputLocked: { color: theme.muted },
  sectionLabel: { fontSize: typeSizes.sectionLabel, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 7 },
  requiredLabel: { color: theme.danger },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { 
    fontSize: typeSizes.chip, 
    fontWeight: '600', 
    color: theme.muted, 
    backgroundColor: theme.inputBg, 
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
  hintText: { fontSize: typeSizes.hintText, color: theme.faint, marginTop: 8, marginBottom: 10 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.continueButtonText },
  gpsLoading: { 
    fontSize: typeSizes.gpsLoading, 
    fontWeight: '600', 
    color: theme.muted,
    fontStyle: 'italic'
  },
  gpsErrorText: {
    fontSize: typeSizes.gpsErrorText,
    color: theme.danger,
    marginTop: 2
  },
  stationAutoHint: {
    fontSize: typeSizes.stationAutoHint,
    color: theme.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // ===== Mode aérien =====
  // Bloc « Informations aéronef / équipe » (#ux-aerien) : un conteneur visuel
  // dédié — icône + titre, sous-groupes Aéronef/Équipe/Base — pour que l'agent
  // identifie la zone d'un coup d'œil, plutôt que des champs mêlés au reste.
  aerienInfoBlock: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 12, padding: 12, marginBottom: 10 },
  aerienInfoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: theme.inputBorder },
  aerienInfoIcon: { fontSize: typeSizes.aerienInfoIcon, color: GREEN },
  aerienInfoTitle: { fontSize: typeSizes.aerienInfoTitle, fontWeight: '800', color: GREEN, letterSpacing: 0.5, textTransform: 'uppercase' },
  aerienSubgroupLabel: { fontSize: typeSizes.aerienSubgroupLabel, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  // Zone À REMPLIR (vs. les `autoCard`/`card` de lecture ailleurs sur cet écran) :
  // fond theme.warnBg, bordure GREEN en focus — cf. commentaire de theme.warnBg plus haut.
  aerienFieldGroup: { marginBottom: 10 },
  aerienFieldNoMargin: { marginBottom: 0 },
  aerienFieldLabel: { fontSize: typeSizes.aerienFieldLabel, fontWeight: '600', color: theme.faint, textTransform: 'uppercase', marginBottom: 4 },
  aerienFieldBox: { backgroundColor: theme.warnBg, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  aerienFieldBoxFocused: { borderColor: GREEN, borderWidth: 1.5 },
  aerienFieldInput: { fontSize: typeSizes.aerienFieldInput, fontWeight: '600', color: theme.text, padding: 0 },
  aerienFieldRowSplit: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  gpsBaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  gpsBaseButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  gpsBaseButtonText: { fontSize: typeSizes.gpsBaseButtonText, fontWeight: '700', color: '#fff' },
  gpsBaseValue: { fontSize: typeSizes.gpsBaseValue, fontWeight: '600', color: theme.muted, flexShrink: 1 },
  // « Motif du divers » (#ux-aerien) : même style de zone à remplir que le bloc
  // aéronef/équipe, réutilisé ici pour rester cohérent visuellement.
  operationMotifDivers: { marginTop: 4 },
  operationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  operationTitle: { fontSize: typeSizes.operationTitle, fontWeight: '800', color: GREEN, letterSpacing: 0.4 },
  operationRemove: { fontSize: typeSizes.operationRemove, fontWeight: '700', color: theme.danger },
  operationSubLabel: { marginTop: 10, marginBottom: 6 },
  operationRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  operationCell: { flex: 1, backgroundColor: theme.successBg, borderRadius: 8, padding: 8 },
  operationCellLabel: { fontSize: typeSizes.operationCellLabel, fontWeight: '600', color: GREEN, textTransform: 'uppercase', marginBottom: 3 },
  operationInput: { fontSize: typeSizes.operationInput, fontWeight: '700', color: theme.text, padding: 0 },
  operationTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.inputBorder },
  operationTotalLabel: { fontSize: typeSizes.operationTotalLabel, fontWeight: '700', color: theme.muted, textTransform: 'uppercase' },
  operationTotalValue: { fontSize: typeSizes.operationTotalValue, fontWeight: '800', color: GREEN, fontFamily: 'monospace' },
  addOperationButton: { borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  addOperationButtonText: { fontSize: typeSizes.addOperationButtonText, fontWeight: '700', color: GREEN },
  totalJourCard: { backgroundColor: GREEN, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalJourLabel: { fontSize: typeSizes.totalJourLabel, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  totalJourValue: { fontSize: typeSizes.totalJourValue, fontWeight: '800', color: '#fff', fontFamily: 'monospace' },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
