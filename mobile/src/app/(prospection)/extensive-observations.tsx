import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeBoolean, updateProspectionExtensiveObservations } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { DEGATS_CULTURES_EXTENSIF_OPTIONS, NIVEAU_OPTIONS } from '@/lib/prospection-extensive';
import { DateField } from '@/components/DateField';
import { useAsyncAction } from '@/hooks/use-async-action';
import { formatHeureLocale } from '@/lib/prospection-fiche-lecture';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const INACTIVE_BG = '#efeada';

// La colonne backend `hauteur_herbe_cm` reste en centimètres (partagée avec l'intensif,
// cf. reference.tsx/observations.tsx) : seule l'unité affichée/saisie à l'écran devient
// le mètre. Conversion appliquée aux deux bornes (chargement/enregistrement), même
// principe que ventVitesseKmhToMsInput dans infestation.tsx.
const CM_PAR_M = 100;

function hauteurCmToMInput(cm: number | null): string {
  if (cm == null) return '';
  return String(Math.round((cm / CM_PAR_M) * 100) / 100);
}

function hauteurMInputToCm(m: string): number | null {
  if (m === '') return null;
  const parsed = parseFloat(m);
  return Number.isFinite(parsed) ? Math.round(parsed * CM_PAR_M * 100) / 100 : null;
}

// ==========================================
// Mode aérien — Pesticides embarqués + Signatures
// ==========================================

/** Entier non-négatif strict (zéro autorisé) — vide accepté (champ non renseigné,
 * pas bloquant), tout le reste rejeté avec un message nommant le champ en cause. */
function validerEntierPositif(raw: string, label: string): { value: number | null; erreur: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, erreur: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, erreur: `${label} : un nombre entier positif ou nul est requis.` };
  }
  return { value: parseInt(trimmed, 10), erreur: null };
}

/** Pourcentage entier 0-100 — vide accepté (champ non renseigné, pas bloquant).
 * `verdissement_pourcent` est un entier côté backend (Pydantic `int`, pas de
 * décimales acceptées aujourd'hui) : on refuse donc aussi les décimales ici,
 * plutôt que de laisser croire qu'elles seraient conservées. */
function validerPourcentage(raw: string, label: string): { value: number | null; erreur: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, erreur: null };
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, erreur: `${label} : un nombre entier entre 0 et 100 est requis.` };
  }
  const parsed = parseInt(trimmed, 10);
  if (parsed > 100) {
    return { value: null, erreur: `${label} : la valeur ne peut pas dépasser 100 %.` };
  }
  return { value: parsed, erreur: null };
}

type SignatureRole = 'visa' | 'consultant_fao' | 'pilote' | 'chef_base';

const SIGNATURE_LABELS: Record<SignatureRole, string> = {
  visa: 'VISA',
  consultant_fao: 'Consultant FAO',
  pilote: 'Pilote',
  chef_base: 'Chef de Base',
};

const SIGNATURE_ROLES: SignatureRole[] = ['visa', 'consultant_fao', 'pilote', 'chef_base'];

