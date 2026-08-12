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

  const readOnly = isValidationView === '1';

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={0} />
        <Text style={styles.title}>Références</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Type de traitement*</Text>
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
              { value: 'TOTAL', label: 'Couvertures totales' },
              { value: 'BARRIERE', label: 'Barrières' },
              { value: 'IRREGULIER', label: 'Irrégulier' },
            ]}
            value={store.ref.modeTraitement ?? null}
            onChange={(v) => !readOnly && store.updateRef({ modeTraitement: v as any })}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>N° de fiche</Text>
          <Text style={styles.monoReadonly}>{store.ref.numeroFiche ?? 'généré à l’enregistrement'}</Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>Date de traitement*</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="AAAA-MM-JJ"
              value={store.ref.dateTraitement ?? ''}
              onChangeText={(v) => store.updateRef({ dateTraitement: v })}
            />
          </View>
          <View style={[styles.field, styles.flex1]}>
            <Text style={styles.label}>Date de validation*</Text>
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
          <Text style={styles.label}>Fiche de prospection liée*</Text>
          <Card variant="default" style={styles.prospectionCard}>
            <Text style={styles.prospectionText}>{prospectionId ?? '—'}</Text>
          </Card>
          {errors.prospectionId && <Text style={styles.error}>{errors.prospectionId}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Localisation</Text>
          <TouchableOpacity style={styles.gpsButton} onPress={captureGps} disabled={readOnly || isGpsLoading}>
            <Text style={styles.gpsButtonText}>📍 {isGpsLoading ? 'Capture GPS en cours…' : 'Capturer la position'}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            {store.ref.latitude != null && store.ref.longitude != null
              ? `${store.ref.latitude.toFixed(5)}, ${store.ref.longitude.toFixed(5)} · alt. ${store.ref.altitude ?? '—'} m`
              : 'Position non capturée'}
          </Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Région"
            value={store.ref.region ?? ''}
            onChangeText={(v) => store.updateRef({ region: v })}
          />
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="District"
            value={store.ref.district ?? ''}
            onChangeText={(v) => store.updateRef({ district: v })}
          />
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Commune"
            value={store.ref.commune ?? ''}
            onChangeText={(v) => store.updateRef({ commune: v })}
          />
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Localité*"
            value={store.ref.localite ?? ''}
            onChangeText={(v) => store.updateRef({ localite: v })}
          />
          {errors.localite && <Text style={styles.error}>{errors.localite}</Text>}
        </View>

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
  content: { padding: 16, gap: 14 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  field: { gap: 5 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
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
  prospectionCard: { borderWidth: 2, borderColor: traitementColors.vertPrincipal },
  prospectionText: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  gpsButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: traitementColors.infoFond,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
  },
  gpsButtonText: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.vertPrincipal },
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
