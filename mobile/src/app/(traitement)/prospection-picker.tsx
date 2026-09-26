import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ProspectionRead } from '@/lib/api-client';
import {
  loadFichesDisponiblesPourTraitement,
  assurerProspectionDisponibleLocalement,
  materialiserFichesDisponibles,
} from '@/lib/prospection-accueil';
import {
  listProspectionIdsAvecTraitementLocal,
  listProspectionsDisponiblesPourTraitementLocal,
} from '@/lib/prospection-repository';
import { NetworkError } from '@/lib/errors';
import { useAuthStore } from '@/lib/auth-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const LIBELLE_TYPE: Record<string, string> = {
  extensive: 'Extensive',
  intensive: 'Intensive',
  validation: 'Signalement',
};

/**
 * Champs affichés par cet écran, communs à `ProspectionRead` (serveur, en
 * ligne) et `DraftProspection` (repli local, hors ligne — cf. `horsLigne`
 * ci-dessous) : ni l'un ni l'autre n'est retaillé, cette interface ne fait
 * que documenter le sous-ensemble réellement lu par `renderItem`.
 */
interface FichePickable {
  id: string;
  type_prospection: string;
  n_fiche?: string | null;
  n_message?: string | null;
  date_prospection?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  station_libre?: string | null;
  prospecteur_nom?: string | null;
  validated_by_nom?: string | null;
  validated_at?: string | null;
}

/**
 * « Fiches de traitement → Consulter une fiche validée » (#fiches-validees-
 * multi-utilisateurs) — remplace le sélecteur mono-utilisateur d'origine
 * (Lot 2/3, #91) : les fiches validées PAR N'IMPORTE QUEL agent, des trois
 * types (extensive/intensive/signalement — même table, même workflow de
 * statut), pas encore transformées en traitement.
 *
 * En ligne, toujours un appel serveur direct (jamais le cache SQLite local,
 * qui ne connaît que les fiches créées sur CET appareil) — « la disponibilité
 * globale des fiches est une opération serveur ». Hors ligne, un écran
 * bloqué empêcherait de démarrer toute fiche de traitement terrain — on
 * bascule donc sur `listProspectionsDisponiblesPourTraitementLocal`
 * (prospection-repository.ts), une approximation locale volontairement
 * signalée par un bandeau (`horsLigne`), jamais silencieuse.
 */
export default function TraitementProspectionPickerScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [prospections, setProspections] = useState<FichePickable[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const { run, isRunning: isSelectionEnCours } = useAsyncAction();
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const charger = useCallback(() => {
    if (!token) return;
    void runTask(() => loadFichesDisponiblesPourTraitement(token), {
      name: 'traitement.prospectionPicker',
      criticality: 'essential',
    }).then(async (outcome) => {
      if (outcome.ok) {
        // #fiches-disponibles-hors-ligne : met en cache local TOUTE la liste
        // dès qu'elle apparaît en ligne (pas seulement la fiche choisie), pour
        // qu'elle reste consultable au prochain passage hors connexion.
        await materialiserFichesDisponibles(outcome.value);
        // #liste-nouveau-traitement-exclut-deja-traitees : le serveur n'exclut une fiche qu'une
        // fois son traitement synchronisé — on retire aussi, tout de suite, celles pour
        // lesquelles un traitement existe déjà sur cet appareil (brouillon, enregistré hors
        // ligne…). Complément best-effort : s'il échoue, la liste serveur reste affichée telle quelle.
        const dejaTraitees = await runTask(() => listProspectionIdsAvecTraitementLocal(), {
          name: 'traitement.prospectionPicker.dejaTraitees',
          criticality: 'best-effort',
        });
        const disponibles = dejaTraitees.ok
          ? outcome.value.filter((p) => !dejaTraitees.value.has(p.id))
          : outcome.value;
        setHorsLigne(false);
        setErreurDeLecture(null);
        // Même liste (mêmes fiches, même ordre) : on garde l'état tel quel — évite un rendu
        // inutile à chaque prise de focus (le filtre produit un nouveau tableau à chaque appel).
        setProspections((precedentes) =>
          precedentes.length === disponibles.length && precedentes.every((p, i) => p.id === disponibles[i].id)
            ? precedentes
            : disponibles
        );
        setLoading(false);
        return;
      }
      if (!(outcome.error instanceof NetworkError)) {
        // Panne serveur, auth, etc. : reste bloquant, comme avant — seule
        // l'indisponibilité RÉSEAU justifie le repli local (approximatif).
        setErreurDeLecture(outcome.error);
        setLoading(false);
        return;
      }
      const locales = await listProspectionsDisponiblesPourTraitementLocal();
      setHorsLigne(true);
      setErreurDeLecture(null);
      setProspections(locales);
      setLoading(false);
    });
  }, [token]);

  // Rafraîchi à chaque prise de focus (pas seulement au montage) : une fiche de
  // signalement (#nouvelle-fiche-validation-immediate) créée et synchronisée
  // pendant que cet écran restait monté plus bas dans la pile de navigation
  // (retour arrière vers lui plutôt qu'un remontage complet) doit apparaître
  // sans attendre un redémarrage de l'app — même mécanisme que (app)/index.tsx,
  // sync.tsx, prospection.tsx et fiches.tsx.
  useFocusEffect(charger);

  const choisir = (prospection: FichePickable) =>
    run(
      async () => {
        // En ligne : rapatrie la fiche en local si elle vient d'un autre
        // agent, sans quoi l'écran Références (lecture locale) ne trouverait
        // rien. Hors ligne, `prospection` vient déjà du cache local — inutile
        // (et l'objet n'a de toute façon pas la forme `ProspectionRead`
        // complète qu'attend `assurerProspectionDisponibleLocalement`).
        if (!horsLigne) {
          await assurerProspectionDisponibleLocalement(prospection as ProspectionRead);
        }
        router.push({
          pathname: '/(traitement)/references' as any,
          params: { prospectionId: prospection.id },
        });
      },
      { screen: 'prospection-picker', context: { prospectionId: prospection.id, horsLigne } }
    );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Consulter une fiche validée</Text>

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
          data={prospections}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EtatVide
              erreur={erreurDeLecture}
              titreVide="Aucune fiche validée disponible pour le moment."
              onReessayer={charger}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => choisir(item)}
              disabled={isSelectionEnCours}
            >
              <Text style={styles.rowTitle}>
                {LIBELLE_TYPE[item.type_prospection] ?? item.type_prospection} · {item.n_fiche ?? item.n_message ?? 'sans référence'}
              </Text>
              <Text style={styles.rowSubtitle}>
                {item.date_prospection?.slice(0, 10) ?? 'date inconnue'} ·{' '}
                {[item.region, item.district, item.commune].filter(Boolean).join(' · ') ||
                  item.station_libre ||
                  'localisation non renseignée'}
              </Text>
              <Text style={styles.rowDetail}>
                Créée par {item.prospecteur_nom ?? '—'}
                {item.validated_by_nom ? ` · Validée par ${item.validated_by_nom}` : ''}
                {item.validated_at ? ` le ${item.validated_at.slice(0, 10)}` : ''}
              </Text>
            </TouchableOpacity>
          )}
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
    list: { flex: 1 },
    emptyText: { fontFamily: traitementFonts.ui, color: traitementColors.texteLabel, textAlign: 'center', marginTop: 20 },
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
    rowDetail: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteLabel },
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
