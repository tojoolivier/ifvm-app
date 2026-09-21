import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  countUnsyncedTraitements,
  markTraitementValidee,
  DraftTraitement,
  Cible,
} from '@/lib/traitement-repository';
import { enregistrerEtSynchroniserTraitement } from '@/lib/traitement-sync';
import { apiClient } from '@/lib/api-client';
import { telechargerEtPartagerPdf } from '@/lib/pdf-partage';
import { depsPdfPartage } from '@/lib/pdf-partage-natif';
import { estToutParti, resumerEnPhrase } from '@/lib/sync-lot';
import { useAuthStore } from '@/lib/auth-store';
import { SignatureRole } from '@/lib/traitement-capture-store';
import { listUtilisateursByRole, UtilisateurEquipe } from '@/lib/referentiel-db';
import {
  aggregateRecapErrors,
  computeSignatureMatrix,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
} from '@/lib/traitement-validation';
import { Card } from '@/components/traitement/Card';
import { Toast, useTraitementToast } from '@/components/traitement/Toast';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useErrorStore } from '@/lib/error-store';
import { useErrorLogStore } from '@/lib/error-log-store';
import { toFriendlyError } from '@/lib/friendly-error';
import { logger } from '@/lib/logger';
import { formatDirectionDeplacement } from '@/lib/prospection-infestation-insights';
import { EtatVide } from '@/components/erreurs/etat-vide';

// Aérien : 8 étapes (Équipe/Pesticides & rotations scindés, #equipe-slide-aerien ;
// Cibles fusionnée en Synthèse + Surface traitée ajoutée avant Signatures, #326) ;
// terrestre : 6 (équipe et pesticides restés sur un seul écran, flux inchangé) —
// reflète PROGRESS_SEGMENTS_AERIEN/PROGRESS_SEGMENTS_TERRESTRE (ProgressBar.tsx).
// Le dernier libellé est toujours « Signatures » : son index se déduit de la
// longueur, jamais codé en dur.
const CONTROL_LABELS_AERIEN = ['Références', 'Synthèse', 'Équipe', 'Pesticides & rotations', 'Moyens & protection', 'Impacts & risque', 'Surface traitée', 'Signatures'];
const CONTROL_LABELS_TERRESTRE = ['Références', 'Cibles', 'Équipe', 'Moyens & protection', 'Impacts & risque', 'Signatures'];

/** #signatures-auto-equipe §9 : la carte « Signatures » du récapitulatif liste
 * chaque rôle avec le nom résolu depuis « Équipe » et son état de signature. */
const SIGNATURE_ROLE_LABELS: Record<SignatureRole, string> = {
  PILOTE: 'Pilote',
  MECANICIEN: 'Mécanicien',
  CHEF_DE_BASE: 'Chef de base',
  CHEF_EQUIPE: "Chef d'équipe",
  CONSULTANT_INTERNATIONAL: 'Consultant',
};

/**
 * Dernier verrou (CDG §9) : envoie les signatures accumulées localement (nom +
 * tracé) à `POST /traitements/{id}/valider`, puis réécrit la fiche locale avec
 * les valeurs canoniques serveur (#signatures-auto-equipe §6) — verrouillage
 * définitif, jamais rejoué pour une fiche déjà `validee` (appelant s'en assure).
 */
async function validerEtVerrouillerSurServeur(draft: DraftTraitement, token: string): Promise<void> {
  const signatures = (draft.signatures ?? [])
    .filter((s) => !!s.signature_image && !!s.signataire_nom)
    .map((s) => ({
      role: s.role as 'PILOTE' | 'MECANICIEN' | 'CHEF_DE_BASE' | 'CHEF_EQUIPE' | 'CONSULTANT_INTERNATIONAL',
      signataire_nom: s.signataire_nom!,
      signature_image: s.signature_image,
    }));
  const serveur = await apiClient.validerTraitement(token, draft.id, {
    date_validation: draft.date_validation as string,
    signatures,
  });
  await markTraitementValidee(
    draft.id,
    serveur.date_validation,
    (serveur.signatures ?? []).map((s) => ({
      id: s.id,
      traitement_id: draft.id,
      role: s.role,
      signataire_nom: s.signataire_nom,
      signature_image: s.signature_image ?? null,
      horodatage: s.horodatage,
    }))
  );
}

/**
 * #recap-fiche-traitement-incomplet : le récapitulatif n'affichait que
 * l'Équipe et Pesticides & rotations (Aérien) — Moyens & protection, Impacts &
 * risque, Cibles, et la totalité du Terrestre (Équipe & Conditions, Moyens,
 * Produits utilisés) n'y apparaissaient jamais, alors que ces données sont
 * bien enregistrées. Sans écran de relecture complet, revenir « voir ce qui a
 * été saisi » donnait l'impression que ces informations avaient disparu — les
 * helpers et cartes ci-dessous couvrent chaque écran du parcours, dans son
 * propre ordre de saisie.
 */
