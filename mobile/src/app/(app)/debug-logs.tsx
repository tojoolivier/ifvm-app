import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { useRequestLogStore, RequestLogEntry } from '@/lib/request-log-store';
import { useErrorLogStore, ErrorLogEntry } from '@/lib/error-log-store';
import { useDebugStore } from '@/lib/debug-store';
import { estLeJournalCasse } from '@/lib/logger';
import { viderJournal } from '@/lib/journal-db';
import { runTask } from '@/lib/run-task';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

const IFVM_GREEN_DARK = '#163F16';

function statusColor(entry: RequestLogEntry): string {
  if (!entry.ok) return '#DC2626';
  if (entry.status && entry.status >= 200 && entry.status < 300) return '#15803D';
  return '#D97706';
}

function LogRow({ entry }: { entry: RequestLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.startedAt).toLocaleTimeString('fr-FR');
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  return (
    <TouchableOpacity style={styles.row} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(entry) }]} />
        <Text style={styles.method}>{entry.method}</Text>
        <Text style={styles.url} numberOfLines={expanded ? undefined : 1}>{entry.url}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>{entry.status ?? 'ERR'} · {entry.durationMs}ms · {time}</Text>
      </View>
      {expanded && (
        <View style={styles.detail}>
          {entry.error && <Text style={styles.detailError}>Erreur : {entry.error}</Text>}
          {entry.requestBody != null && (
            <>
              <Text style={styles.detailLabel}>Requête</Text>
              <Text style={styles.detailBody}>{entry.requestBody}</Text>
            </>
          )}
          {entry.responseBody != null && (
            <>
              <Text style={styles.detailLabel}>Réponse</Text>
              <Text style={styles.detailBody}>{entry.responseBody}</Text>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function ErrorRow({ entry }: { entry: ErrorLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.occurredAt).toLocaleTimeString('fr-FR');
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  return (
    <TouchableOpacity style={styles.row} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
      <View style={styles.rowHeader}>
        <View style={[styles.statusDot, { backgroundColor: '#DC2626' }]} />
        <Text style={styles.url} numberOfLines={expanded ? undefined : 1}>{entry.message}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>{entry.screen ?? '—'} · {time}</Text>
      </View>
      {expanded && (
        <View style={styles.detail}>
          {entry.context && (
            <>
              <Text style={styles.detailLabel}>Contexte</Text>
              <Text style={styles.detailBody}>{JSON.stringify(entry.context, null, 2)}</Text>
            </>
          )}
          {entry.cause && (
            <>
              <Text style={styles.detailLabel}>Cause d&apos;origine</Text>
              <Text style={styles.detailBody}>{entry.cause}</Text>
            </>
          )}
          {entry.stack && (
            <>
              <Text style={styles.detailLabel}>Pile d&apos;appel</Text>
              <Text style={styles.detailBody}>{entry.stack}</Text>
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function DebugLogsScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const entries = useRequestLogStore((s) => s.entries);
  const clear = useRequestLogStore((s) => s.clear);
  const errorEntries = useErrorLogStore((s) => s.entries);
  const clearErrors = useErrorLogStore((s) => s.clear);
  const debugEnabled = useDebugStore((s) => s.enabled);
  // Lu au montage, pas en continu : `estLeJournalCasse()` est un drapeau
  // mémoire et non un store réactif — délibérément, puisque le logger ne peut
  // rien notifier sans risquer la récursion que décrit `logger.ts`. Le drapeau
  // ne redescend jamais de lui-même, donc une lecture par ouverture suffit.
  const journalCasse = estLeJournalCasse();
  const { run, isRunning: isExporting } = useAsyncAction();

  const handleClear = () => {
    Alert.alert('Vider le journal ?', 'Toutes les requêtes et erreurs enregistrées seront effacées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: () => {
          clear();
          clearErrors();
          // Sans ça le bouton mentirait : les deux stores sont en mémoire,
          // mais la table `journal` est durable et survivrait au « Vider ».
          void runTask(viderJournal, {
            name: 'journal.vider',
            criticality: 'best-effort',
          });
        },
      },
    ]);
  };

  const handleExport = () =>
    run(
      async () => {
        const report = {
          generatedAt: new Date().toISOString(),
          requests: entries,
          errors: errorEntries,
        };
        const file = new File(Paths.cache, `ifvm-debug-${Date.now()}.json`);
        await file.write(JSON.stringify(report, null, 2));
        await shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Rapport de debug IFVM' });
      },
      { screen: 'debug-logs' }
    );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Journal de debug</Text>
              <Text style={styles.headerSub}>
                {entries.length} requête{entries.length > 1 ? 's' : ''} · {errorEntries.length} erreur{errorEntries.length > 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.clearBtn} onPress={handleExport} disabled={isExporting} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>{isExporting ? 'Export…' : 'Exporter'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>Vider</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {journalCasse && (
          <View style={styles.alerte}>
            <Text style={styles.alerteText}>
              Une partie du journal n’a pas pu être enregistrée sur l’appareil. Ce que vous voyez
              ici est peut-être incomplet — signalez-le au support.
            </Text>
          </View>
        )}
        {!debugEnabled && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Le mode débogage est désactivé — tout continue d’être enregistré, mais les détails
              techniques sont conservés moins longtemps. Activez-le depuis le profil si le support
              vous le demande.
            </Text>
          </View>
        )}
        {errorEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Erreurs applicatives</Text>
            {errorEntries.map((entry) => <ErrorRow key={entry.id} entry={entry} />)}
          </>
        )}

        <Text style={styles.sectionTitle}>Requêtes réseau</Text>
        {entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Aucune requête enregistrée</Text>
          </View>
        ) : (
          entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  backIcon: 22,
  headerTitle: 18,
  headerSub: 12,
  clearBtnText: 13,
  sectionTitle: 11,
  noticeText: 12,
  alerteText: 12,
  method: 12,
  url: 12,
  metaText: 11,
  detailError: 12,
  detailLabel: 11,
  detailBody: 11,
  emptyIcon: 40,
  emptyTitle: 16,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#FFFFFF22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { color: '#FFFFFF', fontSize: typeSizes.backIcon, fontWeight: '300', lineHeight: 26, marginTop: -2 },
    headerTextContainer: { flex: 1, marginLeft: 12 },
    headerTitle: { color: '#FFFFFF', fontSize: typeSizes.headerTitle, fontWeight: '700' },
    headerSub: { color: '#FFFFFFAA', fontSize: typeSizes.headerSub, marginTop: 1 },
    clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    clearBtnText: { color: '#FFFFFF', fontSize: typeSizes.clearBtnText, fontWeight: '600' },
    container: { flex: 1 },
    contentContainer: { padding: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: typeSizes.sectionTitle, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
    notice: {
      backgroundColor: '#FEF3C7',
      borderWidth: 1,
      borderColor: '#FCD34D',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    noticeText: { fontSize: typeSizes.noticeText, color: '#78350F' },
    // Jetons `danger-bg` / `danger-border` / `danger-text` de DESIGN.md. Le reste
    // du fichier porte des hex ad hoc antérieurs ; ne pas les recopier.
    alerte: {
      backgroundColor: '#fbe9e5',
      borderWidth: 1,
      borderColor: '#f0c4b9',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    alerteText: { fontSize: typeSizes.alerteText, color: '#a5341c' },
    row: {
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    method: { fontSize: typeSizes.method, fontWeight: '700', color: '#111827', width: 44 },
    url: { flex: 1, fontSize: typeSizes.url, color: '#374151' },
    rowMeta: { marginTop: 4, marginLeft: 16 },
    metaText: { fontSize: typeSizes.metaText, color: '#9CA3AF' },
    detail: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    detailError: { fontSize: typeSizes.detailError, color: '#DC2626', marginBottom: 4 },
    detailLabel: { fontSize: typeSizes.detailLabel, fontWeight: '700', color: '#6B7280', marginTop: 4 },
    detailBody: { fontSize: typeSizes.detailBody, color: '#111827', fontFamily: 'monospace' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: typeSizes.emptyIcon, marginBottom: 8 },
    emptyTitle: { fontSize: typeSizes.emptyTitle, fontWeight: '600', color: '#111827' },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
