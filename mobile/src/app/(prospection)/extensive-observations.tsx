import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import {
  ExtensiveObservationsUpdateInput,
  updateProspectionExtensiveObservations,
} from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
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
// Auto-signature du prospecteur (section Signature, après Remarques) — même
// teinte que la carte "Prospecteur" de observations.tsx (Intensif).
const AUTO_BG = '#eaf2ec';

// La colonne backend `hauteur_herbe_cm` reste en centimètres (partagée avec l'intensif,
// cf. reference.tsx/observations.tsx) : seule l'unité affichée/saisie à l'écran devient
// le mètre. Conversion appliquée aux deux bornes (chargement/enregistrement), même
// principe que ventVitesseKmhToMsInput dans infestation.tsx.
const CM_PAR_M = 100;

// #saisie-decimale-virgule : même bascule (côté parsing) que parseDecimalInput
// dans veg.tsx/moyens.tsx/synthese.tsx — la virgule est le séparateur décimal
// attendu par l'agent (clavier "decimal-pad" en locale FR), mais `parseFloat`
// s'arrête au premier caractère non numérique : "0,80" valait donc 0 tel quel,
// perdu silencieusement à l'enregistrement (jamais d'erreur, jamais de blocage —
// juste une valeur fausse, 0,00 m quelle que soit la saisie sous la barre).
// L'affichage (hauteurCmToMInput) reste en point : une fiche déjà enregistrée
// s'y attend (#228, préaffiché à "1.25", jamais "1,25").
function hauteurCmToMInput(cm: number | null): string {
  if (cm == null) return '';
  return String(Math.round((cm / CM_PAR_M) * 100) / 100);
}

function hauteurMInputToCm(m: string): number | null {
  if (m === '') return null;
  const parsed = parseFloat(m.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * CM_PAR_M * 100) / 100 : null;
}

// ==========================================
// Mode aérien — Signatures
// ==========================================

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
//
// Pilote est retiré du slide Signatures — même traitement que VISA ci-dessus :
// les colonnes backend `signature_pilote_nom`/`_horodatage`/`_image` restent en
// base pour préserver l'historique déjà enregistré (cf. `buildPayload`, qui les
// renvoie telles quelles), mais plus aucune UI ne propose de (re)signer pour ce
// rôle. Son nom continue d'être saisi sur Référence (`draft.pilote`), sans lien
// avec une signature.
type SignatureRole = 'consultant_fao' | 'chef_base';

const SIGNATURE_LABELS: Record<SignatureRole, string> = {
  consultant_fao: 'Consultant International',
  chef_base: 'Chef de Base',
};

const SIGNATURE_ROLES: SignatureRole[] = ['consultant_fao', 'chef_base'];

