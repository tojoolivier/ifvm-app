import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  updateTraitementAerien,
  updateTraitementTerrestre,
  addRotation,
  addProduitUtilise,
  listReprenableTraitements,
  DraftTraitementRow,
} from '@/lib/traitement-repository';
import { listUtilisateursByRole, listPesticides, Pesticide, UtilisateurEquipe } from '@/lib/referentiel-db';
import { useTraitementCaptureStore, ProduitDraft } from '@/lib/traitement-capture-store';
import { generateId } from '@/lib/id';
import {
  computeTotalPesticideTerrestre,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  validateTerrestreConditions,
  validateRotationsHeures,
} from '@/lib/traitement-validation';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { AerienForm } from '@/components/traitement/AerienForm';
import { TerrestreForm } from '@/components/traitement/TerrestreForm';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

export default function TraitementScreen() {
  const router = useRouter();
  const { traitementId, isValidationView, origineId } =
    useLocalSearchParams<{ traitementId: string; isValidationView?: string; origineId?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';

  const typeTraitement = store.typeTraitement;
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);
  const [chefsEquipe, setChefsEquipe] = useState<UtilisateurEquipe[]>([]);
  const [agentsEncadreurs, setAgentsEncadreurs] = useState<UtilisateurEquipe[]>([]);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [reprenables, setReprenables] = useState<DraftTraitementRow[]>([]);
  const [surfaceInfesteeHa, setSurfaceInfesteeHa] = useState<number | null>(null);
  const [origineCumuleeHa, setOrigineCumuleeHa] = useState<number | null>(null);
  // Le store (Lot 1, non modifiable) n'expose pas de updateProduit — seulement
  // addProduit/removeProduit — donc l'édition des produits utilisés (terrestre)
  // est portée par un état local immuable propre à cet écran.
  const [produits, setProduits] = useState<ProduitDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargementBase = useSignalerChargement('traitement');
  const signalerChargement = (error: unknown, source: string) =>
    signalerChargementBase(error, { traitementId, source });

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId).then((draft) => {
      if (!draft) return;
      store.setTypeTraitement(draft.type_traitement);
      setSurfaceInfesteeHa(draft.cible?.surface_infestee_ha ?? null);
      if (draft.type_traitement === 'AERIEN' && draft.aerien) {
        store.updateAerien({
          pilote: draft.aerien.pilote || null,
          mecanicien: draft.aerien.mecanicien || null,
          chefDeBaseId: draft.aerien.chef_de_base_id || null,
          consultantInternational: draft.aerien.consultant_international,
        });
        if (store.aerien.rotations.length === 0) {
          for (const r of draft.aerien.rotations) {
            store.addRotation({
              numero_cuve: r.numero_cuve,
              produit_id: r.produit_id,
              quantite_l: r.quantite_l,
              temperature_debut_c: r.temperature_debut_c,
              temperature_fin_c: r.temperature_fin_c,
              vent_debut_ms: r.vent_debut_ms,
              vent_fin_ms: r.vent_fin_ms,
              heure_debut: r.heure_debut,
              heure_fin: r.heure_fin,
            });
          }
        }
        if (store.aerien.rotations.length === 0 && draft.aerien.rotations.length === 0) {
          store.addRotation({});
        }
      }
      if (draft.type_traitement === 'TERRESTRE' && draft.terrestre) {
        store.updateTerrestre({
          chefEquipeId: draft.terrestre.chef_equipe_id || null,
          agentEncadreurId: draft.terrestre.agent_encadreur_id,
          consultantInternational: draft.terrestre.consultant_international,
          heureDebut: draft.terrestre.heure_debut,
          heureFin: draft.terrestre.heure_fin,
          vitesse_vent_ms: draft.terrestre.vitesse_vent_ms,
          direction_vent: draft.terrestre.direction_vent,
          temperature_c: draft.terrestre.temperature_c,
          repriseTraitement: draft.terrestre.reprise_traitement ?? false,
          traitementOrigineId: draft.terrestre.traitement_origine_id,
          surface_atomiseur_ha: draft.terrestre.surface_atomiseur_ha,
          surface_disque_rotatif_ha: draft.terrestre.surface_disque_rotatif_ha,
          surface_ulvamast_ha: draft.terrestre.surface_ulvamast_ha,
          surfaceRestanteAbandonnee: draft.terrestre.surface_restante_abandonnee,
          motifSurfaceRestanteAbandonnee: draft.terrestre.motif_surface_restante_abandonnee,
          essence_litres: draft.terrestre.essence_litres,
          nb_piles: draft.terrestre.nb_piles,
        });
        // Présélection reprise : uniquement sur une fiche fraîchement amorcée
        // depuis "Zones à reprendre" (draft.terrestre.reprise_traitement pas
        // encore renseigné) — n'écrase jamais un choix déjà enregistré.
        if (origineId && !draft.terrestre.reprise_traitement && !draft.terrestre.traitement_origine_id) {
          store.updateTerrestre({ repriseTraitement: true, traitementOrigineId: origineId });
        }
        if (produits.length === 0) {
          setProduits(
            draft.terrestre.produits.length > 0
              ? draft.terrestre.produits.map((p) => ({ localId: generateId(), produit_id: p.produit_id, quantite_l: p.quantite_l }))
              : [{ localId: generateId() }]
          );
        }
      }
    }).catch((error) => signalerChargement(error, 'getTraitement'));
    listPesticides().then(setPesticides).catch((error) => signalerChargement(error, 'listPesticides'));
    listReprenableTraitements().then(setReprenables).catch((error) => signalerChargement(error, 'listReprenableTraitements'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  useEffect(() => {
    listUtilisateursByRole('chef_de_base').then(setChefsDeBase).catch((error) => signalerChargement(error, 'listUtilisateursByRole:chef_de_base'));
    listUtilisateursByRole('chef_equipe').then(setChefsEquipe).catch((error) => signalerChargement(error, 'listUtilisateursByRole:chef_equipe'));
    listUtilisateursByRole('agent_encadreur').then(setAgentsEncadreurs).catch((error) => signalerChargement(error, 'listUtilisateursByRole:agent_encadreur'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const origineId = store.terrestre.traitementOrigineId;
    let cancelled = false;
    if (store.terrestre.repriseTraitement && origineId) {
      void getTraitement(origineId)
        .then((draft) => {
          if (!cancelled) setOrigineCumuleeHa(draft?.terrestre?.surface_cumulee_ha ?? null);
        })
        .catch((error) => {
          if (!cancelled) signalerChargement(error, 'getTraitement:origine');
        });
    } else {
      // Défère hors du tick synchrone de l'effet (react-hooks/set-state-in-effect) :
      // pas d'E/S ici, mais un `setState` direct dans le corps de l'effet reste
      // proscrit au même titre.
      void Promise.resolve().then(() => {
        if (!cancelled) setOrigineCumuleeHa(null);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.terrestre.repriseTraitement, store.terrestre.traitementOrigineId]);

  const totalPesticideTerrestre = computeTotalPesticideTerrestre(produits);
  const surfaceTraitee = computeSurfaceTraitee(store.terrestre);
  const surfaceCumulee = computeSurfaceCumulee(surfaceTraitee, store.terrestre.repriseTraitement, origineCumuleeHa);
  const surfaceRestante = computeSurfaceRestante(surfaceInfesteeHa, surfaceCumulee);

  const handleContinuer = () =>
    run(
      async () => {
        if (typeTraitement === 'AERIEN') {
          if (!store.aerien.pilote || !store.aerien.mecanicien || !store.aerien.chefDeBaseId) {
            setErrors({ aerien: 'Pilote, mécanicien et chef de base sont obligatoires' });
            return;
          }
          const heuresErrors = validateRotationsHeures(
            store.aerien.rotations.map((r) => ({ heureDebut: r.heure_debut ?? null, heureFin: r.heure_fin ?? null }))
          );
          if (heuresErrors.length > 0) {
            setErrors({ aerien: heuresErrors[0].message });
            return;
          }
          await updateTraitementAerien(traitementId, {
            pilote: store.aerien.pilote,
            mecanicien: store.aerien.mecanicien,
            chefDeBaseId: store.aerien.chefDeBaseId,
            consultantInternational: store.aerien.consultantInternational,
          });
          for (const r of store.aerien.rotations) {
            await addRotation(traitementId, {
              numero_cuve: r.numero_cuve,
              produit_id: r.produit_id,
              quantite_l: r.quantite_l,
              temperature_debut_c: r.temperature_debut_c,
              temperature_fin_c: r.temperature_fin_c,
              vent_debut_ms: r.vent_debut_ms,
              vent_fin_ms: r.vent_fin_ms,
              heure_debut: r.heure_debut,
              heure_fin: r.heure_fin,
            });
          }
        } else {
          const conditionErrors = validateTerrestreConditions({
            heureDebut: store.terrestre.heureDebut ?? null,
            heureFin: store.terrestre.heureFin ?? null,
            repriseTraitement: store.terrestre.repriseTraitement ?? false,
            traitementOrigineId: store.terrestre.traitementOrigineId ?? null,
            surfaceRestanteHa: surfaceRestante,
            surfaceRestanteAbandonnee: store.terrestre.surfaceRestanteAbandonnee ?? null,
            motifSurfaceRestanteAbandonnee: store.terrestre.motifSurfaceRestanteAbandonnee ?? null,
          });
          if (!store.terrestre.chefEquipeId || conditionErrors.length > 0) {
            const byField: Record<string, string> = {};
            if (!store.terrestre.chefEquipeId) byField.chefEquipeId = "Le chef d'équipe est obligatoire";
            for (const e of conditionErrors) byField[e.field] = e.message;
            setErrors(byField);
            return;
          }
          await updateTraitementTerrestre(traitementId, {
            chefEquipeId: store.terrestre.chefEquipeId,
            agentEncadreurId: store.terrestre.agentEncadreurId,
            consultantInternational: store.terrestre.consultantInternational,
            heureDebut: store.terrestre.heureDebut,
            heureFin: store.terrestre.heureFin,
            vitesse_vent_ms: store.terrestre.vitesse_vent_ms,
            direction_vent: store.terrestre.direction_vent,
            temperature_c: store.terrestre.temperature_c,
            repriseTraitement: store.terrestre.repriseTraitement,
            traitementOrigineId: store.terrestre.traitementOrigineId,
            surface_atomiseur_ha: store.terrestre.surface_atomiseur_ha,
            surface_disque_rotatif_ha: store.terrestre.surface_disque_rotatif_ha,
            surface_ulvamast_ha: store.terrestre.surface_ulvamast_ha,
            surfaceRestanteAbandonnee: store.terrestre.surfaceRestanteAbandonnee,
            motifSurfaceRestanteAbandonnee: store.terrestre.motifSurfaceRestanteAbandonnee,
            essence_litres: store.terrestre.essence_litres,
            nb_piles: store.terrestre.nb_piles,
          });
          for (const p of produits) {
            await addProduitUtilise(traitementId, { produit_id: p.produit_id, quantite_l: p.quantite_l });
          }
        }

        router.push({ pathname: '/(traitement)/moyens' as any, params: { traitementId, isValidationView } });
      },
      {
        screen: 'traitement',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId, typeTraitement },
      }
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={2} />
        <Text style={styles.title}>Traitement</Text>

        {typeTraitement === 'AERIEN' && (
          <AerienForm readOnly={readOnly} chefsDeBase={chefsDeBase} pesticides={pesticides} error={errors.aerien} />
        )}

        {typeTraitement === 'TERRESTRE' && (
          <TerrestreForm
            readOnly={readOnly}
            chefsEquipe={chefsEquipe}
            agentsEncadreurs={agentsEncadreurs}
            reprenables={reprenables}
            pesticides={pesticides}
            produits={produits}
            setProduits={setProduits}
            surfaceTraitee={surfaceTraitee}
            surfaceCumulee={surfaceCumulee}
            surfaceRestante={surfaceRestante}
            totalPesticideTerrestre={totalPesticideTerrestre}
            errors={errors}
          />
        )}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
