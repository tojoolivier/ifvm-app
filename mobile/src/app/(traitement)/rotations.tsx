import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  addRotation,
  deleteAllRotationsForTraitementAerien,
  updateTraitementAerienPesticideRecu,
  updateTraitementAerienEfficacite,
} from '@/lib/traitement-repository';
import { listPesticides, Pesticide } from '@/lib/referentiel-db';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import {
  computeNbRotations,
  computeTotalPesticideAerienParUnite,
  computeSurfaceTraiteeAerien,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  computePesticideStockRestant,
  computeDureesRotation,
  formatDureeRotation,
  validateRotationsHeures,
  deriveNomCommercial,
} from '@/lib/traitement-validation';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN } from '@/components/traitement/ProgressBar';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProduitSelectField } from '@/components/traitement/ProduitSelectField';
import { TimeField } from '@/components/traitement/TimeField';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

/**
 * Écran « Pesticides & rotations » (migration 0046/0047, #Ticket 7,
 * #equipe-slide-aerien ; renommé depuis « Traitement » par #326) — aérien
 * uniquement, inséré juste après Équipe (traitement.tsx, dont ce bloc a été
 * extrait) et avant Moyens. Chaque rotation porte désormais quantité + unité (L/kg),
 * une superficie traitée et des heures d'ouverture/fermeture de vanne, en plus des
 * champs déjà existants (produit, températures, vent, heure_debut/heure_fin de la
 * rotation entière). N° de cuve et les 3 durées ne sont jamais saisis : dérivés à
 * l'affichage. « Pesticide reçu (l) » (libellé affiché « Approvisionnement (l) »)
 * y a été déplacé depuis Équipe : c'est une
 * information propre au traitement (stock de pesticide), pas à l'équipe.
 */
// Saisie francophone : la virgule est le séparateur décimal attendu par l'utilisateur,
// mais JS/JSON n'utilisent que le point en interne — même paire de fonctions que
// moyens.tsx/synthese.tsx (#326), pas mutualisée pour l'instant (cf. commentaire
// équivalent là-bas). Sans conversion, taper "3,2" produisait `Number("3,2")` =
// `NaN`, aussitôt réaffiché tel quel par `String(NaN)` — la valeur saisie semblait
// « disparaître », remplacée par "NaN" (#pesticides-rotations-decimales).
function parseDecimalInput(raw: string): number | null {
  if (raw === '') return null;
  const val = Number(raw.replace(',', '.'));
  return isNaN(val) ? null : val;
}

function formatDecimalDisplay(value: number | null | undefined): string {
  return value != null ? String(value).replace('.', ',') : '';
}

type AerienDecimalField = 'pesticideRecuL' | 'tauxMortalitePourcent' | 'evaluationEfficaciteHeuresApres';
type RotationDecimalField =
  | 'quantite'
  | 'surface_ha'
  | 'temperature_debut_c'
  | 'temperature_fin_c'
  | 'vent_debut_ms'
  | 'vent_fin_ms';

