import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { DateField } from '@/components/DateField';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/** Signalement = un rapport externe (citoyen, agent local, autorité) qui déclenche cette prospection de vérification.
 * Il n'existe pas encore de liste de signalements côté serveur (cf. ADR-006) : saisie manuelle en attendant. */
export default function ExtensiveSignalementScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);

  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = source.trim().length > 0 && description.trim().length > 0;

  const startValidation = async () => {
    if (!user || !token || isCreating || !canContinue) return;
    setIsCreating(true);
    setError(null);
    try {
      const draft = await startNewProspection({
        token,
        prospecteurId: user.id,
        typeProspection: 'validation',
        signalementSource: source.trim(),
        signalementDate: date.trim() || null,
        signalementDescription: description.trim(),
      });
      await hydrateFromDraft(draft.id);
      router.replace({ pathname: '/(prospection)/extensive-reference' as any, params: { draftId: draft.id } });
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Impossible de démarrer la vérification (campagne introuvable ou hors-ligne).'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Vérifier un signalement</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.hint}>
            Renseignez le signalement reçu (SMS, appel, agent local) avant de vous rendre sur place.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Source</Text>
            <TextInput
              value={source}
              onChangeText={setSource}
              placeholder="Ex. Rasoanaivo (habitant)"
              placeholderTextColor={TEXT_SECONDARY}
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Date du signalement</Text>
            <DateField
              value={date || null}
              onChange={setDate}
              maximumDate={new Date()}
              style={styles.dateFieldBox}
              textStyle={styles.input}
              placeholderStyle={[styles.input, { color: TEXT_SECONDARY }]}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ce qui a été signalé"
              placeholderTextColor={TEXT_SECONDARY}
              style={[styles.input, styles.multiline]}
              multiline
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={startValidation}
            disabled={!canContinue || isCreating}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{isCreating ? 'Création…' : 'Continuer : Références ›'}</Text>
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
  hint: { fontSize: 11.5, lineHeight: 16, color: TEXT_SECONDARY, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 10 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 4 },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  errorText: { color: '#c0412b', fontSize: 12, marginTop: 4, textAlign: 'center' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
