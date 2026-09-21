import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, Cible } from '@/lib/traitement-repository';
import { getProspection, listAllProspectionCaptures, listAllProspectionPopulations } from '@/lib/prospection-repository';
import { construireDetailPhaseStade, PhaseStadeGroup } from '@/lib/traitement-cible';
import { Card } from '@/components/traitement/Card';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  return String(value);
}

/** `vols_clairs_essaims` est stocké en base locale sous forme 1/0 (colonne REAL,
 * cf. construireCible dans traitement-cible.ts) — jamais renseigné si null. */
function displayVolsClairsEssaims(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'non renseigné';
  return value ? 'oui' : 'non';
}

/** Une espèce est « présente » sur la cible dès que l'un de ses champs détaillés
 * (petites/grandes larves ou densités) est renseigné (non `null`/`undefined`) —
 * `null` sur les 4 signifie que cette espèce n'a aucune ligne population sur la
 * prospection liée, `undefined` qu'ils n'existent pas du tout (fiche créée avant
 * l'ajout du détail par espèce). Depuis #cible-extensif-signalement-defauts-zero,
 * `construireCible`/`construire_cible()` ne mettent ces 4 champs à 0 (jamais
 * `null`) QUE pour une espèce réellement présente dans `cible.espece` — jamais
 * pour les deux à la fois sur une prospection "rien trouvé", ce test-ci reste
 * donc valide sans traitement spécial. Même logique que synthese.tsx/recap.tsx. */
function especePresente(cible: Cible | null, espece: 'lmc' | 'nse'): boolean {
  if (!cible) return false;
  return (
    cible[`petites_larves_${espece}`] != null ||
    cible[`grandes_larves_${espece}`] != null ||
    cible[`densite_diffuse_${espece}`] != null ||
    cible[`densite_groupee_${espece}`] != null
  );
}

/** « LMC », « NSE » ou « LMC / NSE » selon les espèces détaillées présentes ;
 * repli sur `cible.espece` (agrégé, peut valoir "MELANGE") pour une fiche créée
 * avant l'ajout du détail par espèce. */
function displayEspeces(cible: Cible | null): string {
  const especes = (['lmc', 'nse'] as const).filter((e) => especePresente(cible, e));
  if (especes.length > 0) return especes.map((e) => e.toUpperCase()).join(' / ');
  return display(cible?.espece);
}

/** Extensif/Signalement, prospection "rien trouvé" (#cible-extensif-signalement-
 * defauts-zero) : "0" plutôt que "non renseigné" quand aucune phase/stade n'a
 * été capturé pour ce groupe espèce/catégorie — l'Intensif garde "non renseigné". */
