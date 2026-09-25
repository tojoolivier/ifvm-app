import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { motifEquipeIncompatible } from '@/lib/equipe-travail';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';
import { useEquipesDeTravail } from '@/hooks/use-equipes-de-travail';
import { startNewProspection } from '@/lib/prospection-accueil';
import { setProspectionModeExtensif } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const GREEN = '#235a36';
const BLUE = '#31567f';

type ModeExtensif = 'terrestre' | 'aerien';

/**
 * Choix du mode de la fiche extensive, avant toute saisie — le mode terrestre
 * charge la fiche extensive exactement comme avant (aucun champ aérien affiché,
 * aucune donnée aérienne créée) ; le mode aérien ajoute le bloc équipe/aéronef et
 * les opérations de vol sur le slide Références (cf. extensive-reference.tsx).
 *
 * Deux points d'entrée :
 * - Depuis `type-chooser.tsx` (carte « Extensive »), aucun brouillon n'existe
 *   encore : `draftId` est absent, ce choix crée le brouillon (comportement
 *   historique, inchangé).
 * - Depuis `extensive-signalement.tsx` (« Vérifier un signalement »), le
 *   brouillon existe déjà (type_prospection = 'validation', champs de
 *   signalement déjà enregistrés) et arrive ici via `draftId` : ce choix se
 *   contente de fixer son `mode_extensif`, sans recréer de brouillon.
 */
export default function ExtensiveModeChooserScreen() {
  const router = useRouter();
  const { draftId: existingDraftId } = useLocalSearchParams<{ draftId?: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const { run, isRunning: isCreating } = useAsyncAction();
  const [modeChoisi, setMode] = useState<ModeExtensif | null>(null);
  const ouvrirChoixEquipe = useEquipeSheetStore((s) => s.ouvrir);
  const { courante } = useEquipesDeTravail();

  // Même principe que le menu « Nouvelle fiche » : un mode incompatible avec l'équipe de travail
  // n'est pas une erreur, c'est une invitation à changer d'équipe. Valable aussi pour une validation,
  // dont le brouillon reprend l'équipe courante au moment où son mode est fixé.
  const motifPour = (voulu: ModeExtensif) => motifEquipeIncompatible(voulu, courante);
  // Un changement d'équipe (feuille globale) peut rendre le mode déjà choisi incompatible : il est
  // alors ignoré plutôt que reporté sur une équipe qui ne lui convient pas.
  const mode = modeChoisi && !motifPour(modeChoisi) ? modeChoisi : null;
  const choisirMode = (voulu: ModeExtensif) => {
    if (motifPour(voulu)) ouvrirChoixEquipe();
    else setMode(voulu);
  };

  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const handleContinue = () =>
    run(
      async () => {
        const draft = existingDraftId
          ? await setProspectionModeExtensif(existingDraftId, mode!, courante?.id ?? null)
          : await startNewProspection({
              token: token!,
              prospecteurId: user!.id,
              typeProspection: 'extensive',
              modeExtensif: mode,
            });
        await hydrateFromDraft(draft.id);
        router.replace({ pathname: '/(prospection)/extensive-reference' as any, params: { draftId: draft.id } });
      },
      {
        screen: 'extensive-mode-chooser',
        precondition: !!user && !!token && !!mode,
        preconditionMessage: mode
          ? 'Session expirée — reconnectez-vous pour créer une fiche.'
          : 'Choisissez un mode de prospection avant de continuer.',
        context: { typeProspection: existingDraftId ? 'validation' : 'extensive', mode, draftId: existingDraftId ?? null },
      }
    );

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
          <Text style={styles.hint}>Choisissez comment cette prospection a été réalisée.</Text>

          <TouchableOpacity
            style={[styles.card, mode === 'terrestre' && styles.cardActiveGreen, motifPour('terrestre') && styles.cardIndisponible]}
            onPress={() => choisirMode('terrestre')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>Prospection Terrestre</Text>
            <Text style={styles.cardSubtitle}>{motifPour('terrestre') ?? 'Prospection réalisée au sol.'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, mode === 'aerien' && styles.cardActiveBlue, motifPour('aerien') && styles.cardIndisponible]}
            onPress={() => choisirMode('aerien')}
            activeOpacity={0.85}
          >
            <Text style={styles.cardTitle}>Prospection Aérienne</Text>
            <Text style={styles.cardSubtitle}>{motifPour('aerien') ?? "Prospection réalisée à partir d'un aéronef."}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !mode && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!mode || isCreating}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{isCreating ? 'Création…' : 'Continuer'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  back: 22,
  title: 15,
  hint: 12,
  cardIcon: 18,
  cardTitle: 15,
  cardSubtitle: 11.5,
  continueButtonText: 15,
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
  content: { flex: 1, paddingHorizontal: 16 },
  hint: { fontSize: typeSizes.hint, lineHeight: 17, color: theme.muted, marginBottom: 14 },
  card: { borderRadius: 14, padding: 17, marginBottom: 12, backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.inputBorder },
  cardActiveGreen: { borderColor: GREEN, borderWidth: 2, backgroundColor: theme.successBg },
  cardActiveBlue: { borderColor: BLUE, borderWidth: 2, backgroundColor: '#eaf0f7' },
  cardIndisponible: { opacity: 0.55 },
  cardIcon: { fontSize: typeSizes.cardIcon, marginBottom: 4 },
  cardTitle: { fontSize: typeSizes.cardTitle, fontWeight: '800', color: theme.text },
  cardSubtitle: { fontSize: typeSizes.cardSubtitle, lineHeight: 16, color: theme.muted, marginTop: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: typeSizes.continueButtonText },
});
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
