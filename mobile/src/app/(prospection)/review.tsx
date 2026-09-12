import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { buildVegetationSummary, parseVegetationSol } from '@/lib/prospection-fiche-lecture';
import {
  InfestationRow,
  PopulationRow,
  listAllProspectionInfestations,
  listAllProspectionPopulations,
} from '@/lib/prospection-repository';
import { buildRecapitulatif, enregistrerEtSynchroniser, infestationDetailHasData } from '@/lib/prospection-review';
import { estToutParti, resumerEnPhrase } from '@/lib/sync-lot';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

export default function ReviewScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const draft = useProspectionWizardStore((s) => s.draft);
  const captures = useProspectionWizardStore((s) => s.captures);
  const resetWizard = useProspectionWizardStore((s) => s.reset);
  const resetCaptureLoop = useProspectionCaptureStore((s) => s.reset);
  const { run, isRunning: isSaving } = useAsyncAction();
  const [infestations, setInfestations] = useState<InfestationRow[]>([]);
  const [populations, setPopulations] = useState<PopulationRow[]>([]);
  const signalerChargement = useSignalerChargement('review');

  useEffect(() => {
    if (!draft) return;
    void listAllProspectionInfestations(draft.id)
      .then(setInfestations)
      .catch((error) => signalerChargement(error, { draftId: draft.id }));
    // Densités par espèce + stade (4 blocs indépendants LMC/NSE × imago/larve, cf.
    // density.tsx) : jamais affichées jusqu'ici dans ce récapitulatif.
    void listAllProspectionPopulations(draft.id)
      .then(setPopulations)
      .catch((error) => signalerChargement(error, { draftId: draft.id }));
  }, [draft?.id, signalerChargement]);

  const recap = useMemo(() => {
    if (!draft) return null;
    const vegetationSummary = buildVegetationSummary(
      parseVegetationSol(draft.vegetation, draft.sol, draft.degats_cultures)
    );
    return buildRecapitulatif(draft, captures, vegetationSummary, infestations, populations);
  }, [draft, captures, infestations, populations]);

  if (!draft || !recap) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const handleSave = () =>
    run(
      async () => {
        const resume = await enregistrerEtSynchroniser(draft, captures, token!);
        resetWizard();
        resetCaptureLoop();
        // La fiche est enregistrée localement dans tous les cas ; seul l'envoi
        // peut avoir échoué. Le message du résumé est déjà traduit par classe
        // (#172) — le message brut ne sort plus d'ici. Le conflit compte comme
        // « non parti » : le laisser passer pour un succès rendrait muet
        // exactement ce que ce ticket rend visible.
        router.replace({
          pathname: '/(app)/prospection' as any,
          params: estToutParti(resume)
            ? { justSaved: '1' }
            : { syncWarning: resumerEnPhrase(resume) },
        });
      },
      {
        screen: 'review',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { draftId: draft.id },
      }
    );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Fiche — récapitulatif</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.headerCard}>
            <Text style={styles.headerCardLabel}>Fiche {recap.nFiche}</Text>
            <Text style={styles.headerCardTitle}>{recap.station}</Text>
            <Text style={styles.headerCardMeta}>
              {recap.dateProspection} · {user ? `${user.prenom} ${user.nom}`.trim() : '—'}
            </Text>
          </View>

          {recap.reviewGroups.map((group) => (
            <View key={group.label} style={styles.card}>
              <Text style={styles.cardTitle}>{group.label} — captures (calcul auto)</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{group.total}</Text>
                  <Text style={styles.statLabel}>total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{group.max}</Text>
                  <Text style={styles.statLabel}>max fiche</Text>
                </View>
              </View>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>Phénotype dominant</Text>
                <Text style={styles.summaryLineValueRed}>{group.dominantLabel}</Text>
              </View>
            </View>
          ))}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Densités par espèce et stade</Text>
            {recap.densites.map((d) => (
              <View key={d.key} style={styles.summaryLine}>
                <Text style={styles.summaryLineLabel}>{d.label}</Text>
                <Text style={styles.summaryLineValue}>
                  {d.densiteDiffuse ?? '—'} ind./ha · {d.densiteGroupee ?? '—'} ind./m²
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Temps de capture</Text>
            <Text style={styles.paragraph}>{recap.dureeSession} min</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Infestation</Text>

            {(['imago', 'larve'] as const).map((categorie) => {
              const rows = recap.infestationDetail.filter(
                (d) => d.categorie === categorie && infestationDetailHasData(d)
              );
              // Bloc entier masqué (titre inclus) si ni LMC ni NSE n'ont la moindre
              // donnée pour cette catégorie — jamais une ligne isolée à 0/—/—.
              if (rows.length === 0) return null;
              return (
                <View key={categorie} style={styles.infestationGroup}>
                  <Text style={styles.infestationGroupTitle}>
                    {categorie === 'imago' ? 'IMAGOS' : 'LARVES'}
                  </Text>
                  {rows.map((d) => (
                    <View key={d.key} style={styles.summaryLine}>
                      <Text style={styles.summaryLineLabel}>{d.label}</Text>
                      <Text style={styles.summaryLineValue}>
                        {d.nombre} · {d.densiteDiffuse != null ? `${d.densiteDiffuse} ind./ha` : '—'} ·{' '}
                        {d.densiteGroupee != null ? `${d.densiteGroupee} ind./m²` : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}

            {recap.infestationCibles.length > 0 && (
              <View style={styles.infestationGroup}>
                <Text style={styles.infestationGroupTitle}>CIBLES SÉLECTIONNÉES</Text>
                {recap.infestationCibles.map((cible) => (
                  <View key={cible.key} style={styles.summaryLine}>
                    <Text style={styles.summaryLineLabel}>• {cible.label}</Text>
                    <Text style={styles.summaryLineValue}>{cible.details.join(' · ') || '—'}</Text>
                  </View>
                ))}
              </View>
            )}

            {recap.infestationDetail.every((d) => !infestationDetailHasData(d)) &&
              recap.infestationCibles.length === 0 && (
                <Text style={styles.paragraph}>Aucune information renseignée.</Text>
              )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Comportement</Text>
            <Text style={styles.paragraph}>{recap.comportementSummary}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Végétation & sol</Text>
            <Text style={styles.paragraph}>{recap.vegetationSummary}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Observations</Text>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLineLabel}>Heure d&apos;observation</Text>
              <Text style={styles.summaryLineValue}>{recap.heureObservationLabel}</Text>
            </View>
            <Text style={styles.paragraph}>{recap.observationsText}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Référence</Text>
            <Text style={styles.paragraph}>
              PA <Text style={styles.paragraphStrong}>{recap.pa}</Text> · Station{' '}
              <Text style={styles.paragraphStrong}>{recap.station}</Text>
              {'\n'}
              Surf. prospectée <Text style={styles.paragraphStrong}>{recap.surfaceProspectee ?? '—'} ha</Text> · station{' '}
              <Text style={styles.paragraphStrong}>{recap.surfaceStation ?? '—'} ha</Text> · GPS{' '}
              <Text style={styles.mono}>
                {recap.latitude?.toFixed(4) ?? '—'}, {recap.longitude?.toFixed(4) ?? '—'}
              </Text>
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer (hors-ligne) ✓'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  scroll: { flex: 1 },
  headerCard: { backgroundColor: GREEN, borderRadius: 13, padding: 16, marginBottom: 11 },
  headerCardLabel: { color: '#ffffffcc', fontSize: 11 },
  headerCardTitle: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerCardMeta: { color: '#ffffffd9', fontSize: 11, marginTop: 2 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: TEXT, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  statBox: { flex: 1, backgroundColor: '#f6f3e9', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: GREEN },
  statLabel: { fontSize: 9, color: '#9a9484' },
  infestationGroup: { marginBottom: 4 },
  infestationGroupTitle: { fontSize: 9, fontWeight: '800', color: '#9a9484', marginTop: 6, marginBottom: 2, letterSpacing: 0.5 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#f1ede1' },
  summaryLineLabel: { fontSize: 12, color: '#5c5848' },
  summaryLineValue: { fontSize: 12, fontWeight: '600', color: TEXT },
  summaryLineValueRed: { fontSize: 12, fontWeight: '700', color: '#c0412b' },
  paragraph: { fontSize: 12, lineHeight: 20, color: '#5c5848' },
  paragraphStrong: { color: TEXT, fontWeight: '600' },
  mono: { fontFamily: 'monospace' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