function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  return String(value);
}

function displayBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return 'non renseigné';
  return value ? 'Oui' : 'Non';
}

function displayListe(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'aucun(e)';
}

/** Listes cochables (espèces non ciblées, familles de mortalité) : même repli
 * que impacts.tsx sur une chaîne corrompue — un écran de relecture ne doit
 * jamais planter pour ça, juste afficher « aucun(e) ». */
function parseJsonArraySafe(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.ignore(e, 'Liste corrompue au récapitulatif — affichée comme vide.');
    return [];
  }
}

function parseJsonDictSafe(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    logger.ignore(e, 'Dictionnaire corrompu au récapitulatif — affiché comme vide.');
    return {};
  }
}

/** `vols_clairs_essaims` stocké 1/0 (colonne REAL, cf. construireCible) — même
 * repli que cibles.tsx/synthese.tsx. */
function displayVolsClairsEssaims(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'non renseigné';
  return value ? 'Oui' : 'Non';
}

/** Une espèce est « présente » sur la cible dès que l'un de ses champs
 * détaillés est renseigné (non `null`/`undefined`). Depuis
 * #cible-extensif-signalement-defauts-zero, ces 4 champs valent 0 (jamais
 * `null`) QUE pour une espèce réellement présente dans `cible.espece` — jamais
 * pour les deux à la fois sur une prospection Extensif/Signalement "rien
 * trouvé". Même logique que cibles.tsx/synthese.tsx. */
function especePresenteRecap(cible: Cible | null | undefined, espece: 'lmc' | 'nse'): boolean {
  if (!cible) return false;
  return (
    cible[`petites_larves_${espece}`] != null ||
    cible[`grandes_larves_${espece}`] != null ||
    cible[`densite_diffuse_${espece}`] != null ||
    cible[`densite_groupee_${espece}`] != null
  );
}

function displayEspecesRecap(cible: Cible | null | undefined): string {
  const especes = (['lmc', 'nse'] as const).filter((e) => especePresenteRecap(cible, e));
  if (especes.length > 0) return especes.map((e) => e.toUpperCase()).join(' / ');
  return display(cible?.espece);
}

function displayParEspeceRecap(lmc: number | null | undefined, nse: number | null | undefined): string {
  const parts: string[] = [];
  if (lmc != null) parts.push(`LMC : ${lmc}`);
  if (nse != null) parts.push(`NSE : ${nse}`);
  return parts.length > 0 ? parts.join(' / ') : 'non renseigné';
}

/** Méthode d'évaluation de l'efficacité — même libellés que rotations.tsx
 * (Aérien) / TerrestreForm.tsx (Terrestre), les deux seuls écrans qui la saisissent. */
function displayMethodeEvaluation(value: string | null | undefined): string {
  if (value === 'ESTIMATION_VISUELLE') return 'Estimation visuelle';
  if (value === 'COMPTAGES_PRE_POST') return 'Comptages pré/post-traitement';
  return 'non renseigné';
}

/** Personne concernée/mode de contamination (empoisonnement) — mêmes libellés
 * que impacts.tsx. */
function displayPersonneConcernee(value: string | null | undefined): string {
  if (value === 'AGENT') return 'Agent';
  if (value === 'POPULATION') return 'Population';
  return 'non renseigné';
}

const MODE_CONTAMINATION_LABELS: Record<string, string> = {
  INGESTION: 'Ingestion',
  INHALATION: 'Inhalation',
  CONTACT: 'Contact',
  AUTRE: 'Autre',
};

function displayModeContamination(value: string | null | undefined): string {
  if (!value) return 'non renseigné';
  return MODE_CONTAMINATION_LABELS[value] ?? value;
}

/** 4 axes de l'écran Impacts & risque (impacts.tsx, `AXES_RISQUE`) — dupliqué
 * ici plutôt que mutualisé, même choix que le reste de ce module. */
const AXES_RISQUE_LABELS: Record<string, string> = {
  ressources_eau: 'Ressources en eau',
  sol: 'Sol',
  faune_non_cible: 'Faune non cible',
  abeilles: 'Abeilles/pollinisateurs',
};

function displayEvaluationRisque(dict: Record<string, boolean>): string {
  const entries = Object.entries(AXES_RISQUE_LABELS).filter(([key]) => dict[key] !== undefined);
  if (entries.length === 0) return 'non renseigné';
  return entries.map(([key, label]) => `${label} : ${dict[key] ? 'Oui' : 'Non'}`).join(' · ');
}

