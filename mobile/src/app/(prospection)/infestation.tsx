import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TYPE_CIBLE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { EspeceSelection, parseEspeceSelection } from '@/lib/prospection-especes';
import {
  CaptureRow,
  DraftProspection,
  InfestationRow,
  deleteProspectionInfestation,
  getDerniereDensiteMemeSite,
  getProspection,
  listAllProspectionCaptures,
  listAllProspectionInfestations,
  saveProspectionInfestation,
  updateProspectionAvertissements,
} from '@/lib/prospection-repository';
import {
  COMPASS_DIRECTIONS,
  comportementInsight,
  densityInsight,
  oppositeDirection,
} from '@/lib/prospection-infestation-insights';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { TimeField } from '@/components/TimeField';
import {
  AerialPopulationClassification,
  TAILLE_GROUPE_SEUIL_BANDE_M2,
  classifyAerialPopulation,
  isHeureNocturne,
  normalizeAerialClassification,
  validateComportementDirection,
  validateEcartHistorique,
  validateEssaimNocturne,
  validateGroupementLarvaire,
  validateInfestationFormation,
} from '@/lib/prospection-validation';
import {
  StadeDominantBucket,
  dominantStadeImago,
  dominantStadeLarve,
} from '@/lib/prospection-capture-store';

/**
 * Les paires proposées à la saisie — ordre d'affichage, labels partagés capture/hint.
 * L5-L6/L6-L7 couvrent NSE (larves jusqu'à L7) ; LMC s'arrête à L5, ces deux paires n'y
 * seront simplement jamais suggérées automatiquement (cf. `dominantStadeLarve`).
 */
const STADE_DOMINANT_OPTIONS: { value: StadeDominantBucket; label: string }[] = [
  { value: 'l1_l2', label: 'L1-L2' },
  { value: 'l2_l3', label: 'L2-L3' },
  { value: 'l3_l4', label: 'L3-L4' },
  { value: 'l4_l5', label: 'L4-L5' },
  { value: 'l5_l6', label: 'L5-L6' },
  { value: 'l6_l7', label: 'L6-L7' },
];

