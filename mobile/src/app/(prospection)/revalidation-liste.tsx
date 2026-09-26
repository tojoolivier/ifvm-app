import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ProspectionRead } from '@/lib/api-client';
import {
  loadFichesARevalider,
  assurerProspectionDisponibleLocalement,
} from '@/lib/prospection-accueil';
import {
  listProspectionsARevaliderLocal,
  listProspectionIdsDejaRevalideesLocalement,
  demarrerRevalidation,
} from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { NetworkError } from '@/lib/errors';
import { useAuthStore } from '@/lib/auth-store';
import { useAsyncAction } from '@/hooks/use-async-action';
// Import intermodule : cet écran vit sous (prospection) mais affiche une liste
// avec le style visuel du module traitement (cf. hand-off #taille-police-par-utilisateur).
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const LIBELLE_TYPE: Record<string, string> = {
  extensive: 'Extensive',
  validation: 'Signalement',
};

/** Sous-ensemble commun à `ProspectionRead` (serveur, en ligne) et
 * `DraftProspection` (repli local, hors ligne) — même principe que
 * `FichePickable` dans prospection-picker.tsx. */
interface FicheARevalider {
  id: string;
  type_prospection: string;
  n_fiche?: string | null;
  n_message?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  validated_at?: string | null;
}

function joursDeRetard(validatedAt: string | null | undefined): number | null {
  if (!validatedAt) return null;
  const ecarteMs = Date.now() - new Date(validatedAt).getTime();
  return Math.max(0, Math.floor(ecarteMs / (1000 * 60 * 60 * 24)));
}

/**
 * « Prospections à revalider » (#revalidation-prospection) — accessible
 * depuis le tableau de bord, au même niveau que Nouvelle prospection et
 * Nouveau traitement. Liste les fiches extensive/validation validées depuis
 * plus de 5 jours sans traitement associé (le serveur les exclut désormais
 * de « Consulter une fiche validée » pour cette même raison — la surface
 * infestée et la localisation des criquets ont pu changer).
 *
 * Sélectionner une fiche amorce une NOUVELLE fiche prospection (nouvel id,
 * chaînée via `revalide_de_id`), pré-remplie avec toutes les données de
 * l'ancienne (`demarrerRevalidation`) — jamais une modification en place,
 * cf. plan robust-finding-hartmanis.md. Le wizard extensif qui suit
 * (extensive-reference.tsx → … → extensive-recap.tsx) est réutilisé tel
 * quel, sans aucune modification : il ne connaît que `draftId`.
 */
