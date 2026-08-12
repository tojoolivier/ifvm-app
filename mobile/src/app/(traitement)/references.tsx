import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentPosition, reverseGeocode, LocationPermissionDeniedError } from '@/lib/location';
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
import { Card } from '@/components/traitement/Card';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { SegmentedControl } from '@/components/traitement/SegmentedControl';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

/**
 * Écran A — Références.
 *
 * Déviation notée : le type de traitement (Aérien|Terrestre) détermine quelle
 * table de spécialisation créer (traitement_aerien vs traitement_terrestre),
 * mais leurs champs obligatoires (pilote/mécanicien/chef de base, ou chef
 * d'équipe) ne sont saisis qu'à l'écran C. Pour respecter l'ordre de
 * navigation A→B→C du brief (l'écran B a besoin d'un traitementId existant),
 * le brouillon est créé ici avec des valeurs placeholder pour ces champs
 * type-spécifiques ; l'écran C les complète ensuite via updateTraitementAerien/
 * updateTraitementTerrestre (ajoutés à traitement-repository.ts pour ce lot).
 */

/** Formate une date ISO ("2026-07-30" ou "2026-07-30T10:00:00Z") en JJ/MM/AAAA pour l'affichage. */
function formatDateFr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('T')[0].split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

export default function ReferencesScreen() {
  const router = useRouter();
  const { prospectionId: routeProspectionId, traitementId: routeTraitementId, isValidationView } =
    useLocalSearchParams<{ prospectionId?: string; traitementId?: string; isValidationView?: string }>();

  const store = useTraitementCaptureStore();
  const [typeTraitement, setTypeTraitement] = useState<'AERIEN' | 'TERRESTRE' | null>(null);
  const [traitementId, setTraitementId] = useState<string | null>(routeTraitementId ?? null);
  const [prospectionId, setProspectionId] = useState<string | null>(routeProspectionId ?? null);
  // ReferenceDraft (traitement-capture-store.ts) n'a pas de champ dateValidation
  // (store non modifiable pour ce lot) : suivi en état local d'écran.
  const [dateValidation, setDateValidation] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [prospectionStatut, setProspectionStatut] = useState<string | null>(null);
  const [prospectionUpdatedAt, setProspectionUpdatedAt] = useState<string | null>(null);

  const readOnly = isValidationView === '1';
  const hasGps = store.ref.latitude != null && store.ref.longitude != null;

  useEffect(() => {
    if (routeTraitementId) {
      store.setValidationView(readOnly);
      getTraitement(routeTraitementId).then((draft) => {
        if (!draft) return;
        setTypeTraitement(draft.type_traitement);
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
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTraitementId]);

  useEffect(() => {
    if (!prospectionId) return;
    getProspection(prospectionId).then((prospection) => {
      if (!prospection) return;
      setProspectionStatut(prospection.statut);
      setProspectionUpdatedAt(prospection.updated_at);
    });
  }, [prospectionId]);

  const captureGps = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentPosition();
      store.updateRef({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      const area = await reverseGeocode(pos.latitude, pos.longitude);
      store.updateRef({ region: area.region, district: area.district, commune: area.commune });
    } catch (error) {
      const message =
        error instanceof LocationPermissionDeniedError
          ? 'Permission de localisation refusée.'
          : 'Position GPS indisponible.';
      Alert.alert('⚠️ Localisation', message);
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleContinuer = async () => {
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
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
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

      router.push({ pathname: '/(traitement)/cibles' as any, params: { traitementId: id, isValidationView } });
    } finally {
      setIsSaving(false);
    }
  };

  const regionDistrictCommune = [store.ref.region, store.ref.district, store.ref.commune].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>A — Type &amp; références</Text>
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
            onChange={(v) => !readOnly && !traitementId && setTypeTraitement(v as any)}
          />
          {errors.typeTraitement && <Text style={styles.error}>{errors.typeTraitement}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mode de traitement</Text>
          <SegmentedControl
            deselectable
            options={[
              { value: 'TOTAL', label: 'Total' },
              { value: 'BARRIERE', label: 'Barrière' },
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
            <Text style={styles.label}>Date de traitement *</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="AAAA-MM-JJ"
              value={store.ref.dateTraitement ?? ''}
              onChangeText={(v) => store.updateRef({ dateTraitement: v })}
            />
          </View>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>Date de validation *</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="AAAA-MM-JJ"
              value={dateValidation ?? ''}
              onChangeText={setDateValidation}
            />
          </View>
        </View>
        {errors.dateTraitement && <Text style={styles.error}>{errors.dateTraitement}</Text>}
        {errors.dateValidation && <Text style={styles.error}>{errors.dateValidation}</Text>}

        <View style={styles.field}>
          <Text style={styles.label}>Fiche de prospection liée *</Text>
          <Card variant="default" style={styles.prospectionCard}>
            <Text style={styles.label}>N° fiche de prospection</Text>
            <Text style={styles.prospectionText}>{prospectionId ?? '—'}</Text>
            <Text style={styles.note}>
              {prospectionStatut === STATUT_VALIDE && prospectionUpdatedAt
                ? `Validée le ${formatDateFr(prospectionUpdatedAt)} · lecture seule`
                : 'Lecture seule'}
            </Text>
          </Card>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 14 },
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
