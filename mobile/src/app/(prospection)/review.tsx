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
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const GREEN = '#235a36';

/** Même composant/style que `DetailRows` côté Extensif (extensive-recap.tsx) —
 * une ligne label/valeur, jamais masquée silencieusement (« — » si absent). */
function DetailRows({ rows }: { rows: DetailRowViewModel[] }) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
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
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

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
        // #retour-apres-creation-fiche : `dismissTo` (et non `replace`) — `replace` vers le groupe
        // `(app)` depuis le groupe `(prospection)` en empilait une SECONDE instance sous laquelle
        // restait la liste d'origine : deux « Retour » pour revenir à l'accueil. `dismissTo` revient
        // à la liste « Prospection » déjà dans la pile (un seul « Retour » ensuite).
        router.dismissTo({
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

const BASE_TYPE_SIZES = {
  backWhite: 20,
  titleWhite: 14,
  subtitleWhite: 10.5,
  checkBadgeText: 11,
  checkLabel: 12.5,
  detailSubtitle: 10,
  detailSubtitleSmall: 9,
  detailLine: 12,
  detailRowLabel: 13,
  detailRowValue: 13.5,
  offlineText: 11,
  saveButtonText: 15,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.screen },
  safe: { flex: 1 },
  headerGreen: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  headerRowGreen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backWhite: { fontSize: typeSizes.backWhite, fontWeight: '700', color: '#fff' },
  titleWhite: { fontSize: typeSizes.titleWhite, fontWeight: '700', color: '#fff' },
  subtitleWhite: { fontSize: typeSizes.subtitleWhite, fontWeight: '500', color: '#ffffffcc', marginTop: 2 },
  scroll: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 10, padding: 11 },
  checkBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.checkBadgeText },
  checkLabel: { fontSize: typeSizes.checkLabel, fontWeight: '600', color: theme.text },
  detailCard: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.inputBorder, borderRadius: 10, padding: 11, marginTop: -2 },
  detailSubtitle: { fontSize: typeSizes.detailSubtitle, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  detailSubtitleSmall: { fontSize: typeSizes.detailSubtitleSmall, fontWeight: '700', color: theme.faint, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailLine: { fontSize: typeSizes.detailLine, color: theme.muted, lineHeight: 17 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: theme.border },
  // #lisibilite-terrain : libellés/valeurs agrandis (au lieu de 11.5px) pour rester
  // lisibles sur le terrain, y compris pour la densité.
  detailRowLabel: { fontSize: typeSizes.detailRowLabel, fontWeight: '600', color: theme.muted, flexShrink: 1 },
  detailRowValue: { fontSize: typeSizes.detailRowValue, color: theme.text, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  offlineBanner: { marginTop: 6, backgroundColor: theme.warnBg, borderWidth: 1, borderColor: theme.warnBorder, borderRadius: 11, padding: 12 },
  offlineText: { fontSize: typeSizes.offlineText, lineHeight: 16, color: theme.warn, fontWeight: '500' },
  footer: { padding: 16 },
  saveButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.saveButtonText },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
