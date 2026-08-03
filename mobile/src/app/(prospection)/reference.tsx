import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { getCurrentPosition, reverseGeocode, GpsPosition, LocationPermissionDeniedError } from '@/lib/location';
import {
  findNearestStation,
  listPostesAcridiens,
  listStationsByPoste,
  PosteAcridien,
  StationFixe,
} from '@/lib/referentiel-db';
import { updateProspectionReference } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { referenceSchema, ReferenceFormValues } from '@/lib/prospection-reference-schema';

const INACTIVE_BG = '#efeada';
const INACTIVE_TEXT = '#9a9484';
const GPS_BADGE_BG = '#eaf2ec';

type SelectMode = 'auto' | 'manuel';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

function generateNumeroFiche(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `FI-${datePart}-${idPart}`;
}

/** N° relevé — dérivé de la station/session GPS résolue (PDF champ 1), jamais saisi manuellement. */
function generateNumeroReleve(stationId: string | null, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const stationPart = (stationId ?? 'XXX').replace(/-/g, '').slice(0, 6).toUpperCase();
  return `REL-${stationPart}-${datePart}`;
}

function formatDateHeure(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export default function ReferenceScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);

  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [adminArea, setAdminArea] = useState<{ region: string | null; district: string | null; commune: string | null }>({
    region: null,
    district: null,
    commune: null,
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [postes, setPostes] = useState<PosteAcridien[]>([]);
  const [stationsForPa, setStationsForPa] = useState<StationFixe[]>([]);
  const [paMode, setPaMode] = useState<SelectMode>('auto');
  const [stationMode, setStationMode] = useState<SelectMode>('auto');
  const [pa, setPa] = useState<PosteAcridien | null>(null);
  const [station, setStation] = useState<StationFixe | null>(null);
  const [autoPa, setAutoPa] = useState<PosteAcridien | null>(null);
  const [autoStation, setAutoStation] = useState<StationFixe | null>(null);

  const paModeRef = useRef<SelectMode>('auto');
  const stationModeRef = useRef<SelectMode>('auto');
  useEffect(() => {
    paModeRef.current = paMode;
  }, [paMode]);
  useEffect(() => {
    stationModeRef.current = stationMode;
  }, [stationMode]);

  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      hydrateFromDraft(draftId);
    }
  }, [draftId, draft?.id, hydrateFromDraft]);

  useEffect(() => {
    listPostesAcridiens().then(setPostes).catch(() => {});
  }, []);

  useEffect(() => {
    getCurrentPosition()
      .then(async (pos) => {
        setPosition(pos);
        const [area, nearestStation, postesList] = await Promise.all([
          reverseGeocode(pos.latitude, pos.longitude),
          findNearestStation(pos.latitude, pos.longitude),
          listPostesAcridiens(),
        ]);
        setAdminArea(area);
        if (!nearestStation) return;
        const nearestPa = postesList.find((p) => p.id === nearestStation.paId) ?? null;
        setAutoStation(nearestStation);
        setAutoPa(nearestPa);
        if (nearestPa && paModeRef.current === 'auto') {
          await applyPa(nearestPa);
          if (stationModeRef.current === 'auto') setStation(nearestStation);
        }
      })
      .catch((e) => {
        setLocationError(
          e instanceof LocationPermissionDeniedError
            ? 'Permission de localisation refusée'
            : 'Position GPS indisponible'
        );
      });
  }, []);

  async function applyPa(poste: PosteAcridien): Promise<StationFixe[]> {
    setPa(poste);
    const list = await listStationsByPoste(poste.id);
    setStationsForPa(list);
    return list;
  }

  async function setPaAuto() {
    setPaMode('auto');
    if (!autoPa) return;
    await applyPa(autoPa);
    if (stationModeRef.current === 'auto' && autoStation) setStation(autoStation);
  }

  function setPaManuel() {
    setPaMode('manuel');
  }

  async function selectPa(poste: PosteAcridien) {
    const list = await applyPa(poste);
    setStation((current) => (current && list.some((s) => s.id === current.id) ? current : list[0] ?? null));
  }

  function setStationAuto() {
    setStationMode('auto');
    if (autoStation) setStation(autoStation);
  }

  function setStationManuel() {
    setStationMode('manuel');
  }

  function selectStation(next: StationFixe) {
    setStation(next);
    setStationMode('manuel');
  }

  const form = useForm({
    defaultValues: {
      surfStation: draft?.surf_station != null ? String(draft.surf_station) : '',
      surfProspectee: draft?.surf_prospectee != null ? String(draft.surf_prospectee) : '',
      surfInfestee: draft?.surf_infestee != null ? String(draft.surf_infestee) : '',
    } as ReferenceFormValues,
    onSubmit: async ({ value }) => {
      if (!draftId) return;
      try {
        await referenceSchema.validate(value, { abortEarly: false });
      } catch (validationError: any) {
        const errors: Record<string, string> = {};
        for (const err of validationError.inner ?? []) {
          if (err.path) errors[err.path] = err.message;
        }
        setFormErrors(errors);
        return;
      }
      setFormErrors({});
      setIsSaving(true);
      try {
        const dateProspection = draft?.date_prospection ?? new Date().toISOString().slice(0, 10);
        const nFiche = generateNumeroFiche(draftId, dateProspection);
        const nReleve = generateNumeroReleve(station?.id ?? null, dateProspection);
        const updated = await updateProspectionReference(draftId, {
          latitude: position?.latitude ?? 0,
          longitude: position?.longitude ?? 0,
          altitude: position?.altitude ?? null,
          surfStation: Number(value.surfStation),
          surfProspectee: Number(value.surfProspectee),
          surfInfestee: Number(value.surfInfestee),
          nFiche,
          nReleve,
          region: adminArea.region,
          district: adminArea.district,
          commune: adminArea.commune,
          pa_code: pa?.code ?? null,
          pa_nom: pa?.nom ?? null,
          stationId: station?.id ?? null,
          station_nom: station?.nom ?? null,
        });
        setDraft(updated);
        router.push({ pathname: '/(prospection)/species' as any, params: { draftId } });
      } finally {
        setIsSaving(false);
      }
    },
  });

  const nFichePreview = draftId ? generateNumeroFiche(draftId, draft?.date_prospection ?? '') : '—';
  const nRelevePreview = generateNumeroReleve(station?.id ?? null, draft?.date_prospection ?? '');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nouvelle prospection</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
          <View style={styles.progressBar} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.gpsCard}>
            <View style={styles.gpsHeaderRow}>
              <Text style={styles.gpsTitle}>📍 Position acquise</Text>
              <View style={styles.accuracyBadge}>
                <Text style={styles.accuracyText}>
                  {position?.accuracy != null ? `± ${Math.round(position.accuracy)} m` : '…'}
                </Text>
              </View>
            </View>
            <View style={styles.gpsFieldsRow}>
              <View style={styles.gpsField}>
                <Text style={styles.gpsFieldLabel}>Latitude</Text>
                <Text style={styles.gpsFieldValue}>{position ? position.latitude.toFixed(4) : '—'}</Text>
              </View>
              <View style={styles.gpsField}>
                <Text style={styles.gpsFieldLabel}>Longitude</Text>
                <Text style={styles.gpsFieldValue}>{position ? position.longitude.toFixed(4) : '—'}</Text>
              </View>
              <View style={[styles.gpsField, { flex: 0.75 }]}>
                <Text style={styles.gpsFieldLabel}>Alt.</Text>
                <Text style={styles.gpsFieldValue}>{position?.altitude != null ? Math.round(position.altitude) : '—'}</Text>
              </View>
            </View>
            <Text style={styles.gpsAdminText}>
              {locationError ??
                ([adminArea.region, adminArea.district, adminArea.commune].filter(Boolean).join(' · ') ||
                  'Localisation en cours…')}
            </Text>
          </View>

          <View style={styles.refCard}>
            <View style={styles.refHeaderRow}>
              <Text style={styles.refLabel}>2. Poste acridien (PA)</Text>
              <View style={styles.toggleTrack}>
                <TouchableOpacity onPress={setPaAuto} activeOpacity={0.7}>
                  <Text style={[styles.toggleSegment, paMode === 'auto' && styles.toggleSegmentActive]}>Auto</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={setPaManuel} activeOpacity={0.7}>
                  <Text style={[styles.toggleSegment, paMode === 'manuel' && styles.toggleSegmentActive]}>Manuel</Text>
                </TouchableOpacity>
              </View>
            </View>
            {paMode === 'auto' ? (
              <View style={styles.autoValueRow}>
                <Text style={styles.autoValueText}>{pa?.nom ?? '…'}</Text>
                <View style={styles.gpsBadge}>
                  <Text style={styles.gpsBadgeText}>📡 via GPS</Text>
                </View>
              </View>
            ) : (
              <View style={styles.chipsRow}>
                {postes.map((poste) => {
                  const active = poste.id === pa?.id;
                  return (
                    <TouchableOpacity key={poste.id} onPress={() => selectPa(poste)} activeOpacity={0.7}>
                      <Text style={[styles.chip, active && styles.chipActive]}>{poste.nom}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.refCard}>
            <View style={styles.refHeaderRow}>
              <Text style={styles.refLabel}>5. Station</Text>
              <View style={styles.toggleTrack}>
                <TouchableOpacity onPress={setStationAuto} activeOpacity={0.7}>
                  <Text style={[styles.toggleSegment, stationMode === 'auto' && styles.toggleSegmentActive]}>
                    Auto
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={setStationManuel} activeOpacity={0.7}>
                  <Text style={[styles.toggleSegment, stationMode === 'manuel' && styles.toggleSegmentActive]}>
                    Manuel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {stationMode === 'auto' ? (
              <View style={styles.autoValueRow}>
                <Text style={styles.autoValueText}>{station?.nom ?? '…'}</Text>
                <View style={styles.gpsBadge}>
                  <Text style={styles.gpsBadgeText}>📡 via GPS</Text>
                </View>
              </View>
            ) : (
              <View style={styles.chipsRow}>
                {stationsForPa.map((s) => {
                  const active = s.id === station?.id;
                  return (
                    <TouchableOpacity key={s.id} onPress={() => selectStation(s)} activeOpacity={0.7}>
                      <Text style={[styles.chip, active && styles.chipActive]}>{s.nom}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaField}>
              <Text style={styles.metaLabel}>N° Fiche ⟳</Text>
              <Text style={styles.metaValue}>{nFichePreview}</Text>
            </View>
            <View style={styles.metaField}>
              <Text style={styles.metaLabel}>N° relevé ⟳</Text>
              <Text style={styles.metaValue}>{nRelevePreview}</Text>
            </View>
            <View style={styles.metaField}>
              <Text style={styles.metaLabel}>Date/heure ⟳</Text>
              <Text style={styles.metaValue}>{formatDateHeure(new Date())}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Surfaces (ha) — saisie</Text>
          <View style={styles.surfacesRow}>
            <form.Field name="surfStation">
              {(field) => (
                <View style={styles.surfaceField}>
                  <Text style={styles.surfaceLabel}>Station</Text>
                  <TextInput
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    keyboardType="decimal-pad"
                    style={styles.surfaceInput}
                  />
                </View>
              )}
            </form.Field>
            <form.Field name="surfProspectee">
              {(field) => (
                <View style={styles.surfaceField}>
                  <Text style={styles.surfaceLabel}>Prospectée</Text>
                  <TextInput
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    keyboardType="decimal-pad"
                    style={styles.surfaceInput}
                  />
                </View>
              )}
            </form.Field>
            <form.Field name="surfInfestee">
              {(field) => (
                <View style={styles.surfaceField}>
                  <Text style={styles.surfaceLabel}>Infestée</Text>
                  <TextInput
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    style={styles.surfaceInput}
                  />
                </View>
              )}
            </form.Field>
          </View>
          {Object.values(formErrors).map((message) => (
            <Text key={message} style={styles.errorText}>
              {message}
            </Text>
          ))}
          <Text style={styles.hintText}>Tapez une valeur — les autres champs se calculent ensuite automatiquement.</Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={form.handleSubmit}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  gpsCard: { backgroundColor: GREEN, borderRadius: 13, padding: 14, marginBottom: 12 },
  gpsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  gpsTitle: { color: '#fff', fontWeight: '700', fontSize: 12 },
  accuracyBadge: { backgroundColor: '#ffffff2e', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  accuracyText: { color: '#fff', fontSize: 9.5, fontWeight: '600' },
  gpsFieldsRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  gpsField: { flex: 1, backgroundColor: '#ffffff1f', borderRadius: 8, padding: 7 },
  gpsFieldLabel: { color: '#ffffffbf', fontSize: 8.5, textTransform: 'uppercase' },
  gpsFieldValue: { color: '#fff', fontWeight: '600', fontSize: 12.5 },
  gpsAdminText: { color: '#ffffffd9', fontSize: 10.5 },
  refCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 13, marginBottom: 11 },
  refHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  refLabel: { fontSize: 9, fontWeight: '700', color: INACTIVE_TEXT, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleTrack: { flexDirection: 'row', backgroundColor: INACTIVE_BG, borderRadius: 8, padding: 2, gap: 2 },
  toggleSegment: {
    fontSize: 9.5,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    color: INACTIVE_TEXT,
    overflow: 'hidden',
  },
  toggleSegmentActive: { backgroundColor: GREEN, color: '#fff' },
  autoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  autoValueText: { fontSize: 15, fontWeight: '700', color: TEXT },
  gpsBadge: { backgroundColor: GPS_BADGE_BG, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  gpsBadgeText: { fontSize: 9, fontWeight: '600', color: GREEN },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    backgroundColor: INACTIVE_BG,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  metaField: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9 },
  metaLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  metaValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', marginBottom: 9 },
  surfacesRow: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  surfaceField: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9 },
  surfaceLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 2 },
  surfaceInput: { fontSize: 18, fontWeight: '700', color: TEXT, padding: 0 },
  hintText: { fontSize: 10.5, color: '#9a9484', paddingHorizontal: 2 },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
