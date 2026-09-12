import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProspectionRead } from '@/lib/api-client';
import { loadFichesDisponiblesPourTraitement, assurerProspectionDisponibleLocalement } from '@/lib/prospection-accueil';
import { listProspectionsDisponiblesPourTraitementLocal } from '@/lib/prospection-repository';
import { NetworkError } from '@/lib/errors';
import { useAuthStore } from '@/lib/auth-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { EtatVide } from '@/components/erreurs/etat-vide';

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

  const charger = useCallback(() => {
    if (!token) return;
    void runTask(() => loadFichesDisponiblesPourTraitement(token), {
      name: 'traitement.prospectionPicker',
      criticality: 'essential',
    }).then(async (outcome) => {
      if (outcome.ok) {
        setHorsLigne(false);
        setErreurDeLecture(null);
        setProspections(outcome.value);
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

  useEffect(() => {
    charger();
  }, [charger]);

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
                {[item.region, item.district, item.commune].filter(Boolean).join(' · ') || 'localisation non renseignée'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp, padding: 16, gap: 12 },
  title: {
    fontFamily: traitementFonts.uiExtraBold,
    fontSize: traitementTypeSizes.titreEcran,
    color: traitementColors.texteTitre,
  },
  list: { flex: 1 },
  emptyText: { fontFamily: traitementFonts.ui, color: traitementColors.texteLabel, textAlign: 'center', marginTop: 20 },
  bandeauHorsLigne: {
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.label,
    color: traitementColors.avertissementTexte,
    backgroundColor: traitementColors.avertissementFond,
    borderWidth: 1,
    borderColor: traitementColors.avertissementBordure,
    borderRadius: traitementRadii.carte,
    padding: 10,
  },
  row: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.carte,
    padding: 10,
    marginBottom: 8,
    gap: 2,
  },
  rowTitle: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  rowSubtitle: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteSecondaire },
  rowDetail: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
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

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