/** Zones exposées (moyens.tsx/synthese.tsx, `ZONES`) — dupliqué ici, même choix. */
const ZONES_LABELS: Record<string, string> = { cultures: 'Cultures', paturages: 'Pâturages' };

function displayZonesExposees(raw: string | null | undefined): string {
  const dict = parseJsonDictSafe(raw);
  const actives = Object.entries(dict)
    .filter(([, actif]) => actif)
    .map(([key]) => ZONES_LABELS[key] ?? key);
  return actives.length > 0 ? actives.join(', ') : 'aucune';
}

/** Une ligne « libellé : valeur » des cartes Équipe/Traitement — « — » si absent,
 * jamais une ligne masquée (un champ facultatif vide reste visible, cf. #equipe-slide-aerien). */
function RecapLigne({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.recapLigne}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value || '—'}</Text>
    </View>
  );
}

export default function RecapScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const token = useAuthStore((s) => s.token);
  const toast = useTraitementToast();
  const readOnly = isValidationView === '1';

  const [draft, setDraft] = useState<DraftTraitement | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  // Résolution id -> nom pour l'affichage du chef de base — seul rôle resté une FK
  // (pilote/mécanicien/consultant sont redevenus du texte libre, migration backend
  // 0048, affichés directement sans jointure).
  const [personnes, setPersonnes] = useState<UtilisateurEquipe[]>([]);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signaler = useErrorStore((s) => s.signaler);
  const logError = useErrorLogStore((s) => s.addEntry);

  useEffect(() => {
    if (!draft) return;
    // Chef de base (aérien) et chef d'équipe (terrestre) sont les deux seuls
    // rôles de signature restés une FK utilisateur — résolus ici pour la carte
    // « Signatures » (#signatures-auto-equipe), au même titre que « Équipe ».
    const role = draft.type_traitement === 'AERIEN' ? 'chef_de_base' : 'chef_equipe';
    listUtilisateursByRole(role)
      .then(setPersonnes)
      .catch((error) => logError({
        message: toFriendlyError(error).message,
        stack: error instanceof Error ? error.stack ?? null : null,
        screen: 'recap',
        context: { traitementId, source: 'listUtilisateursByRole' },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.type_traitement, traitementId, logError]);

  const nomPersonne = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const p = personnes.find((u) => u.id === id);
    return p ? `${p.prenom} ${p.nom}` : null;
  };
  /** Nom du signataire attendu pour un rôle — même résolution que l'écran
   * Signatures (#signatures-auto-equipe §5) : jamais une saisie indépendante. */
  const nomPourRole = (role: SignatureRole): string | null => {
    if (draft?.type_traitement === 'AERIEN' && draft.aerien) {
      if (role === 'PILOTE') return draft.aerien.pilote || null;
      if (role === 'MECANICIEN') return draft.aerien.mecanicien || null;
      if (role === 'CHEF_DE_BASE') return nomPersonne(draft.aerien.chef_de_base_id);
      if (role === 'CONSULTANT_INTERNATIONAL') return draft.aerien.consultant_international || null;
    }
    if (draft?.type_traitement === 'TERRESTRE' && draft.terrestre) {
      if (role === 'CHEF_EQUIPE') return nomPersonne(draft.terrestre.chef_equipe_id);
      if (role === 'CONSULTANT_INTERNATIONAL') return draft.terrestre.consultant_international || null;
    }
    return null;
  };

  const chargerRecap = useCallback(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((d) => {
        setDraft(d);
        setErreurDeLecture(null);
      })
      .catch((error) => {
        setErreurDeLecture(error);
        signaler(error, 'runTask:essential');
        logError({
          message: toFriendlyError(error).message,
          stack: error instanceof Error ? error.stack ?? null : null,
          screen: 'recap',
          context: { traitementId },
        });
      });
    // Le compte de fiches en attente est indicatif (bandeau), pas la donnée que
    // cet écran existe pour afficher : un échec ici ne bloque pas le recap.
    countUnsyncedTraitements()
      .then(setUnsyncedCount)
      .catch((error) => {
        logError({
          message: toFriendlyError(error).message,
          stack: error instanceof Error ? error.stack ?? null : null,
          screen: 'recap',
          context: { traitementId, source: 'countUnsyncedTraitements' },
        });
      });
  }, [traitementId, signaler, logError]);

  useEffect(() => {
    chargerRecap();
  }, [chargerRecap]);

  if (!draft) {
    return (
      <SafeAreaView style={styles.container}>
        <EtatVide
          erreur={erreurDeLecture}
          titreVide="Chargement…"
          onReessayer={erreurDeLecture ? chargerRecap : undefined}
        />
      </SafeAreaView>
    );
  }

  const traitementIdCourant = draft.id;
  const numeroFicheCourant = draft.numero_fiche ?? draft.id;

  // Le PDF n'existe côté backend que pour une fiche validée (#495, même règle
  // que #494) — le bouton ne peut apparaître que dans le bloc `readOnly`
  // ci-dessous, jamais pendant la saisie.
  const telechargerPdf = () =>
    run(
      () =>
        telechargerEtPartagerPdf(
          depsPdfPartage(),
          `/traitements/${traitementIdCourant}/pdf`,
          `fiche-crt-${numeroFicheCourant}.pdf`
        ),
      { screen: 'recap', context: { traitementId: traitementIdCourant, action: 'telecharger-pdf' } }
    );

  // « Signé » se lit désormais dans la fiche persistée localement (SQLite,
  // `traitement_signature`), pas dans un state éphémère (#signatures-auto-equipe
  // §6) : une signature tracée puis « VALIDÉE » doit compter ici même après
  // fermeture/réouverture de la fiche, avant tout envoi au serveur.
  const estSigne = (role: SignatureRole): boolean =>
    (draft.signatures ?? []).some((s) => s.role === role && !!s.signature_image);

  const signatureMatrix: (ReturnType<typeof computeSignatureMatrix>[number] & { signe: boolean })[] =
    draft.type_traitement === 'AERIEN'
      ? computeSignatureMatrix('AERIEN', {
          pilote: draft.aerien?.pilote,
          mecanicien: draft.aerien?.mecanicien,
          chef_de_base_id: draft.aerien?.chef_de_base_id,
          consultant_international: draft.aerien?.consultant_international,
        }).map((r) => ({ ...r, signe: estSigne(r.role as SignatureRole) }))
      : computeSignatureMatrix('TERRESTRE', {
          chef_equipe_id: draft.terrestre?.chef_equipe_id,
          agent_encadreur: draft.terrestre?.agent_encadreur,
          consultant_international: draft.terrestre?.consultant_international,
        }).map((r) => ({ ...r, signe: estSigne(r.role as SignatureRole) }));

  const surfaceTraitee = draft.terrestre ? computeSurfaceTraitee(draft.terrestre) : 0;
  const surfaceCumulee = draft.terrestre
    ? computeSurfaceCumulee(surfaceTraitee, draft.terrestre.reprise_traitement, draft.terrestre.surface_cumulee_ha)
    : 0;
  const surfaceRestante = draft.terrestre ? computeSurfaceRestante(draft.cible?.surface_infestee_ha, surfaceCumulee) : 0;

  const errors = aggregateRecapErrors({
    typeTraitement: draft.type_traitement,
    references: {
      typeTraitement: draft.type_traitement,
      dateTraitement: draft.date_traitement,
      dateValidation: draft.date_validation,
      localite: draft.localite,
      prospectionId: draft.prospection_id,
    },
    recouvrementPercent: draft.recouvrement_percent,
    empoisonnement: {
      empoisonnement: draft.empoisonnement,
      empoisonnementType: draft.empoisonnement_type,
      empoisonnementMode: draft.empoisonnement_mode,
      empoisonnementAutre: draft.empoisonnement_autre,
    },
    terrestreConditions:
      draft.type_traitement === 'TERRESTRE' && draft.terrestre
        ? {
            heureDebut: draft.terrestre.heure_debut,
            heureFin: draft.terrestre.heure_fin,
            vitesseVentMs: draft.terrestre.vitesse_vent_ms,
            temperatureC: draft.terrestre.temperature_c,
            surfaceRestanteHa: surfaceRestante,
            surfaceRestanteAbandonnee: draft.terrestre.surface_restante_abandonnee,
            motifSurfaceRestanteAbandonnee: draft.terrestre.motif_surface_restante_abandonnee,
          }
        : null,
    aerienEquipe:
      draft.type_traitement === 'AERIEN' && draft.aerien
        ? {
            chefDeBaseId: draft.aerien.chef_de_base_id,
            chefDeBaseNom: nomPersonne(draft.aerien.chef_de_base_id),
            pilote: draft.aerien.pilote,
            mecanicien: draft.aerien.mecanicien,
            consultantInternational: draft.aerien.consultant_international,
            immatriculeAeronef: draft.aerien.immatricule_aeronef,
            basePrincipale: draft.aerien.base_principale,
          }
        : null,
    // #traitement-aerien-sync-apres-enregistrement / #traitement-terrestre-sync-apres-enregistrement
    aerienRotations: (draft.aerien?.rotations ?? []).map((r) => ({
      produitId: r.produit_id,
      quantite: r.quantite,
    })),
    terrestreProduits: (draft.terrestre?.produits ?? []).map((p) => ({
      produitId: p.produit_id,
      quantiteL: p.quantite_l,
    })),
    signatureMatrix,
  });

  const controlLabels = draft.type_traitement === 'AERIEN' ? CONTROL_LABELS_AERIEN : CONTROL_LABELS_TERRESTRE;
  const indexSignatures = controlLabels.length - 1;

  const nbSignaturesRequises = signatureMatrix.filter((r) => r.required).length;
  const nbSignaturesFaites = signatureMatrix.filter((r) => r.signe).length;

  const handleEnregistrer = () =>
    run(
      async () => {
        // Déjà visible à l'écran (liste des points à corriger) : pas de second signal.
        if (errors.length > 0) return;
        const resume = await enregistrerEtSynchroniserTraitement(draft, token!);
        // La fiche est enregistrée localement dans tous les cas ; seul l'envoi
        // peut avoir échoué. Annoncer « Fiche enregistrée » sans regarder le
        // résumé rendrait un refus 4xx ou un conflit 409 totalement muets —
        // le silence exact que #177 supprime.
        const estPartie = resume.reussies.includes(draft.id);

        // Dernier verrou (CDG §9) : n'appelle /valider qu'une fois la fiche
        // réellement arrivée côté serveur (#signatures-auto-equipe §6) — la
        // chaîne complète FRONTEND → API → BACKEND → BASE DE DONNÉES n'a de
        // sens que si le traitement existe déjà côté serveur. Hors ligne, les
        // signatures restent persistées localement (déjà écrites à chaque
        // VALIDER sur l'écran Signatures) et la validation serveur suivra la
        // prochaine synchronisation réussie.
        if (estPartie && draft.statut !== 'validee') {
          await validerEtVerrouillerSurServeur(draft, token!).catch((error) => {
            logError({
              message: toFriendlyError(error).message,
              stack: error instanceof Error ? error.stack ?? null : null,
              screen: 'recap',
              context: { traitementId, source: 'validerTraitement' },
            });
          });
        }

        toast.show(
          estToutParti(resume)
            ? 'Fiche enregistrée et synchronisée'
            : `Fiche enregistrée sur l’appareil — ${resumerEnPhrase(resume)}`
        );
        setTimeout(() => router.replace('/(app)' as any), 1900);
      },
      {
        screen: 'recap',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { traitementId },
      }
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.header}>
          <Text style={styles.numeroFiche}>{draft.numero_fiche ?? 'généré à l’enregistrement'}</Text>
          <Text style={styles.headerLine}>
            {draft.type_traitement} · {draft.mode_traitement ?? '—'} · {draft.localite ?? '—'} · {draft.date_traitement ?? '—'}
          </Text>
        </Card>

        {controlLabels.map((label, index) => {
          const ok =
            index === indexSignatures
              ? nbSignaturesFaites === nbSignaturesRequises
              : errors.length === 0;
          return (
            <View key={label} style={styles.controlLine}>
              <Text style={ok ? styles.dotOk : styles.dotWarn}>{ok ? '✓' : '!'}</Text>
              <Text style={styles.controlLabel}>{label}</Text>
              {index === indexSignatures && <Text style={styles.controlDetail}>{nbSignaturesFaites}/{nbSignaturesRequises} signatures</Text>}
            </View>
          );
        })}

        <Card>
          <Text style={styles.sectionTitle}>Localisation</Text>
          <RecapLigne
            label="Région · district · commune"
            value={[draft.region, draft.district, draft.commune].filter(Boolean).join(' · ') || null}
          />
          <RecapLigne
            label="Coordonnées GPS"
            value={
              draft.latitude != null && draft.longitude != null
                ? `${draft.latitude.toFixed(4)}, ${draft.longitude.toFixed(4)}`
                : null
            }
          />
          <RecapLigne label="Altitude (m)" value={display(draft.altitude)} />
        </Card>

        {draft.cible && (
          <Card>
            <Text style={styles.sectionTitle}>Cible</Text>
            <RecapLigne label="Espèce" value={displayEspecesRecap(draft.cible)} />
            <RecapLigne
              label="Petites larves (L1-L3)"
              value={displayParEspeceRecap(draft.cible.petites_larves_lmc, draft.cible.petites_larves_nse)}
            />
            <RecapLigne
              label="Grandes larves"
              value={displayParEspeceRecap(draft.cible.grandes_larves_lmc, draft.cible.grandes_larves_nse)}
            />
            <RecapLigne label="Vols/essaims" value={displayVolsClairsEssaims(draft.cible.vols_clairs_essaims)} />
            {especePresenteRecap(draft.cible, 'lmc') && (
              <RecapLigne
                label="Répartition LMC"
                value={`diffuse : ${display(draft.cible.densite_diffuse_lmc)} ind./ha · groupée : ${display(draft.cible.densite_groupee_lmc)} ind./m²`}
              />
            )}
            {especePresenteRecap(draft.cible, 'nse') && (
              <RecapLigne
                label="Répartition NSE"
                value={`diffuse : ${display(draft.cible.densite_diffuse_nse)} ind./ha · groupée : ${display(draft.cible.densite_groupee_nse)} ind./m²`}
              />
            )}
            {!especePresenteRecap(draft.cible, 'lmc') && !especePresenteRecap(draft.cible, 'nse') && (
              <RecapLigne label="Répartition de la population" value={display(draft.cible.repartition_population)} />
            )}
            <RecapLigne label="Surface infestée (ha)" value={display(draft.cible.surface_infestee_ha)} />
          </Card>
        )}

        {draft.type_traitement === 'AERIEN' && draft.aerien && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Équipe</Text>
              <RecapLigne label="Chef de base" value={nomPersonne(draft.aerien.chef_de_base_id)} />
              <RecapLigne label="Pilote" value={draft.aerien.pilote} />
              <RecapLigne label="Mécanicien" value={draft.aerien.mecanicien} />
              <RecapLigne label="Consultant" value={draft.aerien.consultant_international} />
              <RecapLigne label="Immatriculation aéronef" value={draft.aerien.immatricule_aeronef} />
              <RecapLigne label="Base principale" value={draft.aerien.base_principale} />
              <RecapLigne label="Stand" value={draft.aerien.stand} />
              <RecapLigne label="Date d'installation (Stand)" value={display(draft.aerien.stand_date_installation)} />
              <RecapLigne label="Base secondaire" value={draft.aerien.base_secondaire} />
              <RecapLigne
                label="Date d'installation (Base secondaire)"
                value={display(draft.aerien.base_secondaire_date_installation)}
              />
              <RecapLigne label="Reprise de traitement" value={displayBool(draft.aerien.reprise_traitement)} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Pesticides & rotations</Text>
              <RecapLigne label="Nb rotations" value={draft.aerien.nb_rotations != null ? String(draft.aerien.nb_rotations) : null} />
              <RecapLigne label="Total pesticide (l)" value={draft.aerien.total_pesticide_l != null ? String(draft.aerien.total_pesticide_l) : null} />
              <RecapLigne label="Total pesticide (kg)" value={draft.aerien.total_pesticide_kg != null ? String(draft.aerien.total_pesticide_kg) : null} />
              <RecapLigne label="Surface traitée (ha)" value={draft.aerien.surface_traitee_ha != null ? String(draft.aerien.surface_traitee_ha) : null} />
              <RecapLigne label="Surface cumulée (ha)" value={display(draft.aerien.surface_cumulee_ha)} />
              <RecapLigne label="Surface restante (ha)" value={display(draft.aerien.surface_restante_ha)} />
              <RecapLigne label="Approvisionnement (l)" value={draft.aerien.pesticide_recu_l != null ? String(draft.aerien.pesticide_recu_l) : null} />
              <RecapLigne label="Reste en stock (l)" value={display(draft.aerien.pesticide_stock_restant_l)} />
              <RecapLigne label="Taux de mortalité (%)" value={display(draft.aerien.taux_mortalite_pourcent)} />
              <RecapLigne label="Évalué après (heures)" value={display(draft.aerien.evaluation_efficacite_heures_apres)} />
              <RecapLigne label="Méthode d'évaluation" value={displayMethodeEvaluation(draft.aerien.methode_evaluation_efficacite)} />
            </Card>

            <Card variant="info">
              <Text style={styles.label}>Rapprochement fiche de vol</Text>
              <Text style={styles.note}>
                À faire manuellement — pas encore de correspondance automatique par n° de cuve dans ce lot.
              </Text>
            </Card>
          </>
        )}

        {draft.type_traitement === 'TERRESTRE' && draft.terrestre && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>Équipe & Conditions</Text>
              <RecapLigne label="Chef d'équipe" value={nomPersonne(draft.terrestre.chef_equipe_id)} />
              <RecapLigne label="Agent encadreur" value={draft.terrestre.agent_encadreur} />
              <RecapLigne label="Consultant" value={draft.terrestre.consultant_international} />
              <RecapLigne label="Heure début" value={draft.terrestre.heure_debut} />
              <RecapLigne label="Heure fin" value={draft.terrestre.heure_fin} />
              <RecapLigne label="Vitesse du vent (m/s)" value={display(draft.terrestre.vitesse_vent_ms)} />
              <RecapLigne label="Direction du vent" value={formatDirectionDeplacement(draft.terrestre.direction_vent)} />
              <RecapLigne label="Température (°C)" value={display(draft.terrestre.temperature_c)} />
              <RecapLigne label="Reprise de traitement" value={displayBool(draft.terrestre.reprise_traitement)} />
              <RecapLigne label="Taux de mortalité (%)" value={display(draft.terrestre.taux_mortalite_pourcent)} />
              <RecapLigne label="Évalué après (heures)" value={display(draft.terrestre.evaluation_efficacite_heures_apres)} />
              <RecapLigne label="Méthode d'évaluation" value={displayMethodeEvaluation(draft.terrestre.methode_evaluation_efficacite)} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Moyens & produits (Terrestre)</Text>
              <RecapLigne label="Atomiseur à dos (ha)" value={display(draft.terrestre.surface_atomiseur_ha)} />
              <RecapLigne label="Disque rotatif (ha)" value={display(draft.terrestre.surface_disque_rotatif_ha)} />
              <RecapLigne label="Surface traitée (ha)" value={display(draft.terrestre.surface_traitee_ha)} />
              <RecapLigne label="Surface cumulée (ha)" value={display(draft.terrestre.surface_cumulee_ha)} />
              <RecapLigne label="Surface restante (ha)" value={display(draft.terrestre.surface_restante_ha)} />
              {draft.terrestre.surface_restante_abandonnee && (
                <RecapLigne label="Motif d'abandon" value={draft.terrestre.motif_surface_restante_abandonnee} />
              )}
              {draft.terrestre.produits.length === 0 ? (
                <RecapLigne label="Produits utilisés" value={null} />
              ) : (
                draft.terrestre.produits.map((p, index) => (
                  <RecapLigne
                    key={p.id}
                    label={p.nom_commercial ?? `Produit ${index + 1}`}
                    value={p.quantite_l != null ? `${p.quantite_l} ${draft.terrestre?.pesticide_unite ?? 'L'}` : null}
                  />
                ))
              )}
              <RecapLigne
                label={`Total pesticide (${draft.terrestre.pesticide_unite ?? 'L'})`}
                value={display(draft.terrestre.total_pesticide_l)}
              />
              <RecapLigne
                label={`Stock initial (${draft.terrestre.pesticide_unite ?? 'L'})`}
                value={display(draft.terrestre.stock_initial_l)}
              />
              <RecapLigne
                label={`Approvisionnement (${draft.terrestre.pesticide_unite ?? 'L'})`}
                value={display(draft.terrestre.pesticide_recu_l)}
              />
              <RecapLigne
                label={`Stock Final (${draft.terrestre.pesticide_unite ?? 'L'})`}
                value={display(draft.terrestre.pesticide_stock_restant_l)}
              />
              <RecapLigne label="Essence (l)" value={display(draft.terrestre.essence_litres)} />
              <RecapLigne label="Nombre de piles" value={display(draft.terrestre.nb_piles)} />
            </Card>
          </>
        )}

        <Card>
          <Text style={styles.sectionTitle}>Moyens & protection</Text>
          <Text style={styles.subsectionTitle}>Humains</Text>
          <RecapLigne label="Nb agents permanents" value={display(draft.nb_agents_permanents)} />
          <RecapLigne label="Nb agents temporaires" value={display(draft.nb_agents_temporaires)} />
          <RecapLigne label="Nb personnel local" value={display(draft.nb_personnel_local)} />
          <Text style={styles.subsectionTitle}>Matériels</Text>
          <RecapLigne label="Atomiseur" value={display(draft.moyens_atomiseur_nb)} />
          <RecapLigne label="Essence (litres)" value={display(draft.moyens_essence_litres)} />
          <RecapLigne label="Disque rotatif" value={display(draft.moyens_disque_rotatif_nb)} />
          <RecapLigne label="Nombre de piles" value={display(draft.moyens_piles_nb)} />
          <RecapLigne label="Ulvamast" value={display(draft.moyens_ulvamast_nb)} />
          <Text style={styles.subsectionTitle}>Kit de protection</Text>
          <RecapLigne label="Combinaisons" value={display(draft.kit_combinaison)} />
          <RecapLigne label="Gants" value={display(draft.kit_gants)} />
          <RecapLigne label="Lunettes" value={display(draft.kit_lunettes)} />
          <RecapLigne label="Masques" value={display(draft.kit_masques)} />
          <RecapLigne label="Bottes" value={display(draft.kit_botte)} />
          <RecapLigne label="Zones exposées" value={displayZonesExposees(draft.zones_exposees)} />
          <RecapLigne label="Strate herbeuse (m)" value={display(draft.hauteur_strate_herbeuse_m)} />
          <RecapLigne label="Strate arborée (m)" value={display(draft.hauteur_strate_arboree_m)} />
          <RecapLigne label="Recouvrement (%)" value={display(draft.recouvrement_percent)} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Impacts & risque</Text>
          <RecapLigne label="Empoisonnement" value={displayBool(draft.empoisonnement)} />
          {draft.empoisonnement && (
            <>
              <RecapLigne label="Personne concernée" value={displayPersonneConcernee(draft.empoisonnement_type)} />
              <RecapLigne label="Mode de contamination" value={displayModeContamination(draft.empoisonnement_mode)} />
              {draft.empoisonnement_mode === 'AUTRE' && (
                <RecapLigne label="Préciser" value={draft.empoisonnement_autre} />
              )}
            </>
          )}
          <RecapLigne label="Évaluation du risque" value={displayEvaluationRisque(parseJsonDictSafe(draft.evaluation_risque))} />
          <RecapLigne label="Comportement anormal" value={displayBool(draft.comportement_anormal)} />
          {draft.comportement_anormal && (
            <RecapLigne label="Espèces concernées" value={displayListe(parseJsonArraySafe(draft.comportement_non_cibles))} />
          )}
          <RecapLigne label="Mortalité" value={displayBool(draft.mortalite)} />
          {draft.mortalite && (
            <RecapLigne label="Familles concernées" value={displayListe(parseJsonArraySafe(draft.mortalite_familles))} />
          )}
          {(draft.evaluations_risque_population ?? []).length > 0 && (
            <>
              <Text style={styles.sousTitre}>Évaluation du risque pour la population</Text>
              {(draft.evaluations_risque_population ?? []).map((evaluation, index) => (
                <RecapLigne
                  key={evaluation.id}
                  label={`Évaluation ${index + 1}`}
                  value={`${display(evaluation.habitat_proche)} · ${
                    evaluation.distance_km != null ? `${evaluation.distance_km} km` : 'non renseigné'
                  } · ${
                    evaluation.sensibilisation == null
                      ? 'non renseigné'
                      : evaluation.sensibilisation
                        ? 'sensibilisée'
                        : 'non sensibilisée'
                  }`}
                />
              ))}
            </>
          )}
          <RecapLigne label="Observations" value={draft.observations} />
        </Card>

        {signatureMatrix.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Signatures</Text>
            {signatureMatrix.map((r) => (
              <RecapLigne
                key={r.role}
                label={SIGNATURE_ROLE_LABELS[r.role as SignatureRole]}
                value={`${nomPourRole(r.role as SignatureRole) ?? '—'} — ${r.signe ? 'Signature validée' : 'Non signée'}`}
              />
            ))}
          </Card>
        )}

        <Card variant={unsyncedCount > 0 ? 'avertissement' : 'info'}>
          <Text style={styles.note}>☁︎ {unsyncedCount} fiche(s) en attente de synchronisation</Text>
        </Card>

        {readOnly ? (
          <>
            <Card variant="info">
              <Text style={styles.note}>🔒 Fiche verrouillée (lecture seule)</Text>
            </Card>
            {draft.statut === 'validee' && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={telechargerPdf}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Génération…' : 'Télécharger le PDF'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.saveButton, errors.length > 0 && styles.saveButtonWarn]}
            onPress={handleEnregistrer}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Enregistrement…' : errors.length === 0 ? 'Enregistrer' : `${errors.length} point(s) à corriger`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Toast message={toast.message} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  header: { backgroundColor: traitementColors.vertPrincipal, borderColor: traitementColors.vertPrincipal, gap: 4 },
  numeroFiche: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.valeurDerivee, color: '#fff' },
  headerLine: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: '#fff' },
  controlLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotOk: { color: traitementColors.vertPrincipal, fontFamily: traitementFonts.uiBold },
  dotWarn: { color: traitementColors.attente, fontFamily: traitementFonts.uiBold },
  controlLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre, flex: 1 },
  controlDetail: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.label, color: traitementColors.texteSecondaire },
  sectionTitle: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.corps + 1, color: traitementColors.texteTitre, marginBottom: 4 },
  // Sous-titre à l'intérieur d'une Card qui regroupe plusieurs sous-sections
  // de l'écran source (ex. "Moyens & protection" = Humains + Matériels + Kit
  // de protection sur moyens.tsx) — plus discret que `sectionTitle` (titre de
  // la Card elle-même), avec un espace au-dessus pour marquer la coupure.
  subsectionTitle: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.label,
    color: traitementColors.texteLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 2,
  },
  recapLigne: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 2 },
  recapLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire, flex: 1 },
  recapValue: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre, textAlign: 'right' },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  sousTitre: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.label,
    color: traitementColors.texteTitre,
    marginTop: 6,
    marginBottom: 2,
  },
  note: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteNote },
  saveButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  saveButtonWarn: { backgroundColor: traitementColors.attente },
  saveButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
