import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentPosition, reverseGeocode } from '@/lib/location';
import {
  createDraftTraitementAerien,
  createDraftTraitementTerrestre,
  updateTraitementReference,
  getTraitement,
} from '@/lib/traitement-repository';
import { getProspection } from '@/lib/prospection-repository';
import { STATUT_VALIDE } from '@/lib/prospection-fiche-lecture';
import { generateId } from '@/lib/id';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { validateReferences } from '@/lib/traitement-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { Card } from '@/components/traitement/Card';
import { DateField } from '@/components/traitement/DateField';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { SegmentedControl } from '@/components/traitement/SegmentedControl';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('T')[0].split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

export default function ReferencesScreen() {
  const router = useRouter();
  const {
    prospectionId: routeProspectionId,
    traitementId: routeTraitementId,
    isValidationView,
    origineId,
  } = useLocalSearchParams<{
    prospectionId?: string;
    traitementId?: string;
    isValidationView?: string;
    origineId?: string;
  }>();

  const store = useTraitementCaptureStore();
  const typeTraitement = store.typeTraitement;
  const [traitementId, setTraitementId] = useState<string | null>(routeTraitementId ?? null);
  const [prospectionId, setProspectionId] = useState<string | null>(routeProspectionId ?? null);
  const [dateValidation, setDateValidation] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prospectionStatut, setProspectionStatut] = useState<string | null>(null);
  const [prospectionUpdatedAt, setProspectionUpdatedAt] = useState<string | null>(null);

  const readOnly = isValidationView === '1';
  const hasGps = store.ref.latitude != null && store.ref.longitude != null;
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('references');

  useEffect(() => {
    if (routeTraitementId) {
      store.setValidationView(readOnly);
      getTraitement(routeTraitementId)
        .then((draft) => {
          if (!draft) return;
          store.setTypeTraitement(draft.type_traitement);
          setProspectionId(draft.prospection_id);
          setDateValidation(draft.date_validation);
          store.updateRef({
            numeroFiche: draft.numero_fiche,
            dateTraitement: draft.date_traitement,
            localite: draft.localite,
            region: draft.region,
            district: draft.district,
            commune: draft.commune,
            latitude: draft.latitude,
            longitude: draft.longitude,
            altitude: draft.altitude,
            modeTraitement: (draft.mode_traitement as 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null) ?? null,
          });
        })
        .catch((error) => signalerChargement(error, { traitementId: routeTraitementId }));
    } else {
      store.reset();
      // Nouvelle fiche de traitement (pas encore de brouillon) : la date de
      // traitement est toujours celle du jour, non modifiable (cf. DateField
      // `editable={false}` plus bas) — la date de validation, elle aussi non
      // modifiable, se déduit de la fiche de prospection liée (effet suivant).
      store.updateRef({ dateTraitement: new Date().toISOString().slice(0, 10) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTraitementId, signalerChargement]);

  useEffect(() => {
    if (!prospectionId) return;
    getProspection(prospectionId)
      .then((prospection) => {
        if (!prospection) return;
        setProspectionStatut(prospection.statut);
        setProspectionUpdatedAt(prospection.updated_at);
        // Nouvelle fiche seulement (une fiche déjà créée garde sa date de
        // validation enregistrée, restaurée par l'effet précédent) : la date de
        // validation — non modifiable — est celle de la fiche de prospection liée,
        // quel que soit l'écran d'où l'agent est arrivé (sélecteur, zones à
        // reprendre, entrée directe par prospectionId).
        if (!routeTraitementId) {
          setDateValidation(prospection.date_prospection.slice(0, 10));
        }
      })
      .catch((error) => signalerChargement(error, { prospectionId }));
  }, [prospectionId, routeTraitementId, signalerChargement]);

  const captureGps = () =>
    runGps(
      async () => {
        const pos = await getCurrentPosition();
        store.updateRef({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });

        // Géocodage inverse hors-ligne : best-effort délibéré — sans réseau ni
        // cache, on garde les coordonnées mais pas la région/district/commune,
        // et ça ne doit pas faire échouer la capture GPS elle-même.
        try {
          const area = await reverseGeocode(pos.latitude, pos.longitude);
          store.updateRef({ region: area.region, district: area.district, commune: area.commune });
        } catch (geoError) {
          logger.ignore(geoError, 'géocodage inverse indisponible hors-ligne, coordonnées conservées');
        }
      },
      { screen: 'references', context: { traitementId, prospectionId } }
    );

  const handleContinuer = () =>
    run(
      async () => {
        // Vérifier que la date de traitement n'est pas antérieure à la date de validation
        // (on valide/approuve d'abord, le traitement s'exécute ensuite).
        if (store.ref.dateTraitement && dateValidation) {
          const traitementDate = new Date(store.ref.dateTraitement);
          const validationDate = new Date(dateValidation);
          if (traitementDate < validationDate) {
            setErrors({
              ...errors,
              dateTraitement: 'La date de traitement ne peut pas être antérieure à la date de validation'
            });
            return;
          }
        }

        const validationErrors = validateReferences({
          typeTraitement,
          dateTraitement: store.ref.dateTraitement ?? null,
          dateValidation,
          localite: store.ref.localite ?? null,
          prospectionId,
        });

        const byField: Record<string, string> = {};
        for (const e of validationErrors) byField[e.field] = e.message;
        setErrors(byField);
        // Déjà visible à l'écran (message par champ) : pas de second signal.
        if (validationErrors.length > 0) return;

        let id = traitementId;
        if (!id) {
          const created =
            typeTraitement === 'AERIEN'
              ? await createDraftTraitementAerien({
                  id: generateId(),
                  prospectionId: prospectionId!,
                  dateTraitement: store.ref.dateTraitement,
                  pilote: '',
                  mecanicien: '',
                  chefDeBaseId: '',
                })
              : await createDraftTraitementTerrestre({
                  id: generateId(),
                  prospectionId: prospectionId!,
                  dateTraitement: store.ref.dateTraitement,
                  chefEquipeId: '',
                });
          id = created.id;
          setTraitementId(id);
        }

        await updateTraitementReference(id, {
          localite: store.ref.localite ?? null,
          region: store.ref.region ?? null,
          district: store.ref.district ?? null,
          commune: store.ref.commune ?? null,
          latitude: store.ref.latitude ?? null,
          longitude: store.ref.longitude ?? null,
          altitude: store.ref.altitude ?? null,
          dateTraitement: store.ref.dateTraitement ?? null,
          dateValidation,
          numeroFiche: null,
        });

        router.push({ pathname: '/(traitement)/cibles' as any, params: { traitementId: id, isValidationView, origineId } });
      },
      { screen: 'references', context: { traitementId, prospectionId } }
    );

  const regionDistrictCommune = [store.ref.region, store.ref.district, store.ref.commune].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
              <Text style={styles.backChevron}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Type &amp; références</Text>
          </View>
          <ProgressBar currentIndex={0} />

          <View style={styles.field}>
            <Text style={styles.label}>Type de traitement *</Text>
            <SegmentedControl
              options={[
                { value: 'AERIEN', label: 'Aérien' },
                { value: 'TERRESTRE', label: 'Terrestre' },
              ]}
              value={typeTraitement}
              onChange={(v) => !readOnly && !traitementId && store.setTypeTraitement(v as any)}
            />
            {errors.typeTraitement && <Text style={styles.error}>{errors.typeTraitement}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mode de traitement</Text>
            <SegmentedControl
              deselectable
              options={[
                { value: 'TOTAL', label: 'Couvertures totales' },
                { value: 'BARRIERE', label: 'Barrières' },
                { value: 'IRREGULIER', label: 'Irrégulier' },
              ]}
              value={store.ref.modeTraitement ?? null}
              onChange={(v) => !readOnly && store.updateRef({ modeTraitement: v as any })}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>N° de fiche (auto)</Text>
            <Card variant="default" style={styles.ficheCard}>
              <Text style={styles.monoReadonly}>{store.ref.numeroFiche ?? '(généré à la saisie)'}</Text>
              <Text style={styles.note}>Prénom du chef — Type — Date ISO, suffixe en cas de collision.</Text>
            </Card>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Date de traitement * (auto — aujourd’hui)</Text>
              <DateField
                editable={false}
                value={store.ref.dateTraitement ?? null}
                onChange={(v) => store.updateRef({ dateTraitement: v })}
              />
            </View>
            <View style={[styles.field, styles.flex1]}>
              <Text style={styles.label}>Date de validation * (auto — fiche de prospection)</Text>
              <DateField editable={false} value={dateValidation} onChange={setDateValidation} />
            </View>
          </View>
          {errors.dateTraitement && <Text style={styles.error}>{errors.dateTraitement}</Text>}
          {errors.dateValidation && <Text style={styles.error}>{errors.dateValidation}</Text>}

          <View style={styles.field}>
            <Text style={styles.label}>Fiche de prospection liée *</Text>
            {prospectionId ? (
              <Card variant="default" style={styles.prospectionCard}>
                <Text style={styles.label}>N° fiche de prospection</Text>
                <Text style={styles.prospectionText}>{prospectionId}</Text>
                <Text style={styles.note}>
                  {prospectionStatut === STATUT_VALIDE && prospectionUpdatedAt
                    ? `Validée le ${formatDateFr(prospectionUpdatedAt)} · lecture seule`
                    : 'Lecture seule'}
                </Text>
              </Card>
            ) : readOnly ? (
              <Card variant="default" style={styles.prospectionCard}>
                <Text style={styles.prospectionText}>—</Text>
              </Card>
            ) : (
              <TouchableOpacity
                style={styles.prospectionPickerLink}
                onPress={() => router.push('/(traitement)/prospection-picker' as any)}
              >
                <Text style={styles.prospectionPickerLinkText}>Choisir une fiche de prospection ›</Text>
              </TouchableOpacity>
            )}
            {errors.prospectionId && <Text style={styles.error}>{errors.prospectionId}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Localisation</Text>
            <TouchableOpacity style={styles.gpsRow} onPress={captureGps} disabled={readOnly || isGpsLoading}>
              <Text style={styles.gpsRowText}>GPS &amp; géocodage inverse</Text>
              <Text style={[styles.gpsStatus, hasGps && styles.gpsStatusActive]}>
                {isGpsLoading ? 'Localisation…' : hasGps ? '📍 Localisé' : 'Localiser'}
              </Text>
            </TouchableOpacity>

            <Card variant="info" style={styles.coordCard}>
              <Text style={styles.label}>Coord. (auto) · altitude</Text>
              <Text style={styles.coordValue}>
                {hasGps
                  ? `${store.ref.latitude!.toFixed(4)}, ${store.ref.longitude!.toFixed(4)} · ${store.ref.altitude ?? '—'} m`
                  : 'Position non capturée'}
              </Text>
            </Card>

            <Card variant="default" style={styles.regionCard}>
              <Text style={styles.label}>Région · district · commune (auto, hors-ligne)</Text>
              <Text style={styles.coordValue}>{regionDistrictCommune || '—'}</Text>
            </Card>

            <View style={styles.field}>
              <Text style={styles.label}>Localité * (saisie manuelle)</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="Localité"
                value={store.ref.localite ?? ''}
                onChangeText={(v) => store.updateRef({ localite: v })}
              />
            </View>
            {errors.localite && <Text style={styles.error}>{errors.localite}</Text>}
          </View>

          {!readOnly && (
            <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
              <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer — Cibles ›'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  keyboardAvoidingView: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backChevron: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran + 6, color: traitementColors.texteTitre },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  field: { gap: 5 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  label: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.label,
    color: traitementColors.texteLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  note: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.texteNote },
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
  monoReadonly: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
  ficheCard: { gap: 4 },
  prospectionCard: { borderWidth: 2, borderColor: traitementColors.vertPrincipal, gap: 4 },
  prospectionText: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.valeurDerivee, color: traitementColors.texteTitre },
  prospectionPickerLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.chip,
  },
  prospectionPickerLinkText: { fontFamily: traitementFonts.uiBold, color: traitementColors.vertPrincipal, fontSize: traitementTypeSizes.corps },
  gpsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  gpsRowText: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire },
  gpsStatus: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteLabel },
  gpsStatusActive: { color: traitementColors.vertPrincipal },
  coordCard: { gap: 4 },
  coordValue: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.corps + 1, color: traitementColors.texteTitre },
  regionCard: { gap: 4 },
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