function stadeDominantLabel(value: StadeDominantBucket | null): string {
  return STADE_DOMINANT_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#f6f3e9';
const TARGET_ACTIVE = '#c0412b';

// Groupes incompatibles (au sein d'un même groupe, un seul type sélectionnable à la fois)
// "essaim" a disparu (migration backend 0031) : Dense et Très dense sont désormais des
// types de cible à part entière (comme Vol clair), plus une sous-classification.
const INCOMPATIBLE_GROUPS = {
  larve: ['tache_larvaire', 'bande_larvaire'],
  imago: ['vol_clair', 'dense', 'tres_dense'],
};

// Stade requis pour que chaque type de cible soit disponible : un type "larve" n'a de
// sens que si des larves ont été prospectées sur cette fiche (et inversement pour "imago").
const TARGET_STADE: Record<string, 'imago' | 'larve'> = {
  tache_larvaire: 'larve',
  bande_larvaire: 'larve',
  vol_clair: 'imago',
  dense: 'imago',
  tres_dense: 'imago',
};

interface FormationForm {
  tailleMin: string;
  tailleMax: string;
  tailleMoy: string;
  surfaceTotale: string;
  densMin: string;
  densMax: string;
  densMoy: string;
  interdistanceMin: string;
  interdistanceMax: string;
  interdistanceMoy: string;
  comportement: 'repos' | 'deplacement' | null;
  // Direction du déplacement (bande/essaim) et direction du vent sont deux mesures
  // indépendantes : le vent peut souffler dans un sens différent du déplacement observé.
  deplacementDe: string;
  deplacementVers: string;
  ventDirectionDe: string;
  ventVitesse: string;
  stadeDominant: StadeDominantBucket | null;
  tailleGroupeM2: string;
  nbTachesBandes: string;
  frontLongueurM: string;
  frontLargeurM: string;
  densiteMaxFront: string;
  densiteMoyArriereFront: string;
  essaimComportement: 'vol' | 'pose' | null;
  heureObservation: string;
  densiteEnVol: string;
  dimensionHa: string;
  surfaceContamineeHa: string;
  surfaceInfesteePourcent: string;
  aerialVolSpontane: boolean | null;
  aerialVisibleDePres: boolean | null;
  aerialMasseSombre: boolean | null;
  aerialMasquePaysage: 'partiellement' | 'entierement' | null;
  aerialStoredClassification: AerialPopulationClassification | null;
}

const AERIAL_CLASSIFICATION_LABELS: Record<AerialPopulationClassification, string> = {
  vol_clair: 'Vol clair',
  dense: 'Dense',
  tres_dense: 'Très dense',
};

function computeAerialClassification(form: FormationForm): AerialPopulationClassification | null {
  if (form.aerialVolSpontane === null) {
    return form.aerialStoredClassification;
  }
  return classifyAerialPopulation({
    volSpontaneNonProvoque: form.aerialVolSpontane,
    visibleSeulementDePres: form.aerialVisibleDePres,
    masseSombreSansMasquerPaysage: form.aerialMasseSombre,
    masquePaysage: form.aerialMasquePaysage,
  });
}

function emptyFormation(): FormationForm {
  return {
    tailleMin: '',
    tailleMax: '',
    tailleMoy: '',
    surfaceTotale: '',
    densMin: '',
    densMax: '',
    densMoy: '',
    interdistanceMin: '',
    interdistanceMax: '',
    interdistanceMoy: '',
    comportement: null,
    deplacementDe: '',
    deplacementVers: '',
    ventDirectionDe: '',
    ventVitesse: '',
    stadeDominant: null,
    tailleGroupeM2: '',
    nbTachesBandes: '',
    frontLongueurM: '',
    frontLargeurM: '',
    densiteMaxFront: '',
    densiteMoyArriereFront: '',
    essaimComportement: null,
    heureObservation: '',
    densiteEnVol: '',
    dimensionHa: '',
    surfaceContamineeHa: '',
    surfaceInfesteePourcent: '',
    aerialVolSpontane: null,
    aerialVisibleDePres: null,
    aerialMasseSombre: null,
    aerialMasquePaysage: null,
    aerialStoredClassification: null,
  };
}

function formFromRow(row: InfestationRow | undefined): FormationForm {
  if (!row) return emptyFormation();
  return {
    tailleMin: row.taille_min != null ? String(row.taille_min) : '',
    tailleMax: row.taille_max != null ? String(row.taille_max) : '',
    tailleMoy: row.taille_moy != null ? String(row.taille_moy) : '',
    surfaceTotale: row.surface_totale != null ? String(row.surface_totale) : '',
    densMin: row.densite_min != null ? String(row.densite_min) : '',
    densMax: row.densite_max != null ? String(row.densite_max) : '',
    densMoy: row.densite_moy != null ? String(row.densite_moy) : '',
    interdistanceMin: row.interdistance_min != null ? String(row.interdistance_min) : '',
    interdistanceMax: row.interdistance_max != null ? String(row.interdistance_max) : '',
    interdistanceMoy: row.interdistance_moy != null ? String(row.interdistance_moy) : '',
    comportement: (row.comportement as 'repos' | 'deplacement' | null) ?? null,
    // Indépendants : direction du déplacement (direction_de/vers) vs direction du vent
    // (vent_de) — ne plus faire retomber l'un sur l'autre (cf. anciens brouillons où les
    // deux colonnes étaient toujours écrites avec la même valeur, avant ce correctif).
    deplacementDe: row.direction_de ?? '',
    deplacementVers: row.direction_vers ?? '',
    ventDirectionDe: row.vent_de ?? '',
    ventVitesse: ventVitesseKmhToMsInput(row.vent_vitesse ?? null),
    stadeDominant: (row.stade_dominant as StadeDominantBucket | null) ?? null,
    tailleGroupeM2: row.taille_groupe_m2 != null ? String(row.taille_groupe_m2) : '',
    nbTachesBandes: row.nb_taches_bandes != null ? String(row.nb_taches_bandes) : '',
    frontLongueurM: row.front_longueur_m != null ? String(row.front_longueur_m) : '',
    frontLargeurM: row.front_largeur_m != null ? String(row.front_largeur_m) : '',
    densiteMaxFront: row.densite_max_front != null ? String(row.densite_max_front) : '',
    densiteMoyArriereFront: row.densite_moy_arriere_front != null ? String(row.densite_moy_arriere_front) : '',
    essaimComportement: row.essaim_en_vol ? 'vol' : row.essaim_pose ? 'pose' : null,
    heureObservation: row.heure_observation ?? '',
    densiteEnVol: row.densite_en_vol != null ? String(row.densite_en_vol) : '',
    dimensionHa: row.dimension_ha != null ? String(row.dimension_ha) : '',
    surfaceContamineeHa: row.surface_contaminee_ha != null ? String(row.surface_contaminee_ha) : '',
    surfaceInfesteePourcent: row.surface_infestee_pourcent != null ? String(row.surface_infestee_pourcent) : '',
    aerialVolSpontane: null,
    aerialVisibleDePres: null,
    aerialMasseSombre: null,
    aerialMasquePaysage: null,
    aerialStoredClassification: normalizeAerialClassification(row.type_essaim),
  };
}

function numOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

// Règle #8 : le champ "vent_vitesse" reste en km/h côté base/validation/backend (contrat
// OpenAPI inchangé, seuils de prospection-validation.ts déjà exprimés en km/h) — seule
// l'unité affichée/saisie à l'écran devient m/s. Conversion appliquée aux deux bornes
// (chargement/enregistrement), jamais un simple changement de texte.
const KMH_PAR_MS = 3.6;

function ventVitesseKmhToMsInput(kmh: number | null): string {
  if (kmh == null) return '';
  return String(Math.round((kmh / KMH_PAR_MS) * 10) / 10);
}

function ventVitesseMsInputToKmh(ms: string): number | null {
  if (ms === '') return null;
  const parsed = Number(ms);
  return Number.isFinite(parsed) ? Math.round(parsed * KMH_PAR_MS * 10) / 10 : null;
}

// "essaim" a disparu (migration backend 0031) : Vol clair, Dense et Très dense sont les
// 3 types de cible aériens (imago), au même niveau que Tache/Bande larvaire.
function isTypeCibleAerien(typeCible: string): boolean {
  return typeCible === 'vol_clair' || typeCible === 'dense' || typeCible === 'tres_dense';
}
// Champs auparavant réservés à "essaim" : maintenant Dense et Très dense (Vol clair,
// par nature diffus, ne les concerne pas — inchangé par rapport à avant).
function isTypeCibleDense(typeCible: string): boolean {
  return typeCible === 'dense' || typeCible === 'tres_dense';
}

function rowFromForm(typeCible: string, form: FormationForm): InfestationRow {
  const aerien = isTypeCibleAerien(typeCible);
  const dense = isTypeCibleDense(typeCible);
  return {
    espece: null,
    type_cible: typeCible,
    taille_min: numOrNull(form.tailleMin),
    taille_max: numOrNull(form.tailleMax),
    taille_moy: numOrNull(form.tailleMoy),
    surface_totale: numOrNull(form.surfaceTotale),
    densite_min: numOrNull(form.densMin),
    densite_max: numOrNull(form.densMax),
    densite_moy: numOrNull(form.densMoy),
    interdistance: null,
    interdistance_min: numOrNull(form.interdistanceMin),
    interdistance_max: numOrNull(form.interdistanceMax),
    interdistance_moy: numOrNull(form.interdistanceMoy),
    comportement: form.comportement,
    direction_de: form.deplacementDe || null,
    direction_vers: form.deplacementVers || null,
    vent_de: form.ventDirectionDe || null,
    vent_vitesse: ventVitesseMsInputToKmh(form.ventVitesse),
    pullulation_nb: null,
    taille_long: null,
    taille_large: null,
    taille_epaisseur: null,
    // Comportement de l'essaim piloté par l'État à l'écran (règles #4-#6, cf.
    // handleEtatChange) ; le filet de sécurité #106 reste appliqué ici à la sauvegarde,
    // uniquement : de nuit, un essaim ne se déplace pas, donc on force "posé" quel que
    // soit l'État affiché (l'avertissement horaire correspondant, lui, est indépendant —
    // cf. validateEssaimNocturne).
    essaim_en_vol: aerien
      ? isHeureNocturne(form.heureObservation)
        ? 0
        : form.essaimComportement === 'vol'
          ? 1
          : 0
      : null,
    essaim_pose: aerien
      ? isHeureNocturne(form.heureObservation)
        ? 1
        : form.essaimComportement === 'pose'
          ? 1
          : 0
      : null,
    // type_essaim reste alimenté (confirmation détaillée via le questionnaire séquentiel,
    // redondante avec type_cible depuis 0031 mais sans perte d'information côté backend).
    type_essaim: aerien ? computeAerialClassification(form) : null,
    nb_taches_bandes: typeCible === 'bande_larvaire' ? numOrNull(form.nbTachesBandes) : null,
    interdistance_m: null,
    surface_contaminee_ha: dense ? numOrNull(form.surfaceContamineeHa) : null,
    type_larve: null,
    surface_infestee_pourcent: dense ? numOrNull(form.surfaceInfesteePourcent) : null,
    stade_dominant: form.stadeDominant,
    taille_groupe_m2: numOrNull(form.tailleGroupeM2),
    front_longueur_m: numOrNull(form.frontLongueurM),
    front_largeur_m: numOrNull(form.frontLargeurM),
    densite_max_front: numOrNull(form.densiteMaxFront),
    densite_moy_arriere_front: numOrNull(form.densiteMoyArriereFront),
    heure_observation: aerien ? form.heureObservation || null : null,
    densite_en_vol: dense ? numOrNull(form.densiteEnVol) : null,
    dimension_ha: aerien ? numOrNull(form.dimensionHa) : null,
  };
}

/**
 * Une formation aérienne (vol clair / essaim) n'affiche pas de champ « densité moyenne » :
 * sa saisie passe par le questionnaire de classification, l'heure et les dimensions. Les
 * inclure ici évite qu'une cible aérienne renseignée soit considérée comme vide (#201).
 */
function isFilled(form: FormationForm): boolean {
  return (
    form.surfaceTotale !== '' ||
    form.densMoy !== '' ||
    form.tailleMoy !== '' ||
    form.heureObservation !== '' ||
    form.dimensionHa !== '' ||
    form.densiteEnVol !== '' ||
    form.comportement !== null ||
    form.essaimComportement !== null ||
    computeAerialClassification(form) !== null
  );
}

type Tab = 'desc' | 'comport';

export default function InfestationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [forms, setForms] = useState<Record<string, FormationForm> | null>(null);
  const [selectedTargetsRaw, setSelectedTargets] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('desc');
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('infestation');

  // Fiche chargée une seule fois au montage (réutilisée aussi par handleFooterPress
  // pour station_id, qui appelait déjà `getProspection` séparément auparavant).
  const [draftRow, setDraftRow] = useState<DraftProspection | null>(null);
  useEffect(() => {
    if (!draftId) return;
    void getProspection(draftId)
      .then(setDraftRow)
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, signalerChargement]);

  // Captures déjà saisies sur cette fiche (écran Captures) : sert à calculer
  // automatiquement le stade dominant Imagos/Larves (cf. dominantStadeLarve/Imago).
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  useEffect(() => {
    if (!draftId) return;
    void listAllProspectionCaptures(draftId)
      .then(setCaptures)
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, signalerChargement]);
  const dominantLarve = dominantStadeLarve(captures);
  const dominantImago = dominantStadeImago(captures);

  // Stades effectivement prospectés sur cette fiche (cf. species.tsx). Tant que la
  // fiche n'est pas encore chargée (ou si elle n'a pas de sélection d'espèces —
  // fiche ancienne, incomplète), on ne bloque rien plutôt que de tout désactiver
  // par erreur : `especeSelection` reste `null` et hasImago/hasLarve valent `true`.
  const especeSelection: EspeceSelection | null = draftRow?.especes ? parseEspeceSelection(draftRow.especes) : null;
  const hasImago = especeSelection ? especeSelection.lmcImago || especeSelection.nseImago : true;
  const hasLarve = especeSelection ? especeSelection.lmcLarve || especeSelection.nseLarve : true;

  const isTargetAvailable = (value: string) => {
    const stade = TARGET_STADE[value];
    return stade === 'larve' ? hasLarve : stade === 'imago' ? hasImago : true;
  };

  // Règle #6 : dérivé (pas de state dupliqué) — si le stade correspondant devient
  // indisponible (retour arrière sur species.tsx puis modification de la sélection),
  // le type de cible devenu invalide disparaît de la sélection affichée/persistée
  // sans qu'on ait besoin de le retirer explicitement de l'état brut.
  const selectedTargets = selectedTargetsRaw.filter(isTargetAvailable);

  // Cibles effectivement enregistrées en base au dernier chargement/enregistrement — sert
  // à distinguer « jamais sélectionné » de « désélectionné après avoir été enregistré » :
  // seul ce dernier cas doit déclencher une suppression (cf. persistAll ci-dessous).
  const savedTargetsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!draftId) return;
    void listAllProspectionInfestations(draftId)
      .then((rows) => {
        const byType = new Map(rows.map((row) => [row.type_cible, row]));
        const next: Record<string, FormationForm> = {};
        const selected: string[] = [];
        for (const option of TYPE_CIBLE_OPTIONS) {
          next[option.value] = formFromRow(byType.get(option.value));
          if (byType.has(option.value)) {
            selected.push(option.value);
          }
        }
        // Taille du groupe ≥ 1000 m² déjà en base : "tache" n'est plus une cible valide.
        const size = numOrNull(next.tache_larvaire?.tailleGroupeM2 ?? '') ?? 0;
        if (size >= TAILLE_GROUPE_SEUIL_BANDE_M2 && selected.includes('tache_larvaire') && !selected.includes('bande_larvaire')) {
          next.bande_larvaire = next.tache_larvaire;
          next.tache_larvaire = emptyFormation();
          selected[selected.indexOf('tache_larvaire')] = 'bande_larvaire';
        }
        setForms(next);
        setSelectedTargets(selected);
        savedTargetsRef.current = new Set(selected);
      })
      .catch((error) => signalerChargement(error, { draftId }));
  }, [draftId, signalerChargement]);

  // Règle #7 : l'heure d'observation est renseignée automatiquement (heure système, au
  // moment où l'utilisateur ouvre le détail comportemental de cette cible) plutôt que
  // saisie à la main — mais seulement si aucune heure n'a déjà été enregistrée pour cette
  // cible (ne pas recalculer/écraser une valeur existante en revenant sur ce slide).
  useEffect(() => {
    if (!forms || tab !== 'comport') return;
    const target = selectedTargets.length > 0 ? selectedTargets[0] : null;
    if (!target || !isTypeCibleAerien(target)) return;
    if (forms[target]?.heureObservation) return;
    void Promise.resolve().then(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setForms((current) =>
        current && !current[target].heureObservation
          ? { ...current, [target]: { ...current[target], heureObservation: hhmm } }
          : current
      );
    });
  }, [forms, tab, selectedTargets]);

  // Stade dominant Larves : pré-rempli automatiquement depuis les captures déjà saisies
  // (règle demandée), tout en restant modifiable manuellement — jamais écrasé si déjà
  // renseigné (rechargé depuis la base, ou déjà corrigé par le prospecteur).
  useEffect(() => {
    if (!forms || tab !== 'comport' || !dominantLarve) return;
    const target = selectedTargets.length > 0 ? selectedTargets[0] : null;
    if (target !== 'tache_larvaire' && target !== 'bande_larvaire') return;
    if (forms[target]?.stadeDominant) return;
    const bucket = dominantLarve.bucket;
    void Promise.resolve().then(() => {
      setForms((current) =>
        current && !current[target].stadeDominant
          ? { ...current, [target]: { ...current[target], stadeDominant: bucket } }
          : current
      );
    });
  }, [forms, tab, selectedTargets, dominantLarve]);

  if (!forms) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const currentTarget = selectedTargets.length > 0 ? selectedTargets[0] : TYPE_CIBLE_OPTIONS[0].value;
  const form = forms[currentTarget];
  const targetLabel = TYPE_CIBLE_OPTIONS.find((o) => o.value === currentTarget)?.label ?? currentTarget;

  // Taille du groupe ≥ 1000 m² : "tache" n'est plus une cible valide, seul "bande" reste sélectionnable
  const tacheDisabledBySize =
    (numOrNull(forms.tache_larvaire?.tailleGroupeM2 ?? '') ?? 0) >= TAILLE_GROUPE_SEUIL_BANDE_M2;

  const setField = <K extends keyof FormationForm>(field: K, value: FormationForm[K]) => {
    setForms((current) => (current ? { ...current, [currentTarget]: { ...current[currentTarget], [field]: value } } : current));

    // Le comportement de l'essaim est désormais principalement piloté par l'État
    // (repos/déplacement, cf. handleEtatChange) : l'ancienne bascule "nuit → posé" en
    // saisie live est retirée d'ici pour ne pas contredire visuellement l'État choisi.
    // Le filet de sécurité #106 (nuit → forcé "posé") reste appliqué à la sauvegarde
    // dans rowFromForm, lui, inchangé — ainsi que l'avertissement validateEssaimNocturne.

    if (
      field === 'tailleGroupeM2' &&
      currentTarget === 'tache_larvaire' &&
      (numOrNull(value as string) ?? 0) >= TAILLE_GROUPE_SEUIL_BANDE_M2 &&
      !selectedTargets.includes('bande_larvaire')
    ) {
      setSelectedTargets((current) => current.map((t) => (t === 'tache_larvaire' ? 'bande_larvaire' : t)));
      setForms((current) =>
        current
          ? { ...current, bande_larvaire: { ...current.tache_larvaire, tailleGroupeM2: value as string }, tache_larvaire: emptyFormation() }
          : current
      );
    }
  };

  // Règles #4-#6 : l'État (Repos/Déplacement) contrôle automatiquement la Direction et
  // le Comportement de l'essaim. Toggle complet (repos → déplacement → aucun état).
  const handleEtatChange = (value: 'repos' | 'deplacement') => {
    setForms((current) => {
      if (!current) return current;
      const currentForm = current[currentTarget];
      const nextEtat = currentForm.comportement === value ? null : value;
      // Seule la direction du DÉPLACEMENT est effacée/indisponible en Repos (règle #4) —
      // la direction du vent (ventDirectionDe) est indépendante de l'État de l'insecte,
      // elle n'est jamais touchée ici.
      const next: FormationForm =
        nextEtat === 'repos'
          ? { ...currentForm, comportement: 'repos', essaimComportement: 'pose', deplacementDe: '', deplacementVers: '' }
          : nextEtat === 'deplacement'
            ? { ...currentForm, comportement: 'deplacement', essaimComportement: 'vol' }
            : { ...currentForm, comportement: null, essaimComportement: null, deplacementDe: '', deplacementVers: '' };
      return { ...current, [currentTarget]: next };
    });
  };

  // Réponses "Oui/Non" du questionnaire séquentiel (classification aérienne) :
  // réversibles, avec effacement réel (pas seulement masqué) des réponses en aval
  // devenues invalides quand une réponse amont change ou est effacée.
  const handleAerialAnswer = (
    field: 'aerialVolSpontane' | 'aerialVisibleDePres' | 'aerialMasseSombre',
    value: boolean
  ) => {
    setForms((current) => {
      if (!current) return current;
      const currentForm = current[currentTarget];
      const nextValue = currentForm[field] === value ? null : value;
      const next: FormationForm = { ...currentForm, [field]: nextValue };
      if (field === 'aerialVolSpontane') {
        next.aerialVisibleDePres = null;
        next.aerialMasseSombre = null;
        next.aerialMasquePaysage = null;
      } else if (field === 'aerialVisibleDePres') {
        next.aerialMasseSombre = null;
        next.aerialMasquePaysage = null;
      } else if (field === 'aerialMasseSombre') {
        next.aerialMasquePaysage = null;
      }
      return { ...current, [currentTarget]: next };
    });
  };

  const descInsight = densityInsight(numOrNull(form.densMoy));
  const comportInsight = comportementInsight(form.comportement, form.deplacementVers || null, numOrNull(form.ventVitesse));
  const deplacementTarget = COMPASS_DIRECTIONS.find((d) => d.label === form.deplacementVers);
  const deplacementAngle = deplacementTarget ? deplacementTarget.deg : 0;
  // Le vent n'a qu'une seule direction saisie (origine, pas de colonne "vers" côté
  // backend) : contrairement au déplacement, pas de flèche origine → destination.
  const ventDirectionLabel = form.ventDirectionDe || '—';

  // ==========================================
  // LOGIQUE DE SELECTION
  // ==========================================

  const handleTargetSelect = (value: string) => {
    const isSelected = selectedTargets.includes(value);

    if (!isSelected && !isTargetAvailable(value)) {
      Alert.alert(
        'Stade non prospecté',
        TARGET_STADE[value] === 'larve'
          ? 'Aucun stade larvaire n\'a été prospecté sur cette fiche (voir l\'étape "Qu\'avez-vous observé ?").'
          : 'Aucun stade imago n\'a été prospecté sur cette fiche (voir l\'étape "Qu\'avez-vous observé ?").'
      );
      return;
    }

    if (value === 'tache_larvaire' && !isSelected && tacheDisabledBySize) {
      Alert.alert(
        'Taille ≥ 1000 m²',
        'Un groupe de cette taille est une bande, pas une tache. Sélectionnez "Bande larvaire".'
      );
      return;
    }

    // Si déjà sélectionné, on le désélectionne
    if (isSelected) {
      setSelectedTargets(selectedTargets.filter((t) => t !== value));
      return;
    }

    // Si on a déjà 2 types sélectionnés, on ne peut pas en ajouter un 3ème
    if (selectedTargets.length >= 2) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez sélectionner que 2 types de cible maximum.');
      return;
    }

    // Vérifier les incompatibilités
    let incompatibleFound = false;
    let incompatibleTarget = '';

    // Vérifier si le nouveau type est incompatible avec un type déjà sélectionné
    for (const group of Object.values(INCOMPATIBLE_GROUPS)) {
      if (group.includes(value)) {
        // Vérifier si un autre type du même groupe est déjà sélectionné
        for (const selected of selectedTargets) {
          if (group.includes(selected) && selected !== value) {
            incompatibleFound = true;
            incompatibleTarget = selected;
            break;
          }
        }
        break;
      }
    }

    if (incompatibleFound) {
      // Remplacer l'ancien par le nouveau
      setSelectedTargets(
        selectedTargets.map((t) => (t === incompatibleTarget ? value : t))
      );
      // Réinitialiser le formulaire de l'ancien type
      setForms((current) => current ? { ...current, [incompatibleTarget]: emptyFormation() } : current);
    } else {
      // Ajouter le nouveau type
      setSelectedTargets([...selectedTargets, value]);
    }
  };

  const persistAll = async () => {
    // La sélection d'une cible est elle-même une donnée : on enregistre chaque type
    // sélectionné, même partiellement rempli, sinon la sélection disparaît à la
    // réouverture de la fiche (#201).
    for (const target of selectedTargets) {
      await saveProspectionInfestation(draftId, target, rowFromForm(target, forms[target]));
    }
    // Symétrique : une cible désélectionnée après avoir été enregistrée doit disparaître
    // de la base, sinon elle réapparaît sélectionnée à la prochaine ouverture de la fiche
    // — la section Infestation doit rester réversible, pas seulement remplissable.
    for (const target of savedTargetsRef.current) {
      if (!selectedTargets.includes(target)) {
        await deleteProspectionInfestation(draftId, target);
      }
    }
    savedTargetsRef.current = new Set(selectedTargets);
  };

  const handleFooterPress = () => {
    // La section Infestation est entièrement facultative : ne rien sélectionner ne doit
    // jamais bloquer la navigation. Sans cible sélectionnée, il n'y a rien à configurer
    // dans l'onglet Comportement (masqué dans ce cas, cf. `tab === 'comport' &&
    // selectedTargets.length > 0` plus bas) — on saute donc directement l'étape et on
    // enregistre (aucune ligne à persister) avant de continuer.
    if (tab === 'desc' && selectedTargets.length > 0) {
      setTab('comport');
      return;
    }

    // Tout le contrôle passe par `run` : la lecture de l'historique (`getDerniereDensiteMemeSite`)
    // est asynchrone, la laisser hors frontière renvoyait ses échecs dans le vide (#175/#177).
    return run(
      async () => {
        // Réutilise la fiche déjà chargée au montage plutôt que de la refetcher ici.
        const draft = draftRow;

        const blocages: string[] = [];
        const avertissements: string[] = [];
        /** Sous-ensemble des avertissements relevant de #106 (plausibilité horaire, écart historique) : marque la fiche « à vérifier », visible en revue. */
        const avertissementsAVerifier: string[] = [];
        for (const target of selectedTargets) {
          const f = forms[target];
          if (!isFilled(f)) continue;
          const result = validateInfestationFormation({
            densMin: numOrNull(f.densMin),
            densMax: numOrNull(f.densMax),
            // Les seuils de validation sont exprimés en km/h (cf. VENT_VITESSE_SEUIL_*_KMH) ;
            // le formulaire saisit désormais en m/s (règle #8) — on reconvertit avant validation.
            ventVitesse: ventVitesseMsInputToKmh(f.ventVitesse),
          });
          blocages.push(...result.blocages);
          avertissements.push(...result.avertissements);

          const directionResult = validateComportementDirection({
            typeCible: target,
            comportement: f.comportement,
            directionRenseignee: !!(f.deplacementDe && f.deplacementVers),
          });
          blocages.push(...directionResult.blocages);
          avertissements.push(...directionResult.avertissements);

          if (target === 'tache_larvaire' || target === 'bande_larvaire') {
            const groupementResult = validateGroupementLarvaire({
              typeCible: target,
              nbTachesBandes: numOrNull(f.nbTachesBandes),
              interdistanceMoy: numOrNull(f.interdistanceMoy),
            });
            blocages.push(...groupementResult.blocages);
            avertissements.push(...groupementResult.avertissements);
          }

          const pushAVerifier = (result: { avertissements: string[] }) => {
            avertissements.push(...result.avertissements);
            avertissementsAVerifier.push(...result.avertissements);
          };

          if (isTypeCibleAerien(target)) {
            pushAVerifier(
              validateEssaimNocturne({ typeCible: target, heureObservation: f.heureObservation })
            );
          }

          if (draft?.station_id) {
            const derniereDensiteMoyConnue = await getDerniereDensiteMemeSite(draft.station_id, target, draft.id);
            pushAVerifier(
              validateEcartHistorique({ densiteMoyActuelle: numOrNull(f.densMoy), derniereDensiteMoyConnue })
            );
          }
        }
        if (blocages.length > 0) {
          Alert.alert('Saisie incohérente', blocages.join('\n'));
          return;
        }
        if (avertissements.length > 0) {
          Alert.alert('À vérifier', avertissements.join('\n'));
        }
        if (draftId) {
          await updateProspectionAvertissements(draftId, avertissementsAVerifier);
        }

        await persistAll();
        router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
      },
      {
        screen: 'infestation',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  const renderTargetChips = () => {
    return TYPE_CIBLE_OPTIONS.map((option) => {
      const isSelected = selectedTargets.includes(option.value);
      // Vérifier si ce type est incompatible avec un autre sélectionné
      let isIncompatible = false;
      for (const group of Object.values(INCOMPATIBLE_GROUPS)) {
        if (group.includes(option.value)) {
          for (const selected of selectedTargets) {
            if (group.includes(selected) && selected !== option.value) {
              isIncompatible = true;
              break;
            }
          }
          break;
        }
      }
      const isStadeBlocked = !isSelected && !isTargetAvailable(option.value);
      const isDisabled =
        isStadeBlocked || (option.value === 'tache_larvaire' && !isSelected && tacheDisabledBySize);

      return (
        <TouchableOpacity
          key={option.value}
          onPress={() => handleTargetSelect(option.value)}
          disabled={isDisabled}
          style={[
            styles.targetChip,
            isSelected && styles.targetChipActive,
            isIncompatible && styles.targetChipIncompatible,
            isDisabled && styles.targetChipIncompatible,
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.targetChipText, isSelected && styles.targetChipTextActive]}>
            {option.label}
          </Text>
          {isSelected && <Text style={styles.targetChipCheck}>✓</Text>}
          {isIncompatible && <Text style={styles.targetChipIncompatibleText}>⛔</Text>}
        </TouchableOpacity>
      );
    });
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
            <TouchableOpacity onPress={() => (tab === 'comport' ? setTab('desc') : router.back())} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {tab === 'desc' ? 'Infestation' : `Comportement · ${targetLabel}`}
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            {tab === 'desc' && (
              <>
                <View style={styles.toggleTrack}>
                  <TouchableOpacity onPress={() => setTab('desc')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                    <Text style={[styles.toggleSegment, tab === 'desc' && styles.toggleSegmentActive]}>Description</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setTab('comport')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                    <Text style={styles.toggleSegment}>Comportement</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Type de cible</Text>
                
                <View style={styles.targetRow}>
                  {renderTargetChips()}
                </View>

                <View style={styles.selectionInfo}>
                  <Text style={styles.selectionInfoText}>
                    {selectedTargets.length === 0 
                      ? 'Aucun type sélectionné' 
                      : `${selectedTargets.length} type${selectedTargets.length > 1 ? 's' : ''} sélectionné${selectedTargets.length > 1 ? 's' : ''}`
                    }
                  </Text>
                </View>
              </>
            )}

            {tab === 'desc' && selectedTargets.length > 0 && (
              <View style={styles.card}>
                {isTypeCibleAerien(currentTarget) && (
                  <>
                    <Text style={styles.sectionLabel}>Classification (questionnaire séquentiel)</Text>
                    <Text style={styles.fieldGroupLabel}>Vol spontané, non provoqué ?</Text>
                    <View style={styles.row2}>
                      {([true, false] as const).map((value) => {
                        const active = form.aerialVolSpontane === value;
                        return (
                          <TouchableOpacity
                            key={String(value)}
                            onPress={() => handleAerialAnswer('aerialVolSpontane', value)}
                            style={[styles.chip, active && styles.chipActive]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {value ? 'Oui' : 'Non'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {form.aerialVolSpontane === true && (
                      <>
                        <Text style={styles.fieldGroupLabel}>Visible seulement de près ?</Text>
                        <View style={styles.row2}>
                          {([true, false] as const).map((value) => {
                            const active = form.aerialVisibleDePres === value;
                            return (
                              <TouchableOpacity
                                key={String(value)}
                                onPress={() => handleAerialAnswer('aerialVisibleDePres', value)}
                                style={[styles.chip, active && styles.chipActive]}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                  {value ? 'Oui' : 'Non'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {form.aerialVolSpontane === true && form.aerialVisibleDePres === false && (
                      <>
                        <Text style={styles.fieldGroupLabel}>Masse sombre qui ne masque pas le paysage ?</Text>
                        <View style={styles.row2}>
                          {([true, false] as const).map((value) => {
                            const active = form.aerialMasseSombre === value;
                            return (
                              <TouchableOpacity
                                key={String(value)}
                                onPress={() => handleAerialAnswer('aerialMasseSombre', value)}
                                style={[styles.chip, active && styles.chipActive]}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                  {value ? 'Oui' : 'Non'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {form.aerialVolSpontane === true &&
                      form.aerialVisibleDePres === false &&
                      form.aerialMasseSombre === false && (
                        <>
                          <Text style={styles.fieldGroupLabel}>La formation masque le paysage à l&apos;arrière-plan</Text>
                          <View style={styles.row2}>
                            {(['partiellement', 'entierement'] as const).map((value) => {
                              const active = form.aerialMasquePaysage === value;
                              return (
                                <TouchableOpacity
                                  key={value}
                                  onPress={() => setField('aerialMasquePaysage', active ? null : value)}
                                  style={[styles.chip, active && styles.chipActive]}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                    {value === 'partiellement' ? 'Partiellement' : 'Entièrement'}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      )}

                    {(() => {
                      const classification = computeAerialClassification(form);
                      return (
                        <View style={styles.insightCallout}>
                          <Text style={styles.insightText}>
                            Classification :{' '}
                            {classification ? AERIAL_CLASSIFICATION_LABELS[classification] : 'en attente de réponses'}
                          </Text>
                        </View>
                      );
                    })()}
                  </>
                )}

                {(currentTarget === 'tache_larvaire' || currentTarget === 'bande_larvaire') && (
                  <>
                    <Text style={styles.fieldGroupLabel}>Stade dominant</Text>
                    <View style={styles.rowWrap}>
                      {STADE_DOMINANT_OPTIONS.map((option) => {
                        const active = form.stadeDominant === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() => setField('stadeDominant', active ? null : option.value)}
                            style={[styles.chipWrap, active && styles.chipActive]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {dominantLarve && (
                      <Text style={styles.hintText}>
                        Calculé depuis les captures : {dominantLarve.stade} ({dominantLarve.effectif} individus)
                        {dominantLarve.bucket === form.stadeDominant
                          ? ' ✓'
                          : ` → suggère ${stadeDominantLabel(dominantLarve.bucket)}`}
                      </Text>
                    )}
                  </>
                )}

                {currentTarget === 'bande_larvaire' && (
                  <>
                    <View style={styles.row2NoMargin}>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel}>Nombre de taches</Text>
                        <View style={styles.infoBoxInputRow}>
                          <TextInput
                            value={form.nbTachesBandes}
                            onChangeText={(v) => setField('nbTachesBandes', v)}
                            keyboardType="number-pad"
                            style={styles.infoBoxInput}
                          />
                        </View>
                      </View>
                    </View>

                    <Text style={styles.sectionLabel}>Dimensions du front (m)</Text>
                    <View style={styles.row3}>
                      <View style={styles.box}>
                        <Text style={styles.boxCaption}>longueur</Text>
                        <TextInput
                          value={form.frontLongueurM}
                          onChangeText={(v) => setField('frontLongueurM', v)}
                          keyboardType="decimal-pad"
                          style={styles.boxValue}
                        />
                      </View>
                      <View style={styles.box}>
                        <Text style={styles.boxCaption}>largeur</Text>
                        <TextInput
                          value={form.frontLargeurM}
                          onChangeText={(v) => setField('frontLargeurM', v)}
                          keyboardType="decimal-pad"
                          style={styles.boxValue}
                        />
                      </View>
                    </View>

                    <Text style={styles.sectionLabel}>Densité au front (/m²)</Text>
                    <View style={styles.row3}>
                      <View style={styles.box}>
                        <Text style={styles.boxCaption}>max</Text>
                        <TextInput
                          value={form.densiteMaxFront}
                          onChangeText={(v) => setField('densiteMaxFront', v)}
                          keyboardType="decimal-pad"
                          style={styles.boxValue}
                        />
                      </View>
                      <View style={styles.box}>
                        <Text style={styles.boxCaption}>moy arrière</Text>
                        <TextInput
                          value={form.densiteMoyArriereFront}
                          onChangeText={(v) => setField('densiteMoyArriereFront', v)}
                          keyboardType="decimal-pad"
                          style={styles.boxValue}
                        />
                      </View>
                    </View>
                  </>
                )}

                {descInsight && (
                  <View style={styles.insightCallout}>
                    <Text style={styles.insightText}>{descInsight}</Text>
                  </View>
                )}
              </View>
            )}

            {tab === 'comport' && selectedTargets.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.fieldGroupLabel}>État</Text>
                <View style={styles.row2}>
                  {(['repos', 'deplacement'] as const).map((value) => {
                    const active = form.comportement === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => handleEtatChange(value)}
                        style={[styles.chip, active && styles.chipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {value === 'repos' ? 'Repos' : 'Déplacement'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isTypeCibleAerien(currentTarget) && (
                  <>
                    <Text style={styles.fieldGroupLabel}>Comportement de l&apos;essaim</Text>
                    <View style={styles.row2}>
                      {(['vol', 'pose'] as const).map((value) => {
                        const active = form.essaimComportement === value;
                        // Figé par l'État (règles #4-#6) : l'option contraire à l'État
                        // sélectionné n'est pas disponible tant qu'un État est choisi.
                        const isLocked =
                          (value === 'vol' && form.comportement === 'repos') ||
                          (value === 'pose' && form.comportement === 'deplacement');
                        return (
                          <TouchableOpacity
                            key={value}
                            onPress={() => !isLocked && setField('essaimComportement', value)}
                            disabled={isLocked}
                            style={[styles.chip, active && styles.chipActive, isLocked && styles.chipDisabled]}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {value === 'vol' ? 'En vol' : 'Posé'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Purement informatif (pas de champ backend dédié aux stades imago,
                        contrairement aux larves) : calculé depuis les captures saisies. */}
                    {dominantImago && (
                      <View style={styles.insightCallout}>
                        <Text style={styles.insightText}>
                          Stade dominant calculé : {dominantImago.sexe === 'F' ? '♀' : '♂'} {dominantImago.stade} (
                          {dominantImago.effectif} individus)
                        </Text>
                      </View>
                    )}

                    <Text style={styles.fieldGroupLabel}>Heure d&apos;observation</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>hh:mm</Text>
                      <TimeField
                        value={form.heureObservation || null}
                        onChange={(value) => setField('heureObservation', value)}
                        style={styles.timeFieldBox}
                        textStyle={styles.infoBoxInput}
                        placeholderStyle={styles.infoBoxInput}
                      />
                    </View>

                    <Text style={styles.fieldGroupLabel}>Dimensions de la formation (ha)</Text>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>ha</Text>
                      <TextInput
                        value={form.dimensionHa}
                        onChangeText={(value) => setField('dimensionHa', value)}
                        placeholder="Surface estimée"
                        keyboardType="decimal-pad"
                        style={styles.infoBoxInput}
                      />
                    </View>

                    {isTypeCibleDense(currentTarget) && (
                      <>
                        <Text style={styles.fieldGroupLabel}>Densité en vol (ind./m²)</Text>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoBoxLabel}>ind./m²</Text>
                          <TextInput
                            value={form.densiteEnVol}
                            onChangeText={(value) => setField('densiteEnVol', value)}
                            placeholder="Si mesurable"
                            keyboardType="decimal-pad"
                            style={styles.infoBoxInput}
                          />
                        </View>

                        <Text style={styles.fieldGroupLabel}>Surface contaminée (ha)</Text>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoBoxLabel}>ha</Text>
                          <TextInput
                            value={form.surfaceContamineeHa}
                            onChangeText={(value) => setField('surfaceContamineeHa', value)}
                            placeholder="Surface contaminée"
                            keyboardType="decimal-pad"
                            style={styles.infoBoxInput}
                          />
                        </View>

                        <Text style={styles.fieldGroupLabel}>Dont infestée (%)</Text>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoBoxLabel}>%</Text>
                          <TextInput
                            value={form.surfaceInfesteePourcent}
                            onChangeText={(value) => setField('surfaceInfesteePourcent', value)}
                            placeholder="Part infestée"
                            keyboardType="decimal-pad"
                            style={styles.infoBoxInput}
                          />
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* Règle #4 : la direction n'a de sens qu'en Déplacement — masquée (et effacée
                    par handleEtatChange) tant que l'État n'est pas "Déplacement". */}
                {form.comportement === 'deplacement' && (
                  <>
                    <Text style={styles.fieldGroupLabel}>Direction du déplacement</Text>
                    <View style={styles.compassCard}>
                      <View style={styles.compassCircle}>
                        <Text style={[styles.compassCardinal, styles.compassCardinalN]}>N</Text>
                        <Text style={[styles.compassCardinal, styles.compassCardinalS]}>S</Text>
                        <Text style={[styles.compassCardinal, styles.compassCardinalO]}>O</Text>
                        <Text style={[styles.compassCardinal, styles.compassCardinalE]}>E</Text>
                        <View style={[styles.compassArrow, { transform: [{ rotate: `${deplacementAngle}deg` }] }]} />
                        <View style={styles.compassArrowDot} />
                      </View>
                      <View style={styles.compassChips}>
                        {COMPASS_DIRECTIONS.map((dir) => {
                          const active = dir.label === form.deplacementDe;
                          return (
                            <TouchableOpacity
                              key={dir.label}
                              onPress={() => {
                                if (active) {
                                  // Réversible : retaper la direction active la désélectionne.
                                  setField('deplacementDe', '');
                                  setField('deplacementVers', '');
                                } else {
                                  setField('deplacementDe', dir.label);
                                  setField('deplacementVers', oppositeDirection(dir.label));
                                }
                              }}
                              style={[styles.compassChip, active && styles.compassChipActive]}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.compassChipText, active && styles.compassChipTextActive]}>{dir.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Vent</Text>
                  {/* Indépendante de la direction du déplacement (règle du 24/08) : le vent
                      peut souffler dans un sens différent de celui de l'insecte. */}
                  <Text style={styles.fieldGroupLabel}>Direction du vent</Text>
                  <View style={styles.compassChips}>
                    {COMPASS_DIRECTIONS.map((dir) => {
                      const active = dir.label === form.ventDirectionDe;
                      return (
                        <TouchableOpacity
                          key={dir.label}
                          onPress={() => setField('ventDirectionDe', active ? '' : dir.label)}
                          style={[styles.compassChip, active && styles.compassChipActive]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.compassChipText, active && styles.compassChipTextActive]}>{dir.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.row2NoMargin}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Direction</Text>
                      <Text style={styles.infoBoxValue}>{ventDirectionLabel}</Text>
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Vitesse</Text>
                      <View style={styles.infoBoxInputRow}>
                        <TextInput
                          value={form.ventVitesse}
                          onChangeText={(v) => setField('ventVitesse', v)}
                          keyboardType="decimal-pad"
                          style={styles.infoBoxInput}
                        />
                        <Text style={styles.infoBoxUnit}>m/s</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {comportInsight && (
                  <View style={styles.insightCallout}>
                    <Text style={styles.insightText}>{comportInsight}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              style={[styles.continueButton, isSaving && styles.continueButtonDisabled]}
              onPress={handleFooterPress}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>
                {tab === 'desc' && selectedTargets.length > 0 ? 'Comportement  ›' : 'Continuer  ›'}
              </Text>
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
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 16, fontWeight: '800', color: TEXT },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 7 },
  hintText: { fontSize: 11, color: TEXT_SECONDARY, fontStyle: 'italic', marginBottom: 10 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  targetChip: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  targetChipActive: { backgroundColor: TARGET_ACTIVE, borderColor: TARGET_ACTIVE },
  targetChipIncompatible: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', opacity: 0.6 },
  targetChipIncompatibleText: { fontSize: 12 },
  targetChipText: { fontSize: 13, fontWeight: '700', color: TEXT },
  targetChipTextActive: { fontWeight: '800', color: '#fff' },
  targetChipCheck: { fontSize: 14, color: '#fff', fontWeight: '700' },
  selectionInfo: { alignItems: 'center', marginBottom: 12 },
  selectionInfoText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  toggleTrack: { flexDirection: 'row', backgroundColor: INACTIVE_BG, borderRadius: 11, padding: 3, gap: 3, marginBottom: 14 },
  toggleSegmentTouchable: { flex: 1 },
  toggleSegment: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    color: '#9a9484',
  },
  toggleSegmentActive: { backgroundColor: '#fff', color: TEXT },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: TEXT, marginBottom: 10 },
  fieldGroupLabel: { fontSize: 10, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7, marginTop: 12 },
  row3: { flexDirection: 'row', gap: 7 },
  row2: { flexDirection: 'row', gap: 7, marginTop: 7 },
  row2NoMargin: { flexDirection: 'row', gap: 7 },
  // Rangée qui s'enroule — pour les groupes de plus de 2-3 options (ex. stade dominant,
  // 6 paires) où `row2`/`row3` (chips `flex: 1`) deviendraient illisibles sur une ligne.
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chipWrap: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: INACTIVE_BG },
  box: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 9, minHeight: 62 },
  boxCaption: { fontSize: 10.5, fontWeight: '500', color: '#9a9484', marginBottom: 3 },
  boxValue: { fontSize: 17, fontWeight: '700', color: TEXT, padding: 0 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '800', color: '#fff' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 15, paddingVertical: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  insightCallout: { backgroundColor: '#fbeae6', borderRadius: 10, padding: 11, marginTop: 10 },
  insightText: { fontSize: 11.5, lineHeight: 16, fontWeight: '500', color: '#a8422c' },
  compassCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginTop: 7 },
  compassCircle: { width: 150, height: 150, alignSelf: 'center', borderWidth: 2, borderColor: BORDER, borderRadius: 75, marginBottom: 8 },
  compassCardinal: { position: 'absolute', fontSize: 10.5, fontWeight: '700', color: '#9a9484' },
  compassCardinalN: { top: 4, left: '50%', marginLeft: -5 },
  compassCardinalS: { bottom: 4, left: '50%', marginLeft: -5 },
  compassCardinalO: { left: 7, top: '50%', marginTop: -7 },
  compassCardinalE: { right: 7, top: '50%', marginTop: -7 },
  compassArrow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 2.5,
    height: 52,
    backgroundColor: TARGET_ACTIVE,
    marginLeft: -1.25,
    marginTop: -52,
    transformOrigin: 'bottom center',
  } as any,
  compassArrowDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: -4.5,
    marginTop: -4.5,
    backgroundColor: TARGET_ACTIVE,
  },
  compassChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  compassChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, backgroundColor: INACTIVE_BG },
  compassChipActive: { backgroundColor: TARGET_ACTIVE },
  compassChipText: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY },
  compassChipTextActive: { fontWeight: '800', color: '#fff' },
  infoBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 9, minHeight: 62 },
  infoBoxLabel: { fontSize: 10.5, fontWeight: '500', color: '#9a9484', marginBottom: 3 },
  infoBoxValue: { fontSize: 15, fontWeight: '700', color: TEXT },
  infoBoxInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  infoBoxInput: { flex: 1, fontSize: 17, fontWeight: '700', color: TEXT, padding: 0 },
  infoBoxUnit: { fontSize: 10.5, fontWeight: '600', color: '#9a9484' },
  timeFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
