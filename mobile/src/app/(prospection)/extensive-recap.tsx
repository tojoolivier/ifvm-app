import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import {
  concludeValidation,
  DraftProspection,
  listAllProspectionPopulations,
  listOperationsAeriennes,
  normalizeBoolean,
  OperationAerienneRow,
  PopulationRow,
} from '@/lib/prospection-repository';
import { enregistrerEtSynchroniser } from '@/lib/prospection-review';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import {
  BIOTOPE_EXTENSIVE_OPTIONS,
  TYPE_OPERATION_OPTIONS,
  formatDuree,
  imagoTotalFromRow,
  larveTotalFromRow,
  parseSelectionMultiple,
  typeCibleImagoLabel,
} from '@/lib/prospection-extensive';
import { DEGATS_OPTIONS, formatHeureLocale } from '@/lib/prospection-fiche-lecture';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';

const GREEN = '#235a36';
const RED = '#c0412b';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

interface DetailRow {
  label: string;
  value: string;
}

/**
 * Récapitulatif complet (#227) : chaque ligne du mockup demandé par l'utilisateur
 * (Nombre de captures, Phases, Accouplement, Ponte, Interdistance, Type de cible,
 * Direction, État, Comportement, Densités…) est affichée explicitement, même quand
 * la valeur est absente (« — ») — ne jamais masquer un champ silencieusement, c'est
 * précisément ce qui donnait l'impression qu'une donnée saisie avait « disparu ».
 * Seul le bloc entier LMC/NSE est masqué si l'espèce n'a strictement aucune donnée
 * (elle n'a jamais été ouverte) : cf. `imagoRowHasData`/`larveRowHasData`.
 */
function buildImagoRows(row: PopulationRow | null): DetailRow[] {
  // ✅ CORRECTION : Le nombre de captures est la somme des phases
  const totalCaptures = imagoTotalFromRow(row);
  
  return [
    { label: 'Nombre de captures', value: String(totalCaptures) },
    {
      label: 'Phases',
      value: `Sol. ${row?.captures_sol ?? 0} · Trans. ${row?.captures_trans ?? 0} · Sol-Trans. ${row?.captures_solitaro_transiens ?? 0} · Grég. ${row?.captures_greg ?? 0}`,
    },
    // Le détail des stades (femelleA1, maleA234…) n'est pas persisté pour les imagos —
    // seule la répartition par phases l'est. Le dire explicitement plutôt que d'omettre
    // la ligne : ne jamais laisser croire qu'une saisie a été perdue (règle #11).
    { label: 'Stades', value: 'Non conservés en base (seule la répartition par phases l’est)' },
    { label: 'Accouplement', value: row?.accouplement ?? '—' },
    { label: 'Ponte', value: row?.ponte ?? '—' },
    { label: 'Interdistance (m)', value: row?.interdistance != null ? String(row.interdistance) : '—' },
    { label: 'Type de cible', value: typeCibleImagoLabel(row?.type_cible) },
    {
      label: 'Direction du déplacement',
      value: row?.direction_de ? `${row.direction_de} → ${row.direction_vers}` : '—',
    },
    { label: 'État', value: row?.etat === 'repos' ? 'Repos' : row?.etat === 'deplacement' ? 'Déplacement' : '—' },
    {
      label: 'Comportement de l’essaim',
      value: row?.essaim_en_vol ? 'En vol' : row?.essaim_pose ? 'Posé' : '—',
    },
    { label: 'Densité diffuse', value: row?.densite_diffuse != null ? `${row.densite_diffuse} D/ha` : '—' },
    { label: 'Densité groupée', value: row?.densite_groupee != null ? `${row.densite_groupee} D/m²` : '—' },
  ];
}

function imagoRowHasData(row: PopulationRow | null): boolean {
  if (!row) return false;
  return (
    (row.captures_nombre ?? 0) > 0 ||
    (row.captures_sol ?? 0) > 0 ||
    (row.captures_trans ?? 0) > 0 ||
    (row.captures_solitaro_transiens ?? 0) > 0 ||
    (row.captures_greg ?? 0) > 0 ||
    row.densite_diffuse != null ||
    row.densite_groupee != null ||
    !!row.accouplement ||
    !!row.ponte ||
    row.interdistance != null ||
    !!row.etat
  );
}

