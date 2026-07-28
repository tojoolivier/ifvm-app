import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProspection, updateProspectionEssaim, DraftProspection } from '@/lib/prospection-repository';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

const ESSAIM_TYPES = [
  { value: 'clair', label: 'Clair' },
  { value: 'dense', label: 'Dense' },
  { value: 'tres_dense', label: 'Très dense' },
];

const DIRECTIONS = [
  'N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'
];

type NextRoute = 'vegetation' | 'pullulation' | 'recapitulatif';

export default function EssaimScreen() {
  const router = useRouter();
  const { draftId, next } = useLocalSearchParams<{ draftId: string; next?: NextRoute }>();

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [essaimType, setEssaimType] = useState<string | null>(null);
  const [directionDe, setDirectionDe] = useState<string | null>(null);
  const [directionVers, setDirectionVers] = useState<string | null>(null);
  const [essaimPose, setEssaimPose] = useState<boolean | null>(null);
  const [surfaceContaminee, setSurfaceContaminee] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then((row) => {
      setDraft(row);
      if (row) {
        setEssaimType(row.essaim_type);
        setDirectionDe(row.essaim_vol_dir_de);
        setDirectionVers(row.essaim_vol_dir_vers);
        setEssaimPose(row.essaim_pose);
        setSurfaceContaminee(row.surface_contaminee?.toString() ?? '');
      }
    });
  }, [draftId]);

  const handleContinuer = async () => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateProspectionEssaim(draft.id, {
        essaim_type: essaimType,
        essaim_vol_dir_de: directionDe,
        essaim_vol_dir_vers: directionVers,
        essaim_pose: essaimPose,
        surface_contaminee: surfaceContaminee ? Number(surfaceContaminee) : null,
      });
      
      const nextRoute = next ?? 'vegetation';
      router.push({
        // @ts-ignore
        pathname: `/(prospection)/${nextRoute}`,
        params: { draftId: draft.id }
      });
    } catch (error) {
      console.error('Erreur sauvegarde essaim:', error);
      setSaveError('Impossible d\'enregistrer les données essaim');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    // Déterminer d'où on vient
    const hasPullulation = draft.pullulation_nb != null || draft.interdistance != null || draft.taille_info;
    const backRoute = hasPullulation ? 'pullulation' : 'infestation-comportement';
    router.push({
      // @ts-ignore
      pathname: `/(prospection)/${backRoute}`,
      params: { draftId: draft.id }
    });
  };

  const hasSelection = essaimType !== null || directionDe !== null || directionVers !== null || essaimPose !== null;

  if (!draft) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TouchableOpacity onPress={handleRetour} activeOpacity={0.7}>
          <Text style={styles.backLink}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Essaim</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '92%' }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Étape 4/4</Text>
          {hasSelection && (
            <Text style={styles.progressCount}>✅ Renseigné</Text>
          )}
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Contexte */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Contexte</Text>
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Surface infestée</Text>
            <Text style={styles.contextValue}>
              {draft.surf_infestee != null ? `${draft.surf_infestee} ha` : '—'}
            </Text>
          </View>
          {draft.surface_contaminee != null && (
            <View style={styles.contextRow}>
              <Text style={styles.contextLabel}>Déjà contaminée</Text>
              <Text style={styles.contextValue}>{draft.surface_contaminee} ha</Text>
            </View>
          )}
        </View>

        {/* Type d'essaim */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type d'essaim</Text>
          <View style={styles.chipsRow}>
            {ESSAIM_TYPES.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.chip, essaimType === option.value && styles.chipActive]}
                onPress={() => setEssaimType(essaimType === option.value ? null : option.value)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, essaimType === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Direction de provenance */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Direction de provenance</Text>
          <View style={styles.chipsRow}>
            {DIRECTIONS.map((dir) => (
              <TouchableOpacity
                key={dir}
                style={[styles.chip, directionDe === dir && styles.chipActive]}
                onPress={() => setDirectionDe(directionDe === dir ? null : dir)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, directionDe === dir && styles.chipTextActive]}>
                  {dir}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Direction de déplacement */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Direction de déplacement</Text>
          <View style={styles.chipsRow}>
            {DIRECTIONS.map((dir) => (
              <TouchableOpacity
                key={dir}
                style={[styles.chip, directionVers === dir && styles.chipActive]}
                onPress={() => setDirectionVers(directionVers === dir ? null : dir)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, directionVers === dir && styles.chipTextActive]}>
                  {dir}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Essaim posé */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Essaim posé</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btnPose, essaimPose === true && styles.btnPoseActive]}
              onPress={() => setEssaimPose(essaimPose === true ? null : true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnPoseText, essaimPose === true && styles.btnPoseTextActive]}>
                Oui ✅
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPose, essaimPose === false && styles.btnPoseActive]}
              onPress={() => setEssaimPose(essaimPose === false ? null : false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnPoseText, essaimPose === false && styles.btnPoseTextActive]}>
                Non ❌
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Surface contaminée */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Surface contaminée (ha)</Text>
          <TextInput
            style={[styles.input, surfaceContaminee ? styles.inputFilled : null]}
            value={surfaceContaminee}
            onChangeText={setSurfaceContaminee}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Résumé */}
        {hasSelection && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Résumé</Text>
            {essaimType && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>
                  {ESSAIM_TYPES.find(o => o.value === essaimType)?.label}
                </Text>
              </View>
            )}
            {directionDe && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Provenance</Text>
                <Text style={styles.summaryValue}>{directionDe}</Text>
              </View>
            )}
            {directionVers && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Direction</Text>
                <Text style={styles.summaryValue}>{directionVers}</Text>
              </View>
            )}
            {essaimPose != null && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Posé</Text>
                <Text style={styles.summaryValue}>{essaimPose ? 'Oui' : 'Non'}</Text>
              </View>
            )}
            {surfaceContaminee && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Surface contaminée</Text>
                <Text style={styles.summaryValue}>{surfaceContaminee} ha</Text>
              </View>
            )}
          </View>
        )}

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.btnContinuer} 
          onPress={handleContinuer} 
          disabled={isSaving}
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

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  header: { 
    backgroundColor: IFVM_GREEN_DARK, 
    paddingHorizontal: 16, 
    paddingBottom: 14 
  },
  backLink: { 
    color: '#FFFFFFCC', 
    fontSize: 13, 
    marginBottom: 6 
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 10 
  },
  progressTrack: { 
    height: 4, 
    backgroundColor: '#FFFFFF33', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: 4, 
    backgroundColor: '#FFFFFF' 
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
  },
  progressCount: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '600',
  },
  content: { 
    flex: 1 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase' 
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  contextLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  contextValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  chipsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipActive: { 
    backgroundColor: IFVM_GREEN_LIGHT, 
    borderColor: IFVM_GREEN 
  },
  chipText: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  chipTextActive: { 
    color: IFVM_GREEN_DARK 
  },
  row: { 
    flexDirection: 'row', 
    gap: 12 
  },
  btnPose: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  btnPoseActive: { 
    backgroundColor: IFVM_GREEN, 
    borderColor: IFVM_GREEN 
  },
  btnPoseText: { 
    color: '#111827', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  btnPoseTextActive: { 
    color: '#FFFFFF' 
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputFilled: {
    borderColor: IFVM_GREEN,
    backgroundColor: IFVM_GREEN_LIGHT,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  summaryValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
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
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    flex: 1,
  },
  btnContinuer: { 
    backgroundColor: IFVM_GREEN, 
    borderRadius: 10, 
    paddingVertical: 16, 
    alignItems: 'center', 
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  btnContinuerText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
});