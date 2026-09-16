import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { listCampagnesLocal } from '@/lib/referentiel-db';
import { pickCurrentCampagneId } from '@/lib/prospection-accueil';
import { useAsyncAction } from '@/hooks/use-async-action';
import { ReferentialError } from '@/lib/errors';
import { DateField } from '@/components/DateField';
import { BaseAerienneField, type BaseAerienneOption } from '@/components/referentiel/BaseAerienneField';
import { StandRemplissageField, type StandRemplissageOption } from '@/components/referentiel/StandRemplissageField';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * En-tête d'une fiche de vol (#fiche-vol-creation-mobile) — une fiche de vol
 * regroupe tous les vols d'un hélicoptère pour une date donnée (ADR-011) ;
 * cet écran ne crée que l'en-tête (équipage, base de rattachement,
 * hélicoptère) : la saisie des vols eux-mêmes (chrono, MEP/Application/
 * Prospection, Convoyage/Divers) sera son propre chantier, à la suite.
 *
 * Création en ligne uniquement, comme `BaseAerienneField`/`StandRemplissageField`
 * — pas de `syncPush` ici : `numero_fiche` est généré côté serveur.
 */
export default function FicheVolCreationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const { run, isRunning: isSaving } = useAsyncAction();

  const [dateVol, setDateVol] = useState<string | null>(todayIso());
  const [compagnie, setCompagnie] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [pilote, setPilote] = useState('');
  const [mecanicien, setMecanicien] = useState('');
  const [consultantInternational, setConsultantInternational] = useState('');
  const [observations, setObservations] = useState('');

  const [baseId, setBaseId] = useState<string | null>(null);
  const [standId, setStandId] = useState<string | null>(null);
  // #equipe-aerienne : le chef de base n'est plus choisi séparément — il est
  // dérivé de la base choisie (base -> équipe -> chef de base), puisqu'une
  // équipe aérienne = un chef de base = une base principale (migration 0066).
  const [chefDeBaseId, setChefDeBaseId] = useState<string | null>(null);
  const [chefDeBaseNom, setChefDeBaseNom] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { run: runChef, isRunning: isChefLoading } = useAsyncAction();

  const onChangeBase = (id: string, option: BaseAerienneOption) => {
    setBaseId(id);
    setChefDeBaseId(null);
    setChefDeBaseNom(null);
    void runChef(
      async () => {
        const equipeId =
          option.parent_base_id === null
            ? option.equipe_id
            : (await apiClient.listBasesAeriennes(token!)).find((b) => b.id === option.parent_base_id)
                ?.equipe_id ?? null;
        if (!equipeId) {
          throw new ReferentialError("Cette base n'a pas d'équipe aérienne rattachée.");
        }
        const equipe = (await apiClient.listEquipesAeriennes(token!)).find((e) => e.id === equipeId);
        if (!equipe) {
          throw new ReferentialError('Équipe aérienne introuvable pour cette base.');
        }
        const chef = (await apiClient.listChefsDeBase(token!)).find((c) => c.id === equipe.chef_de_base_id);
        setChefDeBaseId(equipe.chef_de_base_id);
        setChefDeBaseNom(chef ? `${chef.prenom} ${chef.nom}` : equipe.chef_de_base_id);
      },
      { screen: 'fiche-vol-creation', precondition: !!token }
    );
  };
  const onChangeStand = (id: string, _option: StandRemplissageOption) => setStandId(id);

  const submit = () => {
    const errors: Record<string, string> = {};
    if (!dateVol) errors.dateVol = 'Renseignez la date du vol.';
    if (!compagnie.trim()) errors.compagnie = 'Renseignez la compagnie.';
    if (!immatriculation.trim()) errors.immatriculation = "Renseignez l'immatriculation.";
    if (!pilote.trim()) errors.pilote = 'Renseignez le pilote.';
    if (!mecanicien.trim()) errors.mecanicien = 'Renseignez le mécanicien.';
    if (!baseId) errors.baseId = 'Choisissez une base aérienne.';
    if (!standId) errors.standId = 'Choisissez un stand de remplissage.';
    if (baseId && !chefDeBaseId) {
      errors.chefDeBaseId = 'Le chef de base de cette base est introuvable — vérifiez son équipe aérienne.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    void run(
      async () => {
        const campagnes = await listCampagnesLocal();
        const campagneId = pickCurrentCampagneId(campagnes);
        if (!campagneId) {
          throw new ReferentialError('Aucune campagne disponible — synchronisez le référentiel.');
        }
        const fiche = await apiClient.createFicheVol(token!, {
          date_vol: dateVol!,
          compagnie: compagnie.trim(),
          immatriculation: immatriculation.trim(),
          campagne_id: campagneId,
          base_id: baseId!,
          stand_id: standId!,
          pilote: pilote.trim(),
          mecanicien: mecanicien.trim(),
          chef_de_base_id: chefDeBaseId!,
          consultant_international: consultantInternational.trim() || null,
          observations: observations.trim() || null,
        });
        router.replace({
          pathname: '/(fiche-vol)/recap' as any,
          params: {
            id: fiche.id,
            numeroFiche: fiche.numero_fiche,
            dateVol: fiche.date_vol,
            immatriculation: fiche.immatriculation,
            compagnie: fiche.compagnie,
          },
        });
      },
      {
        screen: 'fiche-vol-creation',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour créer une fiche.',
        context: { baseId, standId, chefDeBaseId },
      }
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Nouvelle fiche de vol</Text>
            <View style={styles.headerSpacer} />
            <TouchableOpacity
              onPress={() => router.push('/(fiche-vol)/referentiels' as any)}
              accessibilityRole="button"
            >
              <Text style={styles.referentielsLink}>Référentiels ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.label}>Date du vol</Text>
              <DateField value={dateVol} onChange={setDateVol} />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Compagnie</Text>
              <TextInput
                value={compagnie}
                onChangeText={setCompagnie}
                placeholder="Ex. Madagascar Hélicoptères"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Immatriculation</Text>
              <TextInput
                value={immatriculation}
                onChangeText={setImmatriculation}
                placeholder="Ex. 5R-MXY"
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>

            <BaseAerienneField value={baseId} onChange={onChangeBase} />
            <StandRemplissageField value={standId} onChange={onChangeStand} />

            <View style={styles.card}>
              <Text style={styles.label}>Chef de base</Text>
              {isChefLoading ? (
                <ActivityIndicator color={GREEN} />
              ) : (
                <Text style={styles.chefDeBaseValue}>
                  {chefDeBaseNom ?? 'Choisissez une base pour déterminer le chef de base'}
                </Text>
              )}
            </View>

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
              <Text style={styles.label}>Mécanicien</Text>
              <TextInput
                value={mecanicien}
                onChangeText={setMecanicien}
                placeholder="Nom du mécanicien"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Consultant international (facultatif)</Text>
              <TextInput
                value={consultantInternational}
                onChangeText={setConsultantInternational}
                placeholder="Nom, si présent"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Observations (facultatif)</Text>
              <TextInput
                value={observations}
                onChangeText={setObservations}
                placeholder="Remarques sur la journée"
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                style={[styles.input, styles.inputMultiline]}
              />
            </View>

            {Object.values(formErrors).map((message) => (
              <Text key={message} style={styles.errorText}>
                {message}
              </Text>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity
              style={[styles.continueButton, isSaving && styles.continueButtonDisabled]}
              onPress={submit}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{isSaving ? 'Création…' : 'Créer la fiche  ›'}</Text>
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
  headerSpacer: { flex: 1 },
  referentielsLink: { fontSize: 12.5, fontWeight: '700', color: GREEN },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 11 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, gap: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  input: { fontSize: 13, fontWeight: '600', color: TEXT, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8 },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  chefDeBaseValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: BG },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