function buildLarveRows(row: PopulationRow | null): DetailRow[] {
  // ✅ CORRECTION : Le nombre de captures est la somme des stades
  const totalCaptures = larveTotalFromRow(row);
  
  let stadesValue = '—';
  if (row?.densites_larve) {
    const parsed = JSON.parse(row.densites_larve) as Record<string, number>;
    const nonZero = Object.entries(parsed).filter(([, v]) => v > 0);
    if (nonZero.length > 0) stadesValue = nonZero.map(([stade, v]) => `${stade} ${v}`).join(' · ');
  }
  const autres = [
    row?.tache_larvaire ? 'Tache larvaire' : null,
    row?.bande_larvaire ? 'Bande larvaire' : null,
    row?.deplacement ? `Déplacement : ${row.deplacement === 'perchee' ? 'Perchée' : 'Repos'}` : null,
  ].filter(Boolean);

  return [
    { label: 'Nombre de captures', value: String(totalCaptures) },
    { label: 'Stades renseignés', value: stadesValue },
    { label: 'Interdistance (m)', value: row?.interdistance != null ? String(row.interdistance) : '—' },
    { label: 'Surface contaminée (ha)', value: row?.surface_contaminee_ha != null ? String(row.surface_contaminee_ha) : '—' },
    // ✅ AJOUT : Densités pour les larves (maintenant sauvegardées en base)
    { label: 'Densité diffuse', value: row?.densite_diffuse != null ? `${row.densite_diffuse} D/ha` : '—' },
    { label: 'Densité groupée', value: row?.densite_groupee != null ? `${row.densite_groupee} D/m²` : '—' },
    { label: 'Autres informations', value: autres.length > 0 ? autres.join(' · ') : '—' },
  ];
}

function larveRowHasData(row: PopulationRow | null): boolean {
  if (!row) return false;
  if ((row.captures_nombre ?? 0) > 0) return true;
  if (row.interdistance != null) return true;
  if (row.surface_contaminee_ha != null) return true;
  if (row.tache_larvaire || row.bande_larvaire) return true;
  if (row.deplacement && row.deplacement !== 'repos') return true;
  // ✅ AJOUT : Vérifier les densités
  if (row.densite_diffuse != null) return true;
  if (row.densite_groupee != null) return true;
  return false;
}

/**
 * Bloc « E · Aérien » — mode aérien uniquement. Doit afficher TOUT le domaine
 * aérien de la fiche : Références (équipe/aéronef, déjà ajoutées) ET Pesticides
 * embarqués + Signatures (cf. prompt « pesticides embarqués + signatures »).
 * `Non applicable` — jamais de valeur par défaut/périmée — n'apparaît QUE si
 * Pesticides = NON : les champs dépendants (nom commercial, quantités, fûts)
 * sont alors omis plutôt qu'affichés à `null`, cf. `buildPesticidesRows`.
 */
function buildReferencesAeriennesRows(draft: DraftProspection): DetailRow[] {
  return [
    { label: 'Société', value: draft.societe ?? '—' },
    { label: 'Immatricule Aéronef', value: draft.immatricule_aeronef ?? '—' },
    { label: 'Pilote', value: draft.pilote ?? '—' },
    { label: 'Mécanicien', value: draft.mecanicien ?? '—' },
    { label: 'Chef de base', value: draft.chef_de_base ?? '—' },
    { label: 'Base', value: draft.base ?? '—' },
    { label: 'Base secondaire', value: draft.base_secondaire ?? '—' },
  ];
}

