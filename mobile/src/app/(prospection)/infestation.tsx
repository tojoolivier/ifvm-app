import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TYPE_CIBLE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { InfestationRow, listAllProspectionInfestations, saveProspectionInfestation } from '@/lib/prospection-repository';
import {
  COMPASS_DIRECTIONS,
  comportementInsight,
  densityInsight,
  oppositeDirection,
} from '@/lib/prospection-infestation-insights';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#f6f3e9';
const TARGET_ACTIVE = '#c0412b';

interface FormationForm {
  tailleMin: string;
  tailleMax: string;
  tailleMoy: string;
  surfTot: string;
  densMin: string;
  densMax: string;
  densMoy: string;
  interdistanceMin: string;
  interdistanceMax: string;
  interdistanceMoy: string;
  comportement: 'repos' | 'deplacement' | null;
  ventDe: string;
  ventVers: string;
  ventVitesse: string;
}

function emptyFormation(): FormationForm {
  return {
    tailleMin: '',
    tailleMax: '',
    tailleMoy: '',
    surfTot: '',
    densMin: '',
    densMax: '',
    densMoy: '',
    interdistanceMin: '',
    interdistanceMax: '',
    interdistanceMoy: '',
    comportement: null,
    ventDe: '',
    ventVers: '',
    ventVitesse: '',
  };
}

function formFromRow(row: InfestationRow | undefined): FormationForm {
  if (!row) return emptyFormation();
  return {
    tailleMin: row.taille_min != null ? String(row.taille_min) : '',
    tailleMax: row.taille_max != null ? String(row.taille_max) : '',
    tailleMoy: row.taille_moy != null ? String(row.taille_moy) : '',
    surfTot: row.surface_tot != null ? String(row.surface_tot) : '',
    densMin: row.densite_min != null ? String(row.densite_min) : '',
    densMax: row.densite_max != null ? String(row.densite_max) : '',
    densMoy: row.densite_moy != null ? String(row.densite_moy) : '',
    interdistanceMin: row.interdistance_min != null ? String(row.interdistance_min) : '',
    interdistanceMax: row.interdistance_max != null ? String(row.interdistance_max) : '',
    interdistanceMoy: row.interdistance_moy != null ? String(row.interdistance_moy) : '',
    comportement: (row.comportement as 'repos' | 'deplacement' | null) ?? null,
    ventDe: row.vent_de ?? row.direction_de ?? '',
    ventVers: row.direction_vers ?? '',
    ventVitesse: row.vent_vitesse != null ? String(row.vent_vitesse) : '',
  };
}

function numOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

/**
 * Le PDF ne demande qu'une seule paire "Direction du vent (de / vers)" + vitesse, mais le schéma
 * back-end porte ce concept sur deux paires de colonnes distinctes (`vent_de` seul, et
 * `direction_de`/`direction_vers` — normalement la direction de déplacement de l'essaim). Faute
 * d'un champ dédié pour la saisie de la direction de déplacement dans ce handoff, on duplique la
 * valeur "de" sur les deux colonnes pour ne perdre aucune saisie utilisateur.
 */
function rowFromForm(typeCible: string, form: FormationForm): InfestationRow {
  return {
    espece: null,
    type_cible: typeCible,
    taille_min: numOrNull(form.tailleMin),
    taille_max: numOrNull(form.tailleMax),
    taille_moy: numOrNull(form.tailleMoy),
    surface_tot: numOrNull(form.surfTot),
    densite_min: numOrNull(form.densMin),
    densite_max: numOrNull(form.densMax),
    densite_moy: numOrNull(form.densMoy),
    interdistance: null,
    interdistance_min: numOrNull(form.interdistanceMin),
    interdistance_max: numOrNull(form.interdistanceMax),
    interdistance_moy: numOrNull(form.interdistanceMoy),
    comportement: form.comportement,
    direction_de: form.ventDe || null,
    direction_vers: form.ventVers || null,
    vent_de: form.ventDe || null,
    vent_vitesse: numOrNull(form.ventVitesse),
    pullulation_nb: null,
    taille_long: null,
    taille_large: null,
    taille_epaisseur: null,
    essaim_en_vol: null,
    essaim_pose: null,
    type_essaim: null,
    nb_taches_bandes: null,
    interdistance_m: null,
    surface_contaminee_ha: null,
    type_larve: null,
    surf_infestee_pourcent: null,
  };
}

