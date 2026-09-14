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
import {
  buildRecapitulatif,
  DetailRowViewModel,
  enregistrerEtSynchroniser,
  infestationDetailHasData,
} from '@/lib/prospection-review';
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

/** Même composant/style que `DetailRows` côté Extensif (extensive-recap.tsx) —
 * une ligne label/valeur, jamais masquée silencieusement (« — » si absent). */
function DetailRows({ rows }: { rows: DetailRowViewModel[] }) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.detailRowLabel}>{row.label}</Text>
          <Text style={styles.detailRowValue}>{row.value}</Text>
        </View>
      ))}
    </>
  );
}

export default function ReviewScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
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
    // intensive-imagos.tsx/intensive-larves.tsx) : reprises dans le détail B/C ci-dessous.
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

  const handleSave = () => {
    void run(
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
  };

  const infestationRowsByCategorie = (categorie: 'imago' | 'larve') =>
    recap.infestationDetail.filter((d) => d.categorie === categorie && infestationDetailHasData(d));
  const hasInfestationData =
    recap.infestationDetail.some((d) => infestationDetailHasData(d)) || recap.infestationCibles.length > 0;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerGreen}>
          <View style={styles.headerRowGreen}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backWhite}>‹</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.titleWhite}>Récapitulatif</Text>
              <Text style={styles.subtitleWhite}>
                Fiche {recap.nFiche} · {recap.dateProspection}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 8 }}>
          {/* A — Référence */}
          <View style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
            <Text style={styles.checkLabel}>A · Référence</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLine}>PA : {recap.pa} · Station : {recap.station}</Text>
            <Text style={styles.detailLine}>
              Surf. prospectée : {recap.surfaceProspectee ?? '—'} ha · Surf. station : {recap.surfaceStation ?? '—'} ha
            </Text>
            <Text style={styles.detailLine}>
              GPS : {recap.latitude?.toFixed(4) ?? '—'}, {recap.longitude?.toFixed(4) ?? '—'}
            </Text>
            <Text style={styles.detailLine}>Heure d&apos;observation : {recap.heureObservationLabel}</Text>
          </View>

          {/* B — Imagos */}
          <View style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
            <Text style={styles.checkLabel}>B · Imagos</Text>
          </View>
          <View style={styles.detailCard}>
            {recap.imagoDetailGroups.length === 0 ? (
              <Text style={styles.detailLine}>Aucune donnée renseignée.</Text>
            ) : (
              recap.imagoDetailGroups.map((group, index) => (
                <View key={group.espece} style={index > 0 ? { marginTop: 10 } : undefined}>
                  <Text style={styles.detailSubtitle}>{group.label}</Text>
                  <DetailRows rows={group.rows} />
                </View>
              ))
            )}
          </View>

          {/* C — Larves */}
          <View style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
            <Text style={styles.checkLabel}>C · Larves</Text>
          </View>
          <View style={styles.detailCard}>
            {recap.larveDetailGroups.length === 0 ? (
              <Text style={styles.detailLine}>Aucune donnée renseignée.</Text>
            ) : (
              recap.larveDetailGroups.map((group, index) => (
                <View key={group.espece} style={index > 0 ? { marginTop: 10 } : undefined}>
                  <Text style={styles.detailSubtitle}>{group.label}</Text>
                  <DetailRows rows={group.rows} />
                </View>
              ))
            )}
          </View>

          {/* Infestation/Comportement : donnée historique (écran retiré du parcours de
              saisie), affichée pour les fiches qui en portent encore — jamais de section
              vide pour une fiche nouvellement créée. */}
          {hasInfestationData && (
            <View style={styles.detailCard}>
              <Text style={styles.detailSubtitle}>Infestation (historique)</Text>
              {(['imago', 'larve'] as const).map((categorie) => {
                const rows = infestationRowsByCategorie(categorie);
                if (rows.length === 0) return null;
                return (
                  <View key={categorie} style={{ marginTop: 4 }}>
                    <Text style={styles.detailSubtitleSmall}>{categorie === 'imago' ? 'Imagos' : 'Larves'}</Text>
                    {rows.map((d) => (
                      <View key={d.key} style={styles.detailRow}>
                        <Text style={styles.detailRowLabel}>{d.label}</Text>
                        <Text style={styles.detailRowValue}>
                          {d.nombre} · {d.densiteDiffuse != null ? `${d.densiteDiffuse} ind./ha` : '—'} ·{' '}
                          {d.densiteGroupee != null ? `${d.densiteGroupee} ind./m²` : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
              {recap.infestationCibles.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.detailSubtitleSmall}>Cibles sélectionnées</Text>
                  {recap.infestationCibles.map((cible) => (
                    <View key={cible.key} style={styles.detailRow}>
                      <Text style={styles.detailRowLabel}>{cible.label}</Text>
                      <Text style={styles.detailRowValue}>{cible.details.join(' · ') || '—'}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={[styles.detailLine, { marginTop: 6 }]}>Comportement : {recap.comportementSummary}</Text>
            </View>
          )}

          {/* D — Végétation & Sol */}
          <View style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
            <Text style={styles.checkLabel}>D · Végétation &amp; Sol</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLine}>{recap.vegetationSummary}</Text>
          </View>

          {/* E — Observations */}
          <View style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
            <Text style={styles.checkLabel}>E · Observations</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLine}>Heure d&apos;observation : {recap.heureObservationLabel}</Text>
            <Text style={styles.detailLine}>{recap.observationsText}</Text>
          </View>

          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>☁︎ Pas de réseau ici — la fiche part en file de synchronisation.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.saveButtonText}>
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
  headerGreen: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  headerRowGreen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backWhite: { fontSize: 20, fontWeight: '700', color: '#fff' },
  titleWhite: { fontSize: 14, fontWeight: '700', color: '#fff' },
  subtitleWhite: { fontSize: 10.5, fontWeight: '500', color: '#ffffffcc', marginTop: 2 },
  scroll: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11 },
  checkBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  checkLabel: { fontSize: 12.5, fontWeight: '600', color: '#2a2a22' },
  detailCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginTop: -2 },
  detailSubtitle: { fontSize: 10, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  detailSubtitleSmall: { fontSize: 9, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailLine: { fontSize: 12, color: '#5c5848', lineHeight: 17 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  // #lisibilite-terrain : libellés/valeurs agrandis (au lieu de 11.5px) pour rester
  // lisibles sur le terrain, y compris pour la densité.
  detailRowLabel: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, flexShrink: 1 },
  detailRowValue: { fontSize: 13.5, color: TEXT, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  offlineBanner: { marginTop: 6, backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 11, padding: 12 },
  offlineText: { fontSize: 11, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  footer: { padding: 16 },
  saveButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
