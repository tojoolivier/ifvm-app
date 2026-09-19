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
import { BaseAerienneField } from '@/components/referentiel/BaseAerienneField';
import { StandRemplissageField } from '@/components/referentiel/StandRemplissageField';
import { EquipeAerienneField, type EquipeAerienneOption } from '@/components/referentiel/EquipeAerienneField';
import { ProspectionValideeField, type ProspectionValideeOption } from '@/components/referentiel/ProspectionValideeField';
import { peutSaisirFicheVol } from '@/lib/fiche-vol-access';
import { AccesRestreint } from '@/components/fiche-vol/AccesRestreint';

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
 * cet écran ne crée que l'en-tête : la saisie des vols eux-mêmes (chrono,
 * MEP/Application/Prospection, Convoyage/Divers) continue ensuite sur l'écran de
 * récapitulatif (`(fiche-vol)/recap.tsx`).
 *
 * L'équipe aérienne se choisit en premier (migration backend 0075) : le chef de base,
 * le pilote, le mécanicien, le consultant, l'immatriculation et la société de son
 * hélicoptère s'en déduisent — affichés en lecture seule, le serveur en fait autorité —
 * et seuls les lieux (base, stand) de cette équipe sont proposés. Une équipe créée avant
 * cette évolution peut manquer de pilote/mécanicien/hélicoptère : ces seuls champs
 * restent alors saisissables.
 *
 * Création en ligne uniquement, comme `BaseAerienneField`/`StandRemplissageField`
 * — pas de `syncPush` ici : `numero_fiche` est généré côté serveur.
 *
 * Réservé au chef de base et à l'équipe aérienne (#fiche-vol-acces-roles) —
 * garde-fou au cas où cet écran serait atteint par lien direct plutôt que
 * depuis `(fiche-vol)/menu.tsx`, déjà filtré pour les autres rôles.
 */
