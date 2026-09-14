import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFicheVol, updateFicheVolEquipe } from '@/lib/fiche-vol-repository';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Fiche de Vol — B. Équipe (#fiche-vol). Pilote, mécanicien et chef de base
 * sont tous en saisie libre (externes à l'IFVM ou, pour chef de base, aligné
 * sur cette même convention depuis la migration backend 0064 — décision
 * produit du 2026-09-14, cf. `fiche-vol-repository.ts`). Consultant FAO reste
 * facultatif, comme sur la prospection extensive aérienne.
 *
 * Dernier slide construit pour l'instant (C-Informations sur les Bases à
 * venir) : « Enregistrer » sauvegarde localement et revient à l'accueil,
 * plutôt qu'un « Suivant » vers un écran qui n'existe pas encore.
 */
export default function FicheVolEquipeScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [pilote, setPilote] = useState('');
  const [chefDeBase, setChefDeBase] = useState('');
  const [consultantFao, setConsultantFao] = useState('');
  const [mecanicien, setMecanicien] = useState('');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('fiche-vol-equipe');

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!draftId) return;
      const draft = await getFicheVol(draftId);
      if (!isMounted || !draft) return;

      setPilote(draft.pilote ?? '');
      setChefDeBase(draft.chef_de_base ?? '');
      setConsultantFao(draft.consultant_international ?? '');
      setMecanicien(draft.mecanicien ?? '');
      setIsDraftLoaded(true);
    };

    void init().catch((error) => signalerChargement(error, { draftId }));

    return () => {
      isMounted = false;
    };
  }, [draftId, signalerChargement]);

  const handleEnregistrer = () => {
    return run(
      async () => {
        await updateFicheVolEquipe(draftId, {
          pilote: pilote || null,
          chefDeBase: chefDeBase || null,
          consultantInternational: consultantFao || null,
          mecanicien: mecanicien || null,
        });
        router.replace('/(app)');
      },
      {
        screen: 'fiche-vol-equipe',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Fiche de Vol</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.sectionLabel}>B · Équipe</Text>

            <View style={styles.card}>
              <Text style={styles.label}>Pilote</Text>
              <TextInput
                value={pilote}
                onChangeText={setPilote}
                placeholder="Nom du pilote"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Chef de Base</Text>
              <TextInput
                value={chefDeBase}
                onChangeText={setChefDeBase}
                placeholder="Nom du chef de base"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Consultant FAO</Text>
              <TextInput
                value={consultantFao}
                onChangeText={setConsultantFao}
                placeholder="Facultatif"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Mécanicien</Text>
              <TextInput
                value={mecanicien}
                onChangeText={setMecanicien}
                placeholder="Nom du mécanicien"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, (isSaving || !isDraftLoaded) && styles.continueButtonDisabled]}
              onPress={handleEnregistrer}
              disabled={isSaving || !isDraftLoaded}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Enregistrer ✓'}</Text>
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
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 3 },
  input: { fontSize: 15, fontWeight: '700', color: TEXT, padding: 0 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
