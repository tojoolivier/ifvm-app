import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  countUnsyncedTraitements,
  markTraitementValidee,
  DraftTraitement,
} from '@/lib/traitement-repository';
import { enregistrerEtSynchroniserTraitement } from '@/lib/traitement-sync';
import { apiClient } from '@/lib/api-client';
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
            repriseTraitement: draft.terrestre.reprise_traitement,
            traitementOrigineId: draft.terrestre.traitement_origine_id,
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
              <RecapLigne label="Base secondaire" value={draft.aerien.base_secondaire} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Pesticides & rotations</Text>
              <RecapLigne label="Nb rotations" value={draft.aerien.nb_rotations != null ? String(draft.aerien.nb_rotations) : null} />
              <RecapLigne label="Total pesticide (l)" value={draft.aerien.total_pesticide_l != null ? String(draft.aerien.total_pesticide_l) : null} />
              <RecapLigne label="Total pesticide (kg)" value={draft.aerien.total_pesticide_kg != null ? String(draft.aerien.total_pesticide_kg) : null} />
              <RecapLigne label="Surface traitée (ha)" value={draft.aerien.surface_traitee_ha != null ? String(draft.aerien.surface_traitee_ha) : null} />
              <RecapLigne label="Pesticide reçu (l)" value={draft.aerien.pesticide_recu_l != null ? String(draft.aerien.pesticide_recu_l) : null} />
            </Card>

            <Card variant="info">
              <Text style={styles.label}>Rapprochement fiche de vol</Text>
              <Text style={styles.note}>
                À faire manuellement — pas encore de correspondance automatique par n° de cuve dans ce lot.
              </Text>
            </Card>
          </>
        )}

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
          <Card variant="info">
            <Text style={styles.note}>🔒 Fiche verrouillée (lecture seule)</Text>
          </Card>
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
  recapLigne: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 2 },
  recapLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire, flex: 1 },
  recapValue: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre, textAlign: 'right' },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
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
