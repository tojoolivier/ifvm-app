import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { concludeValidation, listAllProspectionPopulations, PopulationRow } from '@/lib/prospection-repository';
import { enregistrerEtSynchroniser } from '@/lib/prospection-review';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { imagoTotalFromRow, larveTotalFromRow } from '@/lib/prospection-extensive';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const RED = '#c0412b';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

export default function ExtensiveRecapScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const draft = useProspectionWizardStore((s) => s.draft);
  const resetWizard = useProspectionWizardStore((s) => s.reset);
  const { run, isRunning: isSaving } = useAsyncAction();
  const [populations, setPopulations] = useState<PopulationRow[]>([]);
  const signalerChargement = useSignalerChargement('extensive-recap');

  useEffect(() => {
    if (!draft) return;
    void listAllProspectionPopulations(draft.id)
      .then(setPopulations)
      .catch((error) => signalerChargement(error, { draftId: draft.id }));
  }, [draft?.id, signalerChargement]);

  const totals = useMemo(() => {
    const findRow = (espece: 'LMC' | 'NSE', categorie: 'imago' | 'larve') =>
      populations.find((p) => p.espece === espece && p.categorie === categorie) ?? null;
    const imagoLMCRow = findRow('LMC', 'imago');
    return {
      imagoLMC: imagoTotalFromRow(imagoLMCRow),
      imagoNSE: imagoTotalFromRow(findRow('NSE', 'imago')),
      larveLMC: larveTotalFromRow(findRow('LMC', 'larve')),
      larveNSE: larveTotalFromRow(findRow('NSE', 'larve')),
      imagoLMCTrans: imagoLMCRow?.captures_trans ?? 0,
      imagoLMCPopDiff: imagoLMCRow?.densite_diffuse ?? null,
    };
  }, [populations]);

  if (!draft) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const isValidation = draft.type_prospection === 'validation';

  const handleSave = () =>
    run(
      async () => {
        await enregistrerEtSynchroniser(draft, [], token!);
        resetWizard();
        router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } });
      },
      {
        screen: 'extensive-recap',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { draftId: draft.id },
      }
    );

  const handleConclude = (conclusion: 'confirmee' | 'infirmee') =>
    run(
      async () => {
        const concluded = await concludeValidation(draft.id, conclusion);
        await enregistrerEtSynchroniser(concluded, [], token!);
        resetWizard();
        router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } });
      },
      {
        screen: 'extensive-recap',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { draftId: draft.id, conclusion },
      }
    );

  if (isValidation) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <KeyboardAvoidingView 
            style={styles.keyboardAvoidingView} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.headerGreen}>
              <View style={styles.headerRowGreen}>
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                  <Text style={styles.backWhite}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titleWhite}>Vérification du signalement</Text>
                  <Text style={styles.subtitleWhite}>
                    Signalé par {draft.signalement_source ?? '—'} · {draft.signalement_date ?? '—'}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              <View style={styles.quoteBanner}>
                <Text style={styles.quoteText}>« {draft.signalement_description ?? '—'} » — signalement reçu, lieu approximatif.</Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.figureCard, styles.flex1]}>
                  <Text style={styles.figureLabel}>LMC · Trans.</Text>
                  <Text style={styles.figureValue}>{totals.imagoLMCTrans}</Text>
                </View>
                <View style={[styles.figureCard, styles.flex1]}>
                  <Text style={styles.figureLabel}>NSE · Densité L</Text>
                  <Text style={styles.figureValue}>{totals.larveNSE}</Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>
                  Fiche A→D remplie sur place, comme pour l&apos;extensif — Pop diff D/ha {totals.imagoLMCPopDiff ?? '—'} · dégâts{' '}
                  {draft.degats_cultures_pourcent ?? 0} %.
                </Text>
              </View>

              <Text style={styles.conclusionLabel}>Conclusion de la vérification</Text>
            </ScrollView>

            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.infirmeeButton}
                onPress={() => handleConclude('infirmee')}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.infirmeeButtonText}>✗ Infirmée</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmeeButton}
                onPress={() => handleConclude('confirmee')}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmeeButtonText}>✓ Confirmée</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.headerGreen}>
            <View style={styles.headerRowGreen}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.backWhite}>‹</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.titleWhite}>Récapitulatif</Text>
                <Text style={styles.subtitleWhite}>
                  {draft.station_libre ?? '—'} · N°{draft.n_message ?? '—'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 8 }}>
            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>A · Références</Text>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>B · Imagos — LMC {totals.imagoLMC} · NSE {totals.imagoNSE}</Text>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>C · Larves — LMC {totals.larveLMC} · NSE {totals.larveNSE}</Text>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>D · Observations — dégâts {draft.degats_cultures_pourcent ?? 0} %</Text>
            </View>

            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>☁︎ Pas de réseau ici — la fiche part en file de synchronisation.</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.saveButtonText}>Enregistrer (hors-ligne) ✓</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
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
  offlineBanner: { marginTop: 6, backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 11, padding: 12 },
  offlineText: { fontSize: 11, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  footer: { padding: 16 },
  saveButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  quoteBanner: { backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 10, padding: 11, marginBottom: 12 },
  quoteText: { fontSize: 11.5, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  flex1: { flex: 1 },
  figureCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9 },
  figureLabel: { fontSize: 9, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase' },
  figureValue: { fontSize: 17, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  summaryCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 14 },
  summaryText: { fontSize: 11.5, lineHeight: 16, color: '#5c5848', fontWeight: '500' },
  conclusionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 },
  footerRow: { padding: 16, paddingTop: 10, flexDirection: 'row', gap: 9 },
  infirmeeButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: RED, borderRadius: 13, padding: 14, alignItems: 'center' },
  infirmeeButtonText: { color: RED, fontWeight: '800', fontSize: 13 },
  confirmeeButton: { flex: 1, backgroundColor: GREEN, borderRadius: 13, padding: 14, alignItems: 'center' },
  confirmeeButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