/** Une formation est considérée renseignée si sa surface totale ou sa densité moyenne est saisie. */
function isFilled(form: FormationForm): boolean {
  return form.surfTot !== '' || form.densMoy !== '';
}

type Tab = 'desc' | 'comport';

export default function InfestationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [forms, setForms] = useState<Record<string, FormationForm> | null>(null);
  const [target, setTarget] = useState<string>(TYPE_CIBLE_OPTIONS[0].value);
  const [tab, setTab] = useState<Tab>('desc');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    listAllProspectionInfestations(draftId).then((rows) => {
      const byType = new Map(rows.map((row) => [row.type_cible, row]));
      const next: Record<string, FormationForm> = {};
      for (const option of TYPE_CIBLE_OPTIONS) {
        next[option.value] = formFromRow(byType.get(option.value));
      }
      setForms(next);
    });
  }, [draftId]);

  if (!forms) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const form = forms[target];
  const targetLabel = TYPE_CIBLE_OPTIONS.find((o) => o.value === target)?.label ?? target;
  const setField = <K extends keyof FormationForm>(field: K, value: FormationForm[K]) => {
    setForms((current) => (current ? { ...current, [target]: { ...current[target], [field]: value } } : current));
  };

  const descInsight = densityInsight(numOrNull(form.densMoy));
  const comportInsight = comportementInsight(form.comportement, form.ventVers || null, numOrNull(form.ventVitesse));
  const windTarget = COMPASS_DIRECTIONS.find((d) => d.label === form.ventVers);
  const windAngle = windTarget ? windTarget.deg : 0;
  const windLabel = form.ventDe && form.ventVers ? `${form.ventDe} → ${form.ventVers}` : '—';

  const persistAll = async () => {
    if (!draftId) return;
    for (const option of TYPE_CIBLE_OPTIONS) {
      const f = forms[option.value];
      if (!isFilled(f)) continue;
      await saveProspectionInfestation(draftId, option.value, rowFromForm(option.value, f));
    }
  };

  const handleFooterPress = async () => {
    if (isSaving) return;
    if (tab === 'desc') {
      setTab('comport');
      return;
    }
    setIsSaving(true);
    try {
      await persistAll();
      router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => (tab === 'comport' ? setTab('desc') : router.back())} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {tab === 'desc' ? 'Infestation' : `Comportement · ${targetLabel}`}
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          {tab === 'desc' && (
            <>
              <Text style={styles.sectionLabel}>Type de cible</Text>
              <View style={styles.targetRow}>
                {TYPE_CIBLE_OPTIONS.map((option) => {
                  const active = option.value === target;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setTarget(option.value)}
                      style={[styles.targetChip, active && styles.targetChipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.targetChipText, active && styles.targetChipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.toggleTrack}>
                <TouchableOpacity onPress={() => setTab('desc')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                  <Text style={[styles.toggleSegment, tab === 'desc' && styles.toggleSegmentActive]}>Description</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('comport')} activeOpacity={0.7} style={styles.toggleSegmentTouchable}>
                  <Text style={styles.toggleSegment}>Comportement</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {tab === 'desc' && (
            <View style={styles.card}>
              <View style={styles.row2NoMargin}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Taille</Text>
                  <TextInput
                    value={form.tailleMoy}
                    onChangeText={(v) => setField('tailleMoy', v)}
                    style={styles.infoBoxInput}
                  />
                </View>
                <View style={[styles.infoBox, styles.infoBoxHighlighted]}>
                  <Text style={styles.infoBoxLabel}>Surface totale</Text>
                  <View style={styles.infoBoxInputRow}>
                    <TextInput
                      value={form.surfTot}
                      onChangeText={(v) => setField('surfTot', v)}
                      keyboardType="decimal-pad"
                      style={styles.infoBoxInput}
                    />
                    <Text style={styles.infoBoxUnit}>ha</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Densité (/m²)</Text>
              <View style={styles.row3}>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>min</Text>
                  <TextInput
                    value={form.densMin}
                    onChangeText={(v) => setField('densMin', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>max</Text>
                  <TextInput
                    value={form.densMax}
                    onChangeText={(v) => setField('densMax', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={[styles.box, styles.boxEmphasis]}>
                  <Text style={[styles.boxCaption, styles.boxCaptionEmphasis]}>moy</Text>
                  <TextInput
                    value={form.densMoy}
                    onChangeText={(v) => setField('densMoy', v)}
                    keyboardType="decimal-pad"
                    style={[styles.boxValue, styles.boxValueEmphasis]}
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Interdistance (m)</Text>
              <View style={styles.row3}>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>min</Text>
                  <TextInput
                    value={form.interdistanceMin}
                    onChangeText={(v) => setField('interdistanceMin', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>max</Text>
                  <TextInput
                    value={form.interdistanceMax}
                    onChangeText={(v) => setField('interdistanceMax', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
                <View style={styles.box}>
                  <Text style={styles.boxCaption}>moy</Text>
                  <TextInput
                    value={form.interdistanceMoy}
                    onChangeText={(v) => setField('interdistanceMoy', v)}
                    keyboardType="decimal-pad"
                    style={styles.boxValue}
                  />
                </View>
              </View>

              {descInsight && (
                <View style={styles.insightCallout}>
                  <Text style={styles.insightText}>{descInsight}</Text>
                </View>
              )}
            </View>
          )}

          {tab === 'comport' && (
            <View style={styles.card}>
              <Text style={styles.fieldGroupLabel}>État</Text>
              <View style={styles.row2}>
                {(['repos', 'deplacement'] as const).map((value) => {
                  const active = form.comportement === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setField('comportement', value)}
                      style={[styles.chip, active && styles.chipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {value === 'repos' ? 'Repos' : 'Déplacement'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldGroupLabel}>Direction du déplacement</Text>
              <View style={styles.compassCard}>
                <View style={styles.compassCircle}>
                  <Text style={[styles.compassCardinal, styles.compassCardinalN]}>N</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalS]}>S</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalO]}>O</Text>
                  <Text style={[styles.compassCardinal, styles.compassCardinalE]}>E</Text>
                  <View style={[styles.compassArrow, { transform: [{ rotate: `${windAngle}deg` }] }]} />
                  <View style={styles.compassArrowDot} />
                </View>
                <View style={styles.compassChips}>
                  {COMPASS_DIRECTIONS.map((dir) => {
                    const active = dir.label === form.ventDe;
                    return (
                      <TouchableOpacity
                        key={dir.label}
                        onPress={() => {
                          setField('ventDe', dir.label);
                          setField('ventVers', oppositeDirection(dir.label));
                        }}
                        style={[styles.compassChip, active && styles.compassChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.compassChipText, active && styles.compassChipTextActive]}>{dir.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Vent</Text>
                <View style={styles.row2NoMargin}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Direction</Text>
                    <Text style={styles.infoBoxValue}>{windLabel}</Text>
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxLabel}>Vitesse</Text>
                    <View style={styles.infoBoxInputRow}>
                      <TextInput
                        value={form.ventVitesse}
                        onChangeText={(v) => setField('ventVitesse', v)}
                        keyboardType="decimal-pad"
                        style={styles.infoBoxInput}
                      />
                      <Text style={styles.infoBoxUnit}>km/h</Text>
                    </View>
                  </View>
                </View>
              </View>

              {comportInsight && (
                <View style={styles.insightCallout}>
                  <Text style={styles.insightText}>{comportInsight}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleFooterPress} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>{tab === 'desc' ? 'Comportement  ›' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 28, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 20, fontWeight: '800', color: TEXT },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 10 },
  targetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  targetChip: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 22,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  targetChipActive: { backgroundColor: TARGET_ACTIVE, borderColor: TARGET_ACTIVE },
  targetChipText: { fontSize: 16, fontWeight: '700', color: TEXT },
  targetChipTextActive: { fontWeight: '800', color: '#fff' },
  toggleTrack: { flexDirection: 'row', backgroundColor: INACTIVE_BG, borderRadius: 14, padding: 4, gap: 4, marginBottom: 20 },
  toggleSegmentTouchable: { flex: 1 },
  toggleSegment: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 11,
    color: '#9a9484',
  },
  toggleSegmentActive: { backgroundColor: '#fff', color: TEXT },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 12 },
  fieldGroupLabel: { fontSize: 12, fontWeight: '700', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 18 },
  row3: { flexDirection: 'row', gap: 9 },
  row2: { flexDirection: 'row', gap: 9, marginTop: 10 },
  row2NoMargin: { flexDirection: 'row', gap: 9 },
  box: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, minHeight: 82 },
  boxCaption: { fontSize: 13, fontWeight: '500', color: '#9a9484', marginBottom: 4 },
  boxCaptionEmphasis: { color: 'rgba(255,255,255,0.75)' },
  boxValue: { fontSize: 24, fontWeight: '700', color: TEXT, padding: 0 },
  boxValueEmphasis: { color: '#fff' },
  boxEmphasis: { backgroundColor: GREEN, borderColor: GREEN },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 12, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 15, fontWeight: '700', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '800', color: '#fff' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 27, paddingVertical: 19, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  insightCallout: { backgroundColor: '#fbeae6', borderRadius: 12, padding: 14, marginTop: 14 },
  insightText: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: '#a8422c' },
  compassCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 16, marginTop: 10 },
  compassCircle: { width: 190, height: 190, alignSelf: 'center', borderWidth: 2, borderColor: BORDER, borderRadius: 95, marginBottom: 14 },
  compassCardinal: { position: 'absolute', fontSize: 13, fontWeight: '700', color: '#9a9484' },
  compassCardinalN: { top: 6, left: '50%', marginLeft: -6 },
  compassCardinalS: { bottom: 6, left: '50%', marginLeft: -6 },
  compassCardinalO: { left: 10, top: '50%', marginTop: -8 },
  compassCardinalE: { right: 10, top: '50%', marginTop: -8 },
  compassArrow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 3,
    height: 66,
    backgroundColor: TARGET_ACTIVE,
    marginLeft: -1.5,
    marginTop: -66,
    transformOrigin: 'bottom center',
  } as any,
  compassArrowDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 11,
    height: 11,
    borderRadius: 5.5,
    marginLeft: -5.5,
    marginTop: -5.5,
    backgroundColor: TARGET_ACTIVE,
  },
  compassChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  compassChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, backgroundColor: INACTIVE_BG },
  compassChipActive: { backgroundColor: TARGET_ACTIVE },
  compassChipText: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY },
  compassChipTextActive: { fontWeight: '800', color: '#fff' },
  infoBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12, minHeight: 82 },
  infoBoxHighlighted: { borderWidth: 2, borderColor: GREEN },
  infoBoxLabel: { fontSize: 13, fontWeight: '500', color: '#9a9484', marginBottom: 4 },
  infoBoxValue: { fontSize: 20, fontWeight: '700', color: TEXT },
  infoBoxInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  infoBoxInput: { flex: 1, fontSize: 24, fontWeight: '700', color: TEXT, padding: 0 },
  infoBoxUnit: { fontSize: 13, fontWeight: '600', color: '#9a9484' },
});