export default function RotationsScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';

  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [surfaceInfesteeHa, setSurfaceInfesteeHa] = useState<number | null>(null);
  const [origineCumuleeHa, setOrigineCumuleeHa] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  // Texte brut en cours de saisie pour les champs décimaux — permet de taper un
  // séparateur décimal ou un zéro de fin ("3," / "3,2") sans que le champ ne se
  // reformate à chaque frappe (cf. `store.aerien.xxx != null ? String(...) : ''`
  // sinon). Un objet pour les champs "aérien" (niveau fiche), un autre indexé par
  // rotation (`localId`) pour les champs propres à chaque rotation.
  const [aerienDrafts, setAerienDrafts] = useState<Partial<Record<AerienDecimalField, string>>>({});
  const [rotationDrafts, setRotationDrafts] = useState<Record<string, Partial<Record<RotationDecimalField, string>>>>({});

  const getAerienDraft = (field: AerienDecimalField): string | undefined => aerienDrafts[field];

  const handleAerienDecimalChange = (field: AerienDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setAerienDrafts((current) => ({ ...current, [field]: raw }));
    if (raw === '') {
      store.updateAerien({ [field]: null });
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    store.updateAerien({ [field]: val });
  };

  const clearAerienDraft = (field: AerienDecimalField) => {
    setAerienDrafts((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const getRotationDraft = (localId: string, field: RotationDecimalField): string | undefined =>
    rotationDrafts[localId]?.[field];

  const handleRotationDecimalChange = (localId: string, field: RotationDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setRotationDrafts((current) => ({ ...current, [localId]: { ...current[localId], [field]: raw } }));
    if (raw === '') {
      store.updateRotation(localId, { [field]: null });
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    store.updateRotation(localId, { [field]: val });
  };

  const clearRotationDraft = (localId: string, field: RotationDecimalField) => {
    setRotationDrafts((current) => {
      if (current[localId]?.[field] === undefined) return current;
      const nextForId = { ...current[localId] };
      delete nextForId[field];
      return { ...current, [localId]: nextForId };
    });
  };
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargementBase = useSignalerChargement('rotations');
  const signalerChargement = (error: unknown, source: string) =>
    signalerChargementBase(error, { traitementId, source });

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        setSurfaceInfesteeHa(draft.cible?.surface_infestee_ha ?? null);
        // pesticide_recu_l chargé ici depuis #equipe-slide-aerien (déplacé depuis
        // Équipe/traitement.tsx) — même garde ailleurs sur cet écran : recharge à
        // chaque montage (bornée à `traitementId`), sans écraser une saisie en cours
        // entre deux montages du même écran.
        if (draft.type_traitement === 'AERIEN' && draft.aerien) {
          store.updateAerien({
            pesticideRecuL: draft.aerien.pesticide_recu_l,
            // Efficacité (migration backend 0058) — même écran/même garde que
            // pesticideRecuL ci-dessus.
            tauxMortalitePourcent: draft.aerien.taux_mortalite_pourcent,
            evaluationEfficaciteHeuresApres: draft.aerien.evaluation_efficacite_heures_apres,
            methodeEvaluationEfficacite: draft.aerien.methode_evaluation_efficacite as
              | 'ESTIMATION_VISUELLE'
              | 'COMPTAGES_PRE_POST'
              | null,
          });
        }
        // Rotations chargées ici seulement (sous-ressource propre à cet écran, pas à
        // Équipe) — même garde qu'auparavant dans traitement.tsx : ne réhydrate
        // qu'une fois par fiche, jamais par-dessus une saisie déjà en cours.
        if (draft.type_traitement === 'AERIEN' && draft.aerien && store.aerien.rotations.length === 0) {
          for (const r of draft.aerien.rotations) {
            store.addRotation({
              produit_id: r.produit_id,
              quantite: r.quantite,
              unite: (r.unite as 'L' | 'kg' | null) ?? 'L',
              surface_ha: r.surface_ha,
              temperature_debut_c: r.temperature_debut_c,
              temperature_fin_c: r.temperature_fin_c,
              vent_debut_ms: r.vent_debut_ms,
              vent_fin_ms: r.vent_fin_ms,
              heure_debut: r.heure_debut,
              heure_fin: r.heure_fin,
              heure_ouverture_vanne: r.heure_ouverture_vanne,
              heure_fermeture_vanne: r.heure_fermeture_vanne,
              nom_commercial: r.nom_commercial,
            });
          }
        }
        if (store.aerien.rotations.length === 0 && (!draft.aerien || draft.aerien.rotations.length === 0)) {
          store.addRotation({});
        }
      })
      .catch((error) => signalerChargement(error, 'getTraitement'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  // Même filtre par mode de traitement que sur Équipe (traitement.tsx) — se
  // recharge si l'agent revient changer le mode sur Références sans changer de fiche.
  useEffect(() => {
    listPesticides(store.ref.modeTraitement)
      .then(setPesticides)
      .catch((error) => signalerChargement(error, 'listPesticides'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId, store.ref.modeTraitement]);

  // Chaînage de reprise (migration backend 0050, mirroir de l'effet équivalent dans
  // traitement.tsx côté Terrestre) : la surface déjà traitée par la chaîne avant
  // cette fiche, pour que l'aperçu de surface restante ici ne surestime pas ce qui
  // reste réellement à traiter — le serveur recalcule de toute façon la valeur
  // définitive à l'enregistrement, ceci n'est qu'un aperçu.
  useEffect(() => {
    const origineId = store.aerien.traitementOrigineId;
    let cancelled = false;
    if (store.aerien.repriseTraitement && origineId) {
      void getTraitement(origineId)
        .then((draft) => {
          if (!cancelled) setOrigineCumuleeHa(draft?.aerien?.surface_cumulee_ha ?? null);
        })
        .catch((error) => {
          if (!cancelled) signalerChargement(error, 'getTraitement:origine');
        });
    } else {
      void Promise.resolve().then(() => {
        if (!cancelled) setOrigineCumuleeHa(null);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.aerien.repriseTraitement, store.aerien.traitementOrigineId]);

  const nbRotations = computeNbRotations(store.aerien.rotations);
  const totauxPesticide = computeTotalPesticideAerienParUnite(store.aerien.rotations);
  const surfaceTraitee = computeSurfaceTraiteeAerien(store.aerien.rotations);
  const surfaceCumulee = computeSurfaceCumulee(surfaceTraitee, store.aerien.repriseTraitement, origineCumuleeHa);
  const surfaceRestante = computeSurfaceRestante(surfaceInfesteeHa, surfaceCumulee);
  // Le stock reçu (pesticide_recu_l) est en litres : seule la consommation en litres
  // s'en déduit, jamais celle en kg (grandeurs différentes, cf. total_pesticide_kg).
  const pesticideStockRestant = computePesticideStockRestant(store.aerien.pesticideRecuL, totauxPesticide.l);

  const handleContinuer = () =>
    run(
      async () => {
        const heuresErrors = validateRotationsHeures(
          store.aerien.rotations.map((r) => ({
            heureDebut: r.heure_debut ?? null,
            heureFin: r.heure_fin ?? null,
            heureOuvertureVanne: r.heure_ouverture_vanne ?? null,
            heureFermetureVanne: r.heure_fermeture_vanne ?? null,
          }))
        );
        if (heuresErrors.length > 0) {
          setError(heuresErrors[0].message);
          return;
        }
        setError(undefined);
        await updateTraitementAerienPesticideRecu(traitementId, store.aerien.pesticideRecuL);
        await updateTraitementAerienEfficacite(traitementId, {
          tauxMortalitePourcent: store.aerien.tauxMortalitePourcent,
          evaluationEfficaciteHeuresApres: store.aerien.evaluationEfficaciteHeuresApres,
          methodeEvaluationEfficacite: store.aerien.methodeEvaluationEfficacite,
        });
        // Purge avant re-création (#persistance-fiches-traitement) : le store
        // ne porte pas d'id stable côté DB pour distinguer une rotation déjà
        // enregistrée d'une nouvelle — sans cette purge, ré-enregistrer une
        // fiche déjà sauvegardée dupliquait toutes ses rotations à chaque
        // passage sur cet écran.
        await deleteAllRotationsForTraitementAerien(traitementId);
        for (const r of store.aerien.rotations) {
          await addRotation(traitementId, {
            produit_id: r.produit_id,
            quantite: r.quantite,
            unite: r.unite,
            surface_ha: r.surface_ha,
            temperature_debut_c: r.temperature_debut_c,
            temperature_fin_c: r.temperature_fin_c,
            vent_debut_ms: r.vent_debut_ms,
            vent_fin_ms: r.vent_fin_ms,
            heure_debut: r.heure_debut,
            heure_fin: r.heure_fin,
            heure_ouverture_vanne: r.heure_ouverture_vanne,
            heure_fermeture_vanne: r.heure_fermeture_vanne,
            nom_commercial: r.nom_commercial,
          });
        }
        router.push({ pathname: '/(traitement)/moyens' as any, params: { traitementId, isValidationView } });
      },
      {
        screen: 'rotations',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId },
      }
    );

  return (
    <SafeAreaView style={chrome.container}>
      <KeyboardAvoidingView style={chrome.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={chrome.content}>
        <ProgressBar currentIndex={3} segments={PROGRESS_SEGMENTS_AERIEN} />
        <Text style={chrome.title}>Pesticides & rotations</Text>

        <Text style={styles.label}>Approvisionnement (l)</Text>
        <TextInput
          testID="pesticide-recu-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="decimal-pad"
          value={getAerienDraft('pesticideRecuL') ?? formatDecimalDisplay(store.aerien.pesticideRecuL)}
          onChangeText={(v) => handleAerienDecimalChange('pesticideRecuL', v)}
          onBlur={() => clearAerienDraft('pesticideRecuL')}
        />

        {store.aerien.rotations.map((rotation, index) => {
          const durees = computeDureesRotation({
            heureDebut: rotation.heure_debut ?? null,
            heureFin: rotation.heure_fin ?? null,
            heureOuvertureVanne: rotation.heure_ouverture_vanne ?? null,
            heureFermetureVanne: rotation.heure_fermeture_vanne ?? null,
          });
          const unite = rotation.unite ?? 'L';

          return (
            <Card key={rotation.localId} style={styles.rotationCard}>
              <View style={styles.rotationHeader}>
                <Text style={styles.rotationTitle}>Rotation {index + 1}</Text>
                {store.aerien.rotations.length > 1 && !readOnly && (
                  <TouchableOpacity onPress={() => store.removeRotation(rotation.localId)}>
                    <Text style={styles.removeButton}>×</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Card variant="derivee">
                <Text style={styles.label}>N° cuve</Text>
                {/* Format aligné sur le serveur (str(numero), migration 0047) : pas de
                    préfixe "C" — sinon l'aperçu ici divergerait de ce qu'affichent le
                    web admin et toute relecture de la fiche synchronisée. testID plutôt
                    qu'un texte unique : "1" collide avec d'autres valeurs affichées
                    (ex. Nb rotations) dès qu'il n'y a qu'une rotation. */}
                <Text testID={`rotation-numero-cuve-${index}`} style={styles.derivedValue}>
                  {String(index + 1)}
                </Text>
              </Card>

              <Text style={styles.label}>Unité *</Text>
              <View style={styles.chipRow}>
                <Chip label="Litres (L)" selected={unite === 'L'} onPress={() => !readOnly && store.updateRotation(rotation.localId, { unite: 'L' })} />
                <Chip label="Kilos (kg)" selected={unite === 'kg'} onPress={() => !readOnly && store.updateRotation(rotation.localId, { unite: 'kg' })} />
              </View>

              <Text style={styles.label}>{`Pesticides consommés (${unite === 'kg' ? 'kg' : 'l'}) *`}</Text>
              <TextInput
                testID={`rotation-quantite-input-${index}`}
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="decimal-pad"
                value={getRotationDraft(rotation.localId, 'quantite') ?? formatDecimalDisplay(rotation.quantite)}
                onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'quantite', v)}
                onBlur={() => clearRotationDraft(rotation.localId, 'quantite')}
              />

              <Text style={styles.label}>Surface traitée (ha) *</Text>
              <TextInput
                testID={`rotation-surface-ha-input-${index}`}
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="decimal-pad"
                value={getRotationDraft(rotation.localId, 'surface_ha') ?? formatDecimalDisplay(rotation.surface_ha)}
                onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'surface_ha', v)}
                onBlur={() => clearRotationDraft(rotation.localId, 'surface_ha')}
              />

              <Text style={styles.label}>Produit / matières actives *</Text>
              <ProduitSelectField
                pesticides={pesticides}
                selectedId={rotation.produit_id}
                readOnly={readOnly}
                onSelect={(p) =>
                  store.updateRotation(rotation.localId, {
                    produit_id: p.id,
                    nom_commercial: deriveNomCommercial(p.nom),
                  })
                }
              />
              <Card variant="derivee">
                <Text style={styles.label}>Nom commercial</Text>
                <Text style={styles.derivedValue}>{rotation.nom_commercial || '—'}</Text>
              </Card>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Heure début *</Text>
                  <TimeField
                    editable={!readOnly}
                    value={rotation.heure_debut ?? null}
                    onChange={(v) => store.updateRotation(rotation.localId, { heure_debut: v })}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Heure fin *</Text>
                  <TimeField
                    editable={!readOnly}
                    value={rotation.heure_fin ?? null}
                    onChange={(v) => store.updateRotation(rotation.localId, { heure_fin: v })}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Ouverture vanne *</Text>
                  <TimeField
                    editable={!readOnly}
                    value={rotation.heure_ouverture_vanne ?? null}
                    onChange={(v) => store.updateRotation(rotation.localId, { heure_ouverture_vanne: v })}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Fermeture vanne *</Text>
                  <TimeField
                    editable={!readOnly}
                    value={rotation.heure_fermeture_vanne ?? null}
                    onChange={(v) => store.updateRotation(rotation.localId, { heure_fermeture_vanne: v })}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Température début (°C) *</Text>
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={getRotationDraft(rotation.localId, 'temperature_debut_c') ?? formatDecimalDisplay(rotation.temperature_debut_c)}
                    onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'temperature_debut_c', v)}
                    onBlur={() => clearRotationDraft(rotation.localId, 'temperature_debut_c')}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Température fin (°C) *</Text>
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={getRotationDraft(rotation.localId, 'temperature_fin_c') ?? formatDecimalDisplay(rotation.temperature_fin_c)}
                    onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'temperature_fin_c', v)}
                    onBlur={() => clearRotationDraft(rotation.localId, 'temperature_fin_c')}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Vitesse du vent début (m/s) *</Text>
                  <TextInput
                    testID={`rotation-vent-debut-input-${index}`}
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={getRotationDraft(rotation.localId, 'vent_debut_ms') ?? formatDecimalDisplay(rotation.vent_debut_ms)}
                    onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'vent_debut_ms', v)}
                    onBlur={() => clearRotationDraft(rotation.localId, 'vent_debut_ms')}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Vitesse du vent fin (m/s) *</Text>
                  <TextInput
                    testID={`rotation-vent-fin-input-${index}`}
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={getRotationDraft(rotation.localId, 'vent_fin_ms') ?? formatDecimalDisplay(rotation.vent_fin_ms)}
                    onChangeText={(v) => handleRotationDecimalChange(rotation.localId, 'vent_fin_ms', v)}
                    onBlur={() => clearRotationDraft(rotation.localId, 'vent_fin_ms')}
                  />
                </View>
              </View>

              {/* Durées calculées, jamais saisies (critère d'acceptation). */}
              <View style={styles.row}>
                <Card variant="derivee" style={chrome.dureeCard}>
                  <Text style={styles.label}>Durée application</Text>
                  <Text style={styles.derivedValue}>
                    {durees.applicationMinutes != null ? formatDureeRotation(durees.applicationMinutes) : '—'}
                  </Text>
                </Card>
                <Card variant="derivee" style={chrome.dureeCard}>
                  <Text style={styles.label}>Durée totale</Text>
                  <Text style={styles.derivedValue}>
                    {durees.totaleMinutes != null ? formatDureeRotation(durees.totaleMinutes) : '—'}
                  </Text>
                </Card>
                <Card variant="derivee" style={chrome.dureeCard}>
                  <Text style={styles.label}>Mise en place</Text>
                  <Text style={styles.derivedValue}>
                    {durees.miseEnPlaceMinutes != null ? formatDureeRotation(durees.miseEnPlaceMinutes) : '—'}
                  </Text>
                </Card>
              </View>
            </Card>
          );
        })}

        {!readOnly && (
          <TouchableOpacity style={styles.addButton} onPress={() => store.addRotation({})}>
            <Text style={styles.addButtonText}>+ Ajouter une rotation</Text>
          </TouchableOpacity>
        )}

        <Card variant="derivee">
          <Text style={styles.label}>Nb rotations</Text>
          <Text style={styles.derivedValue}>{nbRotations}</Text>
        </Card>
        <Card variant="derivee">
          <Text style={styles.label}>Total pesticide (l)</Text>
          <Text style={styles.derivedValue}>{totauxPesticide.l}</Text>
        </Card>
        <Card variant="derivee">
          <Text style={styles.label}>Total pesticide (kg)</Text>
          <Text style={styles.derivedValue}>{totauxPesticide.kg}</Text>
        </Card>
        <Card variant="derivee">
          <Text style={styles.label}>Surface traitée (ha)</Text>
          <Text style={styles.derivedValue}>{surfaceTraitee}</Text>
        </Card>
        {store.aerien.repriseTraitement && (
          <Card variant="derivee">
            <Text style={styles.label}>Surface cumulée (ha)</Text>
            <Text style={styles.derivedValue}>{surfaceCumulee}</Text>
          </Card>
        )}
        <Card variant="derivee">
          <Text style={styles.label}>Surface restante (ha)</Text>
          <Text style={styles.derivedValue}>{surfaceRestante}</Text>
        </Card>
        {pesticideStockRestant != null && (
          <Card variant="derivee">
            <Text style={styles.label}>Reste en stock (l)</Text>
            <Text style={styles.derivedValue}>{pesticideStockRestant}</Text>
          </Card>
        )}

        <Text style={styles.label}>Efficacité</Text>
        <Text style={styles.label}>Taux de mortalité (%)</Text>
        <TextInput
          testID="taux-mortalite-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="decimal-pad"
          value={getAerienDraft('tauxMortalitePourcent') ?? formatDecimalDisplay(store.aerien.tauxMortalitePourcent)}
          onChangeText={(v) => handleAerienDecimalChange('tauxMortalitePourcent', v)}
          onBlur={() => clearAerienDraft('tauxMortalitePourcent')}
        />
        <Text style={styles.label}>Évalué après traitement (heures)</Text>
        <TextInput
          testID="evaluation-efficacite-heures-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="decimal-pad"
          value={
            getAerienDraft('evaluationEfficaciteHeuresApres') ??
            formatDecimalDisplay(store.aerien.evaluationEfficaciteHeuresApres)
          }
          onChangeText={(v) => handleAerienDecimalChange('evaluationEfficaciteHeuresApres', v)}
          onBlur={() => clearAerienDraft('evaluationEfficaciteHeuresApres')}
        />
        <Text style={styles.label}>Méthode d&apos;évaluation</Text>
        <View style={styles.chipRow}>
          <Chip
            label="Estimation visuelle"
            selected={store.aerien.methodeEvaluationEfficacite === 'ESTIMATION_VISUELLE'}
            onPress={() =>
              !readOnly && store.updateAerien({ methodeEvaluationEfficacite: 'ESTIMATION_VISUELLE' })
            }
          />
          <Chip
            label="Comptages pré/post-traitement"
            selected={store.aerien.methodeEvaluationEfficacite === 'COMPTAGES_PRE_POST'}
            onPress={() =>
              !readOnly && store.updateAerien({ methodeEvaluationEfficacite: 'COMPTAGES_PRE_POST' })
            }
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {!readOnly && (
          <TouchableOpacity style={chrome.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={chrome.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const chrome = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  keyboardAvoidingView: { flex: 1 },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  dureeCard: { flex: 1 },
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
