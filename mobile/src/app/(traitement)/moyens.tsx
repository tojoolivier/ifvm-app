import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  updateTraitementMoyens,
  updateTraitementAerienEfficacite,
} from '@/lib/traitement-repository';
import { getProspection } from '@/lib/prospection-repository';
import { validateRecouvrement } from '@/lib/traitement-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

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

type MoyensDecimalField =
  | 'herbeuse'
  | 'arboree'
  | 'recouvrement'
  | 'tauxMortalite'
  | 'evaluationEfficaciteHeures'
  | 'nbAgentsPermanents'
  | 'nbAgentsTemporaires'
  | 'nbPersonnelLocal'
  | 'moyensAtomiseurNb'
  | 'moyensEssenceLitres'
  | 'moyensDisqueRotatifNb'
  | 'moyensPilesNb'
  | 'moyensUlvamastNb';

// Réduit à Cultures/Pâturages — Habitations, Points d'eau, Aire protégée et
// Ruchers retirés du choix (décision produit).
const ZONES = [
  { key: 'cultures', label: 'Cultures' },
  { key: 'paturages', label: 'Pâturages' },
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
  // Efficacité (migration backend 0058, fiche CRT papier section "Traitement") —
  // Aérien uniquement désormais : déplacée ici depuis Équipe/Pesticides & rotations
  // (#efficacite-moyens-protection), puis le Terrestre est reparti sur Équipe
  // (#efficacite-equipe-terrestre) — seul l'Aérien la saisit encore sur cet écran.
  const [tauxMortalite, setTauxMortalite] = useState<number | null>(null);
  const [evaluationEfficaciteHeures, setEvaluationEfficaciteHeures] = useState<number | null>(null);
  const [methodeEvaluation, setMethodeEvaluation] = useState<'ESTIMATION_VISUELLE' | 'COMPTAGES_PRE_POST' | null>(null);
  // Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration backend
  // 0076, #moyens-humains-materiels) — communs à l'Aérien et au Terrestre.
  const [nbAgentsPermanents, setNbAgentsPermanents] = useState<number | null>(null);
  const [nbAgentsTemporaires, setNbAgentsTemporaires] = useState<number | null>(null);
  const [nbPersonnelLocal, setNbPersonnelLocal] = useState<number | null>(null);
  const [moyensAtomiseurNb, setMoyensAtomiseurNb] = useState<number | null>(null);
  const [moyensEssenceLitres, setMoyensEssenceLitres] = useState<number | null>(null);
  const [moyensDisqueRotatifNb, setMoyensDisqueRotatifNb] = useState<number | null>(null);
  const [moyensPilesNb, setMoyensPilesNb] = useState<number | null>(null);
  const [moyensUlvamastNb, setMoyensUlvamastNb] = useState<number | null>(null);
  // Texte brut en cours de saisie pour les champs décimaux de cet écran — permet de
  // taper la virgule ou un zéro de fin ("1,", "1,50") sans que le champ ne se reformate à
  // chaque frappe (cf. `formatDecimalDisplay` sinon appelé sur une valeur encore inexploitable).
  const [decimalDrafts, setDecimalDrafts] = useState<Partial<Record<MoyensDecimalField, string>>>({});
  // Décide du nombre d'étapes de ProgressBar (7 en aérien avec l'écran Rotations, 6 en
  // terrestre sans lui) — même garde défensive que cibles.tsx/signatures.tsx.
  const [typeTraitement, setTypeTraitement] = useState<'AERIEN' | 'TERRESTRE' | null>(null);
  const [prospectionId, setProspectionId] = useState<string | null>(null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('moyens');
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        setTypeTraitement(draft.type_traitement);
        setProspectionId(draft.prospection_id ?? null);
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
        setNbAgentsPermanents(draft.nb_agents_permanents);
        setNbAgentsTemporaires(draft.nb_agents_temporaires);
        setNbPersonnelLocal(draft.nb_personnel_local);
        setMoyensAtomiseurNb(draft.moyens_atomiseur_nb);
        setMoyensEssenceLitres(draft.moyens_essence_litres);
        setMoyensDisqueRotatifNb(draft.moyens_disque_rotatif_nb);
        setMoyensPilesNb(draft.moyens_piles_nb);
        setMoyensUlvamastNb(draft.moyens_ulvamast_nb);
        // Terrestre : Efficacité vit désormais sur l'écran Équipe
        // (#efficacite-equipe-terrestre, retour arrière sur
        // #efficacite-moyens-protection) — seul l'Aérien la saisit encore ici.
        if (draft.type_traitement === 'AERIEN' && draft.aerien) {
          setTauxMortalite(draft.aerien.taux_mortalite_pourcent);
          setEvaluationEfficaciteHeures(draft.aerien.evaluation_efficacite_heures_apres);
          setMethodeEvaluation(
            draft.aerien.methode_evaluation_efficacite as 'ESTIMATION_VISUELLE' | 'COMPTAGES_PRE_POST' | null
          );
        }
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  // Pré-remplit Strate herbeuse/Recouvrement depuis la fiche de prospection liée
  // (déjà renseignés là — intensive ou extensive, `hauteur_herbe_cm`/
  // `verdissement_pourcent` sont des champs communs aux deux) — modifiable
  // ensuite, jamais d'écrasement d'une valeur déjà présente (fiche reprise, ou
  // agent déjà passé sur cet écran). Strate arborée n'a pas d'équivalent sur la
  // prospection : reste en saisie manuelle. Setters fonctionnels : lisent l'état
  // vivant au moment de l'écriture, pas la fermeture (obsolète) de cet effet.
  useEffect(() => {
    if (!prospectionId) return;
    getProspection(prospectionId)
      .then((prospection) => {
        if (!prospection) return;
        if (prospection.hauteur_herbe_cm != null) {
          // cm -> m, arrondi à 2 décimales — même conversion que
          // extensive-observations.tsx (hauteurCmToMInput).
          const herbeuseM = Math.round((prospection.hauteur_herbe_cm / 100) * 100) / 100;
          setHauteurHerbeuse((current) => (current == null ? herbeuseM : current));
        }
        if (prospection.verdissement_pourcent != null) {
          setRecouvrement((current) => (current == null ? prospection.verdissement_pourcent : current));
        }
      })
      .catch((error) => signalerChargement(error, { prospectionId }));
  }, [prospectionId, signalerChargement]);

  // Un matériel est considéré fourni dès qu'au moins une personne en a un
  // (compteur > 0) — même seuil que l'ancienne case à cocher, généralisé au
  // comptage. Le nombre exact par matériel reste visible ligne par ligne.
  const nbKitFournis = KIT_ROWS.filter((row) => (kit[row.key] ?? 0) > 0).length;
  const recouvrementErrors = validateRecouvrement(recouvrement);

  const decimalFieldSetters: Record<MoyensDecimalField, (v: number | null) => void> = {
    herbeuse: setHauteurHerbeuse,
    arboree: setHauteurArboree,
    recouvrement: setRecouvrement,
    tauxMortalite: setTauxMortalite,
    evaluationEfficaciteHeures: setEvaluationEfficaciteHeures,
    nbAgentsPermanents: setNbAgentsPermanents,
    nbAgentsTemporaires: setNbAgentsTemporaires,
    nbPersonnelLocal: setNbPersonnelLocal,
    moyensAtomiseurNb: setMoyensAtomiseurNb,
    moyensEssenceLitres: setMoyensEssenceLitres,
    moyensDisqueRotatifNb: setMoyensDisqueRotatifNb,
    moyensPilesNb: setMoyensPilesNb,
    moyensUlvamastNb: setMoyensUlvamastNb,
  };

  // Accepte "," et "." et tolère la saisie intermédiaire ("1," / "1.") sans la figer tant
  // qu'elle n'est pas exploitable — même logique que `handleDecimalChange` de veg.tsx.
  const handleDecimalChange = (field: MoyensDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setDecimalDrafts((current) => ({ ...current, [field]: raw }));
    if (raw === '') {
      decimalFieldSetters[field](null);
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    decimalFieldSetters[field](val);
  };

  // Resynchronise l'affichage sur la valeur numérique canonique (virgule) une fois la
  // saisie terminée.
  const handleDecimalBlur = (field: MoyensDecimalField) => {
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
        // Terrestre : Efficacité enregistrée sur l'écran Équipe
        // (#efficacite-equipe-terrestre) — rien à faire ici pour lui.
        if (typeTraitement === 'AERIEN') {
          await updateTraitementAerienEfficacite(traitementId, {
            tauxMortalitePourcent: tauxMortalite,
            evaluationEfficaciteHeuresApres: evaluationEfficaciteHeures,
            methodeEvaluationEfficacite: methodeEvaluation,
          });
        }
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
          nb_agents_permanents: nbAgentsPermanents,
          nb_agents_temporaires: nbAgentsTemporaires,
          nb_personnel_local: nbPersonnelLocal,
          moyens_atomiseur_nb: moyensAtomiseurNb,
          moyens_essence_litres: moyensEssenceLitres,
          moyens_disque_rotatif_nb: moyensDisqueRotatifNb,
          moyens_piles_nb: moyensPilesNb,
          moyens_ulvamast_nb: moyensUlvamastNb,
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
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={typeTraitement === 'TERRESTRE' ? 3 : 4}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Moyens & protection</Text>

        {/* Terrestre : Efficacité déplacée sur l'écran Équipe
            (#efficacite-equipe-terrestre) — seul l'Aérien la saisit encore ici,
            où elle vivait déjà (#efficacite-moyens-protection). */}
        {typeTraitement === 'AERIEN' && (
          <>
            <Text style={styles.sectionLabel}>Efficacité</Text>
            <Text style={styles.fieldLabel}>Taux de mortalité (%)</Text>
            <TextInput
              testID="taux-mortalite-input"
              editable={!readOnly}
              style={styles.input}
              placeholder="0"
              keyboardType="decimal-pad"
              value={decimalDrafts.tauxMortalite ?? formatDecimalDisplay(tauxMortalite)}
              onChangeText={(v) => handleDecimalChange('tauxMortalite', v)}
              onBlur={() => handleDecimalBlur('tauxMortalite')}
            />
            <Text style={styles.fieldLabel}>Évalué après traitement (heures)</Text>
            <TextInput
              testID="evaluation-efficacite-heures-input"
              editable={!readOnly}
              style={styles.input}
              placeholder="0"
              keyboardType="decimal-pad"
              value={decimalDrafts.evaluationEfficaciteHeures ?? formatDecimalDisplay(evaluationEfficaciteHeures)}
              onChangeText={(v) => handleDecimalChange('evaluationEfficaciteHeures', v)}
              onBlur={() => handleDecimalBlur('evaluationEfficaciteHeures')}
            />
            <Text style={styles.fieldLabel}>Méthode d&apos;évaluation</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Estimation visuelle"
                selected={methodeEvaluation === 'ESTIMATION_VISUELLE'}
                onPress={() => !readOnly && setMethodeEvaluation('ESTIMATION_VISUELLE')}
              />
              <Chip
                label="Comptages pré/post-traitement"
                selected={methodeEvaluation === 'COMPTAGES_PRE_POST'}
                onPress={() => !readOnly && setMethodeEvaluation('COMPTAGES_PRE_POST')}
              />
            </View>
          </>
        )}

        {/* Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration
            backend 0076, #moyens-humains-materiels) — communs à l'Aérien et
            au Terrestre. */}
        <Text style={styles.sectionLabel}>Humains</Text>
        <Text style={styles.fieldLabel}>Nb agents permanents</Text>
        <TextInput
          testID="nb-agents-permanents-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.nbAgentsPermanents ?? formatDecimalDisplay(nbAgentsPermanents)}
          onChangeText={(v) => handleDecimalChange('nbAgentsPermanents', v)}
          onBlur={() => handleDecimalBlur('nbAgentsPermanents')}
        />
        <Text style={styles.fieldLabel}>Nb agents temporaires</Text>
        <TextInput
          testID="nb-agents-temporaires-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.nbAgentsTemporaires ?? formatDecimalDisplay(nbAgentsTemporaires)}
          onChangeText={(v) => handleDecimalChange('nbAgentsTemporaires', v)}
          onBlur={() => handleDecimalBlur('nbAgentsTemporaires')}
        />
        <Text style={styles.fieldLabel}>Nb personnel local</Text>
        <TextInput
          testID="nb-personnel-local-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.nbPersonnelLocal ?? formatDecimalDisplay(nbPersonnelLocal)}
          onChangeText={(v) => handleDecimalChange('nbPersonnelLocal', v)}
          onBlur={() => handleDecimalBlur('nbPersonnelLocal')}
        />

        <Text style={styles.sectionLabel}>Matériels</Text>
        <Text style={styles.fieldLabel}>Atomiseur</Text>
        <TextInput
          testID="moyens-atomiseur-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.moyensAtomiseurNb ?? formatDecimalDisplay(moyensAtomiseurNb)}
          onChangeText={(v) => handleDecimalChange('moyensAtomiseurNb', v)}
          onBlur={() => handleDecimalBlur('moyensAtomiseurNb')}
        />
        <Text style={styles.fieldLabel}>Essence (litres)</Text>
        <TextInput
          testID="moyens-essence-litres-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="decimal-pad"
          value={decimalDrafts.moyensEssenceLitres ?? formatDecimalDisplay(moyensEssenceLitres)}
          onChangeText={(v) => handleDecimalChange('moyensEssenceLitres', v)}
          onBlur={() => handleDecimalBlur('moyensEssenceLitres')}
        />
        <Text style={styles.fieldLabel}>Disque rotatif</Text>
        <TextInput
          testID="moyens-disque-rotatif-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.moyensDisqueRotatifNb ?? formatDecimalDisplay(moyensDisqueRotatifNb)}
          onChangeText={(v) => handleDecimalChange('moyensDisqueRotatifNb', v)}
          onBlur={() => handleDecimalBlur('moyensDisqueRotatifNb')}
        />
        <Text style={styles.fieldLabel}>Nombre de piles</Text>
        <TextInput
          testID="moyens-piles-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.moyensPilesNb ?? formatDecimalDisplay(moyensPilesNb)}
          onChangeText={(v) => handleDecimalChange('moyensPilesNb', v)}
          onBlur={() => handleDecimalBlur('moyensPilesNb')}
        />
        <Text style={styles.fieldLabel}>Ulvamast</Text>
        <TextInput
          testID="moyens-ulvamast-input"
          editable={!readOnly}
          style={styles.input}
          placeholder="0"
          keyboardType="number-pad"
          value={decimalDrafts.moyensUlvamastNb ?? formatDecimalDisplay(moyensUlvamastNb)}
          onChangeText={(v) => handleDecimalChange('moyensUlvamastNb', v)}
          onBlur={() => handleDecimalBlur('moyensUlvamastNb')}
        />

        <Text style={styles.sectionLabel}>Kit de protection</Text>
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

        <Text style={styles.sectionLabel}>Zones exposées</Text>
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

        {/* Végétation (#326) : déplacée sur l'écran « Synthèse », amont dans le
            nouveau flux Aérien — cet écran continue de charger/réécrire ces 3
            champs tels quels (round-trip, cf. commentaire de synthese.tsx) mais
            ne les affiche/édite plus ici. Le Terrestre garde son flux actuel,
            inchangé : la section reste visible telle quelle. */}
        {typeTraitement !== 'AERIEN' && (
          <>
            <Text style={styles.sectionLabel}>Végétation</Text>

            <Text style={styles.fieldLabel}>Strate herbeuse (m) — pré-remplie, modifiable</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Ex. 1,5"
              keyboardType="decimal-pad"
              value={decimalDrafts.herbeuse ?? formatDecimalDisplay(hauteurHerbeuse)}
              onChangeText={(v) => handleDecimalChange('herbeuse', v)}
              onBlur={() => handleDecimalBlur('herbeuse')}
            />
            <Text style={styles.fieldLabel}>Strate arborée (m)</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Ex. 2,5"
              keyboardType="decimal-pad"
              value={decimalDrafts.arboree ?? formatDecimalDisplay(hauteurArboree)}
              onChangeText={(v) => handleDecimalChange('arboree', v)}
              onBlur={() => handleDecimalBlur('arboree')}
            />
            <Text style={styles.fieldLabel}>Recouvrement (%) — pré-rempli, modifiable</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Ex. 80"
              keyboardType="decimal-pad"
              value={decimalDrafts.recouvrement ?? formatDecimalDisplay(recouvrement)}
              onChangeText={(v) => handleDecimalChange('recouvrement', v)}
              onBlur={() => handleDecimalBlur('recouvrement')}
            />
            {recouvrementErrors.map((e) => (
              <Text key={e.field} style={styles.error}>{e.message}</Text>
            ))}
          </>
        )}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp },
    keyboardAvoidingView: { flex: 1 },
    content: { padding: 16, gap: 10 },
    title: { fontFamily: traitementFonts.uiExtraBold, fontSize: typeSizes.titreEcran, color: traitementColors.texteTitre },
    bannerTextOk: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal },
    bannerTextWarn: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.avertissementTexte },
    hint: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteLabel, fontStyle: 'italic' },
    kitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingVertical: 6 },
    kitLabel: { fontFamily: traitementFonts.ui, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
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
      fontSize: typeSizes.corps + 1,
      color: traitementColors.texteTitre,
      minWidth: 20,
      textAlign: 'center',
    },
    // Semi-gras (au lieu de uiMedium) : demande explicite, titres de champ plus
    // visibles sur les fiches de traitement.
    label: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.label, color: traitementColors.texteLabel },
    // Titre de section (Efficacité, Végétation) : centré, agrandi et en gras —
    // même hiérarchie visuelle que les valeurs de l'écran Cibles (cibles.tsx),
    // sur demande explicite, sans toucher au `label` partagé (utilisé aussi par
    // « Zones exposées », qui reste inchangé).
    sectionLabel: {
      fontFamily: traitementFonts.uiBold,
      fontSize: typeSizes.corps + 3,
      color: traitementColors.texteTitre,
      textAlign: 'center',
    },
    fieldLabel: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.label, color: traitementColors.texteLabel },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.chip,
      paddingHorizontal: 10,
      fontFamily: traitementFonts.ui,
      fontSize: typeSizes.corps,
      color: traitementColors.texteTitre,
      backgroundColor: theme.card,
    },
    error: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.erreurTexte },
    continueButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: traitementColors.vertPrincipal,
      borderRadius: traitementRadii.boutonPrincipal,
      marginTop: 8,
    },
    continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: typeSizes.corps + 1 },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
