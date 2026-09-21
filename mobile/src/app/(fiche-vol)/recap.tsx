import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import type { components } from '@/lib/api-schema.generated';
import { useAsyncAction } from '@/hooks/use-async-action';
import { TimeField } from '@/components/TimeField';
import { SignaturePad } from '@/components/traitement/SignaturePad';
import { ProspectionValideeField } from '@/components/referentiel/ProspectionValideeField';
import { TraitementAerienDuJourField } from '@/components/referentiel/TraitementAerienDuJourField';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const ORANGE = '#c07a2b';
const ORANGE_BG = '#fdf1e3';
const GREEN_BG = '#eaf3ec';

type FicheVolRead = components['schemas']['FicheVolRead'];
type VolRead = components['schemas']['VolRead'];
type TraitementRead = components['schemas']['TraitementRead'];
type RotationRead = components['schemas']['RotationRead'];
type BlocRead = components['schemas']['BlocRead'];
type TypeVol = components['schemas']['VolCreate']['type_vol'];
type RoleSignature = components['schemas']['SignatureVolUpsert']['role'];

const TYPES_VOL: { value: TypeVol; label: string }[] = [
  { value: 'PROSPECTION', label: 'Prospection' },
  { value: 'MEP', label: 'Mise en place' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'CONVOYAGE', label: 'Convoyage' },
  { value: 'DIVERS', label: 'Divers' },
];

const ROLES_SIGNATURE: { role: RoleSignature; label: string }[] = [
  { role: 'PILOTE', label: 'Pilote' },
  { role: 'MECANICIEN', label: 'Mécanicien' },
  { role: 'CHEF_DE_BASE', label: 'Chef de base' },
  { role: 'CONSULTANT_INTERNATIONAL', label: 'Consultant international' },
];

