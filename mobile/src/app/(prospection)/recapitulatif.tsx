// src/app/(prospection)/recapitulatif.tsx

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import { buildRecapitulatif, enregistrerEtSynchroniser, RecapitulatifViewModel } from '@/lib/prospection-recapitulatif';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

export default function RecapitulatifScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [recap, setRecap] = useState<RecapitulatifViewModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (row) setRecap(await buildRecapitulatif(row));
    });
  }, [draftId]);

  const handleEnregistrer = async () => {
    if (!draft || !token) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await enregistrerEtSynchroniser(draft, token);
      router.push({ pathname: '/(tabs)/prospection', params: { justSaved: '1' } });
    } catch {
      setSaveError("Impossible d'enregistrer la fiche localement");
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft || !recap) {
    return <View style={styles.root} />;
  }

  const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(prospection)/vegetation', params: { draftId } })}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Récapitulatif</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fiche</Text>
          <Row label="N° fiche" value={recap.nFiche} />
          <Row label="Station / localité" value={recap.stationLabel} />
          <Row label="Date" value={recap.dateProspection} />
          <Row label="Prospecteur" value={prospecteurLabel} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Captures</Text>
          <Row label="Total capturé" value={String(recap.totalCaptures)} />
          <Row label="Femelles" value={String(recap.totalFemelles)} />
          <Row label="Mâles" value={String(recap.totalMales)} />
          <Row label="Phénotype dominant" value={recap.phenotypeDominantLabel} />
          <Row label="Durée de la session" value={recap.dureeSession} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Végétation & sol</Text>
          <Text style={styles.summaryText}>{recap.vegetationSummary}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Référence</Text>
          <Row label="Surface station" value={formatHa(recap.surfStation)} />
          <Row label="Surface prospectée" value={formatHa(recap.surfProspectee)} />
          <Row label="Surface infestée" value={formatHa(recap.surfInfestee)} />
          <Row
            label="Position GPS"
            value={recap.latitude != null && recap.longitude != null ? `${recap.latitude.toFixed(5)}, ${recap.longitude.toFixed(5)}` : '—'}
          />
        </View>

        {saveError && <Text style={styles.errorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.btnEnregistrer, isSaving && styles.btnDisabled]}
          onPress={handleEnregistrer}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.btnEnregistrerText}>{isSaving ? 'Enregistrement…' : 'Enregistrer (hors-ligne)'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function formatHa(value: number | null): string {
  return value != null ? `${value} ha` : '—';
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
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#6B7280', fontSize: 13 },
  rowValue: { color: '#111827', fontSize: 13, fontWeight: '600' },
  summaryText: { color: '#111827', fontSize: 13, lineHeight: 19 },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  btnEnregistrer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnEnregistrerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
