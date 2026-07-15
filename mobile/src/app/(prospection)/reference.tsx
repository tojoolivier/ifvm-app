// src/app/(prospection)/reference.tsx

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentPosition, GpsPosition, LocationPermissionDeniedError } from '@/lib/location';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import { generateNumeroFiche, saveReference, validateSurfaces } from '@/lib/prospection-reference';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';

type GpsStatus = 'loading' | 'success' | 'error';

export default function ReferenceScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('loading');
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [surfStation, setSurfStation] = useState('');
  const [surfProspectee, setSurfProspectee] = useState('');
  const [surfInfestee, setSurfInfestee] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(setDraft);
  }, [draftId]);

  useEffect(() => {
    let cancelled = false;
    setGpsStatus('loading');
    setGpsError(null);

    getCurrentPosition()
      .then((pos) => {
        if (cancelled) return;
        setPosition(pos);
        setGpsStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setGpsError(
          err instanceof LocationPermissionDeniedError
            ? 'Permission de localisation refusée'
            : 'Position GPS indisponible'
        );
        setGpsStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const numeroFiche = useMemo(
    () => (draft ? generateNumeroFiche(draft.id, draft.date_prospection) : ''),
    [draft]
  );

  const surfaces = {
    surfStation: parseDecimal(surfStation),
    surfProspectee: parseDecimal(surfProspectee),
    surfInfestee: parseDecimal(surfInfestee),
  };
  const surfacesValid = validateSurfaces(surfaces);
  const canContinue = gpsStatus === 'success' && surfacesValid && !isSaving;

  const handleContinuer = async () => {
    if (!draft || !position || !surfacesValid) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveReference({ draftId: draft.id, position, surfaces, numeroFiche });
      router.push({ pathname: '/(prospection)/especes', params: { draftId: draft.id } });
    } catch {
      setSaveError("Impossible d'enregistrer la fiche localement");
    } finally {
      setIsSaving(false);
    }
  };

  const dateHeure = draft
    ? new Date(draft.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/prospection')}>
          <Text style={styles.backLink}>‹ Accueil</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Référence & position</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '25%' }]} />
        </View>
        <Text style={styles.progressLabel}>Étape 1/4</Text>
      </SafeAreaView>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Position GPS</Text>
          {gpsStatus === 'loading' && (
            <View style={styles.gpsRow}>
              <ActivityIndicator color={IFVM_GREEN} />
              <Text style={styles.gpsLoadingText}>Acquisition de la position…</Text>
            </View>
          )}
          {gpsStatus === 'error' && <Text style={styles.gpsErrorText}>{gpsError}</Text>}
          {gpsStatus === 'success' && position && (
            <View>
              <Text style={styles.gpsValue}>
                Lat {position.latitude.toFixed(5)} · Lon {position.longitude.toFixed(5)}
              </Text>
              <Text style={styles.gpsSub}>
                Altitude {position.altitude != null ? `${position.altitude.toFixed(0)} m` : '—'} · Précision{' '}
                {position.accuracy != null ? `${position.accuracy.toFixed(0)} m` : '—'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Row label="N° fiche" value={numeroFiche} />
          <Row label="Date" value={draft?.date_prospection ?? ''} />
          <Row label="Saisie le" value={dateHeure} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Surfaces (ha)</Text>
          <SurfaceField label="Surface station" value={surfStation} onChangeText={setSurfStation} />
          <SurfaceField label="Surface prospectée" value={surfProspectee} onChangeText={setSurfProspectee} />
          <SurfaceField label="Surface infestée" value={surfInfestee} onChangeText={setSurfInfestee} />
          {!surfacesValid && (surfStation || surfProspectee || surfInfestee) && (
            <Text style={styles.gpsErrorText}>infestée ≤ prospectée ≤ station</Text>
          )}
        </View>

        {saveError && <Text style={styles.gpsErrorText}>{saveError}</Text>}

        <TouchableOpacity
          style={[styles.btnContinuer, !canContinue && styles.btnDisabled]}
          onPress={handleContinuer}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>{isSaving ? 'Enregistrement…' : 'Continuer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function parseDecimal(value: string): number | null {
  if (value.trim() === '') return null;
  const normalized = value.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function SurfaceField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.surfaceField}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.surfaceInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: IFVM_GREEN_DARK, paddingHorizontal: 16, paddingBottom: 14 },
  backLink: { color: '#FFFFFFCC', fontSize: 13, marginBottom: 6 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  progressTrack: { height: 4, backgroundColor: '#FFFFFF33', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#FFFFFF' },
  progressLabel: { color: '#FFFFFFAA', fontSize: 11, marginTop: 4 },
  content: { flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsLoadingText: { color: '#6B7280', fontSize: 13 },
  gpsErrorText: { color: '#dc2626', fontSize: 13 },
  gpsValue: { color: '#111827', fontSize: 15, fontWeight: '600' },
  gpsSub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: '#6B7280', fontSize: 13 },
  rowValue: { color: '#111827', fontSize: 13, fontWeight: '600' },
  surfaceField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  surfaceInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    textAlign: 'right',
    color: '#111827',
  },
  btnContinuer: { backgroundColor: IFVM_GREEN, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnContinuerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