/**
 * Chef de Base reste sur le mécanisme référentiel (ROLES dans
 * app/models/users.py) — même mécanisme que le Chef de base de l'écran
 * Traitement (AerienForm.tsx) : on choisit la personne dans une liste d'agents
 * habilités (chips), on ne ressaisit jamais un nom à la main.
 *
 * Consultant FAO reste une saisie libre (nom en texte + signature) — ce n'est
 * pas un agent habilité de l'app, juste un visiteur externe dont on capture le
 * nom au moment de la signature (#consultant-fao-pilote-auto).
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

  // ==========================================
  // SIGNATURE — auto-signature du prospecteur connecté, après Remarques
  // ==========================================
  // Les deux modes (terrestre et aérien), contrairement aux signatures
  // Consultant FAO/Chef de Base plus bas (mode aérien uniquement). Le nom
  // vient uniquement du compte connecté — jamais ressaisi, jamais choisi dans
  // une liste — seul le tracé (`SignaturePad`) est capturé ici. Réutilise
  // `signature_visa_nom`/`_horodatage` (migration 0036) + `signature_visa_image`
  // (migration 0082) — mêmes colonnes que l'auto-signature de observations.tsx
  // (Intensif), même mécanique VALIDER/MODIFIER.
  const user = useAuthStore((s) => s.user);
  const prospecteurNom = user ? `${user.prenom} ${user.nom}` : null;
  const [signatureVisaNomState, setSignatureVisaNomState] = useState<string | null>(draft?.signature_visa_nom ?? null);
  const [signatureVisaHorodatageState, setSignatureVisaHorodatageState] = useState<string | null>(
    draft?.signature_visa_horodatage ?? null
  );
  const [signatureVisaImageState, setSignatureVisaImageState] = useState<string | null>(draft?.signature_visa_image ?? null);
  const [pendingPathVisa, setPendingPathVisa] = useState('');
  const [resetTickVisa, setResetTickVisa] = useState(0);
  const [editingSignatureVisa, setEditingSignatureVisa] = useState(false);
  const enEditionSignatureVisa = editingSignatureVisa || !signatureVisaImageState;

  // Signatures numériques (#signatures-numeriques-extensif-aerien) —
  // toujours affichées en mode aérien.
  // `signatureNoms`/`Horodatages` : nom du signataire choisi + horodatage de
  // validation. `signatureImages` : tracé SVG (`SignaturePad`), la signature
  // réelle — un rôle n'est considéré « signé » que lorsqu'elle est non nulle
  // (un nom seul, hérité d'une ancienne fiche pré-migration 0053, ne suffit
  // plus : l'écran repasse en édition tant qu'aucun tracé n'a été validé).
  // Pilote n'est plus un rôle géré ici (retiré du slide, cf. commentaire plus
  // haut) : aucune entrée pour lui dans ces 4 states.
  const [signatureNoms, setSignatureNoms] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_nom ?? null,
    chef_base: draft?.signature_chef_base_nom ?? null,
  });
  const [signatureHorodatages, setSignatureHorodatages] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_horodatage ?? null,
    chef_base: draft?.signature_chef_base_horodatage ?? null,
  });
  const [signatureImages, setSignatureImages] = useState<Record<SignatureRole, string | null>>({
    consultant_fao: draft?.signature_consultant_fao_image ?? null,
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
    chef_base: null,
  });
  // Tracé en cours (avant VALIDER) — jamais persisté tant que VALIDER n'a pas
  // été pressé. `resetTicks` force le remontage du SignaturePad (non contrôlé,
  // cf. SignaturePad.tsx) pour repartir d'un tracé vierge après MODIFIER ou un
  // changement de personne.
  const [pendingPaths, setPendingPaths] = useState<Record<SignatureRole, string>>({
    consultant_fao: '',
    chef_base: '',
  });
  const [resetTicks, setResetTicks] = useState<Record<SignatureRole, number>>({
    consultant_fao: 0,
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
  // mode aérien (seul mode où ce bloc Signatures s'affiche). Consultant FAO
  // n'a plus besoin de cette liste (#consultant-fao-pilote-auto).
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('extensive-observations');

  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  useEffect(() => {
    if (!isAerien) return;
    listUtilisateursByRole('chef_de_base')
      .then(setChefsDeBase)
      .catch((error) => signalerChargement(error, { draftId, source: 'listUtilisateursByRole:chef_de_base' }));
  }, [isAerien, draftId, signalerChargement]);

  // Résolution best-effort de l'id du Chef de Base associé au nom déjà
  // enregistré (fiche relue) — ne touche jamais un id déjà connu (sélection
  // explicite ou match précédent), cf. commentaire sur `signatureAgentIds`
  // plus haut. Consultant FAO n'a pas d'id à résoudre (#consultant-fao-pilote-auto :
  // texte libre, pas un agent habilité de l'app).
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
   * Déclarée ici (avant `handleSelectSignataire`, qui l'appelle) plutôt que
   * plus bas avec VALIDER/MODIFIER/Suivant — un effet React doit fermer sur une
   * référence déjà déclarée, pas sur une qui le sera plus loin dans le composant.
   */
  const buildPayload = (
    overrides?: Partial<Record<SignatureRole, { nom: string | null; horodatage: string | null; image: string | null }>>,
    overrideVisa?: { nom: string | null; horodatage: string | null; image: string | null }
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
    return {
      degatsCultures: degatsCultures || null,
      verdissementPourcent: validerPourcentage(verdissement, 'Verdure strate herbeuse').value,
      hauteurHerbeCm: hauteurMInputToCm(hauteur),
      dernierePluie: dernierePluie || null,
      intensitePluie: intensite || null,
      // VISA — auto-signature du prospecteur (cf. commentaire sur
      // `signatureVisaNomState` plus haut) : pilotée par l'état local de cet
      // écran, plus par simple passthrough de `draft` — c'est désormais un champ
      // à part entière de ce slide, après Remarques.
      signatureVisaNom: overrideVisa ? overrideVisa.nom : signatureVisaNomState,
      signatureVisaHorodatage: overrideVisa ? overrideVisa.horodatage : signatureVisaHorodatageState,
      signatureVisaImage: overrideVisa ? overrideVisa.image : signatureVisaImageState,
      // Pilote retiré de l'UI mais jamais réécrit : on renvoie tel quel ce que
      // la fiche portait déjà (historique préservé, cf. commentaire sur
      // SignatureRole plus haut).
      signaturePiloteNom: draft?.signature_pilote_nom ?? null,
      signaturePiloteHorodatage: draft?.signature_pilote_horodatage ?? null,
      signaturePiloteImage: draft?.signature_pilote_image ?? null,
      signatureConsultantFaoNom: isAerien ? noms.consultant_fao : null,
      signatureConsultantFaoHorodatage: isAerien ? horodatages.consultant_fao : null,
      signatureConsultantFaoImage: isAerien ? images.consultant_fao : null,
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
      // Auto-signature du prospecteur, après Remarques — les deux modes.
      setSignatureVisaNomState(draft.signature_visa_nom ?? null);
      setSignatureVisaHorodatageState(draft.signature_visa_horodatage ?? null);
      setSignatureVisaImageState(draft.signature_visa_image ?? null);
      setEditingSignatureVisa(false);
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

  /** VALIDER — auto-signature du prospecteur (après Remarques, les deux modes).
   * Capture définitivement le tracé en cours, persisté immédiatement (SQLite
   * local), pas seulement gardé en state React — même principe offline-first
   * que `handleValider` ci-dessus et que observations.tsx (Intensif). */
  const handleValiderSignatureVisa = () => {
    const trace = pendingPathVisa;
    if (!prospecteurNom || !trace) return; // Précondition déjà imposée par le bouton désactivé.
    const horodatage = new Date().toISOString();
    return run(
      async () => {
        const updated = await updateProspectionExtensiveObservations(
          draftId,
          buildPayload(undefined, { nom: prospecteurNom, horodatage, image: trace })
        );
        setDraft(updated);
        setSignatureVisaNomState(prospecteurNom);
        setSignatureVisaHorodatageState(horodatage);
        setSignatureVisaImageState(trace);
        setEditingSignatureVisa(false);
      },
      {
        screen: 'extensive-observations',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  /** MODIFIER — auto-signature du prospecteur : repart d'un tracé vierge ; la
   * signature déjà validée n'est remplacée qu'au prochain VALIDER. */
  const handleModifierSignatureVisa = () => {
    setPendingPathVisa('');
    setResetTickVisa((tick) => tick + 1);
    setEditingSignatureVisa(true);
  };

  const handleContinue = () => {
    // Verdure strate herbeuse : validée avant tout enregistrement — message
    // d'erreur nommant le champ, rien de bloquant si laissé vide.
    const { erreur: verdissementErreur } = validerPourcentage(verdissement, 'Verdure strate herbeuse');
    if (verdissementErreur) {
      Alert.alert('Pourcentage invalide', verdissementErreur);
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
                          {role === 'consultant_fao' ? (
                            // Saisie libre (#consultant-fao-pilote-auto) — pas un
                            // agent habilité de l'app, pas de chip à choisir.
                            <TextInput
                              testID="signature-consultant-fao-nom-input"
                              value={signatureNoms.consultant_fao ?? ''}
                              onChangeText={handleConsultantFaoNomChange}
                              placeholder="Nom du Consultant International"
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

            {/* ==========================================
                SECTION : SIGNATURE (auto-signature du prospecteur, après Remarques)
                ========================================== */}

            <Text style={styles.sectionLabel}>Signature</Text>
            <View style={[styles.card, styles.signatureRow]}>
              <View style={styles.autoCardVisa}>
                <Text style={styles.autoLabelVisa}>Prospecteur</Text>
                <Text style={styles.autoValueVisa}>{prospecteurNom ?? '—'}</Text>
              </View>

              {enEditionSignatureVisa ? (
                <>
                  <SignaturePad
                    key={`signature-visa-${resetTickVisa}`}
                    testID="signature-pad-visa"
                    value={null}
                    onChange={setPendingPathVisa}
                  />
                  <TouchableOpacity
                    style={[styles.signButton, (!prospecteurNom || !pendingPathVisa) && styles.signButtonDone]}
                    onPress={handleValiderSignatureVisa}
                    disabled={!prospecteurNom || !pendingPathVisa}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.signButtonText}>VALIDER</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <SignaturePad testID="signature-pad-visa" value={signatureVisaImageState} onChange={() => {}} readOnly />
                  <Text style={styles.signatureStamp}>Signé à {formatHeureLocale(signatureVisaHorodatageState)}</Text>
                  <TouchableOpacity style={styles.modifyButton} onPress={handleModifierSignatureVisa} activeOpacity={0.85}>
                    <Text style={styles.modifyButtonText}>MODIFIER</Text>
                  </TouchableOpacity>
                </>
              )}
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

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  label: 9,
  input: 13,
  pourcentageUnit: 15,
  sectionLabel: 9,
  chip: 12,
  chipCompact: 9.5,
  footerNoteText: 11,
  continueButtonText: 15,
  signatureValue: 13,
  signatureStamp: 10,
  signButtonText: 12,
  modifyButtonText: 12,
  autoLabelVisa: 9,
  autoValueVisa: 14,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: typeSizes.back, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: typeSizes.title, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 9 },
  label: { fontSize: typeSizes.label, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  input: { fontSize: typeSizes.input, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  // Verdure strate herbeuse (%) — même principe que le stepper Dégâts d'origine :
  // valeur + unité affichée à côté, dans la carte.
  pourcentageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pourcentageInput: { flex: 1 },
  pourcentageUnit: { fontSize: typeSizes.pourcentageUnit, fontWeight: '700', color: TEXT },
  sectionLabel: { fontSize: typeSizes.sectionLabel, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { fontSize: typeSizes.chip, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingVertical: 8, textAlign: 'center', borderRadius: 8, overflow: 'hidden' },
  chipCompact: { fontSize: typeSizes.chipCompact, paddingVertical: 6, paddingHorizontal: 2 },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 9, marginBottom: 9 },
  flex1: { flex: 1 },
  footerNote: { marginTop: 14, backgroundColor: '#eaf2ec', borderRadius: 10, padding: 11 },
  footerNoteText: { fontSize: typeSizes.footerNoteText, lineHeight: 16, color: GREEN, fontWeight: '500' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.continueButtonText },
  // ===== Mode aérien : Signatures =====
  signatureRow: { gap: 6 },
  // Chef de Base : nombre d'agents variable (contrairement aux chips à
  // effectif fixe du reste de l'écran, dimensionnées par `flex: 1`) — la rangée
  // doit donc pouvoir passer à la ligne, et chaque chip porte son propre padding
  // horizontal plutôt que de compter sur le flex pour se dimensionner.
  agentChipsRow: { flexWrap: 'wrap' },
  agentChip: { paddingHorizontal: 12 },
  signatureValue: { fontSize: typeSizes.signatureValue, fontWeight: '700', color: TEXT },
  signatureStamp: { fontSize: typeSizes.signatureStamp, color: TEXT_SECONDARY, fontFamily: 'monospace' },
  signButton: { backgroundColor: GREEN, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  signButtonDone: { backgroundColor: '#9a9484' },
  signButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.signButtonText },
  modifyButton: { borderWidth: 1, borderColor: BORDER, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  modifyButtonText: { color: TEXT, fontWeight: '800', fontSize: typeSizes.modifyButtonText },
  // ===== Signature (auto-signature du prospecteur, après Remarques) =====
  autoCardVisa: { backgroundColor: AUTO_BG, borderRadius: 10, padding: 11, marginBottom: 9 },
  autoLabelVisa: { fontSize: typeSizes.autoLabelVisa, fontWeight: '600', color: GREEN, textTransform: 'uppercase', marginBottom: 4 },
  autoValueVisa: { fontSize: typeSizes.autoValueVisa, fontWeight: '700', color: TEXT },
  // ===== Remarques (terrestre + aérien) =====
  remarquesCard: { marginBottom: 9 },
  remarquesInput: { minHeight: 90, fontFamily: 'System', fontWeight: '500' },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