function typeOperationLabel(value: string): string {
  return TYPE_OPERATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Biotopes/type de station (#biotope-multi) : `draft.type_station` est un JSON
 * encodé (`'["xerophyle","mesophyle"]'`) — jamais affiché brut. */
function typeStationLabel(raw: string | null): string {
  const valeurs = parseSelectionMultiple(raw);
  if (valeurs.length === 0) return '—';
  return valeurs
    .map((v) => BIOTOPE_EXTENSIVE_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(', ');
}

/** « Dégâts sur les cultures » (D — Observations, Terrestre + Aérien) — le même
 * champ `degats_cultures` que l'Intensif (`DEGATS_OPTIONS`, 4 valeurs) même si
 * l'Extensif n'en propose que 3 à la saisie : une fiche qui porterait "nuls"
 * par un autre chemin doit rester lisible ici, pas s'afficher en brut. */
function degatsCulturesLabel(value: string | null): string {
  if (!value) return '—';
  return DEGATS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function buildOperationRows(op: OperationAerienneRow): DetailRow[] {
  return [
    { label: 'Type', value: typeOperationLabel(op.type_operation) },
    // Uniquement pour Divers — jamais affiché pour Convoyage/Prospection.
    ...(op.type_operation === 'divers' ? [{ label: 'Motif', value: op.motif_divers || '—' }] : []),
    { label: 'Début — Heure', value: op.debut_heure || '—' },
    { label: 'Début — Température', value: op.debut_temperature_c != null ? `${op.debut_temperature_c} °C` : '—' },
    { label: 'Début — Vent', value: op.debut_vent_ms != null ? `${op.debut_vent_ms} m/s` : '—' },
    { label: 'Fin — Heure', value: op.fin_heure || '—' },
    { label: 'Fin — Température', value: op.fin_temperature_c != null ? `${op.fin_temperature_c} °C` : '—' },
    { label: 'Fin — Vent', value: op.fin_vent_ms != null ? `${op.fin_vent_ms} m/s` : '—' },
    { label: 'Total heure de vol', value: formatDuree(op.duree_minutes) },
  ];
}

/** `NON` (ou jamais renseigné) → une seule ligne, les champs dépendants ne sont
 * ni affichés à vide ni à une valeur périmée : ils sont absents du tableau. */
function buildPesticidesRows(draft: DraftProspection): DetailRow[] {
  const embarques = normalizeBoolean(draft.pesticides_embarques);
  if (embarques !== true) {
    return [{ label: 'Pesticides embarqués', value: embarques === false ? 'NON' : '—' }];
  }
  return [
    { label: 'Pesticides embarqués', value: 'OUI' },
    { label: 'Nom commercial', value: draft.pesticide_nom_commercial ?? '—' },
    { label: 'Quantité disponible', value: draft.pesticide_quantite_disponible != null ? `${draft.pesticide_quantite_disponible} L` : '—' },
    { label: 'Quantité reçue', value: draft.pesticide_quantite_recue != null ? `${draft.pesticide_quantite_recue} L` : '—' },
    { label: 'Fûts — Disponible', value: draft.futs_disponible != null ? String(draft.futs_disponible) : '—' },
    { label: 'Fûts — Pleins', value: draft.futs_pleins != null ? String(draft.futs_pleins) : '—' },
    { label: 'Fûts — Vides', value: draft.futs_vides != null ? String(draft.futs_vides) : '—' },
    { label: 'Fûts — Reçues', value: draft.futs_recues != null ? String(draft.futs_recues) : '—' },
  ];
}

function buildSignaturesRows(draft: DraftProspection): DetailRow[] {
  const roles: [string, string | null, string | null][] = [
    ['VISA', draft.signature_visa_nom, draft.signature_visa_horodatage],
    ['Consultant FAO', draft.signature_consultant_fao_nom, draft.signature_consultant_fao_horodatage],
    ['Pilote', draft.signature_pilote_nom, draft.signature_pilote_horodatage],
    ['Chef de Base', draft.signature_chef_base_nom, draft.signature_chef_base_horodatage],
  ];
  return roles.map(([label, nom, horodatage]) => ({
    label,
    value: nom ? `${nom} — ${formatHeureLocale(horodatage)}` : '—',
  }));
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.detailRowLabel}>{row.label}</Text>
          <Text style={styles.detailRowValue}>{row.value}</Text>
        </View>
      ))}
    </>
  );
}

