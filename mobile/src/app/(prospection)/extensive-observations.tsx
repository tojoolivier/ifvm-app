import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ExtensiveObservationsUpdateInput,
  normalizeBoolean,
  updateProspectionExtensiveObservations,
} from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { DEGATS_CULTURES_EXTENSIF_OPTIONS, NIVEAU_OPTIONS } from '@/lib/prospection-extensive';
import { listUtilisateursByRole, UtilisateurEquipe } from '@/lib/referentiel-db';
import { DateField } from '@/components/DateField';
import { SignaturePad } from '@/components/traitement/SignaturePad';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

// La colonne backend `hauteur_herbe_cm` reste en centimètres (partagée avec l'intensif,
// cf. reference.tsx/observations.tsx) : seule l'unité affichée/saisie à l'écran devient
// le mètre. Conversion appliquée aux deux bornes (chargement/enregistrement), même
// principe que ventVitesseKmhToMsInput dans infestation.tsx.
const CM_PAR_M = 100;

function hauteurCmToMInput(cm: number | null): string {
  if (cm == null) return '';
  return String(Math.round((cm / CM_PAR_M) * 100) / 100);
}

function hauteurMInputToCm(m: string): number | null {
  if (m === '') return null;
  const parsed = parseFloat(m);
  return Number.isFinite(parsed) ? Math.round(parsed * CM_PAR_M * 100) / 100 : null;
}

// ==========================================
// Mode aérien — Pesticides embarqués + Signatures
// ==========================================

/** Entier non-négatif strict (zéro autorisé) — vide accepté (champ non renseigné,
 * pas bloquant), tout le reste rejeté avec un message nommant le champ en cause. */
function validerEntierPositif(raw: string, label: string): { value: number | null; erreur: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, erreur: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, erreur: `${label} : un nombre entier positif ou nul est requis.` };
  }
  return { value: parseInt(trimmed, 10), erreur: null };
}

/** Pourcentage entier 0-100 — vide accepté (champ non renseigné, pas bloquant).
 * `verdissement_pourcent` est un entier côté backend (Pydantic `int`, pas de
 * décimales acceptées aujourd'hui) : on refuse donc aussi les décimales ici,
 * plutôt que de laisser croire qu'elles seraient conservées. */
function validerPourcentage(raw: string, label: string): { value: number | null; erreur: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, erreur: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, erreur: `${label} : un nombre entier entre 0 et 100 est requis.` };
  }
  const parsed = parseInt(trimmed, 10);
  if (parsed > 100) {
    return { value: null, erreur: `${label} : la valeur ne peut pas dépasser 100 %.` };
  }
  return { value: parsed, erreur: null };
}

// VISA a été entièrement retiré (#signatures-numeriques-extensif-aerien) — les
// colonnes backend `signature_visa_nom`/`_horodatage` (migration 0036) restent en
// base pour préserver l'historique déjà enregistré, mais plus aucune UI ne les lit
// ni ne les écrit à partir d'ici.
type SignatureRole = 'consultant_fao' | 'pilote' | 'chef_base';

const SIGNATURE_LABELS: Record<SignatureRole, string> = {
  consultant_fao: 'Consultant FAO',
  pilote: 'Pilote',
  chef_base: 'Chef de Base',
};

const SIGNATURE_ROLES: SignatureRole[] = ['consultant_fao', 'pilote', 'chef_base'];

/**
 * Chef de Base reste sur le mécanisme référentiel (ROLES dans
 * app/models/users.py) — même mécanisme que le Chef de base de l'écran
 * Traitement (AerienForm.tsx) : on choisit la personne dans une liste d'agents
 * habilités (chips), on ne ressaisit jamais un nom à la main.
 *
 * Consultant FAO et Pilote n'y sont PLUS (#consultant-fao-pilote-auto) :
 * - Consultant FAO redevient une saisie libre (nom en texte + signature) — ce
 *   n'est pas un agent habilité de l'app, juste un visiteur externe dont on
 *   capture le nom au moment de la signature.
 * - Pilote n'est plus sélectionné ici du tout : son nom est celui déjà saisi
 *   sur Référence (`draft.pilote`, texte libre lui aussi), jamais ressaisi —
 *   cf. l'effet dédié plus bas qui garde `signatureNoms.pilote` synchronisé.
 */