export default function ExtensiveObservationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);
  // Terrestre implicite (NULL) comme sur extensive-reference.tsx — le bloc
  // Pesticides embarqués/Signatures n'apparaît qu'en mode aérien choisi
  // explicitement ; le reste de cet écran reste identique dans tous les autres cas.
  const isAerien = draft?.mode_extensif === 'aerien';

  // Dégâts sur les cultures : choix unique Faible/Moyen/Forte — réutilise
  // `prospection.degats_cultures` (déjà utilisé par l'Intensif), pas
  // `degats_cultures_pourcent` (l'ancien stepper %, abandonné pour ce champ
  // mais colonne conservée : une ancienne fiche qui n'a que cette valeur
  // s'ouvre sans erreur, simplement sans sélection ici).
  const [degatsCultures, setDegatsCultures] = useState<string | null>(draft?.degats_cultures ?? null);
  // Verdure strate herbeuse : pourcentage — réutilise `prospection.verdissement_pourcent`
  // (déjà utilisé par l'Intensif), pas `verdure_strate` (l'ancien chip Faible/
  // Moyenne/Forte, abandonné pour ce champ mais colonne conservée, même principe
  // de compatibilité que ci-dessus).
  const [verdissement, setVerdissement] = useState(
    draft?.verdissement_pourcent != null ? String(draft.verdissement_pourcent) : ''
  );
  const [hauteur, setHauteur] = useState(hauteurCmToMInput(draft?.hauteur_herbe_cm ?? null));
  const [dernierePluie, setDernierePluie] = useState(draft?.derniere_pluie ?? '');
  const [intensite, setIntensite] = useState(draft?.intensite_pluie ?? 'faible');
  // « Remarques » — les deux modes (terrestre et aérien), tout en bas du slide.
  // Réutilise `prospection.observations`, déjà câblée pour l'intensif : même
  // colonne, juste un intitulé différent à l'écran (pas de nouvelle colonne).
  const [remarques, setRemarques] = useState(draft?.observations ?? '');

  // Mode aérien uniquement — invisibles et jamais lus/écrits en mode terrestre.
  const [pesticidesEmbarques, setPesticidesEmbarques] = useState<boolean | null>(
    normalizeBoolean(draft?.pesticides_embarques)
  );
  const [pesticideNomCommercial, setPesticideNomCommercial] = useState(draft?.pesticide_nom_commercial ?? '');
  const [pesticideQuantiteDisponible, setPesticideQuantiteDisponible] = useState(
    draft?.pesticide_quantite_disponible != null ? String(draft.pesticide_quantite_disponible) : ''
  );
  const [pesticideQuantiteRecue, setPesticideQuantiteRecue] = useState(
    draft?.pesticide_quantite_recue != null ? String(draft.pesticide_quantite_recue) : ''
  );
  const [futsDisponible, setFutsDisponible] = useState(draft?.futs_disponible != null ? String(draft.futs_disponible) : '');
  const [futsPleins, setFutsPleins] = useState(draft?.futs_pleins != null ? String(draft.futs_pleins) : '');
  const [futsVides, setFutsVides] = useState(draft?.futs_vides != null ? String(draft.futs_vides) : '');
  const [futsRecues, setFutsRecues] = useState(draft?.futs_recues != null ? String(draft.futs_recues) : '');

  // Signatures — indépendantes du choix Pesticides, toujours affichées en mode
  // aérien. Même mécanisme que (traitement)/signatures.tsx : nom saisi + horodatage
  // capturé au moment du "Signer", jamais un tracé manuscrit.
  const [signatureNoms, setSignatureNoms] = useState<Record<SignatureRole, string | null>>({
    visa: draft?.signature_visa_nom ?? null,
    consultant_fao: draft?.signature_consultant_fao_nom ?? null,
    pilote: draft?.signature_pilote_nom ?? null,
    chef_base: draft?.signature_chef_base_nom ?? null,
  });
  const [signatureHorodatages, setSignatureHorodatages] = useState<Record<SignatureRole, string | null>>({
    visa: draft?.signature_visa_horodatage ?? null,
    consultant_fao: draft?.signature_consultant_fao_horodatage ?? null,
    pilote: draft?.signature_pilote_horodatage ?? null,
    chef_base: draft?.signature_chef_base_horodatage ?? null,
  });
  const [signatureDraftNoms, setSignatureDraftNoms] = useState<Record<SignatureRole, string>>({
    visa: '',
    consultant_fao: '',
    pilote: '',
    chef_base: '',
  });

  const { run, isRunning: isSaving } = useAsyncAction();

  const handleSigner = (role: SignatureRole) => {
    const nom = signatureDraftNoms[role];
    if (!nom) return; // Précondition imposée par le bouton désactivé — cf. signatures.tsx.
    const horodatage = new Date().toISOString();
    setSignatureNoms((current) => ({ ...current, [role]: nom }));
    setSignatureHorodatages((current) => ({ ...current, [role]: horodatage }));
  };

  // Même garde que sur extensive-reference.tsx : ces `useState(draft?.x)` d'initialisation
  // ne se remettent jamais à jour si `draft` n'est pas encore hydraté au montage. Restaure
  // une seule fois par fiche chargée pour ne pas écraser une saisie en cours.
  const obsHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft || draft.id !== draftId || obsHydratedRef.current === draft.id) return;
    obsHydratedRef.current = draft.id;
    void Promise.resolve().then(() => {
      setDegatsCultures(draft.degats_cultures ?? null);
      setVerdissement(draft.verdissement_pourcent != null ? String(draft.verdissement_pourcent) : '');
      setHauteur(hauteurCmToMInput(draft.hauteur_herbe_cm));
      setDernierePluie(draft.derniere_pluie ?? '');
      setIntensite(draft.intensite_pluie ?? 'faible');
      setRemarques(draft.observations ?? '');
      // Mode aérien uniquement — sans effet sur une fiche terrestre (colonnes NULL).
      setPesticidesEmbarques(normalizeBoolean(draft.pesticides_embarques));
      setPesticideNomCommercial(draft.pesticide_nom_commercial ?? '');
      setPesticideQuantiteDisponible(draft.pesticide_quantite_disponible != null ? String(draft.pesticide_quantite_disponible) : '');
      setPesticideQuantiteRecue(draft.pesticide_quantite_recue != null ? String(draft.pesticide_quantite_recue) : '');
      setFutsDisponible(draft.futs_disponible != null ? String(draft.futs_disponible) : '');
      setFutsPleins(draft.futs_pleins != null ? String(draft.futs_pleins) : '');
      setFutsVides(draft.futs_vides != null ? String(draft.futs_vides) : '');
      setFutsRecues(draft.futs_recues != null ? String(draft.futs_recues) : '');
      setSignatureNoms({
        visa: draft.signature_visa_nom ?? null,
        consultant_fao: draft.signature_consultant_fao_nom ?? null,
        pilote: draft.signature_pilote_nom ?? null,
        chef_base: draft.signature_chef_base_nom ?? null,
      });
      setSignatureHorodatages({
        visa: draft.signature_visa_horodatage ?? null,
        consultant_fao: draft.signature_consultant_fao_horodatage ?? null,
        pilote: draft.signature_pilote_horodatage ?? null,
        chef_base: draft.signature_chef_base_horodatage ?? null,
      });
    });
  }, [draft, draftId]);

  const handleContinue = () => {
    // Verdure strate herbeuse : validée avant tout enregistrement, comme les
    // fûts plus bas — message d'erreur nommant le champ, rien de bloquant si
    // laissé vide.
    const { value: verdissementValeur, erreur: verdissementErreur } = validerPourcentage(
      verdissement,
      'Verdure strate herbeuse'
    );
    if (verdissementErreur) {
      Alert.alert('Pourcentage invalide', verdissementErreur);
      return;
    }

    // Fûts : validés avant tout enregistrement, seulement si Pesticides = OUI
    // (compact/masqué sinon, donc rien à valider) — mêmes AlertDialogs bloquants
    // que la validation des opérations sur extensive-reference.tsx.
    const futsSaisis =
      isAerien && pesticidesEmbarques === true
        ? [
            ['Fûts disponibles', futsDisponible] as const,
            ['Fûts pleins', futsPleins] as const,
            ['Fûts vides', futsVides] as const,
            ['Fûts reçues', futsRecues] as const,
          ].map(([label, raw]) => ({ label, ...validerEntierPositif(raw, label) }))
        : [];
    const futErreur = futsSaisis.find((f) => f.erreur);
    if (futErreur) {
      Alert.alert('Nombre de fûts invalide', futErreur.erreur!);
      return;
    }
    const [futsDisponibleValeur, futsPleinsValeur, futsVidesValeur, futsRecuesValeur] = futsSaisis.length
      ? futsSaisis.map((f) => f.value)
      : [null, null, null, null];

    return run(
      async () => {
        const updated = await updateProspectionExtensiveObservations(draftId, {
          degatsCultures: degatsCultures || null,
          verdissementPourcent: verdissementValeur,
          hauteurHerbeCm: hauteurMInputToCm(hauteur),
          dernierePluie: dernierePluie || null,
          intensitePluie: intensite || null,
          pesticidesEmbarques: isAerien ? pesticidesEmbarques : null,
          pesticideNomCommercial: isAerien && pesticidesEmbarques === true ? pesticideNomCommercial || null : null,
          pesticideQuantiteDisponible:
            isAerien && pesticidesEmbarques === true && pesticideQuantiteDisponible
              ? parseFloat(pesticideQuantiteDisponible)
              : null,
          pesticideQuantiteRecue:
            isAerien && pesticidesEmbarques === true && pesticideQuantiteRecue
              ? parseFloat(pesticideQuantiteRecue)
              : null,
          futsDisponible: isAerien && pesticidesEmbarques === true ? futsDisponibleValeur : null,
          futsPleins: isAerien && pesticidesEmbarques === true ? futsPleinsValeur : null,
          futsVides: isAerien && pesticidesEmbarques === true ? futsVidesValeur : null,
          futsRecues: isAerien && pesticidesEmbarques === true ? futsRecuesValeur : null,
          signatureVisaNom: isAerien ? signatureNoms.visa : null,
          signatureVisaHorodatage: isAerien ? signatureHorodatages.visa : null,
          signatureConsultantFaoNom: isAerien ? signatureNoms.consultant_fao : null,
          signatureConsultantFaoHorodatage: isAerien ? signatureHorodatages.consultant_fao : null,
          signaturePiloteNom: isAerien ? signatureNoms.pilote : null,
          signaturePiloteHorodatage: isAerien ? signatureHorodatages.pilote : null,
          signatureChefBaseNom: isAerien ? signatureNoms.chef_base : null,
          signatureChefBaseHorodatage: isAerien ? signatureHorodatages.chef_base : null,
          observations: remarques || null,
        });
        setDraft(updated);
        router.push({ pathname: '/(prospection)/extensive-recap' as any, params: { draftId } });
      },
      {
        screen: 'extensive-observations',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

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
            <Text style={styles.title}>Observations</Text>
          </View>
          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.progressBar, styles.progressActive]} />
            ))}
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.sectionLabel}>Dégâts sur les cultures</Text>
            <View style={[styles.chipsRow, { marginBottom: 10 }]}>
              {DEGATS_CULTURES_EXTENSIF_OPTIONS.map((option) => {
                const active = option.value === degatsCultures;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={{ flex: 1 }}
                    onPress={() => setDegatsCultures(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chip, active && styles.chipActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { marginBottom: 9 }]}>
              <Text style={styles.label}>Verdure strate herbeuse</Text>
              <View style={styles.pourcentageRow}>
                <TextInput
                  testID="verdissement-input"
                  value={verdissement}
                  onChangeText={setVerdissement}
                  keyboardType="number-pad"
                  style={[styles.input, styles.pourcentageInput]}
                />
                <Text style={styles.pourcentageUnit}>%</Text>
              </View>
            </View>

            <View style={[styles.card, { marginBottom: 9 }]}>
              <Text style={styles.label}>H Str Herb (m)</Text>
              <TextInput testID="hauteur-herbe-input" value={hauteur} onChangeText={setHauteur} keyboardType="decimal-pad" style={styles.input} />
            </View>

            <View style={styles.row}>
              <View style={[styles.card, styles.flex1]}>
                <Text style={styles.label}>Dernière pluie le</Text>
                <DateField
                  value={dernierePluie || null}
                  onChange={setDernierePluie}
                  maximumDate={new Date()}
                  style={styles.dateFieldBox}
                  textStyle={styles.input}
                  placeholderStyle={[styles.input, { fontWeight: '500', color: TEXT_SECONDARY }]}
                />
              </View>
              <View style={[styles.flex1, { gap: 5 }]}>
                <Text style={styles.label}>Intensité</Text>
                <View style={styles.chipsRow}>
                  {NIVEAU_OPTIONS.map((option) => {
                    const active = option.value === intensite;
                    return (
                      <TouchableOpacity key={option.value} style={{ flex: 1 }} onPress={() => setIntensite(option.value)} activeOpacity={0.7}>
                        <Text style={[styles.chip, styles.chipCompact, active && styles.chipActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {isAerien && (
              <>
                <Text style={styles.sectionLabel}>Pesticides Embarqués</Text>
                <View style={[styles.chipsRow, { marginBottom: 10 }]}>
                  {([true, false] as const).map((value) => {
                    const active = pesticidesEmbarques === value;
                    return (
                      <TouchableOpacity
                        key={String(value)}
                        style={{ flex: 1 }}
                        onPress={() => setPesticidesEmbarques(value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chip, active && styles.chipActive]}>{value ? 'Oui' : 'Non'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {pesticidesEmbarques === true && (
                  <>
                    <View style={[styles.card, { marginBottom: 9 }]}>
                      <Text style={styles.label}>Nom Commercial</Text>
                      <TextInput
                        testID="pesticide-nom-commercial-input"
                        value={pesticideNomCommercial}
                        onChangeText={setPesticideNomCommercial}
                        placeholder="Ex. Fyfanon ULV"
                        placeholderTextColor={TEXT_SECONDARY}
                        style={styles.input}
                      />
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.card, styles.flex1]}>
                        <Text style={styles.label}>Quantité Disponible (L)</Text>
                        <TextInput
                          testID="pesticide-quantite-disponible-input"
                          value={pesticideQuantiteDisponible}
                          onChangeText={setPesticideQuantiteDisponible}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.flex1]}>
                        <Text style={styles.label}>Quantité Reçue (L)</Text>
                        <TextInput
                          testID="pesticide-quantite-recue-input"
                          value={pesticideQuantiteRecue}
                          onChangeText={setPesticideQuantiteRecue}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                    </View>

                    <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Nombre de fûts</Text>
                    <View style={styles.futsGrid}>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Disponible</Text>
                        <TextInput
                          testID="futs-disponible-input"
                          value={futsDisponible}
                          onChangeText={setFutsDisponible}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Pleins</Text>
                        <TextInput
                          testID="futs-pleins-input"
                          value={futsPleins}
                          onChangeText={setFutsPleins}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Vides</Text>
                        <TextInput
                          testID="futs-vides-input"
                          value={futsVides}
                          onChangeText={setFutsVides}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                      <View style={[styles.card, styles.futsCell]}>
                        <Text style={styles.label}>Reçues</Text>
                        <TextInput
                          testID="futs-recues-input"
                          value={futsRecues}
                          onChangeText={setFutsRecues}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                      </View>
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>Signatures</Text>
                {SIGNATURE_ROLES.map((role) => {
                  const signe = !!signatureNoms[role];
                  return (
                    <View key={role} style={[styles.card, styles.signatureRow]}>
                      <Text style={styles.label}>{SIGNATURE_LABELS[role]}</Text>
                      {!signe ? (
                        <TextInput
                          value={signatureDraftNoms[role]}
                          onChangeText={(v) => setSignatureDraftNoms((current) => ({ ...current, [role]: v }))}
                          placeholder="Nom du signataire"
                          placeholderTextColor={TEXT_SECONDARY}
                          style={styles.input}
                        />
                      ) : (
                        <>
                          <Text style={styles.signatureValue}>{signatureNoms[role]}</Text>
                          <Text style={styles.signatureStamp}>{formatHeureLocale(signatureHorodatages[role])}</Text>
                        </>
                      )}
                      <TouchableOpacity
                        style={[styles.signButton, signe && styles.signButtonDone]}
                        onPress={() => handleSigner(role)}
                        disabled={signe || !signatureDraftNoms[role]}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.signButtonText}>{signe ? '✓ Signé' : 'Signer'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.sectionLabel}>Remarques</Text>
            <View style={[styles.card, styles.remarquesCard]}>
              <TextInput
                testID="remarques-input"
                value={remarques}
                onChangeText={setRemarques}
                placeholder="Informations complémentaires…"
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.remarquesInput]}
              />
            </View>

            <View style={styles.footerNote}>
              <Text style={styles.footerNoteText}>Dernier écran de saisie — données culture/climat, communes aux deux espèces.</Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>Suivant : Récapitulatif ›</Text>
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 9 },
  label: { fontSize: 9, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  input: { fontSize: 13, fontWeight: '700', color: TEXT, fontFamily: 'monospace', padding: 0 },
  dateFieldBox: { minHeight: 0, borderWidth: 0, padding: 0, backgroundColor: 'transparent' },
  // Verdure strate herbeuse (%) — même principe que le stepper Dégâts d'origine :
  // valeur + unité affichée à côté, dans la carte.
  pourcentageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pourcentageInput: { flex: 1 },
  pourcentageUnit: { fontSize: 15, fontWeight: '700', color: TEXT },
  sectionLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase', marginBottom: 5 },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, backgroundColor: INACTIVE_BG, paddingVertical: 8, textAlign: 'center', borderRadius: 8, overflow: 'hidden' },
  chipCompact: { fontSize: 9.5, paddingVertical: 6, paddingHorizontal: 2 },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 9, marginBottom: 9 },
  flex1: { flex: 1 },
  footerNote: { marginTop: 14, backgroundColor: '#eaf2ec', borderRadius: 10, padding: 11 },
  footerNoteText: { fontSize: 11, lineHeight: 16, color: GREEN, fontWeight: '500' },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  // ===== Mode aérien : Pesticides embarqués + Signatures =====
  futsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  futsCell: { flexBasis: '47%', flexGrow: 1, marginBottom: 0 },
  signatureRow: { gap: 6 },
  signatureValue: { fontSize: 13, fontWeight: '700', color: TEXT },
  signatureStamp: { fontSize: 10, color: TEXT_SECONDARY, fontFamily: 'monospace' },
  signButton: { backgroundColor: GREEN, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  signButtonDone: { backgroundColor: '#9a9484' },
  signButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  // ===== Remarques (terrestre + aérien) =====
  remarquesCard: { marginBottom: 9 },
  remarquesInput: { minHeight: 90, fontFamily: 'System', fontWeight: '500' },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