export default function FicheVolCreationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const { run, isRunning: isSaving } = useAsyncAction();

  const [dateVol, setDateVol] = useState<string | null>(todayIso());
  // Saisies de repli, utilisées seulement si l'équipe ne fournit pas la valeur.
  const [compagnie, setCompagnie] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [pilote, setPilote] = useState('');
  const [mecanicien, setMecanicien] = useState('');
  const [consultantInternational, setConsultantInternational] = useState('');
  const [observations, setObservations] = useState('');

  const [prospectionId, setProspectionId] = useState<string | null>(null);

  const [pesticideNomCommercial, setPesticideNomCommercial] = useState('');
  const [pesticideQuantiteDisponible, setPesticideQuantiteDisponible] = useState('');
  const [pesticideQuantiteRecue, setPesticideQuantiteRecue] = useState('');
  const [futsDisponible, setFutsDisponible] = useState('');
  const [futsRecues, setFutsRecues] = useState('');
  const [futsPleins, setFutsPleins] = useState('');
  const [futsVides, setFutsVides] = useState('');

  const [equipe, setEquipe] = useState<EquipeAerienneOption | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [standId, setStandId] = useState<string | null>(null);
  const [chefDeBaseNom, setChefDeBaseNom] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { run: runChef, isRunning: isChefLoading } = useAsyncAction();

  // Une nouvelle équipe change les lieux proposés : la base et le stand déjà choisis
  // appartenaient à l'ancienne, on les efface plutôt que de les laisser incohérents.
  const onChangeEquipe = (id: string, option: EquipeAerienneOption) => {
    if (equipe?.id !== id) {
      setBaseId(null);
      setStandId(null);
    }
    setEquipe(option);
    setChefDeBaseNom(null);
    void runChef(
      async () => {
        const chef = (await apiClient.listChefsDeBase(token!)).find((c) => c.id === option.chef_de_base_id);
        setChefDeBaseNom(chef ? `${chef.prenom} ${chef.nom}` : option.chef_de_base_id);
      },
      { screen: 'fiche-vol-creation', precondition: !!token }
    );
  };
  const onChangeBase = (id: string) => setBaseId(id);
  const onChangeStand = (id: string) => setStandId(id);
  const onChangeProspection = (id: string | null, _option: ProspectionValideeOption | null) => setProspectionId(id);

  // Valeur de l'équipe quand elle en fournit une, saisie de repli sinon.
  const piloteEffectif = equipe?.pilote || pilote.trim();
  const mecanicienEffectif = equipe?.mecanicien || mecanicien.trim();
  const immatriculationEffective = equipe?.aeronef?.immatriculation || immatriculation.trim();
  const compagnieEffective = equipe?.aeronef?.societe || compagnie.trim();
  const consultantEffectif = equipe?.consultant_international || consultantInternational.trim() || null;

  const submit = () => {
    const errors: Record<string, string> = {};
    if (!dateVol) errors.dateVol = 'Renseignez la date du vol.';
    if (!equipe) errors.equipe = 'Choisissez l’équipe aérienne.';
    if (equipe && !compagnieEffective) errors.compagnie = 'Renseignez la compagnie.';
    if (equipe && !immatriculationEffective) errors.immatriculation = "Renseignez l'immatriculation.";
    if (equipe && !piloteEffectif) errors.pilote = 'Renseignez le pilote.';
    if (equipe && !mecanicienEffectif) errors.mecanicien = 'Renseignez le mécanicien.';
    if (!baseId) errors.baseId = 'Choisissez une base aérienne.';
    if (!standId) errors.standId = 'Choisissez un stand de remplissage.';
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
          compagnie: compagnieEffective,
          immatriculation: immatriculationEffective,
          campagne_id: campagneId,
          base_id: baseId!,
          stand_id: standId!,
          pilote: piloteEffectif,
          mecanicien: mecanicienEffectif,
          chef_de_base_id: equipe!.chef_de_base_id,
          equipe_aerienne_id: equipe!.id,
          prospection_id: prospectionId,
          consultant_international: consultantEffectif,
          pesticide_nom_commercial: pesticideNomCommercial.trim() || null,
          pesticide_quantite_disponible:
            pesticideQuantiteDisponible.trim() !== '' ? parseFloat(pesticideQuantiteDisponible) : null,
          pesticide_quantite_recue:
            pesticideQuantiteRecue.trim() !== '' ? parseFloat(pesticideQuantiteRecue) : null,
          futs_disponible: futsDisponible.trim() !== '' ? parseInt(futsDisponible, 10) : null,
          futs_recues: futsRecues.trim() !== '' ? parseInt(futsRecues, 10) : null,
          futs_pleins: futsPleins.trim() !== '' ? parseInt(futsPleins, 10) : null,
          futs_vides: futsVides.trim() !== '' ? parseInt(futsVides, 10) : null,
          observations: observations.trim() || null,
        });
        router.replace({
          pathname: '/(fiche-vol)/recap' as any,
          params: {
            id: fiche.id,
            chefDeBaseNom: chefDeBaseNom ?? '',
          },
        });
      },
      {
        screen: 'fiche-vol-creation',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour créer une fiche.',
        context: { equipeId: equipe?.id, baseId, standId },
      }
    );
  };

  if (!peutSaisirFicheVol(role)) {
    return <AccesRestreint />;
  }

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

            <EquipeAerienneField value={equipe?.id ?? null} onChange={onChangeEquipe} />

            {equipe && (
              <View style={styles.card}>
                <Text style={styles.label}>Équipage et hélicoptère (repris de l&apos;équipe)</Text>

                <View style={styles.ligneInfo}>
                  <Text style={styles.sousLabel}>Chef de base</Text>
                  {isChefLoading ? (
                    <ActivityIndicator color={GREEN} />
                  ) : (
                    <Text style={styles.chefDeBaseValue}>{chefDeBaseNom ?? '—'}</Text>
                  )}
                </View>

                {equipe.pilote ? (
                  <View style={styles.ligneInfo}>
                    <Text style={styles.sousLabel}>Pilote</Text>
                    <Text style={styles.chefDeBaseValue}>{equipe.pilote}</Text>
                  </View>
                ) : (
                  <TextInput
                    value={pilote}
                    onChangeText={setPilote}
                    placeholder="Pilote (non renseigné sur l'équipe)"
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.input}
                  />
                )}

                {equipe.mecanicien ? (
                  <View style={styles.ligneInfo}>
                    <Text style={styles.sousLabel}>Mécanicien</Text>
                    <Text style={styles.chefDeBaseValue}>{equipe.mecanicien}</Text>
                  </View>
                ) : (
                  <TextInput
                    value={mecanicien}
                    onChangeText={setMecanicien}
                    placeholder="Mécanicien (non renseigné sur l'équipe)"
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.input}
                  />
                )}

                {equipe.consultant_international ? (
                  <View style={styles.ligneInfo}>
                    <Text style={styles.sousLabel}>Consultant international</Text>
                    <Text style={styles.chefDeBaseValue}>{equipe.consultant_international}</Text>
                  </View>
                ) : (
                  <TextInput
                    value={consultantInternational}
                    onChangeText={setConsultantInternational}
                    placeholder="Consultant international, si présent (facultatif)"
                    placeholderTextColor={TEXT_SECONDARY}
                    style={styles.input}
                  />
                )}

                {equipe.aeronef ? (
                  <>
                    <View style={styles.ligneInfo}>
                      <Text style={styles.sousLabel}>Immatriculation</Text>
                      <Text style={styles.chefDeBaseValue}>{equipe.aeronef.immatriculation}</Text>
                    </View>
                    <View style={styles.ligneInfo}>
                      <Text style={styles.sousLabel}>Société</Text>
                      <Text style={styles.chefDeBaseValue}>{equipe.aeronef.societe}</Text>
                    </View>
                    <View style={styles.ligneInfo}>
                      <Text style={styles.sousLabel}>Volume de cuve</Text>
                      <Text style={styles.chefDeBaseValue}>{equipe.aeronef.volume_cuve_l} L</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <TextInput
                      value={immatriculation}
                      onChangeText={setImmatriculation}
                      placeholder="Immatriculation (aucun hélicoptère sur l'équipe)"
                      placeholderTextColor={TEXT_SECONDARY}
                      autoCapitalize="characters"
                      style={styles.input}
                    />
                    <TextInput
                      value={compagnie}
                      onChangeText={setCompagnie}
                      placeholder="Compagnie"
                      placeholderTextColor={TEXT_SECONDARY}
                      style={styles.input}
                    />
                  </>
                )}
              </View>
            )}

            {equipe ? (
              <>
                <BaseAerienneField value={baseId} onChange={onChangeBase} equipeId={equipe.id} />
                <StandRemplissageField value={standId} onChange={onChangeStand} equipeId={equipe.id} />
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.label}>Base et stand</Text>
                <Text style={styles.chefDeBaseValue}>
                  Choisissez l&apos;équipe aérienne pour voir ses bases et ses stands.
                </Text>
              </View>
            )}
            <ProspectionValideeField value={prospectionId} onChange={onChangeProspection} />

            <View style={styles.card}>
              <Text style={styles.label}>Pesticide — nom commercial (facultatif)</Text>
              <TextInput
                value={pesticideNomCommercial}
                onChangeText={setPesticideNomCommercial}
                placeholder="Ex. Fenitrothion 96 UL"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Pesticide — quantité (L)</Text>
              <View style={styles.rowInputs}>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Disponible</Text>
                  <TextInput
                    value={pesticideQuantiteDisponible}
                    onChangeText={setPesticideQuantiteDisponible}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Reçue</Text>
                  <TextInput
                    value={pesticideQuantiteRecue}
                    onChangeText={setPesticideQuantiteRecue}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Nombre de fûts</Text>
              <View style={styles.rowInputs}>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Disponibles</Text>
                  <TextInput
                    value={futsDisponible}
                    onChangeText={setFutsDisponible}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Reçues</Text>
                  <TextInput
                    value={futsRecues}
                    onChangeText={setFutsRecues}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
              <View style={styles.rowInputs}>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Pleins</Text>
                  <TextInput
                    value={futsPleins}
                    onChangeText={setFutsPleins}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.rowInputItem}>
                  <Text style={styles.sousLabel}>Vides</Text>
                  <TextInput
                    value={futsVides}
                    onChangeText={setFutsVides}
                    placeholder="0"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>
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
  rowInputs: { flexDirection: 'row', gap: 8 },
  rowInputItem: { flex: 1, gap: 4 },
  sousLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  chefDeBaseValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  ligneInfo: { gap: 2 },
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
