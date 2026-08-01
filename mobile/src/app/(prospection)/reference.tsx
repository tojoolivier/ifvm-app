import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentPosition, GpsPosition, LocationPermissionDeniedError } from '@/lib/location';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import { generateNumeroFiche, saveReference, validateSurfaces } from '@/lib/prospection-reference';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

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
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => router.push('/(app)/prospection')}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Référence &amp; position</Text>
            <Text style={styles.headerSub}>Étape 1/4</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '25%' }]} />
        </View>
        <Text style={styles.progressLabel}>Progression 25%</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte GPS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📍</Text>
            <Text style={styles.cardTitle}>Position GPS</Text>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>
                {gpsStatus === 'success' ? '✅' : gpsStatus === 'loading' ? '⏳' : '❌'}
              </Text>
            </View>
          </View>
          {gpsStatus === 'loading' && (
            <View style={styles.gpsRow}>
              <ActivityIndicator color={IFVM_GREEN} size="small" />
              <Text style={styles.gpsLoadingText}>Acquisition de la position…</Text>
            </View>
          )}
          {gpsStatus === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxIcon}>⚠️</Text>
              <Text style={styles.errorBoxText}>{gpsError}</Text>
            </View>
          )}
          {gpsStatus === 'success' && position && (
            <View style={styles.gpsContainer}>
              <View style={styles.gpsRowInfo}>
                <Text style={styles.gpsLabel}>Latitude</Text>
                <Text style={styles.gpsValue}>{position.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.gpsRowInfo}>
                <Text style={styles.gpsLabel}>Longitude</Text>
                <Text style={styles.gpsValue}>{position.longitude.toFixed(6)}</Text>
              </View>
              <View style={styles.gpsRowInfo}>
                <Text style={styles.gpsLabel}>Altitude</Text>
                <Text style={styles.gpsValue}>
                  {position.altitude != null ? `${position.altitude.toFixed(0)} m` : '—'}
                </Text>
              </View>
              <View style={[styles.gpsRowInfo, styles.gpsRowInfoLast]}>
                <Text style={styles.gpsLabel}>Précision</Text>
                <Text style={styles.gpsValue}>
                  {position.accuracy != null ? `${position.accuracy.toFixed(0)} m` : '—'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Carte Informations */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📄</Text>
            <Text style={styles.cardTitle}>Informations</Text>
          </View>
          <Row label="N° fiche" value={numeroFiche} />
          <Row label="Date" value={draft?.date_prospection ?? ''} />
          <Row label="Saisie le" value={dateHeure} />
        </View>

        {/* Carte Surfaces */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📐</Text>
            <Text style={styles.cardTitle}>Surfaces (ha)</Text>
          </View>
          <SurfaceField label="Surface station" value={surfStation} onChangeText={setSurfStation} />
          <SurfaceField label="Surface prospectée" value={surfProspectee} onChangeText={setSurfProspectee} />
          <SurfaceField label="Surface infestée" value={surfInfestee} onChangeText={setSurfInfestee} />
          {!surfacesValid && (surfStation || surfProspectee || surfInfestee) && (
            <View style={styles.validationBox}>
              <Text style={styles.validationText}>⚠️ infestée ≤ prospectée ≤ station</Text>
            </View>
          )}
        </View>

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorBoxText}>{saveError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnContinuer, !canContinue && styles.btnDisabled]}
          onPress={handleContinuer}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnContinuerText}>
            {isSaving ? '⏳ Enregistrement…' : '➡️ Continuer'}
          </Text>
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
      <Text style={styles.rowValue}>{value || '—'}</Text>
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
  const hasValue = value && parseDecimal(value) !== null;
  return (
    <View style={styles.surfaceField}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={[styles.surfaceInput, hasValue && styles.surfaceInputFilled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  header: { 
    backgroundColor: IFVM_GREEN_DARK, 
    paddingHorizontal: 10, 
    paddingBottom: 10 
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
    marginTop: -2,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
  },
  headerSub: {
    color: '#FFFFFFAA',
    fontSize: isSmallScreen ? 10 : 12,
    marginTop: 1,
  },
  headerRight: {
    width: 32,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#FFFFFF33',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  progressLabel: {
    color: '#FFFFFFAA',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  cardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cardBadgeText: {
    fontSize: 14,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  gpsLoadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  gpsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  gpsRowInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  gpsRowInfoLast: {
    borderBottomWidth: 0,
  },
  gpsLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  gpsValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  rowLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  rowValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  surfaceField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  surfaceInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 90,
    textAlign: 'right',
    color: '#111827',
    fontSize: 13,
    backgroundColor: '#FFFFFF',
  },
  surfaceInputFilled: {
    borderColor: IFVM_GREEN,
    backgroundColor: IFVM_GREEN_LIGHT,
  },
  validationBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  validationText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorBoxText: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
  },
  btnContinuer: {
    backgroundColor: IFVM_GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnContinuerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});