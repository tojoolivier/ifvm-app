import { useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, updateTraitementImpacts } from '@/lib/traitement-repository';
import { useTraitementCaptureStore, EvaluationRisquePopulationDraft } from '@/lib/traitement-capture-store';
import { validateEmpoisonnement } from '@/lib/traitement-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { generateId } from '@/lib/id';
import { Chip } from '@/components/traitement/Chip';
import { OuiNonToggle } from '@/components/traitement/OuiNonToggle';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';

const AXES_RISQUE: { key: 'ressources_eau' | 'sol' | 'faune_non_cible' | 'abeilles'; label: string }[] = [
  { key: 'ressources_eau', label: "Ressources en eau" },
  { key: 'sol', label: 'Sol' },
  { key: 'faune_non_cible', label: 'Faune non cible' },
  { key: 'abeilles', label: 'Abeilles/pollinisateurs' },
];
const ESPECES_NON_CIBLES = ['Oiseaux', 'Reptiles', 'Poissons', 'Insectes utiles', 'Mammifères'];
const FAMILLES_MORTALITE = ['Oiseaux', 'Poissons', 'Abeilles', 'Reptiles', 'Mammifères'];

export default function ImpactsScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('impacts');
  const typeTraitement = store.typeTraitement;
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        let evaluationRisque: Record<string, boolean> = {};
        let comportementNonCibles: string[] = [];
        let mortaliteFamilles: string[] = [];
        try {
          evaluationRisque = draft.evaluation_risque ? JSON.parse(draft.evaluation_risque) : {};
          comportementNonCibles = draft.comportement_non_cibles ? JSON.parse(draft.comportement_non_cibles) : [];
          mortaliteFamilles = draft.mortalite_familles ? JSON.parse(draft.mortalite_familles) : [];
        } catch (e) {
          // Sélections cochables, re-saisissables en un geste : même critère que
          // `parseEspeceSelection` (#189) — repli sur des valeurs vides plutôt
          // que bloquer la fiche pour une chaîne corrompue.
          logger.ignore(e, 'Impacts corrompus — repli sur des valeurs vides, re-saisissables.');
        }
        // Défensif (indépendant des écrans visités avant celui-ci dans cette session) —
        // même garde que signatures.tsx : décide du nombre d'étapes de ProgressBar.
        store.setTypeTraitement(draft.type_traitement);
        // « Évaluation du risque pour la population » (#evaluation-risque-population) :
        // id local conservé tel quel (clé stable), sensibilisation normalisée en
        // booléen (0/1/NULL en SQLite, comme empoisonnement/mortalite ci-dessus).
        const evaluationsRisquePopulation: EvaluationRisquePopulationDraft[] = (
          draft.evaluations_risque_population ?? []
        ).map((e) => ({
          id: e.id,
          habitatProche: e.habitat_proche,
          distanceKm: e.distance_km,
          sensibilisation: e.sensibilisation === null ? null : !!e.sensibilisation,
        }));
        store.updateImp({
          empoisonnement: draft.empoisonnement,
          empoisonnementType: draft.empoisonnement_type as any,
          empoisonnementMode: draft.empoisonnement_mode as any,
          empoisonnementAutre: draft.empoisonnement_autre,
          evaluationRisque,
          comportementAnormal: draft.comportement_anormal,
          comportementNonCibles,
          mortalite: draft.mortalite,
          mortaliteFamilles,
          evaluationsRisquePopulation,
        });
        store.setObservations(draft.observations);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId, signalerChargement]);

  const empoisonnementErrors = validateEmpoisonnement({
    empoisonnement: store.imp.empoisonnement ?? null,
    empoisonnementType: store.imp.empoisonnementType ?? null,
    empoisonnementMode: store.imp.empoisonnementMode ?? null,
    empoisonnementAutre: store.imp.empoisonnementAutre ?? null,
  });
  const errorsByField: Record<string, string> = {};
  for (const e of empoisonnementErrors) errorsByField[e.field] = e.message;

  const handleContinuer = () =>
    run(
      async () => {
        // Déjà visible à l'écran (message par champ) : pas de second signal.
        if (empoisonnementErrors.length > 0) return;
        await updateTraitementImpacts(traitementId, {
          empoisonnement: !!store.imp.empoisonnement,
          empoisonnement_type: store.imp.empoisonnementType ?? null,
          empoisonnement_mode: store.imp.empoisonnementMode ?? null,
          empoisonnement_autre: store.imp.empoisonnementAutre ?? null,
          evaluation_risque: store.imp.evaluationRisque ?? {},
          comportement_anormal: !!store.imp.comportementAnormal,
          comportement_non_cibles: store.imp.comportementNonCibles ?? [],
          mortalite: !!store.imp.mortalite,
          mortalite_familles: store.imp.mortaliteFamilles ?? [],
          observations: store.observations,
          evaluationsRisquePopulation: (store.imp.evaluationsRisquePopulation ?? []).map((e) => ({
            id: e.id,
            habitat_proche: e.habitatProche ?? null,
            distance_km: e.distanceKm ?? null,
            sensibilisation: e.sensibilisation ?? null,
          })),
        });
        // Aérien : nouvelle étape « Surface traitée » s'insère avant Signatures
        // (#326) — le terrestre garde son flux actuel, inchangé.
        router.push({
          pathname: (typeTraitement === 'AERIEN' ? '/(traitement)/surface-traitee' : '/(traitement)/signatures') as any,
          params: { traitementId, isValidationView },
        });
      },
      {
        screen: 'impacts',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId },
      }
    );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={typeTraitement === 'TERRESTRE' ? 4 : 5}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Impacts & risque</Text>

        <Text style={styles.label}>Empoisonnement</Text>
        <OuiNonToggle
          options={[
            { label: 'Non', selected: !store.imp.empoisonnement, onPress: () => !readOnly && store.updateImp({ empoisonnement: false }) },
            { label: 'Oui', selected: !!store.imp.empoisonnement, onPress: () => !readOnly && store.updateImp({ empoisonnement: true }) },
          ]}
        />
        {store.imp.empoisonnement && (
          <>
            <Text style={styles.label}>Personne concernée*</Text>
            <View style={styles.chipRow}>
              {(['AGENT', 'POPULATION'] as const).map((v) => (
                <Chip key={v} label={v === 'AGENT' ? 'Agent' : 'Population'} selected={store.imp.empoisonnementType === v} onPress={() => !readOnly && store.updateImp({ empoisonnementType: v })} />
              ))}
            </View>
            {errorsByField.empoisonnementType && <Text style={styles.error}>{errorsByField.empoisonnementType}</Text>}

            <Text style={styles.label}>Mode de contamination*</Text>
            <View style={styles.chipRow}>
              {(['INGESTION', 'INHALATION', 'CONTACT', 'AUTRE'] as const).map((v) => (
                <Chip key={v} label={v[0] + v.slice(1).toLowerCase()} selected={store.imp.empoisonnementMode === v} onPress={() => !readOnly && store.updateImp({ empoisonnementMode: v })} />
              ))}
            </View>
            {errorsByField.empoisonnementMode && <Text style={styles.error}>{errorsByField.empoisonnementMode}</Text>}
            {store.imp.empoisonnementMode === 'AUTRE' && (
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="Préciser*"
                value={store.imp.empoisonnementAutre ?? ''}
                onChangeText={(v) => store.updateImp({ empoisonnementAutre: v })}
              />
            )}
            {errorsByField.empoisonnementAutre && <Text style={styles.error}>{errorsByField.empoisonnementAutre}</Text>}
          </>
        )}

        <Text style={styles.label}>Évaluation du risque</Text>
        {AXES_RISQUE.map((axe) => {
          const valeur = store.imp.evaluationRisque?.[axe.key];
          return (
            <View key={axe.key} style={styles.axeRow}>
              <Text style={styles.axeLabel}>{axe.label}</Text>
              <OuiNonToggle
                options={[
                  {
                    label: 'Non',
                    selected: valeur === false,
                    onPress: () =>
                      !readOnly &&
                      store.updateImp({ evaluationRisque: { ...store.imp.evaluationRisque, [axe.key]: false } }),
                  },
                  {
                    label: 'Oui',
                    selected: valeur === true,
                    onPress: () =>
                      !readOnly &&
                      store.updateImp({ evaluationRisque: { ...store.imp.evaluationRisque, [axe.key]: true } }),
                  },
                ]}
              />
            </View>
          );
        })}

        <Text style={styles.label}>Comportement anormal</Text>
        <OuiNonToggle
          options={[
            { label: 'Non', selected: !store.imp.comportementAnormal, onPress: () => !readOnly && store.updateImp({ comportementAnormal: false }) },
            { label: 'Oui', selected: !!store.imp.comportementAnormal, onPress: () => !readOnly && store.updateImp({ comportementAnormal: true }) },
          ]}
        />
        {store.imp.comportementAnormal && (
          <View style={styles.chipRow}>
            {ESPECES_NON_CIBLES.map((esp) => {
              const list = store.imp.comportementNonCibles ?? [];
              const selected = list.includes(esp);
              return (
                <Chip
                  key={esp}
                  label={esp}
                  selected={selected}
                  onPress={() =>
                    !readOnly &&
                    store.updateImp({ comportementNonCibles: selected ? list.filter((x) => x !== esp) : [...list, esp] })
                  }
                />
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Mortalité</Text>
        <OuiNonToggle
          options={[
            { label: 'Non', selected: !store.imp.mortalite, onPress: () => !readOnly && store.updateImp({ mortalite: false }) },
            { label: 'Oui', selected: !!store.imp.mortalite, onPress: () => !readOnly && store.updateImp({ mortalite: true }) },
          ]}
        />
        {store.imp.mortalite && (
          <View style={styles.chipRow}>
            {FAMILLES_MORTALITE.map((f) => {
              const list = store.imp.mortaliteFamilles ?? [];
              const selected = list.includes(f);
              return (
                <Chip
                  key={f}
                  label={f}
                  selected={selected}
                  onPress={() => !readOnly && store.updateImp({ mortaliteFamilles: selected ? list.filter((x) => x !== f) : [...list, f] })}
                />
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Évaluation du risque pour la population</Text>
        {(store.imp.evaluationsRisquePopulation ?? []).map((evaluation, index) => (
          <View key={evaluation.id} testID={`evaluation-risque-population-${index}`} style={styles.evaluationCard}>
            <Text style={styles.evaluationTitle}>{`Évaluation ${index + 1}`}</Text>
            <Text style={styles.label}>Habitats les plus proches</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Ex. Rizière, zone humide…"
              value={evaluation.habitatProche ?? ''}
              onChangeText={(v) =>
                !readOnly &&
                store.updateImp({
                  evaluationsRisquePopulation: (store.imp.evaluationsRisquePopulation ?? []).map((e) =>
                    e.id === evaluation.id ? { ...e, habitatProche: v } : e
                  ),
                })
              }
            />
            <Text style={styles.label}>Distance (km)</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0.0"
              value={evaluation.distanceKm != null ? String(evaluation.distanceKm) : ''}
              onChangeText={(v) => {
                if (readOnly) return;
                // Saisie décimale (même tolérance virgule/point que le reste des
                // champs numériques du wizard) — jamais transformée au-delà de la
                // conversion en nombre : la valeur saisie est conservée telle quelle.
                const normalise = v.replace(',', '.');
                const valeur = normalise === '' ? null : Number(normalise);
                store.updateImp({
                  evaluationsRisquePopulation: (store.imp.evaluationsRisquePopulation ?? []).map((e) =>
                    e.id === evaluation.id
                      ? { ...e, distanceKm: valeur === null || Number.isNaN(valeur) ? null : valeur }
                      : e
                  ),
                });
              }}
            />
            <Text style={styles.label}>Sensibilisation</Text>
            <OuiNonToggle
              options={[
                {
                  label: 'Non',
                  selected: evaluation.sensibilisation === false,
                  onPress: () =>
                    !readOnly &&
                    store.updateImp({
                      evaluationsRisquePopulation: (store.imp.evaluationsRisquePopulation ?? []).map((e) =>
                        e.id === evaluation.id ? { ...e, sensibilisation: false } : e
                      ),
                    }),
                },
                {
                  label: 'Oui',
                  selected: evaluation.sensibilisation === true,
                  onPress: () =>
                    !readOnly &&
                    store.updateImp({
                      evaluationsRisquePopulation: (store.imp.evaluationsRisquePopulation ?? []).map((e) =>
                        e.id === evaluation.id ? { ...e, sensibilisation: true } : e
                      ),
                    }),
                },
              ]}
            />
          </View>
        ))}
        {!readOnly && (
          <TouchableOpacity
            style={styles.addEvaluationButton}
            onPress={() =>
              store.updateImp({
                evaluationsRisquePopulation: [
                  ...(store.imp.evaluationsRisquePopulation ?? []),
                  { id: generateId(), habitatProche: null, distanceKm: null, sensibilisation: null },
                ],
              })
            }
          >
            <Text style={styles.addEvaluationButtonText}>+ Ajouter une évaluation</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Observations</Text>
        <TextInput
          editable={!readOnly}
          style={[styles.input, styles.textarea]}
          multiline
          value={store.observations ?? ''}
          onChangeText={store.setObservations}
        />

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp },
    keyboardAvoidingView: { flex: 1 },
    content: { padding: 16, gap: 10 },
    title: { fontFamily: traitementFonts.uiExtraBold, fontSize: typeSizes.titreEcran, color: traitementColors.texteTitre },
    // Semi-gras (au lieu de uiMedium) : demande explicite, titres de champ plus
    // visibles sur les fiches de traitement.
    label: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.label, color: traitementColors.texteLabel },
    axeRow: { gap: 4 },
    axeLabel: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.chip,
      paddingHorizontal: 10,
      fontFamily: traitementFonts.ui,
      fontSize: typeSizes.corps,
      color: traitementColors.texteTitre,
      backgroundColor: '#fff',
    },
    textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
    error: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.erreurTexte },
    continueButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: traitementColors.vertPrincipal,
      borderRadius: traitementRadii.boutonPrincipal,
      marginTop: 8,
    },
    continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: typeSizes.corps + 1 },
    evaluationCard: {
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.chip,
      padding: 10,
      gap: 6,
      backgroundColor: '#fff',
    },
    evaluationTitle: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    addEvaluationButton: {
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: traitementColors.vertPrincipal,
      borderRadius: traitementRadii.chip,
    },
    addEvaluationButtonText: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal, fontSize: typeSizes.corps },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
