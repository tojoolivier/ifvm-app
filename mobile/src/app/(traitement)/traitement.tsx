import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  updateTraitementAerien,
  updateTraitementTerrestre,
  addProduitUtilise,
  listReprenableTraitements,
  DraftTraitementRow,
} from '@/lib/traitement-repository';
import { listUtilisateursByRole, listPesticides, listLieuxAeriens, Pesticide, UtilisateurEquipe, LieuAerien } from '@/lib/referentiel-db';
import { useTraitementCaptureStore, ProduitDraft } from '@/lib/traitement-capture-store';
import { useAuthStore } from '@/lib/auth-store';
import { generateId } from '@/lib/id';
import {
  computeTotalPesticideTerrestre,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  computePesticideStockRestant,
  validateTerrestreConditions,
  validateAerienEquipe,
  validateRepriseTraitement,
} from '@/lib/traitement-validation';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
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
  const utilisateurConnecte = useAuthStore((s) => s.user);

  const typeTraitement = store.typeTraitement;
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);
  const [chefsEquipe, setChefsEquipe] = useState<UtilisateurEquipe[]>([]);
  const [agentsEncadreurs, setAgentsEncadreurs] = useState<UtilisateurEquipe[]>([]);
  const [lieuxAeriens, setLieuxAeriens] = useState<LieuAerien[]>([]);
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
        // Rotations non chargées ici : sous-ressource propre à l'écran « Pesticides &
        // rotations » (rotations.tsx), qui suit après celui-ci dans le flux aérien.
        store.updateAerien({
          pilote: draft.aerien.pilote || null,
          mecanicien: draft.aerien.mecanicien || null,
          chefDeBaseId: draft.aerien.chef_de_base_id || null,
          consultantInternational: draft.aerien.consultant_international,
          immatriculationAeronef: draft.aerien.immatricule_aeronef,
          lieuBasePrincipaleId: draft.aerien.lieu_base_principale_id,
          lieuStandId: draft.aerien.lieu_stand_id,
          lieuBaseSecondaireId: draft.aerien.lieu_base_secondaire_id,
          // pesticide_recu_l n'est plus hydraté ici : saisi sur l'écran « Traitement »
          // (rotations.tsx, #equipe-slide-aerien), qui charge ce champ lui-même.
          repriseTraitement: draft.aerien.reprise_traitement ?? false,
          traitementOrigineId: draft.aerien.traitement_origine_id,
        });
        // Présélection reprise (migration backend 0050, mirroir du bloc Terrestre
        // ci-dessous) : uniquement sur une fiche fraîchement amorcée depuis "Zones
        // à reprendre" — n'écrase jamais un choix déjà enregistré.
        if (origineId && !draft.aerien.reprise_traitement && !draft.aerien.traitement_origine_id) {
          store.updateAerien({ repriseTraitement: true, traitementOrigineId: origineId });
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
          pesticideRecuL: draft.terrestre.pesticide_recu_l,
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
              ? draft.terrestre.produits.map((p) => ({
                  localId: generateId(),
                  produit_id: p.produit_id,
                  quantite_l: p.quantite_l,
                  nom_commercial: p.nom_commercial,
                }))
              : [{ localId: generateId() }]
          );
        }
      }
    }).catch((error) => signalerChargement(error, 'getTraitement'));
    listReprenableTraitements().then(setReprenables).catch((error) => signalerChargement(error, 'listReprenableTraitements'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  // Pesticides proposés au choix, filtrés par mode de traitement (BARRIERE : produits
  // barrière, TOTAL : produits de choc, IRREGULIER : tous) — séparé de l'effet
  // ci-dessus pour se recharger si l'agent revient changer le mode sur l'écran
  // Références sans changer de fiche (store.ref.modeTraitement, pas traitementId).
  useEffect(() => {
    listPesticides(store.ref.modeTraitement)
      .then(setPesticides)
      .catch((error) => signalerChargement(error, 'listPesticides'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId, store.ref.modeTraitement]);

  useEffect(() => {
    listUtilisateursByRole('chef_de_base').then(setChefsDeBase).catch((error) => signalerChargement(error, 'listUtilisateursByRole:chef_de_base'));
    listUtilisateursByRole('chef_equipe').then(setChefsEquipe).catch((error) => signalerChargement(error, 'listUtilisateursByRole:chef_equipe'));
    listUtilisateursByRole('agent_encadreur').then(setAgentsEncadreurs).catch((error) => signalerChargement(error, 'listUtilisateursByRole:agent_encadreur'));
    listLieuxAeriens().then(setLieuxAeriens).catch((error) => signalerChargement(error, 'listLieuxAeriens'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chef de base = l'utilisateur connecté sur ce téléphone par défaut (c'est
  // lui qui fait la saisie) — seulement pour une fiche pas encore renseignée,
  // jamais pour écraser une valeur déjà choisie ou déjà enregistrée (brouillon
  // repris, fiche validée en lecture seule).
  useEffect(() => {
    if (typeTraitement !== 'AERIEN' || readOnly || store.aerien.chefDeBaseId || !utilisateurConnecte) return;
    const chefConnecte = chefsDeBase.find((c) => c.id === utilisateurConnecte.id);
    if (chefConnecte) {
      store.updateAerien({ chefDeBaseId: chefConnecte.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeTraitement, readOnly, chefsDeBase, utilisateurConnecte, store.aerien.chefDeBaseId]);

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
  const pesticideStockRestantTerrestre = computePesticideStockRestant(
    store.terrestre.pesticideRecuL,
    totalPesticideTerrestre
  );

  const handleContinuer = () =>
    run(
      async () => {
        if (typeTraitement === 'AERIEN') {
          const chefDeBase = chefsDeBase.find((c) => c.id === store.aerien.chefDeBaseId);
          const equipeErrors = validateAerienEquipe({
            chefDeBaseId: store.aerien.chefDeBaseId,
            chefDeBaseNom: chefDeBase ? `${chefDeBase.prenom} ${chefDeBase.nom}` : null,
            pilote: store.aerien.pilote,
            mecanicien: store.aerien.mecanicien,
            consultantInternational: store.aerien.consultantInternational,
            immatriculeAeronef: store.aerien.immatriculationAeronef,
            lieuBasePrincipaleId: store.aerien.lieuBasePrincipaleId,
          });
          if (equipeErrors.length > 0) {
            setErrors({ aerien: equipeErrors[0].message });
            return;
          }
          const repriseErrors = validateRepriseTraitement(
            store.aerien.repriseTraitement,
            store.aerien.traitementOrigineId
          );
          if (repriseErrors.length > 0) {
            setErrors({ traitementOrigineId: repriseErrors[0].message });
            return;
          }
          await updateTraitementAerien(traitementId, {
            pilote: store.aerien.pilote!,
            mecanicien: store.aerien.mecanicien!,
            chefDeBaseId: store.aerien.chefDeBaseId!,
            consultantInternational: store.aerien.consultantInternational,
            immatriculeAeronef: store.aerien.immatriculationAeronef,
            lieuBasePrincipaleId: store.aerien.lieuBasePrincipaleId,
            lieuStandId: store.aerien.lieuStandId,
            lieuBaseSecondaireId: store.aerien.lieuBaseSecondaireId,
            repriseTraitement: store.aerien.repriseTraitement,
            traitementOrigineId: store.aerien.traitementOrigineId,
          });
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
            pesticideRecuL: store.terrestre.pesticideRecuL,
          });
          for (const p of produits) {
            await addProduitUtilise(traitementId, {
              produit_id: p.produit_id,
              quantite_l: p.quantite_l,
              nom_commercial: p.nom_commercial,
            });
          }
        }

        // Aérien : « Traitement » (rotations.tsx) s'insère juste après cet écran
        // (Équipe), avant Moyens — terrestre continue directement vers Moyens comme
        // aujourd'hui (produits utilisés restés sur cet écran, pas de sous-ressource
        // séparée). #equipe-slide-aerien.
        router.push({
          pathname: (typeTraitement === 'AERIEN' ? '/(traitement)/rotations' : '/(traitement)/moyens') as any,
          params: { traitementId, isValidationView },
        });
      },
      {
        screen: 'traitement',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId, typeTraitement },
      }
    );

  // Migration backend 0050 : listReprenableTraitements() couvre désormais les deux
  // chaînes (Aérien et Terrestre) — chaque type ne doit reprendre que sa propre
  // chaîne (la fiche d'origine doit être du même type, cf. validation backend).
  const reprenablesAerien = reprenables.filter((r) => r.type_traitement === 'AERIEN');
  const reprenablesTerrestre = reprenables.filter((r) => r.type_traitement === 'TERRESTRE');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={2}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Équipe</Text>

        {typeTraitement === 'AERIEN' && (
          <AerienForm
            readOnly={readOnly}
            chefsDeBase={chefsDeBase}
            lieuxAeriens={lieuxAeriens}
            reprenables={reprenablesAerien}
            errors={errors}
          />
        )}

        {typeTraitement === 'TERRESTRE' && (
          <TerrestreForm
            readOnly={readOnly}
            chefsEquipe={chefsEquipe}
            agentsEncadreurs={agentsEncadreurs}
            reprenables={reprenablesTerrestre}
            pesticides={pesticides}
            produits={produits}
            setProduits={setProduits}
            surfaceTraitee={surfaceTraitee}
            surfaceCumulee={surfaceCumulee}
            surfaceRestante={surfaceRestante}
            totalPesticideTerrestre={totalPesticideTerrestre}
            pesticideStockRestant={pesticideStockRestantTerrestre}
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
