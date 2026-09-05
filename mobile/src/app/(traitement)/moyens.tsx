import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, updateTraitementMoyens } from '@/lib/traitement-repository';
import { validateRecouvrement } from '@/lib/traitement-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const KIT_ROWS: { key: 'kit_combinaison' | 'kit_gants' | 'kit_lunettes' | 'kit_masques' | 'kit_botte'; label: string }[] = [
  { key: 'kit_combinaison', label: 'Combinaison' },
  { key: 'kit_gants', label: 'Gants' },
  { key: 'kit_lunettes', label: 'Lunettes' },
  { key: 'kit_masques', label: 'Masques' },
  { key: 'kit_botte', label: 'Botte' },
];

// Saisie francophone : la virgule est le séparateur décimal attendu par l'utilisateur,
// mais JS/JSON n'utilisent que le point en interne — conversion aux deux frontières
// (affichage → virgule, parsing → point), la valeur stockée reste un `number` standard.
// Même paire de fonctions que (prospection)/veg.tsx — pas mutualisée, les deux écrans
// n'ont pas de dépendance commune adaptée pour l'instant.
function parseDecimalInput(raw: string): number | null {
  if (raw === '') return null;
  const val = Number(raw.replace(',', '.'));
  return isNaN(val) ? null : val;
}

function formatDecimalDisplay(value: number | null): string {
  return value != null ? String(value).replace('.', ',') : '';
}

type VegetationDecimalField = 'herbeuse' | 'arboree' | 'recouvrement';

const ZONES = [
  { key: 'habitations', label: 'Habitations' },
  { key: 'points_eau', label: "Points d'eau" },
  { key: 'cultures', label: 'Cultures' },
  { key: 'paturages', label: 'Pâturages' },
  { key: 'aire_protegee', label: 'Aire protégée' },
  { key: 'ruchers', label: 'Ruchers' },
];

