import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, addRotation, updateTraitementAerienPesticideRecu } from '@/lib/traitement-repository';
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
 * l'affichage. « Pesticide reçu (l) » y a été déplacé depuis Équipe : c'est une
 * information propre au traitement (stock de pesticide), pas à l'équipe.
 */
export default function RotationsScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';

  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [surfaceInfesteeHa, setSurfaceInfesteeHa] = useState<number | null>(null);
  const [origineCumuleeHa, setOrigineCumuleeHa] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
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
          store.updateAerien({ pesticideRecuL: draft.aerien.pesticide_recu_l });
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
      <ScrollView contentContainerStyle={chrome.content}>
        <ProgressBar currentIndex={3} segments={PROGRESS_SEGMENTS_AERIEN} />
        <Text style={chrome.title}>Pesticides & rotations</Text>

        <Text style={styles.label}>Pesticide reçu (l)</Text>
        <TextInput
          testID="pesticide-recu-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={store.aerien.pesticideRecuL != null ? String(store.aerien.pesticideRecuL) : ''}
          onChangeText={(v) => store.updateAerien({ pesticideRecuL: v ? Number(v) : null })}
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

              <Text style={styles.label}>{`Quantité (${unite === 'kg' ? 'kg' : 'l'}) *`}</Text>
              <TextInput
                testID={`rotation-quantite-input-${index}`}
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.quantite != null ? String(rotation.quantite) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { quantite: v ? Number(v) : null })}
              />

              <Text style={styles.label}>Surface traitée (ha) *</Text>
              <TextInput
                testID={`rotation-surface-ha-input-${index}`}
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.surface_ha != null ? String(rotation.surface_ha) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { surface_ha: v ? Number(v) : null })}
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
                    keyboardType="numeric"
                    value={rotation.temperature_debut_c != null ? String(rotation.temperature_debut_c) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_debut_c: v ? Number(v) : null })}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Température fin (°C) *</Text>
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={rotation.temperature_fin_c != null ? String(rotation.temperature_fin_c) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_fin_c: v ? Number(v) : null })}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Vitesse du vent début (m/s) *</Text>
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={rotation.vent_debut_ms != null ? String(rotation.vent_debut_ms) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { vent_debut_ms: v ? Number(v) : null })}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Vitesse du vent fin (m/s) *</Text>
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="0"
                    keyboardType="numeric"
                    value={rotation.vent_fin_ms != null ? String(rotation.vent_fin_ms) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { vent_fin_ms: v ? Number(v) : null })}
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
        {error && <Text style={styles.error}>{error}</Text>}

        {!readOnly && (
          <TouchableOpacity style={chrome.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={chrome.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const chrome = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
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
