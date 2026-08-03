import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient, ProspectionRead } from '@/lib/api-client';
import { buildFicheLecture, FicheLectureViewModel, isFicheValidee } from '@/lib/prospection-fiche-lecture';
import { buildFicheLecturePdfHtml } from '@/lib/prospection-fiche-lecture-pdf';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

/**
 * Écran de lecture d'une fiche Validée (#16) : strictement lecture seule, aucune resaisie.
 * Toutes les valeurs affichées sont dérivées de la fiche telle que renvoyée par l'API.
 */
export default function FicheLectureScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [prospection, setProspection] = useState<ProspectionRead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    apiClient
      .getProspection(token, id)
      .then(setProspection)
      .catch(() => setLoadError('Impossible de charger la fiche.'));
  }, [id, token]);

  const handleExportPdf = async () => {
    if (!prospection) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';
      const { uri } = await Print.printToFileAsync({
        html: buildFicheLecturePdfHtml(buildFicheLecture(prospection), prospecteurLabel),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      setExportError("Impossible d'exporter la fiche en PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(app)/prospection')}>
            <Text style={styles.backLink}>‹ Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fiche de lecture</Text>
        </SafeAreaView>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!prospection || !isFicheValidee(prospection)) {
    return <View style={styles.root} />;
  }

  const recap: FicheLectureViewModel = buildFicheLecture(prospection);
  const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(app)/prospection')}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fiche de lecture</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{recap.statutLabel}</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fiche</Text>
          <Row label="N° fiche" value={recap.nFiche} />
          <Row label="Station / localité" value={recap.stationLabel} />
          <Row label="Date" value={recap.dateProspection} />
          <Row label="Prospecteur" value={prospecteurLabel} />
        </View>

        {recap.infestation.hasInfestation && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Infestation</Text>
            <Row label="Type" value={recap.infestation.typeLabel} />
            <Row label="Surface" value={recap.infestation.surfaceTot != null ? `${recap.infestation.surfaceTot} ha` : '—'} />
            <Row label="Comportement" value={recap.infestation.comportementLabel} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Synthèse par espèce</Text>
          {recap.especes.length === 0 ? (
            <Text style={styles.summaryText}>Aucune capture enregistrée.</Text>
          ) : (
            recap.especes.map((e) => (
              <View key={e.espece} style={styles.especeBlock}>
                <Text style={styles.especeTitle}>{e.espece}</Text>
                <Row label="Total capturé" value={String(e.totalCaptures)} />
                <Row label="Densité diffuse /ha" value={e.densiteDiffuse != null ? String(e.densiteDiffuse) : '—'} />
                <Row label="Densité groupée /ha" value={e.densiteGroupee != null ? String(e.densiteGroupee) : '—'} />
                <Row label="Phénotype dominant" value={e.phenotypeDominantLabel} />
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Végétation & sol</Text>
          <Text style={styles.summaryText}>{recap.vegetationSummary}</Text>
        </View>

        {exportError && <Text style={styles.errorText}>{exportError}</Text>}

        <TouchableOpacity
          style={[styles.btnExport, isExporting && styles.btnDisabled]}
          onPress={handleExportPdf}
          disabled={isExporting}
          activeOpacity={0.85}
        >
          <Text style={styles.btnExportText}>{isExporting ? 'Export en cours…' : 'Exporter en PDF'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  backLink: { color: '#FFFFFFCC', fontSize: 13, marginBottom: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  badge: { backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  badgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  especeBlock: { marginBottom: 10 },
  especeTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#6B7280', fontSize: 13 },
  rowValue: { color: '#111827', fontSize: 13, fontWeight: '600' },
  summaryText: { color: '#111827', fontSize: 13, lineHeight: 19 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  btnExport: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnExportText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
