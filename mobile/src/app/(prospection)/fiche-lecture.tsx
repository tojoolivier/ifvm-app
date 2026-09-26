import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient, ProspectionRead } from '@/lib/api-client';
import { buildFicheLecture, STATUT_VALIDE } from '@/lib/prospection-fiche-lecture';
import { getStationById } from '@/lib/referentiel-db';
import { telechargerEtPartagerPdf } from '@/lib/pdf-partage';
import { depsPdfPartage } from '@/lib/pdf-partage-natif';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { runTask } from '@/lib/run-task';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { FicheProspectionTableau } from '@/components/fiche/FicheProspectionTableau';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

/**
 * Écran de lecture d'une fiche de prospection : strictement lecture seule, aucune resaisie. La
 * fiche est présentée en tableaux comme le PDF téléchargé, à partir de la fiche telle que
 * renvoyée par l'API. Le bouton « Télécharger le PDF » est dans l'en-tête, visible sans défiler.
 */
export default function FicheLectureScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);

  const [prospection, setProspection] = useState<ProspectionRead | null>(null);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const [stationLabel, setStationLabel] = useState<string | null>(null);
  const { run, isRunning: isExporting } = useAsyncAction();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const charger = useCallback(() => {
    if (!id || !token) return;
    void runTask(() => apiClient.getProspection(token, id), {
      name: 'ficheLecture.prospection',
      criticality: 'essential',
      context: { id },
    }).then((outcome) => {
      setErreurDeLecture(outcome.ok ? null : outcome.error);
      if (outcome.ok) setProspection(outcome.value);
    });
  }, [id, token]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Nom de la station : la fiche ne porte que son identifiant, le nom vient du référentiel local
  // déjà synchronisé. Un référentiel indisponible ne doit pas empêcher de lire la fiche — la
  // station reste alors affichée par sa saisie libre ou son identifiant.
  const stationId = prospection?.station_id ?? null;
  useEffect(() => {
    if (!stationId) return;
    let annule = false;
    getStationById(stationId)
      .then((station) => {
        if (!annule) setStationLabel(station ? `${station.code} ${station.nom}` : null);
      })
      .catch(() => {
        if (!annule) setStationLabel(null);
      });
    return () => {
      annule = true;
    };
  }, [stationId]);

  // PDF (#494/#594) généré côté backend (WeasyPrint, #533) — même pattern que le CRT
  // (recap.tsx) : pas de rendu HTML côté client, un fetch authentifié + partage natif.
  const handleExportPdf = () =>
    run(
      () =>
        telechargerEtPartagerPdf(
          depsPdfPartage(),
          `/prospections/${prospection!.id}/pdf`,
          `fiche-prospection-${prospection!.n_fiche ?? prospection!.id}.pdf`
        ),
      { screen: 'fiche-lecture', precondition: !!prospection, context: { id } }
    );

  if (erreurDeLecture || !prospection) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(app)/prospection')}>
            <Text style={styles.backLink}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fiche de lecture</Text>
        </SafeAreaView>
        <EtatVide erreur={erreurDeLecture} titreVide="Chargement…" onReessayer={erreurDeLecture ? charger : undefined} />
      </View>
    );
  }

  // Lecture seule de toute fiche du serveur, pas seulement des validées : « Mes fiches » ouvre cet
  // écran pour une fiche « En attente » ou « Vérifiée », qui restait sinon un écran blanc sans erreur.
  // Le PDF, lui, n'existe que pour une fiche validée (le backend refuse les autres en 403).
  const statutLabel = buildFicheLecture(prospection).statutLabel;
  const pdfDisponible = prospection.statut === STATUT_VALIDE;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(app)/prospection')}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={styles.headerTexte}>
            <Text style={styles.headerTitle}>Fiche de lecture</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{statutLabel}</Text>
            </View>
          </View>
          {pdfDisponible && (
            <TouchableOpacity
              style={[styles.btnPdf, isExporting && styles.btnDisabled]}
              onPress={handleExportPdf}
              disabled={isExporting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Télécharger le PDF"
            >
              <Text style={styles.btnPdfText}>{isExporting ? 'Export…' : 'Télécharger le PDF'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <FicheProspectionTableau prospection={prospection} stationLabel={stationLabel} />
        </View>
      </ScrollView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  backLink: 13,
  headerTitle: 18,
  badgeText: 12,
  btnPdfText: 13,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.inputBg },
    header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
    backLink: { color: '#FFFFFFCC', fontSize: typeSizes.backLink, marginBottom: 6 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    headerTexte: { flexShrink: 1 },
    headerTitle: { color: '#FFFFFF', fontSize: typeSizes.headerTitle, fontWeight: '700' },
    badge: { backgroundColor: theme.successBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
    badgeText: { color: theme.success, fontSize: typeSizes.badgeText, fontWeight: '700' },
    content: { flex: 1 },
    card: { backgroundColor: theme.card, borderRadius: 10, padding: 12 },
    btnPdf: { backgroundColor: IFVM_GREEN, borderWidth: 1, borderColor: '#FFFFFF66', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
    btnDisabled: { opacity: 0.6 },
    btnPdfText: { color: '#FFFFFF', fontSize: typeSizes.btnPdfText, fontWeight: '600' },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