export default function MoyensScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const readOnly = isValidationView === '1';

  // Nombre de personnes équipées de chaque matériel — toutes les personnes à
  // bord de l'hélicoptère (ou de l'équipe terrestre) doivent être équipées, pas
  // seulement « au moins une » : un compteur par matériel, plus une case à cocher.
  const [kit, setKit] = useState<Record<string, number>>({});
  const [zones, setZones] = useState<Record<string, boolean>>({});
  const [hauteurHerbeuse, setHauteurHerbeuse] = useState<number | null>(null);
  const [hauteurArboree, setHauteurArboree] = useState<number | null>(null);
  const [recouvrement, setRecouvrement] = useState<number | null>(null);
  // Texte brut en cours de saisie pour les 3 champs décimaux de la végétation — permet de
  // taper la virgule ou un zéro de fin ("1,", "1,50") sans que le champ ne se reformate à
  // chaque frappe (cf. `formatDecimalDisplay` sinon appelé sur une valeur encore inexploitable).
  const [decimalDrafts, setDecimalDrafts] = useState<Partial<Record<VegetationDecimalField, string>>>({});
  // Décide du nombre d'étapes de ProgressBar (7 en aérien avec l'écran Rotations, 6 en
  // terrestre sans lui) — même garde défensive que cibles.tsx/signatures.tsx.
  const [typeTraitement, setTypeTraitement] = useState<'AERIEN' | 'TERRESTRE' | null>(null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('moyens');

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        setTypeTraitement(draft.type_traitement);
        setKit({
          kit_combinaison: draft.kit_combinaison ?? 0,
          kit_gants: draft.kit_gants ?? 0,
          kit_lunettes: draft.kit_lunettes ?? 0,
          kit_masques: draft.kit_masques ?? 0,
          kit_botte: draft.kit_botte ?? 0,
        });
        if (draft.zones_exposees) {
          try {
            setZones(JSON.parse(draft.zones_exposees));
          } catch (e) {
            // Zones cochables, re-saisissables en un geste : même critère que
            // `parseEspeceSelection` (#189) — repli sur aucune zone cochée
            // plutôt que bloquer la fiche pour une chaîne corrompue.
            logger.ignore(e, 'Zones exposées corrompues — repli sur aucune zone cochée, re-saisissable.');
          }
        }
        setHauteurHerbeuse(draft.hauteur_strate_herbeuse_m);
        setHauteurArboree(draft.hauteur_strate_arboree_m);
        setRecouvrement(draft.recouvrement_percent);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  // Un matériel est considéré fourni dès qu'au moins une personne en a un
  // (compteur > 0) — même seuil que l'ancienne case à cocher, généralisé au
  // comptage. Le nombre exact par matériel reste visible ligne par ligne.
  const nbKitFournis = KIT_ROWS.filter((row) => (kit[row.key] ?? 0) > 0).length;
  const recouvrementErrors = validateRecouvrement(recouvrement);

  const vegetationFieldSetters: Record<VegetationDecimalField, (v: number | null) => void> = {
    herbeuse: setHauteurHerbeuse,
    arboree: setHauteurArboree,
    recouvrement: setRecouvrement,
  };

  // Accepte "," et "." et tolère la saisie intermédiaire ("1," / "1.") sans la figer tant
  // qu'elle n'est pas exploitable — même logique que `handleDecimalChange` de veg.tsx.
  const handleVegetationChange = (field: VegetationDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setDecimalDrafts((current) => ({ ...current, [field]: raw }));
    if (raw === '') {
      vegetationFieldSetters[field](null);
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    vegetationFieldSetters[field](val);
  };

  // Resynchronise l'affichage sur la valeur numérique canonique (virgule) une fois la
  // saisie terminée.
  const handleVegetationBlur = (field: VegetationDecimalField) => {
    setDecimalDrafts((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleContinuer = () =>
    run(
      async () => {
        // Déjà visible à l'écran (message par champ) : pas de second signal.
        if (recouvrementErrors.length > 0) return;
        await updateTraitementMoyens(traitementId, {
          kit_combinaison: kit.kit_combinaison ?? 0,
          kit_gants: kit.kit_gants ?? 0,
          kit_lunettes: kit.kit_lunettes ?? 0,
          kit_masques: kit.kit_masques ?? 0,
          kit_botte: kit.kit_botte ?? 0,
          zones_exposees: zones,
          hauteur_strate_herbeuse_m: hauteurHerbeuse,
          hauteur_strate_arboree_m: hauteurArboree,
          recouvrement_percent: recouvrement,
        });
        router.push({ pathname: '/(traitement)/impacts' as any, params: { traitementId, isValidationView } });
      },
      {
        screen: 'moyens',
        precondition: !!traitementId,
        preconditionMessage: 'Session perdue — revenez à l’écran précédent et réessayez.',
        context: { traitementId },
      }
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={typeTraitement === 'TERRESTRE' ? 3 : 4}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Moyens & protection</Text>

        <Card variant={nbKitFournis === 5 ? 'info' : 'avertissement'}>
          <Text style={nbKitFournis === 5 ? styles.bannerTextOk : styles.bannerTextWarn}>
            {nbKitFournis === 5 ? '✓ Tous les matériels fournis (5/5)' : `⚠ Matériel(s) manquant(s) (${nbKitFournis}/5)`}
          </Text>
        </Card>
        <Text style={styles.hint}>Nombre de personnes équipées de chaque matériel (tout l&apos;équipage doit l&apos;être).</Text>

        {KIT_ROWS.map((row) => {
          const valeur = kit[row.key] ?? 0;
          return (
            <View key={row.key} style={styles.kitRow}>
              <Text style={styles.kitLabel}>{row.label}</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterButton}
                  disabled={readOnly || valeur === 0}
                  onPress={() => setKit((prev) => ({ ...prev, [row.key]: Math.max(0, (prev[row.key] ?? 0) - 1) }))}
                >
                  <Text style={styles.counterButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{valeur}</Text>
                <TouchableOpacity
                  style={[styles.counterButton, styles.counterButtonAdd]}
                  disabled={readOnly}
                  onPress={() => setKit((prev) => ({ ...prev, [row.key]: (prev[row.key] ?? 0) + 1 }))}
                >
                  <Text style={[styles.counterButtonText, styles.counterButtonAddText]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={styles.label}>Zones exposées</Text>
        <View style={styles.chipRow}>
          {ZONES.map((z) => (
            <Chip
              key={z.key}
              label={z.label}
              selected={!!zones[z.key]}
              onPress={() => !readOnly && setZones((prev) => ({ ...prev, [z.key]: !prev[z.key] }))}
            />
          ))}
        </View>

        <Text style={styles.label}>Végétation</Text>

        <Text style={styles.fieldLabel}>Strate herbeuse (m)</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 1,5"
          keyboardType="decimal-pad"
          value={decimalDrafts.herbeuse ?? formatDecimalDisplay(hauteurHerbeuse)}
          onChangeText={(v) => handleVegetationChange('herbeuse', v)}
          onBlur={() => handleVegetationBlur('herbeuse')}
        />
        <Text style={styles.fieldLabel}>Strate arborée (m)</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 2,5"
          keyboardType="decimal-pad"
          value={decimalDrafts.arboree ?? formatDecimalDisplay(hauteurArboree)}
          onChangeText={(v) => handleVegetationChange('arboree', v)}
          onBlur={() => handleVegetationBlur('arboree')}
        />
        <Text style={styles.fieldLabel}>Recouvrement (%)</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Ex. 80"
          keyboardType="decimal-pad"
          value={decimalDrafts.recouvrement ?? formatDecimalDisplay(recouvrement)}
          onChangeText={(v) => handleVegetationChange('recouvrement', v)}
          onBlur={() => handleVegetationBlur('recouvrement')}
        />
        {recouvrementErrors.map((e) => (
          <Text key={e.field} style={styles.error}>{e.message}</Text>
        ))}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  bannerTextOk: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal },
  bannerTextWarn: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.avertissementTexte },
  hint: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel, fontStyle: 'italic' },
  kitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingVertical: 6 },
  kitLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: traitementRadii.chip,
    backgroundColor: '#efeada',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonAdd: { backgroundColor: traitementColors.vertPrincipal },
  counterButtonText: { fontFamily: traitementFonts.uiBold, fontSize: 17, color: traitementColors.texteLabel },
  counterButtonAddText: { color: '#fff' },
  counterValue: {
    fontFamily: traitementFonts.monoBold,
    fontSize: traitementTypeSizes.corps + 1,
    color: traitementColors.texteTitre,
    minWidth: 20,
    textAlign: 'center',
  },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  fieldLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
