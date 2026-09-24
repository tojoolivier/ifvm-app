import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const GREEN = '#235a36';

export default function TypeChooserScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const { run, isRunning: isCreating } = useAsyncAction();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const chooseIntensive = () =>
    run(
      async () => {
        const draft = await startNewProspection({ token: token!, prospecteurId: user!.id, typeProspection: 'intensive' });
        await hydrateFromDraft(draft.id);
        router.replace({ pathname: '/(prospection)/reference' as any, params: { draftId: draft.id } });
      },
      {
        screen: 'type-chooser',
        precondition: !!user && !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour créer une fiche.',
        context: { typeProspection: 'intensive' },
      }
    );

  // Le brouillon extensif n'est pas créé ici : l'écran de choix du mode
  // (terrestre/aérien) le crée lui-même une fois le mode choisi — même report
  // qu'avant "☑ Vérifier un signalement" ci-dessous, pour ne jamais créer de
  // brouillon orphelin si l'agent revient en arrière avant d'avoir choisi.
  const chooseExtensive = () => {
    router.push('/(prospection)/extensive-mode-chooser' as any);
  };

  const chooseValidation = () => {
    router.push('/(prospection)/extensive-signalement' as any);
  };

  // #revalidation-prospection : une fiche extensive/validation validée
  // depuis plus de 5 jours sans traitement n'est plus proposée dans
  // « Consulter une fiche validée » — c'est ici qu'elle redevient accessible,
  // pour être revalidée avant traitement (déplacé depuis l'accès rapide du
  // tableau de bord, qui n'accueille plus que les points d'entrée de premier
  // niveau).
  const chooseRevalidation = () => {
    router.push('/(prospection)/revalidation-liste' as any);
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
            <Text style={styles.cardTitleIntensive}>{isCreating ? 'Création…' : 'Intensive'}</Text>
            <Text style={styles.cardSubtitleIntensive}>
              Captures détaillées par phénotype, sexe et phase — ce parcours.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={chooseExtensive} disabled={isCreating} activeOpacity={0.85}>
            <Text style={styles.cardTitle}>Extensive</Text>
            <Text style={styles.cardSubtitle}>
              Densités agrégées par phase (A1–A5 / L1–L7) — mêmes espèces LMC/NSE.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.cardDashed]} onPress={chooseValidation} activeOpacity={0.85}>
            <Text style={styles.cardTitle}>☑ Validation</Text>
            <Text style={styles.cardSubtitle}>
              Même fiche A→D, conclue par Confirmée / Infirmée sur place.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.cardDashed]} onPress={chooseRevalidation} activeOpacity={0.85}>
            <Text style={styles.cardTitle}>🔁 Revalidation</Text>
            <Text style={styles.cardSubtitle}>
              Fiches validées depuis plus de 5 jours sans traitement, à revalider avant traitement.
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  cardTitle: 15,
  cardTitleIntensive: 15,
  cardSubtitle: 11.5,
  cardSubtitleIntensive: 11.5,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.screen },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: typeSizes.back, fontWeight: '700', color: theme.muted },
  title: { fontSize: typeSizes.title, fontWeight: '700', color: theme.text },
  content: { paddingHorizontal: 16 },
  card: { borderRadius: 14, padding: 17, marginBottom: 12, backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.inputBorder },
  cardIntensive: { backgroundColor: GREEN, borderWidth: 0 },
  cardDashed: { borderStyle: 'dashed', borderColor: '#bdb6a2' },
  cardTitle: { fontSize: typeSizes.cardTitle, fontWeight: '800', color: theme.text },
  cardTitleIntensive: { fontSize: typeSizes.cardTitleIntensive, fontWeight: '800', color: '#fff' },
  cardSubtitle: { fontSize: typeSizes.cardSubtitle, lineHeight: 16, color: theme.muted, marginTop: 4 },
  cardSubtitleIntensive: { fontSize: typeSizes.cardSubtitleIntensive, lineHeight: 16, color: '#ffffffd9', marginTop: 4 },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