function PhaseStadeTable({
  title,
  entries,
  defautsZero,
}: {
  title: string;
  entries: { label: string; value: number }[];
  defautsZero: boolean;
}) {
  return (
    <View style={styles.phaseStadeTable}>
      <Text style={styles.phaseStadeTitle}>{title}</Text>
      {entries.length === 0 ? (
        <Text style={styles.value}>{defautsZero ? '0' : 'non renseigné'}</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.label} style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>{entry.label}</Text>
            <Text style={styles.detailRowValue}>{entry.value}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * Écran B — Cibles.
 *
 * Terrestre uniquement depuis #326 : côté Aérien, cet écran est remplacé par
 * « Synthèse » (synthese.tsx), qui reprend le même contenu de cible en lecture
 * seule et y ajoute la végétation (déplacée depuis Moyens) — `references.tsx`
 * route vers l'un ou l'autre selon `type_traitement`.
 *
 * Écran à deux vitesses depuis #cibles-phase-stade-en-direct : Espèce, Vols/essaims
 * et Répartition de la population restent un snapshot figé (`cible`, calculé une
 * seule fois à la création de la fiche via `construireCible`/`construire_cible()` —
 * jamais recalculé après coup). Les tableaux Phase/Stade par espèce/catégorie
 * (LMC/NSE × Imagos/Larves), eux, sont recalculés EN DIRECT à chaque visite de cet
 * écran depuis les populations/captures de la prospection liée
 * (`construireDetailPhaseStade`) — voulu ainsi pour refléter la prospection telle
 * qu'elle est aujourd'hui, pas telle qu'elle était à la création du traitement.
 */
export default function CiblesScreen() {
  const router = useRouter();
  const { traitementId, isValidationView, origineId } =
    useLocalSearchParams<{ traitementId: string; isValidationView?: string; origineId?: string }>();
  const [cible, setCible] = useState<Cible | null>(null);
  // Type de traitement de la fiche — décide du nombre d'étapes de ProgressBar (7 en
  // aérien avec l'écran Rotations, 6 en terrestre sans lui).
  const [typeTraitement, setTypeTraitement] = useState<'AERIEN' | 'TERRESTRE' | null>(null);
  const [phaseStadeGroups, setPhaseStadeGroups] = useState<PhaseStadeGroup[]>([]);
  // #cible-extensif-signalement-defauts-zero : Extensif/Signalement seulement —
  // décide si les tableaux Phase/Stade vides affichent "0" (rien trouvé,
  // conclusif) ou "non renseigné" (Intensif, inchangé).
  const [defautsZero, setDefautsZero] = useState(false);
  const signalerChargement = useSignalerChargement('cibles');

  useEffect(() => {
    if (!traitementId) return;
    void getTraitement(traitementId)
      .then(async (draft) => {
        setCible(draft?.cible ?? null);
        setTypeTraitement(draft?.type_traitement ?? null);
        if (!draft?.prospection_id) {
          setPhaseStadeGroups([]);
          setDefautsZero(false);
          return;
        }
        const [populations, captures, prospection] = await Promise.all([
          listAllProspectionPopulations(draft.prospection_id),
          listAllProspectionCaptures(draft.prospection_id),
          getProspection(draft.prospection_id),
        ]);
        setPhaseStadeGroups(construireDetailPhaseStade(populations, captures));
        setDefautsZero(
          prospection?.type_prospection === 'extensive' || prospection?.type_prospection === 'validation'
        );
      })
      .catch((error) => signalerChargement(error, { traitementId }));
  }, [traitementId, signalerChargement]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={1}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Cibles</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Espèce</Text>
          <Text style={styles.value}>{displayEspeces(cible)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Vols/essaims</Text>
          <Text style={styles.value}>{displayVolsClairsEssaims(cible?.vols_clairs_essaims)}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Répartition de la population</Text>
          {especePresente(cible, 'lmc') || especePresente(cible, 'nse') ? (
            <>
              {especePresente(cible, 'lmc') && (
                <Text style={styles.value}>
                  LMC — diffuse : {display(cible?.densite_diffuse_lmc)} ind./ha · groupée : {display(cible?.densite_groupee_lmc)} ind./m²
                </Text>
              )}
              {especePresente(cible, 'nse') && (
                <Text style={styles.value}>
                  NSE — diffuse : {display(cible?.densite_diffuse_nse)} ind./ha · groupée : {display(cible?.densite_groupee_nse)} ind./m²
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.value}>{display(cible?.repartition_population)}</Text>
          )}
        </View>

        {phaseStadeGroups.map((group) => (
          <Card key={`${group.espece}-${group.categorie}`}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <PhaseStadeTable title="Phase" entries={group.phases} defautsZero={defautsZero} />
            <PhaseStadeTable title="Stade" entries={group.stades} defautsZero={defautsZero} />
          </Card>
        ))}

        <Card variant="derivee" style={styles.deriveeCentree}>
          <Text style={styles.label}>Surface infestée (ha)</Text>
          <Text style={styles.derivedValue}>{display(cible?.surface_infestee_ha)}</Text>
        </Card>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() =>
            router.push({ pathname: '/(traitement)/traitement' as any, params: { traitementId, isValidationView, origineId } })
          }
        >
          <Text style={styles.continueButtonText}>Continuer  ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 12 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  // `alignItems: 'center'` centre le bloc de chaque Text (titre puis valeur)
  // dans la largeur de l'écran, quelle que soit sa longueur ; combiné au
  // `textAlign: 'center'` ci-dessous, une valeur qui retourne à la ligne
  // reste centrée ligne par ligne, pas seulement en bloc.
  field: { gap: 4, alignItems: 'center' },
  // Légèrement agrandi par rapport au reste de l'app (traitementTypeSizes.label,
  // 9) — amélioration de lisibilité ciblée à cet écran seulement, sans toucher
  // au token partagé ni aux autres slides qui l'utilisent.
  label: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps + 1,
    color: traitementColors.texteLabel,
    textAlign: 'center',
  },
  // Valeur plus visible que le titre (hiérarchie titre → valeur), mais toujours
  // nettement en retrait de `derivedValue` (Surface infestée, seule valeur
  // "vedette" de cet écran) pour ne pas aplatir cette hiérarchie-là.
  value: {
    fontFamily: traitementFonts.uiBold,
    fontSize: traitementTypeSizes.corps + 3,
    color: traitementColors.texteTitre,
    textAlign: 'center',
  },
  derivedValue: {
    fontFamily: traitementFonts.monoBold,
    fontSize: traitementTypeSizes.valeurDerivee,
    color: traitementColors.vertPrincipal,
    textAlign: 'center',
  },
  groupTitle: {
    fontFamily: traitementFonts.uiExtraBold,
    fontSize: traitementTypeSizes.corps + 1,
    color: traitementColors.texteTitre,
    marginBottom: 8,
    textAlign: 'center',
  },
  phaseStadeTable: { marginBottom: 8 },
  phaseStadeTitle: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteLabel,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: traitementColors.bordure,
  },
  detailRowLabel: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps - 1, color: traitementColors.texteLabel },
  detailRowValue: { fontFamily: traitementFonts.uiBold, fontSize: traitementTypeSizes.corps - 1, color: traitementColors.texteTitre },
  // Override local, propre à cet écran : centre le contenu de cette carte
  // "derivee" précise sans toucher au composant `Card` partagé (utilisé tel
  // quel, non centré, par d'autres écrans de la fiche de traitement).
  deriveeCentree: { alignItems: 'center' },
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
