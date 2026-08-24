import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, updateTraitementImpacts } from '@/lib/traitement-repository';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { validateEmpoisonnement } from '@/lib/traitement-validation';
import { Chip } from '@/components/traitement/Chip';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const AXES_RISQUE: { key: 'ressources_eau' | 'sol' | 'faune_non_cible' | 'abeilles'; label: string }[] = [
  { key: 'ressources_eau', label: "Ressources en eau" },
  { key: 'sol', label: 'Sol' },
  { key: 'faune_non_cible', label: 'Faune non cible' },
  { key: 'abeilles', label: 'Abeilles/pollinisateurs' },
];
const NIVEAUX = ['FAIBLE', 'MOYEN', 'ELEVE'] as const;
const ESPECES_NON_CIBLES = ['Oiseaux', 'Reptiles', 'Poissons', 'Insectes utiles', 'Mammifères'];
const FAMILLES_MORTALITE = ['Oiseaux', 'Poissons', 'Abeilles', 'Reptiles', 'Mammifères'];

export default function ImpactsScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId).then((draft) => {
      if (!draft) return;
      let evaluationRisque = {};
      let comportementNonCibles: string[] = [];
      let mortaliteFamilles: string[] = [];
      try { evaluationRisque = draft.evaluation_risque ? JSON.parse(draft.evaluation_risque) : {}; } catch {}
      try { comportementNonCibles = draft.comportement_non_cibles ? JSON.parse(draft.comportement_non_cibles) : []; } catch {}
      try { mortaliteFamilles = draft.mortalite_familles ? JSON.parse(draft.mortalite_familles) : []; } catch {}
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
      });
      store.setObservations(draft.observations);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  const empoisonnementErrors = validateEmpoisonnement({
    empoisonnement: store.imp.empoisonnement ?? null,
    empoisonnementType: store.imp.empoisonnementType ?? null,
    empoisonnementMode: store.imp.empoisonnementMode ?? null,
    empoisonnementAutre: store.imp.empoisonnementAutre ?? null,
  });
  const errorsByField: Record<string, string> = {};
  for (const e of empoisonnementErrors) errorsByField[e.field] = e.message;

  const handleContinuer = async () => {
    if (!traitementId || empoisonnementErrors.length > 0) return;
    setIsSaving(true);
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
    });
    setIsSaving(false);
    router.push({ pathname: '/(traitement)/signatures' as any, params: { traitementId, isValidationView } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={4} />
        <Text style={styles.title}>Impacts & risque</Text>

        <Text style={styles.label}>Empoisonnement</Text>
        <View style={styles.chipRow}>
          <Chip label="Non" selected={!store.imp.empoisonnement} onPress={() => !readOnly && store.updateImp({ empoisonnement: false })} />
          <Chip label="Oui" selected={!!store.imp.empoisonnement} onPress={() => !readOnly && store.updateImp({ empoisonnement: true })} />
        </View>
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
        {AXES_RISQUE.map((axe) => (
          <View key={axe.key} style={styles.axeRow}>
            <Text style={styles.axeLabel}>{axe.label}</Text>
            <View style={styles.chipRow}>
              {NIVEAUX.map((n) => (
                <Chip
                  key={n}
                  label={n[0] + n.slice(1).toLowerCase()}
                  selected={store.imp.evaluationRisque?.[axe.key] === n}
                  onPress={() => !readOnly && store.updateImp({ evaluationRisque: { ...store.imp.evaluationRisque, [axe.key]: n } })}
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.label}>Comportement anormal</Text>
        <View style={styles.chipRow}>
          <Chip label="Non" selected={!store.imp.comportementAnormal} onPress={() => !readOnly && store.updateImp({ comportementAnormal: false })} />
          <Chip label="Oui" selected={!!store.imp.comportementAnormal} onPress={() => !readOnly && store.updateImp({ comportementAnormal: true })} />
        </View>
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
        <View style={styles.chipRow}>
          <Chip label="Non" selected={!store.imp.mortalite} onPress={() => !readOnly && store.updateImp({ mortalite: false })} />
          <Chip label="Oui" selected={!!store.imp.mortalite} onPress={() => !readOnly && store.updateImp({ mortalite: true })} />
        </View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  axeRow: { gap: 4 },
  axeLabel: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 10 },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
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