export default function RevalidationListeScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [fiches, setFiches] = useState<FicheARevalider[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const { run, isRunning: isSelectionEnCours } = useAsyncAction();
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const charger = useCallback(() => {
    if (!token) return;
    void runTask(() => loadFichesARevalider(token), {
      name: 'prospection.revalidationListe',
      criticality: 'essential',
    }).then(async (outcome) => {
      if (outcome.ok) {
        // #revalidation-liste-exclut-origine-revalidee : le serveur n'exclut une origine qu'une
        // fois sa revalidation SYNCHRONISÉE — complément best-effort pour celle créée à
        // l'instant sur cet appareil, pas encore repartie en ligne.
        const dejaRevalidees = await runTask(() => listProspectionIdsDejaRevalideesLocalement(), {
          name: 'prospection.revalidationListe.dejaRevalidees',
          criticality: 'best-effort',
        });
        const restantes = dejaRevalidees.ok
          ? outcome.value.filter((f) => !dejaRevalidees.value.has(f.id))
          : outcome.value;
        setHorsLigne(false);
        setErreurDeLecture(null);
        setFiches(restantes);
        setLoading(false);
        return;
      }
      if (!(outcome.error instanceof NetworkError)) {
        setErreurDeLecture(outcome.error);
        setLoading(false);
        return;
      }
      const locales = await listProspectionsARevaliderLocal();
      setHorsLigne(true);
      setErreurDeLecture(null);
      setFiches(locales);
      setLoading(false);
    });
  }, [token]);

  // #revalidation-liste-exclut-origine-revalidee : rafraîchi à chaque prise de focus (pas
  // seulement au montage) — sans quoi revenir de la création d'une revalidation (même pile de
  // navigation, écran jamais démonté) laissait l'origine visible jusqu'au prochain redémarrage.
  // Même mécanisme que (app)/index.tsx, sync.tsx, prospection.tsx, fiches.tsx et
  // prospection-picker.tsx.
  useFocusEffect(charger);

  const choisir = (fiche: FicheARevalider) =>
    run(
      async () => {
        // En ligne : rapatrie la fiche en local si elle vient d'un autre
        // agent — sans quoi demarrerRevalidation() ne trouverait rien à
        // cloner. Hors ligne, la fiche vient déjà du cache local.
        if (!horsLigne) {
          await assurerProspectionDisponibleLocalement(fiche as ProspectionRead);
        }
        const { draftId } = await demarrerRevalidation(fiche.id);
        // Indispensable avant de naviguer : `extensive-reference.tsx` (et la
        // suite du wizard) lisent `useProspectionWizardStore().draft`, jamais
        // directement la base — sans cette hydratation, l'écran s'ouvrirait
        // avec des champs vides malgré un brouillon déjà cloné en local.
        // Même geste que `extensive-mode-chooser.tsx` avant son propre
        // `router.replace` vers cet écran.
        await useProspectionWizardStore.getState().hydrateFromDraft(draftId);
        router.push({
          pathname: '/(prospection)/extensive-reference' as any,
          params: { draftId },
        });
      },
      { screen: 'revalidation-liste', context: { prospectionId: fiche.id, horsLigne } }
    );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Revalidation</Text>
      <Text style={styles.sousTitre}>
        Validées depuis plus de 5 jours sans traitement — la situation sur le
        terrain a pu changer, à revérifier avant de démarrer un traitement.
      </Text>

      {horsLigne && !loading && (
        <Text style={styles.bandeauHorsLigne}>
          Hors ligne — liste limitée aux fiches déjà synchronisées sur cet appareil,
          pas forcément à jour ni exhaustive (fiches des autres agents non comprises).
        </Text>
      )}

      {loading ? (
        <Text style={styles.emptyText}>Chargement…</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={fiches}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EtatVide
              erreur={erreurDeLecture}
              titreVide="Aucune revalidation en attente pour le moment."
              onReessayer={charger}
            />
          }
          renderItem={({ item }) => {
            const retard = joursDeRetard(item.validated_at);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => choisir(item)}
                disabled={isSelectionEnCours}
              >
                <Text style={styles.rowTitle}>
                  {LIBELLE_TYPE[item.type_prospection] ?? item.type_prospection} ·{' '}
                  {item.n_fiche ?? item.n_message ?? 'sans référence'}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {[item.region, item.district, item.commune].filter(Boolean).join(' · ') ||
                    'localisation non renseignée'}
                </Text>
                {retard != null && (
                  <Text style={styles.rowRetard}>
                    Validée il y a {retard} jour{retard > 1 ? 's' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>‹ Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp, padding: 16, gap: 12 },
    title: {
      fontFamily: traitementFonts.uiExtraBold,
      fontSize: typeSizes.titreEcran,
      color: traitementColors.texteTitre,
    },
    sousTitre: {
      fontFamily: traitementFonts.ui,
      fontSize: typeSizes.label,
      color: traitementColors.texteSecondaire,
    },
    bandeauHorsLigne: {
      fontFamily: traitementFonts.ui,
      fontSize: typeSizes.label,
      color: traitementColors.avertissementTexte,
      backgroundColor: traitementColors.avertissementFond,
      borderWidth: 1,
      borderColor: traitementColors.avertissementBordure,
      borderRadius: traitementRadii.carte,
      padding: 10,
    },
    list: { flex: 1 },
    emptyText: { fontFamily: traitementFonts.ui, color: traitementColors.texteLabel, textAlign: 'center', marginTop: 20 },
    row: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.carte,
      padding: 10,
      marginBottom: 8,
      gap: 2,
    },
    rowTitle: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    rowSubtitle: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteSecondaire },
    rowRetard: { fontFamily: traitementFonts.uiMedium, fontSize: typeSizes.label, color: traitementColors.danger },
    backLink: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: traitementColors.dashedBordure,
      borderRadius: traitementRadii.chip,
      padding: 10,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    backLinkText: { fontFamily: traitementFonts.uiMedium, color: traitementColors.texteSecondaire },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