export default function ExtensiveRecapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const draft = useProspectionWizardStore((s) => s.draft);
  const resetWizard = useProspectionWizardStore((s) => s.reset);
  const { run, isRunning: isSaving } = useAsyncAction();
  const [populations, setPopulations] = useState<PopulationRow[]>([]);
  const [operationsAeriennes, setOperationsAeriennes] = useState<OperationAerienneRow[]>([]);
  const signalerChargement = useSignalerChargement('extensive-recap');
  // Terrestre implicite (NULL) — même garde que sur les autres écrans du mode aérien.
  const isAerien = draft?.mode_extensif === 'aerien';

  useEffect(() => {
    if (!draft) return;
    void listAllProspectionPopulations(draft.id)
      .then(setPopulations)
      .catch((error) => signalerChargement(error, { draftId: draft.id }));
  }, [draft?.id, signalerChargement]);

  useEffect(() => {
    if (!draft || !isAerien) return;
    void listOperationsAeriennes(draft.id)
      .then(setOperationsAeriennes)
      .catch((error) => signalerChargement(error, { draftId: draft.id }));
  }, [draft, isAerien, signalerChargement]);

  const totalJourMinutes = useMemo(
    () => operationsAeriennes.reduce((sum, op) => sum + op.duree_minutes, 0),
    [operationsAeriennes]
  );

  const totals = useMemo(() => {
    const findRow = (espece: 'LMC' | 'NSE', categorie: 'imago' | 'larve') =>
      populations.find((p) => p.espece === espece && p.categorie === categorie) ?? null;
    const imagoLMCRow = findRow('LMC', 'imago');
    const imagoNSERow = findRow('NSE', 'imago');
    const larveLMCRow = findRow('LMC', 'larve');
    const larveNSERow = findRow('NSE', 'larve');
    return {
      imagoLMC: imagoTotalFromRow(imagoLMCRow),
      imagoNSE: imagoTotalFromRow(imagoNSERow),
      larveLMC: larveTotalFromRow(larveLMCRow),
      larveNSE: larveTotalFromRow(larveNSERow),
      imagoLMCRows: imagoRowHasData(imagoLMCRow) ? buildImagoRows(imagoLMCRow) : null,
      imagoNSERows: imagoRowHasData(imagoNSERow) ? buildImagoRows(imagoNSERow) : null,
      larveLMCRows: larveRowHasData(larveLMCRow) ? buildLarveRows(larveLMCRow) : null,
      larveNSERows: larveRowHasData(larveNSERow) ? buildLarveRows(larveNSERow) : null,
    };
  }, [populations]);

  if (!draft) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe} />
      </View>
    );
  }

  const isValidation = draft.type_prospection === 'validation';

  const handleSave = () =>
    run(
      async () => {
        await enregistrerEtSynchroniser(draft, [], token!);
        resetWizard();
        router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } });
      },
      {
        screen: 'extensive-recap',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { draftId: draft.id },
      }
    );

  const handleConclude = (conclusion: 'confirmee' | 'infirmee') =>
    run(
      async () => {
        const concluded = await concludeValidation(draft.id, conclusion);
        await enregistrerEtSynchroniser(concluded, [], token!);
        resetWizard();
        router.replace({ pathname: '/(app)/prospection' as any, params: { justSaved: '1' } });
      },
      {
        screen: 'extensive-recap',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour enregistrer.',
        context: { draftId: draft.id, conclusion },
      }
    );

  if (isValidation) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.safe}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.headerGreen}>
              <View style={styles.headerRowGreen}>
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                  <Text style={styles.backWhite}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.titleWhite}>Vérification du signalement</Text>
                  <Text style={styles.subtitleWhite}>
                    Signalé par {draft.signalement_source ?? '—'} · {draft.signalement_date ?? '—'}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              <View style={styles.quoteBanner}>
                <Text style={styles.quoteText}>« {draft.signalement_description ?? '—'} » — signalement reçu, lieu approximatif.</Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.figureCard, styles.flex1]}>
                  <Text style={styles.figureLabel}>Imagos — LMC/NSE</Text>
                  <Text style={styles.figureValue}>{totals.imagoLMC} / {totals.imagoNSE}</Text>
                </View>
                <View style={[styles.figureCard, styles.flex1]}>
                  <Text style={styles.figureLabel}>Larves — LMC/NSE</Text>
                  <Text style={styles.figureValue}>{totals.larveLMC} / {totals.larveNSE}</Text>
                </View>
              </View>

              <Text style={styles.detailSubtitle}>Référence</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.detailLine}>Station : {draft.station_libre ?? '—'} · Type : {typeStationLabel(draft.type_station)}</Text>
                <Text style={styles.detailLine}>
                  GPS : {draft.latitude?.toFixed(4) ?? '—'}, {draft.longitude?.toFixed(4) ?? '—'}
                </Text>
                <Text style={styles.detailLine}>Surface infestée : {draft.surface_infestee ?? '—'} ha</Text>
                <Text style={styles.detailLine}>Heure d’observation : {formatHeureLocale(draft.heure_observation_at)}</Text>
              </View>

              {(totals.imagoLMCRows || totals.imagoNSERows) && (
                <>
                  <Text style={styles.detailSubtitle}>Imagos</Text>
                  <View style={styles.summaryCard}>
                    {totals.imagoLMCRows && (
                      <>
                        <Text style={styles.detailLine}>LMC</Text>
                        <DetailRows rows={totals.imagoLMCRows} />
                      </>
                    )}
                    {totals.imagoNSERows && (
                      <>
                        <Text style={[styles.detailLine, { marginTop: totals.imagoLMCRows ? 6 : 0 }]}>NSE</Text>
                        <DetailRows rows={totals.imagoNSERows} />
                      </>
                    )}
                  </View>
                </>
              )}

              {(totals.larveLMCRows || totals.larveNSERows) && (
                <>
                  <Text style={styles.detailSubtitle}>Larves</Text>
                  <View style={styles.summaryCard}>
                    {totals.larveLMCRows && (
                      <>
                        <Text style={styles.detailLine}>LMC</Text>
                        <DetailRows rows={totals.larveLMCRows} />
                      </>
                    )}
                    {totals.larveNSERows && (
                      <>
                        <Text style={[styles.detailLine, { marginTop: totals.larveLMCRows ? 6 : 0 }]}>NSE</Text>
                        <DetailRows rows={totals.larveNSERows} />
                      </>
                    )}
                  </View>
                </>
              )}

              <Text style={styles.detailSubtitle}>Observations</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.detailLine}>Dégâts sur les cultures : {degatsCulturesLabel(draft.degats_cultures)}</Text>
                <Text style={styles.detailLine}>Verdure strate herbeuse : {draft.verdissement_pourcent != null ? `${draft.verdissement_pourcent} %` : '—'}</Text>
                <Text style={styles.detailLine}>
                  H. strate herbeuse : {draft.hauteur_herbe_cm != null ? `${(draft.hauteur_herbe_cm / 100).toFixed(2)} m` : '—'}
                </Text>
                <Text style={styles.detailLine}>Dernière pluie : {draft.derniere_pluie ?? '—'}</Text>
                <Text style={styles.detailLine}>Intensité pluie : {draft.intensite_pluie ?? '—'}</Text>
                <Text style={styles.detailLine}>Remarques : {draft.observations || '—'}</Text>
              </View>

              {isAerien && (
                <>
                  <Text style={styles.detailSubtitle}>Références aériennes</Text>
                  <View style={styles.summaryCard}>
                    <DetailRows rows={buildReferencesAeriennesRows(draft)} />
                  </View>

                  <Text style={styles.detailSubtitle}>Opérations</Text>
                  <View style={styles.summaryCard}>
                    {operationsAeriennes.length === 0 ? (
                      <Text style={styles.detailLine}>Aucune opération enregistrée.</Text>
                    ) : (
                      operationsAeriennes.map((op, index) => (
                        <View key={index} style={index > 0 ? { marginTop: 8 } : undefined}>
                          <Text style={styles.detailLine}>Opération {index + 1}</Text>
                          <DetailRows rows={buildOperationRows(op)} />
                        </View>
                      ))
                    )}
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailRowLabel, { fontWeight: '700' }]}>Total jour</Text>
                      <Text style={styles.detailRowValue}>{formatDuree(totalJourMinutes)}</Text>
                    </View>
                  </View>

                  <Text style={styles.detailSubtitle}>Pesticides embarqués</Text>
                  <View style={styles.summaryCard}>
                    <DetailRows rows={buildPesticidesRows(draft)} />
                  </View>

                  <Text style={styles.detailSubtitle}>Signatures</Text>
                  <View style={styles.summaryCard}>
                    <DetailRows rows={buildSignaturesRows(draft)} />
                  </View>
                </>
              )}

              <Text style={styles.conclusionLabel}>Conclusion de la vérification</Text>
            </ScrollView>

            <View style={[styles.footerRow, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
              <TouchableOpacity
                style={styles.infirmeeButton}
                onPress={() => handleConclude('infirmee')}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.infirmeeButtonText}>✗ Infirmée</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmeeButton}
                onPress={() => handleConclude('confirmee')}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmeeButtonText}>✓ Confirmée</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.headerGreen}>
            <View style={styles.headerRowGreen}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.backWhite}>‹</Text>
              </TouchableOpacity>
              <View>
                <Text style={styles.titleWhite}>Récapitulatif</Text>
                <Text style={styles.subtitleWhite}>
                  {draft.station_libre ?? '—'} · N°{draft.n_message ?? '—'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 8 }}>
            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>A · Référence</Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailSubtitle}>Informations générales</Text>
              <Text style={styles.detailLine}>N° message : {draft.n_message ?? '—'}</Text>
              <Text style={styles.detailLine}>Date : {draft.date_prospection ?? '—'}</Text>

              <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Station</Text>
              <Text style={styles.detailLine}>Station : {draft.station_libre ?? '—'}</Text>
              <Text style={styles.detailLine}>Type de station : {typeStationLabel(draft.type_station)}</Text>
              <Text style={styles.detailLine}>
                GPS : {draft.latitude?.toFixed(4) ?? '—'}, {draft.longitude?.toFixed(4) ?? '—'}
              </Text>

              <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Surfaces</Text>
              <Text style={styles.detailLine}>Surface station : {draft.surface_station ?? '—'} ha</Text>
              <Text style={styles.detailLine}>Surface infestée : {draft.surface_infestee ?? '—'} ha</Text>

              <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Heure d’observation</Text>
              <Text style={styles.detailLine}>{formatHeureLocale(draft.heure_observation_at)}</Text>
            </View>

            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>B · Imagos — LMC {totals.imagoLMC} · NSE {totals.imagoNSE}</Text>
            </View>
            {(totals.imagoLMCRows || totals.imagoNSERows) && (
              <View style={styles.detailCard}>
                {totals.imagoLMCRows && (
                  <>
                    <Text style={styles.detailSubtitle}>LMC</Text>
                    <DetailRows rows={totals.imagoLMCRows} />
                  </>
                )}
                {totals.imagoNSERows && (
                  <>
                    <Text style={[styles.detailSubtitle, { marginTop: totals.imagoLMCRows ? 8 : 0 }]}>NSE</Text>
                    <DetailRows rows={totals.imagoNSERows} />
                  </>
                )}
              </View>
            )}

            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>C · Larves — LMC {totals.larveLMC} · NSE {totals.larveNSE}</Text>
            </View>
            {(totals.larveLMCRows || totals.larveNSERows) && (
              <View style={styles.detailCard}>
                {totals.larveLMCRows && (
                  <>
                    <Text style={styles.detailSubtitle}>LMC</Text>
                    <DetailRows rows={totals.larveLMCRows} />
                  </>
                )}
                {totals.larveNSERows && (
                  <>
                    <Text style={[styles.detailSubtitle, { marginTop: totals.larveLMCRows ? 8 : 0 }]}>NSE</Text>
                    <DetailRows rows={totals.larveNSERows} />
                  </>
                )}
              </View>
            )}

            <View style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <Text style={styles.checkBadgeText}>✓</Text>
              </View>
              <Text style={styles.checkLabel}>D · Observations — dégâts {degatsCulturesLabel(draft.degats_cultures)}</Text>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailLine}>Dégâts sur les cultures : {degatsCulturesLabel(draft.degats_cultures)}</Text>
              <Text style={styles.detailLine}>Verdure strate herbeuse : {draft.verdissement_pourcent != null ? `${draft.verdissement_pourcent} %` : '—'}</Text>
              <Text style={styles.detailLine}>
                H. strate herbeuse : {draft.hauteur_herbe_cm != null ? `${(draft.hauteur_herbe_cm / 100).toFixed(2)} m` : '—'}
              </Text>
              <Text style={styles.detailLine}>Dernière pluie : {draft.derniere_pluie ?? '—'}</Text>
              <Text style={styles.detailLine}>Intensité pluie : {draft.intensite_pluie ?? '—'}</Text>
              <Text style={styles.detailLine}>Remarques : {draft.observations || '—'}</Text>
            </View>

            {isAerien && (
              <>
                <View style={styles.checkRow}>
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkBadgeText}>✓</Text>
                  </View>
                  <Text style={styles.checkLabel}>E · Aérien</Text>
                </View>
                <View style={styles.detailCard}>
                  <Text style={styles.detailSubtitle}>Références aériennes</Text>
                  <DetailRows rows={buildReferencesAeriennesRows(draft)} />

                  <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Opérations</Text>
                  {operationsAeriennes.length === 0 ? (
                    <Text style={styles.detailLine}>Aucune opération enregistrée.</Text>
                  ) : (
                    operationsAeriennes.map((op, index) => (
                      <View key={index} style={index > 0 ? { marginTop: 8 } : undefined}>
                        <Text style={styles.detailLine}>Opération {index + 1}</Text>
                        <DetailRows rows={buildOperationRows(op)} />
                      </View>
                    ))
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailRowLabel, { fontWeight: '700' }]}>Total jour</Text>
                    <Text style={styles.detailRowValue}>{formatDuree(totalJourMinutes)}</Text>
                  </View>

                  <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Pesticides embarqués</Text>
                  <DetailRows rows={buildPesticidesRows(draft)} />

                  <Text style={[styles.detailSubtitle, { marginTop: 8 }]}>Signatures</Text>
                  <DetailRows rows={buildSignaturesRows(draft)} />
                </View>
              </>
            )}

            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>☁︎ Pas de réseau ici — la fiche part en file de synchronisation.</Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
              <Text style={styles.saveButtonText}>Enregistrer (hors-ligne) ✓</Text>
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
  headerGreen: { backgroundColor: GREEN, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  headerRowGreen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backWhite: { fontSize: 20, fontWeight: '700', color: '#fff' },
  titleWhite: { fontSize: 14, fontWeight: '700', color: '#fff' },
  subtitleWhite: { fontSize: 10.5, fontWeight: '500', color: '#ffffffcc', marginTop: 2 },
  scroll: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11 },
  checkBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  checkBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  checkLabel: { fontSize: 12.5, fontWeight: '600', color: '#2a2a22' },
  detailCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginTop: -2 },
  detailSubtitle: { fontSize: 10, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  detailLine: { fontSize: 12, color: '#5c5848', lineHeight: 17 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f0eee8' },
  detailRowLabel: { fontSize: 11.5, color: TEXT_SECONDARY, flexShrink: 1 },
  detailRowValue: { fontSize: 11.5, color: TEXT, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  offlineBanner: { marginTop: 6, backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 11, padding: 12 },
  offlineText: { fontSize: 11, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  footer: { padding: 16 },
  saveButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  quoteBanner: { backgroundColor: '#fdf6e7', borderWidth: 1, borderColor: '#f0e2bf', borderRadius: 10, padding: 11, marginBottom: 12 },
  quoteText: { fontSize: 11.5, lineHeight: 16, color: '#8a6d2f', fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  flex1: { flex: 1 },
  figureCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9 },
  figureLabel: { fontSize: 9, fontWeight: '500', color: '#9a9484', textTransform: 'uppercase' },
  figureValue: { fontSize: 17, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  summaryCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, marginBottom: 14 },
  summaryText: { fontSize: 11.5, lineHeight: 16, color: '#5c5848', fontWeight: '500' },
  conclusionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 9 },
  footerRow: { padding: 16, paddingTop: 10, flexDirection: 'row', gap: 9 },
  infirmeeButton: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: RED, borderRadius: 13, padding: 14, alignItems: 'center' },
  infirmeeButtonText: { color: RED, fontWeight: '800', fontSize: 13 },
  confirmeeButton: { flex: 1, backgroundColor: GREEN, borderRadius: 13, padding: 14, alignItems: 'center' },
  confirmeeButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';