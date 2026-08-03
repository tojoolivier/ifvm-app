import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

export default function TypeChooserScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseIntensive = async () => {
    if (!user || !token || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const draft = await startNewProspection({ token, prospecteurId: user.id, typeProspection: 'intensive' });
      await hydrateFromDraft(draft.id);
      router.replace({ pathname: '/(prospection)/reference' as any, params: { draftId: draft.id } });
    } catch {
      setError('Impossible de démarrer une nouvelle fiche (campagne introuvable ou hors-ligne).');
    } finally {
      setIsCreating(false);
    }
  };

  const chooseExtensive = async () => {
    if (!user || !token || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const draft = await startNewProspection({ token, prospecteurId: user.id, typeProspection: 'extensive' });
      await hydrateFromDraft(draft.id);
      router.replace({ pathname: '/(prospection)/extensive-reference' as any, params: { draftId: draft.id } });
    } catch {
      setError('Impossible de démarrer une nouvelle fiche (campagne introuvable ou hors-ligne).');
    } finally {
      setIsCreating(false);
    }
  };

  const chooseValidation = () => {
    router.push('/(prospection)/extensive-signalement' as any);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Type de prospection</Text>
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={[styles.card, styles.cardIntensive]}
            onPress={chooseIntensive}
            disabled={isCreating}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitleIntensive}>{isCreating ? 'Création…' : 'Intensif'}</Text>
            <Text style={styles.cardSubtitleIntensive}>
              Captures détaillées par phénotype, sexe et phase — ce parcours.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={chooseExtensive} disabled={isCreating} activeOpacity={0.85}>
            <Text style={styles.cardTitle}>Extensif</Text>
            <Text style={styles.cardSubtitle}>
              Densités agrégées par phase (A1–A5 / L1–L7) — mêmes espèces LMC/NSE.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.cardDashed]} onPress={chooseValidation} activeOpacity={0.85}>
            <Text style={styles.cardTitle}>☑ Vérifier un signalement</Text>
            <Text style={styles.cardSubtitle}>
              Même fiche A→D, conclue par Confirmée / Infirmée sur place.
            </Text>
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}
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
  content: { paddingHorizontal: 16 },
  card: { borderRadius: 14, padding: 17, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: BORDER },
  cardIntensive: { backgroundColor: GREEN, borderWidth: 0 },
  cardDashed: { borderStyle: 'dashed', borderColor: '#bdb6a2' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  cardTitleIntensive: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardSubtitle: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginTop: 4 },
  cardSubtitleIntensive: { fontSize: 11.5, lineHeight: 16, color: '#ffffffd9', marginTop: 4 },
  errorText: { color: '#c0412b', fontSize: 12, marginTop: 4, textAlign: 'center' },
});
