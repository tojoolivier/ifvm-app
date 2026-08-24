import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentPosition } from '@/lib/location';
import { useAuthStore } from '@/lib/auth-store';
import { updateProspectionExtensiveReference } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { BIOTOPE_EXTENSIVE_OPTIONS } from '@/lib/prospection-extensive';
import { useAsyncAction } from '@/hooks/use-async-action';
import { logger } from '@/lib/logger';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const AUTO_BG = '#eaf2ec';
const INACTIVE_BG = '#efeada';

/** Auto-généré côté client comme n_fiche (cf. reference.tsx), faute de numérotation serveur pour l'extensif. */
function generateNumeroMessage(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${datePart}-${idPart}`;
}

export default function ExtensiveReferenceScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const user = useAuthStore((s) => s.user);
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  const isValidation = draft?.type_prospection === 'validation';

  const [latitude, setLatitude] = useState<string>(draft?.latitude != null ? String(draft.latitude) : '');
  const [longitude, setLongitude] = useState<string>(draft?.longitude != null ? String(draft.longitude) : '');
  const [isLoadingGps, setIsLoadingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [stationLibre, setStationLibre] = useState(draft?.station_libre ?? '');
  const [typeStation, setTypeStation] = useState(draft?.type_station ?? '');
  const [surfaceStation, setSurfaceStation] = useState(draft?.surface_station != null ? String(draft.surface_station) : '');
  const [nMessage, setNMessage] = useState(
    draft?.n_message ?? (draftId && draft ? generateNumeroMessage(draftId, draft.date_prospection) : '')
  );
  const { run, isRunning: isSaving } = useAsyncAction();

  // Récupération automatique des coordonnées GPS
  useEffect(() => {
    let isMounted = true;

    const fetchGpsPosition = async () => {
      // Si les coordonnées existent déjà dans le brouillon, on les utilise
      if (draft?.latitude && draft?.longitude) {
        if (isMounted) {
          setLatitude(String(draft.latitude));
          setLongitude(String(draft.longitude));
        }
        return;
      }

      // Sinon, on récupère la position GPS
      if (isMounted) {
        setIsLoadingGps(true);
        setGpsError('');
      }

      try {
        const position = await getCurrentPosition();
        if (isMounted) {
          setLatitude(String(position.latitude));
          setLongitude(String(position.longitude));
          setGpsError('');
        }
      } catch (error) {
        // Best-effort délibéré : déjà visible via `gpsError`, l'agent peut
        // saisir les coordonnées à la main.
        logger.ignore(error, 'position GPS indisponible, saisie manuelle possible');
        if (isMounted) {
          setGpsError('Impossible de récupérer la position GPS');
        }
      } finally {
        if (isMounted) {
          setIsLoadingGps(false);
        }
      }
    };

    void fetchGpsPosition();

    return () => {
      isMounted = false;
    };
  }, [draft?.latitude, draft?.longitude]);

  const handleContinue = () =>
    run(
      async () => {
        // Convertit en minuscules et remplace les espaces par des underscores.
        const normalizedTypeStation = typeStation
          ? typeStation.toLowerCase().replace(/\s+/g, '_')
          : null;

        const updated = await updateProspectionExtensiveReference(draftId, {
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          stationLibre: stationLibre || null,
          typeStation: normalizedTypeStation,
          surfaceStation: surfaceStation ? parseFloat(surfaceStation) : null,
          nMessage: nMessage || null,
        });
        setDraft(updated);
        router.push({ pathname: '/(prospection)/extensive-imagos' as any, params: { draftId } });
      },
      {
        screen: 'extensive-reference',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Références</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            {isValidation && draft?.signalement_description && (
              <View style={styles.quoteBanner}>
                <Text style={styles.quoteText}>
                  « {draft.signalement_description} » — signalé par {draft.signalement_source}
                  {draft.signalement_date ? `, ${draft.signalement_date}` : ''}.
                </Text>
              </View>
            )}

            <View style={styles.autoCard}>
              <Text style={styles.autoLabel}>Prospecteur (connecté)</Text>
              <Text style={styles.autoValue}>{user ? `${user.prenom} ${user.nom}` : '—'}</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Date</Text>
                <Text style={styles.autoValueMono}>{draft?.date_prospection ?? '—'}</Text>
              </View>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>N° message</Text>
                <TextInput value={nMessage} onChangeText={setNMessage} style={styles.autoInputMono} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Station</Text>
              <TextInput value={stationLibre} onChangeText={setStationLibre} style={styles.input} />
            </View>

            <View style={styles.row}>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Latitude S</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS...</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{latitude || '—'}</Text>
                )}
                {gpsError ? (
                  <Text style={styles.gpsErrorText}>{gpsError}</Text>
                ) : null}
              </View>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Longitude E</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS...</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{longitude || '—'}</Text>
                )}
                {gpsError ? (
                  <Text style={styles.gpsErrorText}>{gpsError}</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.sectionLabel}>Type de station (biotope)</Text>
            <View style={styles.chipsRow}>
              {BIOTOPE_EXTENSIVE_OPTIONS.map((option) => {
                const active = option.value === typeStation;
                return (
                  <TouchableOpacity key={option.value} onPress={() => setTypeStation(option.value)} activeOpacity={0.7}>
                    <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { marginTop: 10 }]}>
              <Text style={styles.label}>Surf. (ha)</Text>
              <TextInput
                value={surfaceStation}
                onChangeText={setSurfaceStation}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <Text style={styles.hintText}>Vert = auto-rempli par GPS/session ; blanc = à confirmer ou saisir.</Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Suivant : Imagos ›</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  quoteBanner: { backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 10, padding: 11, marginBottom: 10 },
  quoteText: { fontSize: 11.5, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  autoCard: { backgroundColor: AUTO_BG, borderRadius: 10, padding: 9, marginBottom: 8 },
  autoLabel: { fontSize: 9, fontWeight: '600', color: GREEN, textTransform: 'uppercase' },
  autoValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  autoValueMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  autoInputMono: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9, marginBottom: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, padding: 0 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4, marginBottom: 7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { 
    fontSize: 11.5, 
    fontWeight: '600', 
    color: TEXT_SECONDARY, 
    backgroundColor: INACTIVE_BG, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    overflow: 'hidden' 
  },
  chipActive: { 
    backgroundColor: GREEN, 
    color: '#fff', 
    fontWeight: '700' 
  },
  hintText: { fontSize: 10.5, color: '#9a9484', marginTop: 8, marginBottom: 10 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  gpsLoading: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: TEXT_SECONDARY,
    fontStyle: 'italic'
  },
  gpsErrorText: { 
    fontSize: 10, 
    color: '#d32f2f',
    marginTop: 2
  },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
