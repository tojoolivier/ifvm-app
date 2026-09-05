import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, countUnsyncedTraitements, DraftTraitement } from '@/lib/traitement-repository';
import { enregistrerEtSynchroniserTraitement } from '@/lib/traitement-sync';
import { estToutParti, resumerEnPhrase } from '@/lib/sync-lot';
import { useAuthStore } from '@/lib/auth-store';
import { useTraitementCaptureStore, SignatureRole } from '@/lib/traitement-capture-store';
import { listUtilisateursByRole, listLieuxAeriens, UtilisateurEquipe, LieuAerien } from '@/lib/referentiel-db';
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

// Aérien : 7 étapes (Équipe/Traitement scindés, #equipe-slide-aerien) ; terrestre : 6
// (équipe et pesticides restés sur un seul écran) — reflète PROGRESS_SEGMENTS_AERIEN/
// PROGRESS_SEGMENTS_TERRESTRE (ProgressBar.tsx). Le dernier libellé est toujours
// « Signatures » : son index se déduit de la longueur, jamais codé en dur.
const CONTROL_LABELS_AERIEN = ['Références', 'Cibles', 'Équipe', 'Traitement', 'Moyens & protection', 'Impacts & risque', 'Signatures'];
const CONTROL_LABELS_TERRESTRE = ['Références', 'Cibles', 'Équipe', 'Moyens & protection', 'Impacts & risque', 'Signatures'];

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
  const store = useTraitementCaptureStore();
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
  const [lieuxAeriens, setLieuxAeriens] = useState<LieuAerien[]>([]);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signaler = useErrorStore((s) => s.signaler);
  const logError = useErrorLogStore((s) => s.addEntry);

  useEffect(() => {
    if (draft?.type_traitement !== 'AERIEN') return;
    listUtilisateursByRole('chef_de_base')
      .then(setPersonnes)
      .catch((error) => logError({
        message: toFriendlyError(error).message,
        stack: error instanceof Error ? error.stack ?? null : null,
        screen: 'recap',
        context: { traitementId, source: 'listUtilisateursByRole' },
      }));
    listLieuxAeriens()
      .then(setLieuxAeriens)
      .catch((error) => logError({
        message: toFriendlyError(error).message,
        stack: error instanceof Error ? error.stack ?? null : null,
        screen: 'recap',
        context: { traitementId, source: 'listLieuxAeriens' },
      }));
  }, [draft?.type_traitement, traitementId, logError]);

  const nomPersonne = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const p = personnes.find((u) => u.id === id);
    return p ? `${p.prenom} ${p.nom}` : null;
  };
  const nomLieu = (id: string | null | undefined): string | null =>
    id ? lieuxAeriens.find((l) => l.id === id)?.nom ?? null : null;

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

  const signatureMatrix: (ReturnType<typeof computeSignatureMatrix>[number] & { signe: boolean })[] =
    draft.type_traitement === 'AERIEN'
      ? computeSignatureMatrix('AERIEN', {
          pilote: draft.aerien?.pilote,
          mecanicien: draft.aerien?.mecanicien,
          chef_de_base_id: draft.aerien?.chef_de_base_id,
          consultant_international: draft.aerien?.consultant_international,
        }).map((r) => ({ ...r, signe: !!store.signed[r.role as SignatureRole] }))
      : computeSignatureMatrix('TERRESTRE', {
          chef_equipe_id: draft.terrestre?.chef_equipe_id,
          agent_encadreur_id: draft.terrestre?.agent_encadreur_id,
          consultant_international: draft.terrestre?.consultant_international,
        }).map((r) => ({ ...r, signe: !!store.signed[r.role as SignatureRole] }));

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
            lieuBasePrincipaleId: draft.aerien.lieu_base_principale_id,
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
              <RecapLigne label="Base principale" value={nomLieu(draft.aerien.lieu_base_principale_id)} />
              <RecapLigne label="Stand" value={nomLieu(draft.aerien.lieu_stand_id)} />
              <RecapLigne label="Base secondaire" value={nomLieu(draft.aerien.lieu_base_secondaire_id)} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Traitement</Text>
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