function toMinutes(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function dureesParType(vols: VolRead[]): { type: TypeVol; label: string; minutes: number }[] {
  const parType = new Map<TypeVol, number>();
  for (const vol of vols) {
    parType.set(vol.type_vol as TypeVol, (parType.get(vol.type_vol as TypeVol) ?? 0) + vol.duree_minutes);
  }
  return TYPES_VOL.map(({ value, label }) => ({ type: value, label, minutes: parType.get(value) ?? 0 }));
}

/**
 * Fiche de vol complète (#fiche-vol-saisie-vols) — écran unique qui prolonge
 * l'en-tête créé par `creation.tsx` : saisie des vols de la journée, tableaux
 * Traitement (bloc) / Opération (rotation) en lecture depuis le CRT aérien
 * rattaché à la prospection de référence (s'il y en a une), pesticide/fûts en
 * lecture, signatures, puis validation. Une seule page plutôt qu'un chantier
 * par section : c'est aussi la forme de la fiche papier qu'elle numérise.
 */
export default function FicheVolRecapScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const params = useLocalSearchParams<{ id: string; chefDeBaseNom?: string }>();
  const ficheVolId = params.id;

  const [fiche, setFiche] = useState<FicheVolRead | null>(null);
  const [traitement, setTraitement] = useState<TraitementRead | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { run: runChargement, isRunning: isChargement } = useAsyncAction();
  const { run: runAjoutVol, isRunning: isAjoutVolEnCours } = useAsyncAction();
  const { run: runSuppressionVol } = useAsyncAction();
  const { run: runSignature, isRunning: isSignatureEnCours } = useAsyncAction();
  const { run: runValidation, isRunning: isValidationEnCours } = useAsyncAction();

  const [typeVol, setTypeVol] = useState<TypeVol>('CONVOYAGE');
  const [heureDebut, setHeureDebut] = useState<string | null>(null);
  const [heureFin, setHeureFin] = useState<string | null>(null);
  const [rotationId, setRotationId] = useState<string | null>(null);
  // Rattachement du vol en cours de saisie, choisi vol par vol (une journée peut mêler des
  // vols de prospection et de traitement aérien : un seul `prospection_id` d'en-tête ne suffit pas).
  const [prospectionVolId, setProspectionVolId] = useState<string | null>(null);
  const [traitementChoisi, setTraitementChoisi] = useState<TraitementRead | null>(null);
  const [signatureEnEdition, setSignatureEnEdition] = useState<RoleSignature | null>(null);
  const [traceSignature, setTraceSignature] = useState('');

  const charger = useCallback(() => {
    if (!ficheVolId) return;
    void runChargement(
      async () => {
        const f = await apiClient.getFicheVol(token!, ficheVolId);
        setFiche(f);
        if (f.prospection_id) {
          const traitements = await apiClient.listTraitements(token!, { prospection_id: f.prospection_id });
          setTraitement(traitements.find((t) => t.aerien != null) ?? null);
        } else {
          setTraitement(null);
        }
        setLoaded(true);
      },
      { screen: 'fiche-vol-recap', precondition: !!token, context: { ficheVolId } }
    );
  }, [ficheVolId, runChargement, token]);

  useFocusEffect(charger);

  const verrouillee = fiche?.statut === 'validee';
  const traitementAffiche = traitementChoisi ?? traitement;
  const rotations: RotationRead[] = traitementAffiche?.aerien?.rotations ?? [];
  const blocs: BlocRead[] = traitementAffiche?.aerien?.blocs ?? [];
  const especeCible = traitementAffiche?.cible?.espece ?? null;

  const volsActuels = fiche?.vols ?? [];
  const prochainNumero = volsActuels.length === 0 ? 1 : Math.max(...volsActuels.map((v) => v.numero)) + 1;
  const rattachementRotation = typeVol === 'MEP' || typeVol === 'APPLICATION';
  // `uq_vol_rotation_type` : une rotation = une mise en place + une application.
  const rotationsIndisponibles = volsActuels
    .filter((v) => v.type_vol === typeVol && v.rotation_id)
    .map((v) => v.rotation_id as string);

  const ajouterVol = () =>
    runAjoutVol(
      async () => {
        const mis_a_jour = await apiClient.addVolFicheVol(token!, ficheVolId, {
          numero: prochainNumero,
          type_vol: typeVol,
          heure_debut: heureDebut!,
          heure_fin: heureFin!,
          rotation_id: rattachementRotation ? rotationId : null,
          // Prospection choisie pour CE vol ; à défaut, la prospection d'en-tête (comportement
          // historique, fiches sans choix explicite).
          prospection_id:
            typeVol === 'PROSPECTION' ? (prospectionVolId ?? fiche?.prospection_id ?? null) : null,
        });
        setFiche(mis_a_jour);
        setHeureDebut(null);
        setHeureFin(null);
        setRotationId(null);
        setProspectionVolId(null);
      },
      {
        screen: 'fiche-vol-recap',
        precondition: !!token && !!heureDebut && !!heureFin,
        preconditionMessage: "Renseignez l'heure de début et l'heure de fin du vol.",
        context: { ficheVolId, typeVol },
      }
    );

  const supprimerVol = (volId: string) =>
    runSuppressionVol(
      async () => {
        const mis_a_jour = await apiClient.removeVolFicheVol(token!, ficheVolId, volId);
        setFiche(mis_a_jour);
      },
      { screen: 'fiche-vol-recap', precondition: !!token, context: { ficheVolId, volId } }
    );

  const nomAttendu = (role: RoleSignature): string | null => {
    if (!fiche) return null;
    if (role === 'PILOTE') return fiche.pilote;
    if (role === 'MECANICIEN') return fiche.mecanicien;
    if (role === 'CHEF_DE_BASE') return params.chefDeBaseNom || fiche.chef_de_base_id;
    return fiche.consultant_international ?? null;
  };

  const signer = (role: RoleSignature) =>
    runSignature(
      async () => {
        const nom = nomAttendu(role)!;
        const mis_a_jour = await apiClient.upsertSignatureFicheVol(token!, ficheVolId, {
          role,
          signataire_nom: nom,
          signature_image: traceSignature,
        });
        setFiche(mis_a_jour);
        setSignatureEnEdition(null);
        setTraceSignature('');
      },
      {
        screen: 'fiche-vol-recap',
        precondition: !!token && traceSignature.length > 0,
        preconditionMessage: 'Tracez la signature avant de valider.',
        context: { ficheVolId, role },
      }
    );

  const validerFiche = () =>
    runValidation(
      async () => {
        const mis_a_jour = await apiClient.validerFicheVol(token!, ficheVolId);
        setFiche(mis_a_jour);
      },
      { screen: 'fiche-vol-recap', precondition: !!token, context: { ficheVolId } }
    );

  if (!loaded) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.centre}>
            {isChargement ? (
              <ActivityIndicator color={GREEN} />
            ) : (
              <TouchableOpacity onPress={charger} accessibilityRole="button">
                <Text style={styles.chargerLinkText}>Charger la fiche ›</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!fiche) return null;

  const vols = fiche.vols ?? [];
  const signatures = fiche.signatures ?? [];
  const durees = dureesParType(vols);
  const totalMinutes = durees.reduce((acc, d) => acc + d.minutes, 0);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{fiche.numero_fiche}</Text>
          <View style={styles.headerSpacer} />
          <View style={[styles.badge, verrouillee ? styles.badgeValidee : styles.badgeBrouillon]}>
            <Text style={[styles.badgeText, { color: verrouillee ? GREEN : ORANGE }]}>
              {verrouillee ? 'VALIDÉE' : 'BROUILLON'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Référence */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Référence</Text>
            <Ligne label="Date" valeur={fiche.date_vol} />
            <Ligne label="Compagnie" valeur={fiche.compagnie} />
            <Ligne label="Immatriculation" valeur={fiche.immatriculation} />
            <Ligne label="Base" valeur={`${fiche.base_numero ?? '—'} — ${fiche.base_localite ?? '—'}`} />
            <Ligne label="Stand de remplissage" valeur={`${fiche.stand_numero ?? '—'} — ${fiche.stand_localite ?? '—'}`} />
            <Ligne label="Pilote" valeur={fiche.pilote} />
            <Ligne label="Mécanicien" valeur={fiche.mecanicien} />
            <Ligne label="Chef de base" valeur={params.chefDeBaseNom || fiche.chef_de_base_id} />
            {fiche.consultant_international && <Ligne label="Consultant international" valeur={fiche.consultant_international} />}
            {fiche.prospection_numero_fiche && (
              <>
                <Ligne label="N° fiche de prospection" valeur={fiche.prospection_numero_fiche} />
                <Ligne label="N° fiche de validation" valeur={fiche.prospection_numero_fiche} />
                <Ligne
                  label="Date de validation"
                  valeur={fiche.prospection_date_validation ? fiche.prospection_date_validation.slice(0, 10) : 'non validée'}
                />
              </>
            )}
          </View>

          {/* Vols de la journée */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vols de la journée</Text>
            {vols.length === 0 && <Text style={styles.vide}>Aucun vol saisi.</Text>}
            {vols.map((vol) => (
              <View key={vol.id} style={styles.volRow}>
                <View style={styles.volRowTexte}>
                  <Text style={styles.volRowTitre}>
                    V{vol.numero} · {TYPES_VOL.find((t) => t.value === vol.type_vol)?.label ?? vol.type_vol}
                  </Text>
                  <Text style={styles.volRowSousTexte}>
                    {vol.heure_debut.slice(0, 5)} → {vol.heure_fin.slice(0, 5)} · {formatMinutes(vol.duree_minutes)}
                    {vol.numero_cuve ? ` · Cuve ${vol.numero_cuve}${vol.produit_nom ? ` · ${vol.produit_nom}` : ''}` : ''}
                  </Text>
                </View>
                {!verrouillee && (
                  <TouchableOpacity onPress={() => supprimerVol(vol.id)} accessibilityRole="button">
                    <Text style={styles.supprimerLink}>Retirer</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {!verrouillee && (
              <View style={styles.formulaire}>
                <Text style={styles.sousLabel}>Type de vol</Text>
                <View style={styles.chipsRow}>
                  {TYPES_VOL.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.chip, typeVol === value && styles.chipSelectionne]}
                      onPress={() => {
                        setTypeVol(value);
                        setRotationId(null);
                        setProspectionVolId(null);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, typeVol === value && styles.chipTextSelectionne]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.rowInputs}>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.sousLabel}>Heure de début</Text>
                    <TimeField value={heureDebut} onChange={setHeureDebut} />
                  </View>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.sousLabel}>Heure de fin</Text>
                    <TimeField value={heureFin} onChange={setHeureFin} />
                  </View>
                </View>

                {typeVol === 'PROSPECTION' && (
                  <ProspectionValideeField
                    value={prospectionVolId}
                    onChange={(id) => setProspectionVolId(id)}
                    date={fiche.date_vol}
                    statut={null}
                    label="Fiche de prospection du jour"
                  />
                )}

                {rattachementRotation && (
                  <TraitementAerienDuJourField
                    date={fiche.date_vol}
                    traitement={traitementChoisi}
                    rotationId={rotationId}
                    onTraitementChange={setTraitementChoisi}
                    onRotationChange={setRotationId}
                    rotationsIndisponibles={rotationsIndisponibles}
                  />
                )}

                <TouchableOpacity
                  style={[styles.secondaryButton, isAjoutVolEnCours && styles.boutonDisabled]}
                  onPress={ajouterVol}
                  disabled={isAjoutVolEnCours}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>{isAjoutVolEnCours ? 'Ajout…' : '+ Ajouter le vol'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.dureesRecap}>
              {durees.map((d) => (
                <View key={d.type} style={styles.dureeItem}>
                  <Text style={styles.dureeLabel}>{d.label}</Text>
                  <Text style={styles.dureeValeur}>{formatMinutes(d.minutes)}</Text>
                </View>
              ))}
              <View style={styles.dureeItem}>
                <Text style={styles.dureeLabelTotal}>Total heure de vol</Text>
                <Text style={styles.dureeValeurTotal}>{formatMinutes(totalMinutes)}</Text>
              </View>
            </View>
          </View>

          {/* Traitement (par bloc) */}
          {blocs.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Traitement</Text>
              {blocs.map((bloc) => (
                <View key={bloc.id} style={styles.blocRow}>
                  <Text style={styles.blocTitre}>{bloc.nom}</Text>
                  <Text style={styles.blocSousTexte}>
                    {bloc.localite ?? 'localité non renseignée'} · Espèce {especeCible ?? '—'}
                  </Text>
                  <Text style={styles.blocSousTexte}>
                    Surface {bloc.surface_protegee_ha ? `protégée ${bloc.surface_protegee_ha} ha` : `traitée ${bloc.surface_traitee_ha ?? 0} ha`}
                    {' · '}Interpasse {bloc.interpasse_m ?? '—'} m · Hauteur {bloc.hauteur_vol_min_m ?? '—'}-{bloc.hauteur_vol_max_m ?? '—'} m
                  </Text>
                  {bloc.observation && <Text style={styles.blocSousTexte}>{bloc.observation}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Opération (rotations) */}
          {rotations.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Opération</Text>
              {rotations.map((rotation) => (
                <View key={rotation.id} style={styles.blocRow}>
                  <Text style={styles.blocTitre}>
                    Cuve {rotation.numero_cuve} · {rotation.nom_commercial ?? 'produit inconnu'} · {rotation.quantite} {rotation.unite}
                  </Text>
                  <Text style={styles.blocSousTexte}>
                    Début {rotation.heure_debut.slice(0, 5)} ({rotation.temperature_debut_c}°C, {rotation.vent_debut_ms} m/s)
                  </Text>
                  <Text style={styles.blocSousTexte}>
                    Fin {rotation.heure_fin.slice(0, 5)} ({rotation.temperature_fin_c}°C, {rotation.vent_fin_ms} m/s)
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Pesticide / fûts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pesticide</Text>
            <Ligne label="Nom commercial" valeur={fiche.pesticide_nom_commercial ?? '—'} />
            <Ligne label="Quantité disponible" valeur={`${fiche.pesticide_quantite_disponible ?? '—'} L`} />
            <Ligne label="Quantité reçue" valeur={`${fiche.pesticide_quantite_recue ?? '—'} L`} />
            <Ligne label="Quantité utilisée" valeur={`${fiche.pesticide_quantite_utilisee ?? 0} L`} />
            <Ligne label="Quantité restante" valeur={`${fiche.pesticide_quantite_restante ?? '—'} L`} />
            <Text style={styles.cardSousTitre}>Nombre de fûts</Text>
            <Ligne label="Disponibles" valeur={String(fiche.futs_disponible ?? '—')} />
            <Ligne label="Reçues" valeur={String(fiche.futs_recues ?? '—')} />
            <Ligne label="Pleins" valeur={String(fiche.futs_pleins ?? '—')} />
            <Ligne label="Vides" valeur={String(fiche.futs_vides ?? '—')} />
          </View>

          {/* Remarques */}
          {fiche.observations && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Remarques</Text>
              <Text style={styles.remarquesTexte}>{fiche.observations}</Text>
            </View>
          )}

          {/* Signatures */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Signatures</Text>
            {ROLES_SIGNATURE.filter((r) => nomAttendu(r.role) !== null).map(({ role, label }) => {
              const nom = nomAttendu(role)!;
              const existante = signatures.find((s) => s.role === role);
              const enEdition = signatureEnEdition === role || !existante;

              return (
                <View key={role} style={styles.signatureRow}>
                  <Text style={styles.blocTitre}>
                    {label} — {nom}
                  </Text>
                  {!verrouillee && enEdition && (
                    <>
                      <SignaturePad
                        key={`${role}-${existante ? 'reset' : 'init'}`}
                        testID={`signature-pad-${role}`}
                        value={null}
                        onChange={setTraceSignature}
                      />
                      <TouchableOpacity
                        style={[styles.secondaryButton, isSignatureEnCours && styles.boutonDisabled]}
                        onPress={() => signer(role)}
                        disabled={isSignatureEnCours}
                        accessibilityRole="button"
                      >
                        <Text style={styles.secondaryButtonText}>{isSignatureEnCours ? 'Enregistrement…' : 'Signer'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {!enEdition && existante && (
                    <>
                      <SignaturePad testID={`signature-pad-${role}`} value={existante.signature_image} onChange={() => {}} readOnly />
                      <Text style={styles.hint}>Signature enregistrée</Text>
                      {!verrouillee && (
                        <TouchableOpacity
                          onPress={() => {
                            setTraceSignature('');
                            setSignatureEnEdition(role);
                          }}
                          accessibilityRole="button"
                        >
                          <Text style={styles.supprimerLink}>Modifier</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>

          {!verrouillee && (
            <TouchableOpacity
              style={[styles.continueButton, isValidationEnCours && styles.boutonDisabled]}
              onPress={validerFiche}
              disabled={isValidationEnCours}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{isValidationEnCours ? 'Validation…' : 'Valider la fiche'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLabel}>{label}</Text>
      <Text style={styles.ligneValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chargerLinkText: { fontSize: 14, fontWeight: '700', color: GREEN },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerSpacer: { flex: 1 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  badge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10 },
  badgeValidee: { backgroundColor: GREEN_BG },
  badgeBrouillon: { backgroundColor: ORANGE_BG },
  badgeText: { fontSize: 9.5, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 11 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 13, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: TEXT },
  cardSousTitre: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, marginTop: 4 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ligneLabel: { fontSize: 12, color: TEXT_SECONDARY, flexShrink: 0 },
  ligneValeur: { fontSize: 12.5, fontWeight: '700', color: TEXT, flexShrink: 1, textAlign: 'right' },
  vide: { fontSize: 12.5, color: TEXT_SECONDARY, fontStyle: 'italic' },
  volRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  volRowTexte: { gap: 2 },
  volRowTitre: { fontSize: 12.5, fontWeight: '700', color: TEXT },
  volRowSousTexte: { fontSize: 11, color: TEXT_SECONDARY },
  supprimerLink: { fontSize: 12, fontWeight: '700', color: '#c0412b' },
  formulaire: { gap: 8, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginTop: 4 },
  sousLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  chipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  chipSelectionne: { borderColor: GREEN, backgroundColor: GREEN_BG },
  chipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextSelectionne: { color: GREEN },
  rowInputs: { flexDirection: 'row', gap: 8 },
  rowInputItem: { flex: 1, gap: 4 },
  gap8: { gap: 8 },
  hint: { fontSize: 11.5, color: TEXT_SECONDARY, fontStyle: 'italic' },
  secondaryButton: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  boutonDisabled: { opacity: 0.6 },
  dureesRecap: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8, marginTop: 4, gap: 4 },
  dureeItem: { flexDirection: 'row', justifyContent: 'space-between' },
  dureeLabel: { fontSize: 11.5, color: TEXT_SECONDARY },
  dureeValeur: { fontSize: 12, fontWeight: '700', color: TEXT },
  dureeLabelTotal: { fontSize: 12, fontWeight: '800', color: TEXT },
  dureeValeurTotal: { fontSize: 13, fontWeight: '800', color: GREEN },
  blocRow: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8, gap: 2 },
  blocTitre: { fontSize: 12.5, fontWeight: '700', color: TEXT },
  blocSousTexte: { fontSize: 11, color: TEXT_SECONDARY },
  remarquesTexte: { fontSize: 12.5, color: TEXT, lineHeight: 17 },
  signatureRow: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, gap: 6 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 4 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
