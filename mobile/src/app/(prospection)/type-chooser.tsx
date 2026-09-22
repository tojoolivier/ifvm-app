import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';

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
  const { run, isRunning: isCreating } = useAsyncAction();

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
            <Text style={styles.cardTitle}>🔁 Prospections à revalider</Text>
            <Text style={styles.cardSubtitle}>
              Fiches validées depuis plus de 5 jours sans traitement, à revalider avant traitement.
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
  content: { paddingHorizontal: 16 },
  card: { borderRadius: 14, padding: 17, marginBottom: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: BORDER },
  cardIntensive: { backgroundColor: GREEN, borderWidth: 0 },
  cardDashed: { borderStyle: 'dashed', borderColor: '#bdb6a2' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: TEXT },
  cardTitleIntensive: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardSubtitle: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginTop: 4 },
  cardSubtitleIntensive: { fontSize: 11.5, lineHeight: 16, color: '#ffffffd9', marginTop: 4 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
