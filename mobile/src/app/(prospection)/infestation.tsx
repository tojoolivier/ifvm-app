import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TYPE_CIBLE_OPTIONS } from '@/lib/prospection-fiche-lecture';
import { InfestationRow, listAllProspectionInfestations, saveProspectionInfestation } from '@/lib/prospection-repository';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#f6f3e9';

interface FormationForm {
  tailleMin: string;
  tailleMax: string;
  tailleMoy: string;
  surfTot: string;
  densMin: string;
  densMax: string;
  densMoy: string;
  interdistance: string;
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
    interdistance: '',
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
    interdistance: row.interdistance != null ? String(row.interdistance) : '',
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
    interdistance: numOrNull(form.interdistance),
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

export default function InfestationScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const [forms, setForms] = useState<Record<string, FormationForm> | null>(null);
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

  const setField = <K extends keyof FormationForm>(typeCible: string, field: K, value: FormationForm[K]) => {
    setForms((current) => (current ? { ...current, [typeCible]: { ...current[typeCible], [field]: value } } : current));
  };

  const handleContinue = async () => {
    if (!draftId || isSaving) return;
    setIsSaving(true);
    try {
      for (const option of TYPE_CIBLE_OPTIONS) {
        const form = forms[option.value];
        if (!isFilled(form)) continue;
        await saveProspectionInfestation(draftId, option.value, rowFromForm(option.value, form));
      }
      router.push({ pathname: '/(prospection)/veg' as any, params: { draftId } });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Infestation</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.hint}>Décrivez chaque formation observée (taches, bandes, vols, essaims).</Text>

          {TYPE_CIBLE_OPTIONS.map((option) => {
            const form = forms[option.value];
            return (
              <View key={option.value} style={styles.card}>
                <Text style={styles.cardTitle}>{option.label}</Text>

                <Text style={styles.fieldGroupLabel}>Taille (min / max / moy)</Text>
                <View style={styles.row3}>
                  <TextInput
                    value={form.tailleMin}
                    onChangeText={(v) => setField(option.value, 'tailleMin', v)}
                    placeholder="min"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                  <TextInput
                    value={form.tailleMax}
                    onChangeText={(v) => setField(option.value, 'tailleMax', v)}
                    placeholder="max"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                  <TextInput
                    value={form.tailleMoy}
                    onChangeText={(v) => setField(option.value, 'tailleMoy', v)}
                    placeholder="moy"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                </View>

                <Text style={styles.fieldGroupLabel}>Surf. tot (ha)</Text>
                <TextInput
                  value={form.surfTot}
                  onChangeText={(v) => setField(option.value, 'surfTot', v)}
                  keyboardType="decimal-pad"
                  style={styles.fullInput}
                />

                <Text style={styles.fieldGroupLabel}>Densité (min / max / moy)</Text>
                <View style={styles.row3}>
                  <TextInput
                    value={form.densMin}
                    onChangeText={(v) => setField(option.value, 'densMin', v)}
                    placeholder="min"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                  <TextInput
                    value={form.densMax}
                    onChangeText={(v) => setField(option.value, 'densMax', v)}
                    placeholder="max"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                  <TextInput
                    value={form.densMoy}
                    onChangeText={(v) => setField(option.value, 'densMoy', v)}
                    placeholder="moy"
                    keyboardType="decimal-pad"
                    style={styles.smallInput}
                  />
                </View>

                <Text style={styles.fieldGroupLabel}>Interdistance</Text>
                <TextInput
                  value={form.interdistance}
                  onChangeText={(v) => setField(option.value, 'interdistance', v)}
                  keyboardType="decimal-pad"
                  style={styles.fullInput}
                />

                <Text style={styles.fieldGroupLabel}>Comportement</Text>
                <View style={styles.row2}>
                  {(['repos', 'deplacement'] as const).map((value) => {
                    const active = form.comportement === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() => setField(option.value, 'comportement', value)}
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

                <View style={styles.row2}>
                  <TextInput
                    value={form.ventDe}
                    onChangeText={(v) => setField(option.value, 'ventDe', v)}
                    placeholder="Direction de"
                    style={styles.fullInput}
                  />
                  <TextInput
                    value={form.ventVers}
                    onChangeText={(v) => setField(option.value, 'ventVers', v)}
                    placeholder="Direction vers"
                    style={styles.fullInput}
                  />
                </View>
                <TextInput
                  value={form.ventVitesse}
                  onChangeText={(v) => setField(option.value, 'ventVitesse', v)}
                  placeholder="Vitesse du vent"
                  keyboardType="decimal-pad"
                  style={styles.fullInput}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>Végétation  ›</Text>
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
  scroll: { flex: 1 },
  hint: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, marginBottom: 11 },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: TEXT, marginBottom: 9 },
  fieldGroupLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, marginTop: 7 },
  row3: { flexDirection: 'row', gap: 7 },
  row2: { flexDirection: 'row', gap: 7, marginTop: 7 },
  smallInput: { flex: 1, backgroundColor: INACTIVE_BG, borderRadius: 6, padding: 7, fontSize: 11.5, fontWeight: '600', color: TEXT },
  fullInput: { flex: 1, backgroundColor: INACTIVE_BG, borderRadius: 6, padding: 7, fontSize: 11, fontWeight: '600', color: TEXT, marginTop: 7 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 7, backgroundColor: INACTIVE_BG },
  chipActive: { backgroundColor: GREEN },
  chipText: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextActive: { fontWeight: '700', color: '#fff' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