export default function ExtensiveObservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  // Terrestre implicite (NULL) comme sur extensive-reference.tsx — le bloc
  // Pesticides embarqués/Signatures n'apparaît qu'en mode aérien choisi
  // explicitement ; le reste de cet écran reste identique dans tous les autres cas.
  const isAerien = draft?.mode_extensif === 'aerien';

  // Dégâts sur les cultures : choix unique Faible/Moyen/Forte — réutilise
  // `prospection.degats_cultures` (déjà utilisé par l'Intensif), pas
  // `degats_cultures_pourcent` (l'ancien stepper %, abandonné pour ce champ
  // mais colonne conservée : une ancienne fiche qui n'a que cette valeur
  // s'ouvre sans erreur, simplement sans sélection ici).
  const [degatsCultures, setDegatsCultures] = useState<string | null>(draft?.degats_cultures ?? null);
  // Verdure strate herbeuse : pourcentage — réutilise `prospection.verdissement_pourcent`
  // (déjà utilisé par l'Intensif), pas `verdure_strate` (l'ancien chip Faible/
  // Moyenne/Forte, abandonné pour ce champ mais colonne conservée, même principe
  // de compatibilité que ci-dessus).
  const [verdissement, setVerdissement] = useState(
    draft?.verdissement_pourcent != null ? String(draft.verdissement_pourcent) : ''
  );
  const [hauteur, setHauteur] = useState(hauteurCmToMInput(draft?.hauteur_herbe_cm ?? null));
  const [dernierePluie, setDernierePluie] = useState(draft?.derniere_pluie ?? '');
  const [intensite, setIntensite] = useState(draft?.intensite_pluie ?? 'faible');
  // « Remarques » — les deux modes (terrestre et aérien), tout en bas du slide.
  // Réutilise `prospection.observations`, déjà câblée pour l'intensif : même
  // colonne, juste un intitulé différent à l'écran (pas de nouvelle colonne).
  const [remarques, setRemarques] = useState(draft?.observations ?? '');

  // Mode aérien uniquement — invisibles et jamais lus/écrits en mode terrestre.
  const [pesticidesEmbarques, setPesticidesEmbarques] = useState<boolean | null>(
    normalizeBoolean(draft?.pesticides_embarques)
  );
  const [pesticideNomCommercial, setPesticideNomCommercial] = useState(draft?.pesticide_nom_commercial ?? '');
  const [pesticideQuantiteDisponible, setPesticideQuantiteDisponible] = useState(
    draft?.pesticide_quantite_disponible != null ? String(draft.pesticide_quantite_disponible) : ''
  );
  const [pesticideQuantiteRecue, setPesticideQuantiteRecue] = useState(
    draft?.pesticide_quantite_recue != null ? String(draft.pesticide_quantite_recue) : ''
  );
  const [futsDisponible, setFutsDisponible] = useState(draft?.futs_disponible != null ? String(draft.futs_disponible) : '');
  const [futsPleins, setFutsPleins] = useState(draft?.futs_pleins != null ? String(draft.futs_pleins) : '');
  const [futsVides, setFutsVides] = useState(draft?.futs_vides != null ? String(draft.futs_vides) : '');
  const [futsRecues, setFutsRecues] = useState(draft?.futs_recues != null ? String(draft.futs_recues) : '');

  // Signatures numériques (#signatures-numeriques-extensif-aerien) —
  // indépendantes du choix Pesticides, toujours affichées en mode aérien.
  // `signatureNoms`/`Horodatages` : nom du signataire choisi + horodatage de
  // validation. `signatureImages` : tracé SVG (`SignaturePad`), la signature
  // réelle — un rôle n'est considéré « signé » que lorsqu'elle est non nulle
  // (un nom seul, hérité d'une ancienne fiche pré-migration 0053, ne suffit
  // plus : l'écran repasse en édition tant qu'aucun tracé n'a été validé).
  // Pilote (#consultant-fao-pilote-auto) : le nom vient toujours de Référence
  // (`draft.pilote`), jamais de la signature persistée — évite un flash du nom
  // associé à une ancienne signature avant que l'effet dédié plus bas ne
  // corrige. L'horodatage/l'image ne sont repris que si la signature existante
  // correspond bien au pilote actuel ; sinon ils restent à `null` (signature
  // invalidée), l'effet dédié se chargeant de persister cette rupture.
  const piloteSigneCoherent = (draft?.signature_pilote_nom ?? null) === (draft?.pilote ?? null);
  const [signatureNoms, setSignatureNoms] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_nom ?? null,
    pilote: draft?.pilote ?? null,
    chef_base: draft?.signature_chef_base_nom ?? null,
  });
  const [signatureHorodatages, setSignatureHorodatages] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_horodatage ?? null,
    pilote: piloteSigneCoherent ? (draft?.signature_pilote_horodatage ?? null) : null,
    chef_base: draft?.signature_chef_base_horodatage ?? null,
  });
  const [signatureImages, setSignatureImages] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_image ?? null,
    pilote: piloteSigneCoherent ? (draft?.signature_pilote_image ?? null) : null,
    chef_base: draft?.signature_chef_base_image ?? null,
  });
  // Identifiant de l'agent associé à `signatureNoms[role]` — la relation
  // « qui a signé » se base sur cet id, jamais sur le seul nom affiché (§8) :
  // un changement de personne dans les chips invalide immédiatement toute
  // signature déjà validée pour l'ancien id. Résolu par appariement de nom
  // au chargement (effet plus bas) pour une fiche déjà signée avant relecture,
  // faute d'une colonne d'id côté backend (même limite que traitement_signature).
  const [signatureAgentIds, setSignatureAgentIds] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: null,
    pilote: null,
    chef_base: null,
  });
  // Tracé en cours (avant VALIDER) — jamais persisté tant que VALIDER n'a pas
  // été pressé. `resetTicks` force le remontage du SignaturePad (non contrôlé,
  // cf. SignaturePad.tsx) pour repartir d'un tracé vierge après MODIFIER ou un
  // changement de personne.
  const [pendingPaths, setPendingPaths] = useState<Record<SignatureRole, string>>({
    consultant_fao: '',
    pilote: '',
    chef_base: '',
  });
  const [resetTicks, setResetTicks] = useState<Record<SignatureRole, number>>({
    consultant_fao: 0,
    pilote: 0,
    chef_base: 0,
  });
  // Rôles actuellement en édition (chips + pavé affichés) — un rôle jamais
  // signé y est implicitement (cf. rendu : `enEdition = editingRoles.has(role)
  // || !signatureImages[role]`), celui-ci ne sert qu'à rouvrir l'édition d'une
  // signature déjà validée (MODIFIER).
  const [editingRoles, setEditingRoles] = useState<Set<SignatureRole>>(new Set());

  // Chef de Base : agents habilités proposés en chips (cf. commentaire plus
  // haut), sur le modèle de listUtilisateursByRole côté Traitement
  // (traitement.tsx, AerienForm.tsx). Chargé une seule fois, uniquement en
  // mode aérien (seul mode où ce bloc Signatures s'affiche). Pilote/Consultant
  // FAO n'ont plus besoin de cette liste (#consultant-fao-pilote-auto).
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('extensive-observations');

  useEffect(() => {
    if (!isAerien) return;
    listUtilisateursByRole('chef_de_base')
      .then(setChefsDeBase)
      .catch((error) => signalerChargement(error, { draftId, source: 'listUtilisateursByRole:chef_de_base' }));
  }, [isAerien, draftId, signalerChargement]);

  // Résolution best-effort de l'id du Chef de Base associé au nom déjà
  // enregistré (fiche relue) — ne touche jamais un id déjà connu (sélection
  // explicite ou match précédent), cf. commentaire sur `signatureAgentIds`
  // plus haut. Pilote/Consultant FAO n'ont plus d'id à résoudre
  // (#consultant-fao-pilote-auto : texte libre pour l'un, Référence pour l'autre).
  useEffect(() => {
    if (signatureAgentIds.chef_base != null) return;
    const nom = signatureNoms.chef_base;
    if (!nom) return;
    const match = chefsDeBase.find((agent) => `${agent.prenom} ${agent.nom}` === nom);
    if (!match) return;
    // Différé au micro-tour suivant, comme l'effet d'hydratation plus haut —
    // évite un setState synchrone dans le corps de l'effet (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setSignatureAgentIds((current) => (current.chef_base != null ? current : { ...current, chef_base: match.id }));
    });
  }, [chefsDeBase, signatureNoms.chef_base, signatureAgentIds.chef_base]);

  /**
   * Construit l'intégralité du payload d'enregistrement à partir de l'état
   * courant de l'écran — utilisé aussi bien par VALIDER (une seule signature)
   * que par « Suivant » (tous les champs). `overrides` permet à VALIDER de
   * fournir la signature qu'il vient de capturer sans attendre le prochain
   * rendu (le `setState` correspondant n'est pas encore reflété dans les
   * fermetures `signatureNoms`/`signatureHorodatages`/`signatureImages` au
   * moment de l'appel).
   *
   * Déclarée ici (avant `handleSelectSignataire`/l'effet de réconciliation du
   * pilote, qui l'appellent tous deux) plutôt que plus bas avec VALIDER/
   * MODIFIER/Suivant — un effet React doit fermer sur une référence déjà
   * déclarée, pas sur une qui le sera plus loin dans le composant.
   */
  const buildPayload = (
    overrides?: Partial<Record<SignatureRole, { nom: string | null; horodatage: string | null; image: string | null }>>
  ): ExtensiveObservationsUpdateInput => {
    const noms = { ...signatureNoms };
    const horodatages = { ...signatureHorodatages };
    const images = { ...signatureImages };
    if (overrides) {
      (Object.keys(overrides) as SignatureRole[]).forEach((role) => {
        const o = overrides[role];
        if (!o) return;
        noms[role] = o.nom;
        horodatages[role] = o.horodatage;
        images[role] = o.image;
      });
    }
    const futsActifs = isAerien && pesticidesEmbarques === true;
    return {
      degatsCultures: degatsCultures || null,
      verdissementPourcent: validerPourcentage(verdissement, 'Verdure strate herbeuse').value,
      hauteurHerbeCm: hauteurMInputToCm(hauteur),
      dernierePluie: dernierePluie || null,
      intensitePluie: intensite || null,
      pesticidesEmbarques: isAerien ? pesticidesEmbarques : null,
      pesticideNomCommercial: futsActifs ? pesticideNomCommercial || null : null,
      pesticideQuantiteDisponible: futsActifs && pesticideQuantiteDisponible ? parseFloat(pesticideQuantiteDisponible) : null,
      pesticideQuantiteRecue: futsActifs && pesticideQuantiteRecue ? parseFloat(pesticideQuantiteRecue) : null,
      futsDisponible: futsActifs ? validerEntierPositif(futsDisponible, 'Fûts disponibles').value : null,
      futsPleins: futsActifs ? validerEntierPositif(futsPleins, 'Fûts pleins').value : null,
      futsVides: futsActifs ? validerEntierPositif(futsVides, 'Fûts vides').value : null,
      futsRecues: futsActifs ? validerEntierPositif(futsRecues, 'Fûts reçues').value : null,
      // VISA retiré de l'UI mais jamais réécrit à `null` : on renvoie tel quel
      // ce que la fiche portait déjà (historique préservé, cf. commentaire sur
      // SignatureRole plus haut).
      signatureVisaNom: draft?.signature_visa_nom ?? null,
      signatureVisaHorodatage: draft?.signature_visa_horodatage ?? null,
      signatureConsultantFaoNom: isAerien ? noms.consultant_fao : null,
      signatureConsultantFaoHorodatage: isAerien ? horodatages.consultant_fao : null,
      signatureConsultantFaoImage: isAerien ? images.consultant_fao : null,
      signaturePiloteNom: isAerien ? noms.pilote : null,
      signaturePiloteHorodatage: isAerien ? horodatages.pilote : null,
      signaturePiloteImage: isAerien ? images.pilote : null,
      signatureChefBaseNom: isAerien ? noms.chef_base : null,
      signatureChefBaseHorodatage: isAerien ? horodatages.chef_base : null,
      signatureChefBaseImage: isAerien ? images.chef_base : null,
      observations: remarques || null,
    };
  };

  /** Choisir un agent habilité désigne le signataire à venir — la signature
   * elle-même n'est enregistrée qu'au VALIDER (cf. handleValider). Changer de
   * personne alors qu'une signature était déjà validée pour l'ancienne l'efface
   * immédiatement : elle ne doit jamais être attribuée à la nouvelle (§8). */
  const handleSelectSignataire = (role: SignatureRole, agentId: string, nomComplet: string) => {
    setSignatureNoms((current) => ({ ...current, [role]: nomComplet }));
    if (signatureAgentIds[role] !== agentId) {
      setSignatureAgentIds((current) => ({ ...current, [role]: agentId }));
      setSignatureImages((current) => ({ ...current, [role]: null }));
      setSignatureHorodatages((current) => ({ ...current, [role]: null }));
      setPendingPaths((current) => ({ ...current, [role]: '' }));
      setResetTicks((current) => ({ ...current, [role]: (current[role] ?? 0) + 1 }));
      setEditingRoles((current) => new Set(current).add(role));
      // La rupture du lien avec l'ancien signataire est persistée tout de suite :
      // une fermeture de l'application avant « Suivant » ne doit jamais laisser
      // son tracé attribué à la personne nouvellement sélectionnée.
      void run(
        async () => {
          const updated = await updateProspectionExtensiveObservations(
            draftId,
            buildPayload({ [role]: { nom: nomComplet, horodatage: null, image: null } })
          );
          setDraft(updated);
        },
        {
          screen: 'extensive-observations',
          precondition: !!draftId,
          preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
          context: { draftId, role, agentId, action: 'change-signataire' },
        }
      );
    }
  };

  /**
   * Consultant FAO (#consultant-fao-pilote-auto) : nom en saisie libre, pas un
   * agent habilité de l'app — pas de chip à choisir. Le nom et la signature
   * doivent rester associés (§1) : si le texte change alors qu'une signature
   * était déjà validée pour l'ancien nom, elle est invalidée immédiatement
   * (même principe que `handleSelectSignataire` pour Chef de Base) — sans
   * persistance immédiate ici, contrairement aux chips : une simple frappe ne
   * doit pas déclencher un aller-retour réseau à chaque caractère, et l'état
   * local déjà cohérent (nom + image nulle) suffit à ce que le prochain
   * VALIDER/Suivant persiste la bonne association.
   */
  const handleConsultantFaoNomChange = (texte: string) => {
    const nom = texte || null;
    const nomChange = nom !== signatureNoms.consultant_fao;
    setSignatureNoms((current) => ({ ...current, consultant_fao: nom }));
    if (nomChange && signatureImages.consultant_fao) {
      setSignatureImages((current) => ({ ...current, consultant_fao: null }));
      setSignatureHorodatages((current) => ({ ...current, consultant_fao: null }));
      setPendingPaths((current) => ({ ...current, consultant_fao: '' }));
      setResetTicks((current) => ({ ...current, consultant_fao: (current.consultant_fao ?? 0) + 1 }));
    }
  };

  // Même garde que sur extensive-reference.tsx : ces `useState(draft?.x)` d'initialisation
  // ne se remettent jamais à jour si `draft` n'est pas encore hydraté au montage. Restaure
  // une seule fois par fiche chargée pour ne pas écraser une saisie en cours.
  const obsHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || obsHydratedRef.current === draft.id) return;
    obsHydratedRef.current = draft.id;
    void Promise.resolve().then(() => {
      setDegatsCultures(draft.degats_cultures ?? null);
      setVerdissement(draft.verdissement_pourcent != null ? String(draft.verdissement_pourcent) : '');
      setHauteur(hauteurCmToMInput(draft.hauteur_herbe_cm));
      setDernierePluie(draft.derniere_pluie ?? '');
      setIntensite(draft.intensite_pluie ?? 'faible');
      setRemarques(draft.observations ?? '');
      // Mode aérien uniquement — sans effet sur une fiche terrestre (colonnes NULL).
      setPesticidesEmbarques(normalizeBoolean(draft.pesticides_embarques));
      setPesticideNomCommercial(draft.pesticide_nom_commercial ?? '');
      setPesticideQuantiteDisponible(draft.pesticide_quantite_disponible != null ? String(draft.pesticide_quantite_disponible) : '');
      setPesticideQuantiteRecue(draft.pesticide_quantite_recue != null ? String(draft.pesticide_quantite_recue) : '');
      setFutsDisponible(draft.futs_disponible != null ? String(draft.futs_disponible) : '');
      setFutsPleins(draft.futs_pleins != null ? String(draft.futs_pleins) : '');
      setFutsVides(draft.futs_vides != null ? String(draft.futs_vides) : '');
      setFutsRecues(draft.futs_recues != null ? String(draft.futs_recues) : '');
      // `pilote` n'est plus seed ici (#consultant-fao-pilote-auto) : source
      // unique de vérité = l'effet dédié ci-dessous, qui couvre aussi bien ce
      // premier chargement que le retour depuis Référence en cours de session.
      setSignatureNoms((current) => ({
        ...current,
        consultant_fao: draft.signature_consultant_fao_nom ?? null,
        chef_base: draft.signature_chef_base_nom ?? null,
      }));
      setSignatureHorodatages((current) => ({
        ...current,
        consultant_fao: draft.signature_consultant_fao_horodatage ?? null,
        chef_base: draft.signature_chef_base_horodatage ?? null,
      }));
      setSignatureImages((current) => ({
        ...current,
        consultant_fao: draft.signature_consultant_fao_image ?? null,
        chef_base: draft.signature_chef_base_image ?? null,
      }));
      // Un rechargement de fiche repart d'une édition fermée (lecture seule +
      // MODIFIER) pour tout rôle déjà signé — cf. `editingRoles` plus haut.
      setEditingRoles(new Set());
    });
  }, [draft, draftId]);

  /**
   * Pilote (#consultant-fao-pilote-auto) : source unique de vérité pour
   * `signatureNoms.pilote` — jamais une resaisie indépendante ici, toujours le
   * nom actuellement saisi sur Référence (`draft.pilote`). Couvre à la fois :
   * - le premier chargement d'une fiche (y compris une fiche rouverte après
   *   un changement de pilote fait ailleurs SANS repasser par Signature —
   *   `draft.signature_pilote_nom`, la valeur persistée pour la signature
   *   elle-même, ne correspond alors plus à `draft.pilote`) ;
   * - un changement fait dans la MÊME session (retour sur Référence, §4/Test 3)
   *   — expo-router ne démonte pas cet écran en repassant par "précédent", donc
   *   l'effet d'hydratation ci-dessus (guardé par `draft.id`, inchangé) ne se
   *   redéclencherait pas tout seul.
   *
   * Toute incohérence (signature déjà validée pour un nom différent du pilote
   * actuel) invalide immédiatement le tracé — jamais attribué au nouveau
   * pilote (§4) — et persiste cette rupture tout de suite, même raison que
   * `handleSelectSignataire` : une fermeture de l'app avant "Suivant" ne doit
   * jamais laisser un tracé attribué à la mauvaise personne.
   */
  const piloteReconcilieRef = useRef<string>('');
  useEffect(() => {
    if (!isAerien || !draft || draft.id !== draftId) return;
    const nomPilote = draft.pilote ?? null;
    const nomDejaSigne = draft.signature_pilote_nom ?? null;
    const imageDejaSignee = draft.signature_pilote_image ?? null;
    const cle = `${nomPilote ?? ''}|${nomDejaSigne ?? ''}|${imageDejaSignee ? '1' : '0'}`;
    if (piloteReconcilieRef.current === cle) return;
    piloteReconcilieRef.current = cle;

    const incoherent = !!imageDejaSignee && nomPilote !== nomDejaSigne;

    // Différé au micro-tour suivant, comme les autres effets de cet écran —
    // évite un setState synchrone dans le corps de l'effet (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setSignatureNoms((current) => (current.pilote === nomPilote ? current : { ...current, pilote: nomPilote }));

      if (incoherent) {
        setSignatureImages((current) => ({ ...current, pilote: null }));
        setSignatureHorodatages((current) => ({ ...current, pilote: null }));
        setPendingPaths((current) => ({ ...current, pilote: '' }));
        setResetTicks((current) => ({ ...current, pilote: (current.pilote ?? 0) + 1 }));
        setEditingRoles((current) => new Set(current).add('pilote'));
        // Rupture persistée tout de suite — même raison que handleSelectSignataire :
        // une fermeture de l'app avant "Suivant" ne doit jamais laisser le tracé
        // attribué au nouveau pilote.
        void run(
          async () => {
            const updated = await updateProspectionExtensiveObservations(
              draftId,
              buildPayload({ pilote: { nom: nomPilote, horodatage: null, image: null } })
            );
            setDraft(updated);
          },
          {
            screen: 'extensive-observations',
            precondition: !!draftId,
            preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
            context: { draftId, role: 'pilote', action: 'pilote-change-invalidation' },
          }
        );
      } else if (imageDejaSignee) {
        // Cohérent (déjà signé pour le bon pilote) : restaure aussi l'image et
        // l'horodatage, que l'effet d'hydratation générique ne seed plus pour ce rôle.
        setSignatureImages((current) => (current.pilote === imageDejaSignee ? current : { ...current, pilote: imageDejaSignee }));
        setSignatureHorodatages((current) => {
          const horodatage = draft.signature_pilote_horodatage ?? null;
          return current.pilote === horodatage ? current : { ...current, pilote: horodatage };
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, draftId, isAerien]);

  /**
   * VALIDER — capture définitivement le tracé en cours pour ce rôle. Persisté
   * immédiatement (SQLite local via updateProspectionExtensiveObservations),
   * pas seulement gardé en state React : fermer l'app avant d'atteindre
   * « Suivant » ne perd jamais une signature déjà validée (§9 offline-first).
   */
  const handleValider = (role: SignatureRole) => {
    const nom = signatureNoms[role];
    const trace = pendingPaths[role];
    if (!nom || !trace) return; // Précondition déjà imposée par le bouton désactivé.
    const horodatage = new Date().toISOString();
    return run(
      async () => {
        const updated = await updateProspectionExtensiveObservations(
          draftId,
          buildPayload({ [role]: { nom, horodatage, image: trace } })
        );
        setDraft(updated);
        setSignatureImages((current) => ({ ...current, [role]: trace }));
        setSignatureHorodatages((current) => ({ ...current, [role]: horodatage }));
        setEditingRoles((current) => {
          const next = new Set(current);
          next.delete(role);
          return next;
        });
      },
      {
        screen: 'extensive-observations',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId, role },
      }
    );
  };

  /** MODIFIER — repart d'un tracé vierge pour ce rôle ; la signature déjà
   * validée n'est remplacée qu'au prochain VALIDER, jamais avant (annuler
   * en quittant l'écran sans revalider la conserve intacte). */
  const handleModifier = (role: SignatureRole) => {
    setPendingPaths((current) => ({ ...current, [role]: '' }));
    setResetTicks((current) => ({ ...current, [role]: (current[role] ?? 0) + 1 }));
    setEditingRoles((current) => new Set(current).add(role));
  };

  const handleContinue = () => {
    // Verdure strate herbeuse : validée avant tout enregistrement, comme les
    // fûts plus bas — message d'erreur nommant le champ, rien de bloquant si
    // laissé vide.
    const { erreur: verdissementErreur } = validerPourcentage(verdissement, 'Verdure strate herbeuse');
    if (verdissementErreur) {
      Alert.alert('Pourcentage invalide', verdissementErreur);
      return;
    }

    // Fûts : validés avant tout enregistrement, seulement si Pesticides = OUI
    // (compact/masqué sinon, donc rien à valider) — mêmes AlertDialogs bloquants
    // que la validation des opérations sur extensive-reference.tsx.
    const futsSaisis =
      isAerien && pesticidesEmbarques === true
        ? [
            ['Fûts disponibles', futsDisponible] as const,
            ['Fûts pleins', futsPleins] as const,
            ['Fûts vides', futsVides] as const,
            ['Fûts reçues', futsRecues] as const,
          ].map(([label, raw]) => ({ label, ...validerEntierPositif(raw, label) }))
        : [];
    const futErreur = futsSaisis.find((f) => f.erreur);
    if (futErreur) {
      Alert.alert('Nombre de fûts invalide', futErreur.erreur!);
      return;
    }

    return run(
      async () => {
        const updated = await updateProspectionExtensiveObservations(draftId, buildPayload());
        setDraft(updated);
        router.push({ pathname: '/(prospection)/extensive-recap' as any, params: { draftId } });
      },
      {
        screen: 'extensive-observations',
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
            <Text style={styles.title}>Observations</Text>
          </View>
          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.progressBar, styles.progressActive]} />
            ))}
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.sectionLabel}>Dégâts sur les cultures</Text>
            <View style={[styles.chipsRow, { marginBottom: 10 }]}>
              {DEGATS_CULTURES_EXTENSIF_OPTIONS.map((option) => {
                const active = option.value === degatsCultures;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={{ flex: 1 }}
                    onPress={() => setDegatsCultures(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { marginBottom: 9 }]}>
              <Text style={styles.label}>Verdure strate herbeuse</Text>
              <View style={styles.pourcentageRow}>
                <TextInput
                  testID="verdissement-input"
                  value={verdissement}
                  onChangeText={setVerdissement}
                  keyboardType="number-pad"
                  style={[styles.input, styles.pourcentageInput]}
                />
                <Text style={styles.pourcentageUnit}>%</Text>
              </View>
            </View>

            <View style={[styles.card, { marginBottom: 9 }]}>
              <Text style={styles.label}>H Str Herb (m)</Text>
              <TextInput testID="hauteur-herbe-input" value={hauteur} onChangeText={setHauteur} keyboardType="decimal-pad" style={styles.input} />
            </View>

            <View style={styles.row}>
              <View style={[styles.card, styles.flex1]}>
                <Text style={styles.label}>Dernière pluie le</Text>
                <DateField
                  value={dernierePluie || null}
                  onChange={setDernierePluie}
                  maximumDate={new Date()}
                  style={styles.dateFieldBox}
                  textStyle={styles.input}
                  placeholderStyle={[styles.input, { fontWeight: '500', color: TEXT_SECONDARY }]}
                />
              </View>
              <View style={[styles.flex1, { gap: 5 }]}>
                <Text style={styles.label}>Intensité</Text>
                <View style={styles.chipsRow}>
                  {NIVEAU_OPTIONS.map((option) => {
                    const active = option.value === intensite;
                    return (
                      <TouchableOpacity key={option.value} style={{ flex: 1 }} onPress={() => setIntensite(option.value)} activeOpacity={0.7}>
                        <Text style={[styles.chip, styles.chipCompact, active && styles.chipActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {isAerien && (
              <>
                <Text style={styles.sectionLabel}>Pesticides Embarqués</Text>
                <View style={[styles.chipsRow, { marginBottom: 10 }]}>
                  {([true, false] as const).map((value) => {
                    const active = pesticidesEmbarques === value;
                    return (
                      <TouchableOpacity
                        key={String(value)}
                        style={{ flex: 1 }}
                        onPress={() => setPesticidesEmbarques(value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chip, active && styles.chipActive]}>{value ? 'Oui' : 'Non'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {pesticidesEmbarques === true && (
                  <>
                    <View style={[styles.card, { marginBottom: 9 }]}>
                      <Text style={styles.label}>Nom Commercial</Text>
                      <TextInput
                        testID="pesticide-nom-commercial-input"
                        value={pesticideNomCommercial}
                        onChangeText={setPesticideNomCommercial}
                        placeholder="Ex. Fyfanon ULV"
                        placeholderTextColor={TEXT_SECONDARY}
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.card, styles.flex1]}>
                        <Text style={styles.label}>Quantité Disponible (L)</Text>
                        <TextInput
                          testID="pesticide-quantite-disponible-input"
                          value={pesticideQuantiteDisponible}
                          onChangeText={setPesticideQuantiteDisponible}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.flex1]}>
                        <Text style={styles.label}>Quantité Reçue (L)</Text>
                        <TextInput
                          testID="pesticide-quantite-recue-input"
                          value={pesticideQuantiteRecue}
                          onChangeText={setPesticideQuantiteRecue}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                    </View>

                    <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Nombre de fûts</Text>
                    <View style={styles.futsGrid}>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Disponible</Text>
                        <TextInput
                          testID="futs-disponible-input"
                          value={futsDisponible}
                          onChangeText={setFutsDisponible}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Pleins</Text>
                        <TextInput
                          testID="futs-pleins-input"
                          value={futsPleins}
                          onChangeText={setFutsPleins}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Vides</Text>
                        <TextInput
                          testID="futs-vides-input"
                          value={futsVides}
                          onChangeText={setFutsVides}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Reçues</Text>
                        <TextInput
                          testID="futs-recues-input"
                          value={futsRecues}
                          onChangeText={setFutsRecues}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>Signatures</Text>
                {SIGNATURE_ROLES.map((role) => {
                  const image = signatureImages[role];
                  const enEdition = editingRoles.has(role) || !image;
                  const trace = pendingPaths[role] ?? '';

                  return (
                    <View key={role} style={[styles.card, styles.signatureRow]}>
                      <Text style={styles.label}>{SIGNATURE_LABELS[role]}</Text>

                      {enEdition ? (
                        <>
                          {role === 'pilote' ? (
                            // Auto-rempli depuis Référence (#consultant-fao-pilote-auto)
                            // — jamais une resaisie manuelle ici, cf. l'effet dédié
                            // plus haut qui garde signatureNoms.pilote synchronisé.
                            <Text style={styles.signatureValue}>
                              {draft?.pilote || 'Pilote non renseigné (voir Référence)'}
                            </Text>
                          ) : role === 'consultant_fao' ? (
                            // Saisie libre (#consultant-fao-pilote-auto) — pas un
                            // agent habilité de l'app, pas de chip à choisir.
                            <TextInput
                              testID="signature-consultant-fao-nom-input"
                              value={signatureNoms.consultant_fao ?? ''}
                              onChangeText={handleConsultantFaoNomChange}
                              placeholder="Nom du Consultant FAO"
                              placeholderTextColor={TEXT_SECONDARY}
                              style={styles.input}
                            />
                          ) : (
                            <View style={[styles.chipsRow, styles.agentChipsRow]}>
                              {chefsDeBase.map((agent) => {
                                const nomComplet = `${agent.prenom} ${agent.nom}`;
                                const active = signatureAgentIds.chef_base === agent.id;
                                return (
                                  <TouchableOpacity
                                    key={agent.id}
                                    onPress={() => handleSelectSignataire('chef_base', agent.id, nomComplet)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={[styles.chip, styles.agentChip, active && styles.chipActive]}>{nomComplet}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                          {signatureNoms[role] && (
                            <SignaturePad
                              key={`${role}-${resetTicks[role] ?? 0}`}
                              testID={`signature-pad-${role}`}
                              value={null}
                              onChange={(p) => setPendingPaths((current) => ({ ...current, [role]: p }))}
                            />
                          )}
                          <TouchableOpacity
                            style={[styles.signButton, (!signatureNoms[role] || !trace) && styles.signButtonDone]}
                            onPress={() => handleValider(role)}
                            disabled={!signatureNoms[role] || !trace}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.signButtonText}>VALIDER</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Text style={styles.signatureValue}>{signatureNoms[role]}</Text>
                          <SignaturePad testID={`signature-pad-${role}`} value={image} onChange={() => {}} readOnly />
                          <Text style={styles.signatureStamp}>Signé à {formatHeureLocale(signatureHorodatages[role])}</Text>
                          <TouchableOpacity style={styles.modifyButton} onPress={() => handleModifier(role)} activeOpacity={0.85}>
                            <Text style={styles.modifyButtonText}>MODIFIER</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionLabel}>Remarques</Text>
            <View style={[styles.card, styles.remarquesCard]}>
              <TextInput
                testID="remarques-input"
                value={remarques}
                onChangeText={setRemarques}
                placeholder="Informations complémentaires…"
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.remarquesInput]}
              />
            </View>

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>Dernier écran de saisie — données culture/climat, communes aux deux espèces.</Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Suivant : Récapitulatif ›</Text>
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 9 },
  label: { fontSize: 9, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  input: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  // Verdure strate herbeuse (%) — même principe que le stepper Dégâts d'origine :
  // valeur + unité affichée à côté, dans la carte.
  pourcentageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pourcentageInput: { flex: 1 },
  pourcentageUnit: { fontSize: 15, fontWeight: '700', color: TEXT },
  sectionLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingVertical: 8, textAlign: 'center', borderRadius: 8, overflow: 'hidden' },
  chipCompact: { fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 2 },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 9, marginBottom: 9 },
  flex1: { flex: 1 },
  footerNote: { marginTop: 14, backgroundColor: '#eaf2ec', borderRadius: 10, padding: 11 },
  footerNoteText: { fontSize: 11, lineHeight: 16, color: GREEN, fontWeight: '500' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  // ===== Mode aérien : Pesticides embarqués + Signatures =====
  futsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  futsCell: { flexBasis: '47%', flexGrow: 1, marginBottom: 0 },
  signatureRow: { gap: 6 },
  // Pilote/Chef de Base : nombre d'agents variable (contrairement aux chips à
  // effectif fixe du reste de l'écran, dimensionnées par `flex: 1`) — la rangée
  // doit donc pouvoir passer à la ligne, et chaque chip porte son propre padding
  // horizontal plutôt que de compter sur le flex pour se dimensionner.
  agentChipsRow: { flexWrap: 'wrap' },
  agentChip: { paddingHorizontal: 12 },
  signatureValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  signatureStamp: { fontSize: 10, color: TEXT_SECONDARY, fontFamily: 'monospace' },
  signButton: { backgroundColor: GREEN, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  signButtonDone: { backgroundColor: '#9a9484' },
  signButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  modifyButton: { borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  modifyButtonText: { color: TEXT, fontWeight: '800', fontSize: 12 },
  // ===== Remarques (terrestre + aérien) =====
  remarquesCard: { marginBottom: 9 },
  remarquesInput: { minHeight: 90, fontFamily: 'System', fontWeight: '500' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
