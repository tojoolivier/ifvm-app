import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, FlatList, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from '@tanstack/react-form';
import { getCurrentPosition, reverseGeocode, GpsPosition } from '@/lib/location';
import { PRECISION_GPS_CIBLE_M, PRECISION_GPS_SEUIL_ALERTE_M } from '@/lib/gps-precision';
import { PermissionError } from '@/lib/errors';
import {
  findNearestStation,
  listPostesAcridiens,
  listStationsByPoste,
  PosteAcridien,
  StationFixe,
} from '@/lib/referentiel-db';
import { updateProspectionReference, DraftProspection } from '@/lib/prospection-repository';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { parseSelectionMultiple } from '@/lib/prospection-extensive';
import { ReferenceFormValues } from '@/lib/prospection-reference-schema';
import { validateGpsPosition } from '@/lib/prospection-validation';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useErrorLogStore } from '@/lib/error-log-store';
import { toFriendlyError } from '@/lib/friendly-error';
import { logger } from '@/lib/logger';

const INACTIVE_BG = '#efeada';
const INACTIVE_TEXT = '#9a9484';
const GPS_BADGE_BG = '#eaf2ec';

type SelectMode = 'auto' | 'manuel';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

const BIOTOPE_OPTIONS = [
  { label: 'Xérophyle', value: 'xerophyle' },
  { label: 'Mésophyle', value: 'mesophyle' },
  { label: 'Hygrophyle', value: 'hydrophyle' },
];

function generateNumeroFiche(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `FI-${datePart}-${idPart}`;
}

function formatDateHeure(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

interface OptionReferentiel {
  id: string;
  nom: string;
}

/**
 * Sélecteur PA/Station en mode Manuel (Prospection Intensive uniquement,
 * #manuel-referentiel-pa-station) — déclencheur + modale de recherche, sur le
 * même modèle que `ProduitSelectField` (traitement), mais avec les tokens de
 * style déjà utilisés par cet écran plutôt que ceux du module traitement.
 */
function SelecteurReferentiel<T extends OptionReferentiel>({
  valeur,
  options,
  onSelect,
  placeholder,
  desactive,
  messageDesactive,
}: {
  valeur: T | null;
  options: T[];
  onSelect: (item: T) => void;
  placeholder: string;
  desactive?: boolean;
  messageDesactive?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.nom.toLowerCase().includes(q));
  }, [options, recherche]);

  function fermer() {
    setOuvert(false);
    setRecherche('');
  }

  return (
    <View>
      <TouchableOpacity
        disabled={desactive}
        accessibilityRole="button"
        onPress={() => setOuvert(true)}
        style={[styles.manualInput, styles.selectTrigger, desactive && styles.selectTriggerDisabled]}
      >
        <Text
          style={[styles.selectTriggerText, !valeur && styles.selectTriggerPlaceholder]}
          numberOfLines={1}
        >
          {valeur ? valeur.nom : desactive && messageDesactive ? messageDesactive : placeholder}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={ouvert} onRequestClose={fermer}>
        <View style={styles.selectVoile}>
          <View style={styles.selectCarte}>
            <TextInput
              style={styles.manualInput}
              placeholder="Rechercher…"
              placeholderTextColor={INACTIVE_TEXT}
              value={recherche}
              onChangeText={setRecherche}
              autoFocus
            />
            <FlatList
              data={filtres}
              keyExtractor={(o) => o.id}
              style={styles.selectListe}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.selectVide}>Aucun résultat.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.selectLigne}
                  onPress={() => {
                    onSelect(item);
                    fermer();
                  }}
                >
                  <Text style={styles.selectLigneTexte}>{item.nom}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity accessibilityRole="button" onPress={fermer}>
              <Text style={styles.selectLien}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ReferenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const draft = useProspectionWizardStore((s) => s.draft);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const setDraft = useProspectionWizardStore((s) => s.setDraft);

  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [adminArea, setAdminArea] = useState<{ region: string | null; district: string | null; commune: string | null }>({
    region: null,
    district: null,
    commune: null,
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Retour visuel continu sur la qualité du fix : la précision n'empêche jamais
  // d'enregistrer, c'est donc ici — sous les yeux de l'agent pendant qu'il saisit —
  // qu'elle doit se voir, et pas dans une alerte au moment de valider.
  const accuracyBadgeStyle =
    position?.accuracy == null
      ? null
      : position.accuracy > PRECISION_GPS_SEUIL_ALERTE_M
        ? styles.accuracyBadgeInsuffisante
        : position.accuracy > PRECISION_GPS_CIBLE_M
          ? styles.accuracyBadgeMoyenne
          : null;

  const avertissementPrecision =
    position == null
      ? null
      : (validateGpsPosition({
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        }).avertissements[0] ?? null);
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('reference');
  const logError = useErrorLogStore((s) => s.addEntry);

  const [paMode, setPaMode] = useState<SelectMode>('auto');
  const [stationMode, setStationMode] = useState<SelectMode>('auto');
  const [pa, setPa] = useState<PosteAcridien | null>(null);
  const [paManualNom, setPaManualNom] = useState('');
  const [station, setStation] = useState<StationFixe | null>(null);
  const [stationManualNom, setStationManualNom] = useState('');
  const [autoPa, setAutoPa] = useState<PosteAcridien | null>(null);
  const [autoStation, setAutoStation] = useState<StationFixe | null>(null);

  // Référentiel pour le sélecteur manuel intensif (#manuel-referentiel-pa-station) —
  // indépendant de `autoPa`/`autoStation` (résultat du calcul GPS « plus proche »),
  // ce sont ici toutes les options que l'agent peut choisir à la main.
  const [postesReferentiel, setPostesReferentiel] = useState<PosteAcridien[]>([]);
  const [stationsReferentiel, setStationsReferentiel] = useState<StationFixe[]>([]);

  useEffect(() => {
    let isActive = true;
    void listPostesAcridiens()
      .then((postes) => {
        if (isActive) setPostesReferentiel(postes);
      })
      .catch((error) => signalerChargement(error, { step: 'listPostesAcridiens' }));
    return () => {
      isActive = false;
    };
  }, [signalerChargement]);

  useEffect(() => {
    if (!pa) return;
    let isActive = true;
    void listStationsByPoste(pa.id)
      .then((stations) => {
        if (isActive) setStationsReferentiel(stations);
      })
      .catch((error) => signalerChargement(error, { step: 'listStationsByPoste', paId: pa.id }));
    return () => {
      isActive = false;
    };
  }, [pa, signalerChargement]);

  // Sans PA choisi, aucune station n'est proposable (pa_id est une FK non-nullable
  // côté référentiel) — dérivé au rendu plutôt que par un setState dans l'effet
  // ci-dessus, qui ne doit s'occuper que du fetch asynchrone.
  const stationsDisponibles = pa ? stationsReferentiel : [];

  const paModeRef = useRef<SelectMode>('auto');
  const stationModeRef = useRef<SelectMode>('auto');

  useEffect(() => {
    paModeRef.current = paMode;
  }, [paMode]);

  useEffect(() => {
    stationModeRef.current = stationMode;
  }, [stationMode]);

  useEffect(() => {
    if (draftId && draft?.id !== draftId) {
      void hydrateFromDraft(draftId).catch((error) => signalerChargement(error, { draftId }));
    }
  }, [draftId, draft?.id, hydrateFromDraft, signalerChargement]);

  // Réhydrate le poste acridien saisi manuellement (pas de pa_code : ce n'est pas un
  // poste du référentiel) lorsqu'on revient sur cet écran après l'avoir déjà rempli.
  const paHydratedRef = useRef(false);
  useEffect(() => {
    if (paHydratedRef.current || draft?.id !== draftId) return;
    paHydratedRef.current = true;
    void Promise.resolve().then(() => {
      if (draft.pa_nom && !draft.pa_code) {
        setPaManualNom(draft.pa_nom);
        setPaMode('manuel');
        paModeRef.current = 'manuel';
      }
    });
  }, [draft, draftId]);

  // Même réhydratation pour la station saisie manuellement (pas de station_id connu).
  const stationHydratedRef = useRef(false);
  useEffect(() => {
    if (stationHydratedRef.current || draft?.id !== draftId) return;
    stationHydratedRef.current = true;
    void Promise.resolve().then(() => {
      if (draft.station_nom && !draft.station_id) {
        setStationManualNom(draft.station_nom);
        setStationMode('manuel');
        stationModeRef.current = 'manuel';
      }
    });
  }, [draft, draftId]);

  // ==========================================
  // CAPTURE GPS AUTOMATIQUE (fiche nouvelle) OU RESTAURATION (fiche déjà enregistrée)
  // ==========================================
  useEffect(() => {
    let isActive = true;

    // Fiche déjà enregistrée (brouillon repris, en attente de synchro ou synchronisée) :
    // on restaure la position, le PA et la station tels que saisis, au lieu de les
    // écraser silencieusement par une nouvelle détection GPS/plus-proche-station (#201).
    const restoreFromDraft = async (savedDraft: DraftProspection) => {
      setPosition({
        latitude: savedDraft.latitude as number,
        longitude: savedDraft.longitude as number,
        altitude: savedDraft.altitude ?? null,
        accuracy: null,
        // Pas un vrai fix GPS restauré : `updated_at` est la meilleure approximation
        // disponible du moment de la saisie (aucun timestamp GPS n'est archivé ici).
        timestamp: new Date(savedDraft.updated_at).getTime(),
      });
      setAdminArea({ region: savedDraft.region, district: savedDraft.district, commune: savedDraft.commune });
      setLocationError(null);
      setIsGpsLoading(false);

      if (!savedDraft.pa_code && !savedDraft.station_id) return;

      try {
        const postesList = await listPostesAcridiens();
        if (!isActive) return;
        const matchedPa = postesList.find((p) => p.code === savedDraft.pa_code) ?? null;
        if (!matchedPa) return;
        // `pa_code` renseigné = poste du référentiel : c'est le mode « auto » de cet
        // écran (le mode « manuel » est réservé à la saisie libre, sans code).
        applyPa(matchedPa);
        const stations = await listStationsByPoste(matchedPa.id);
        if (!isActive) return;
        const matchedStation = stations.find((s) => s.id === savedDraft.station_id) ?? null;
        if (matchedStation) {
          setStation(matchedStation);
        }
      } catch (error) {
        // Best effort : la position reste restaurée même si le PA/la station ne matchent plus le référentiel.
        logger.ignore(error, 'PA/station du brouillon introuvables dans le référentiel actuel, position conservée');
      }
    };

    const captureGps = async () => {
      try {
        const pos = await getCurrentPosition({
          // Le GPS converge de plusieurs centaines de mètres vers quelques mètres :
          // on affiche cette descente en direct, l'agent voit que ça travaille et
          // sait quand la position devient exploitable.
          onProgress: (enCours) => {
            if (isActive) setPosition(enCours);
          },
        });
        if (!isActive) return;

        setPosition(pos);
        setLocationError(null);

        const area = await reverseGeocode(pos.latitude, pos.longitude);
        if (!isActive) return;
        setAdminArea(area);

        const [nearestStation, postesList] = await Promise.all([
          findNearestStation(pos.latitude, pos.longitude),
          listPostesAcridiens(),
        ]);

        if (!isActive) return;

        if (nearestStation) {
          const nearestPa = postesList.find((p) => p.id === nearestStation.paId) ?? null;
          setAutoStation(nearestStation);
          setAutoPa(nearestPa);

          if (nearestPa && paModeRef.current === 'auto') {
            applyPa(nearestPa);
            if (stationModeRef.current === 'auto') {
              setStation(nearestStation);
            }
          }
        }
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof PermissionError
          ? 'Permission de localisation refusée. Veuillez activer la localisation dans les paramètres.'
          : 'Position GPS indisponible. Vérifiez que la localisation est activée.';
        setLocationError(message);
        Alert.alert('⚠️ Localisation', message);
        logger.failure('reference.captureGps.failed', error, { step: 'captureGps' });
        logError({
          message: toFriendlyError(error).message,
          stack: error instanceof Error ? error.stack ?? null : null,
          screen: 'reference',
          context: { step: 'captureGps' },
        });
      } finally {
        if (isActive) {
          setIsGpsLoading(false);
        }
      }
    };

    if (draft?.latitude != null && draft?.longitude != null) {
      void restoreFromDraft(draft);
    } else {
      void captureGps();
    }

    return () => {
      isActive = false;
    };
  }, [draft]);

  // #manuel-referentiel-pa-station (§8) : un changement de PA invalide toute
  // station déjà choisie qui ne lui est plus rattachée — qu'il s'agisse d'un
  // changement via GPS (auto) ou via le sélecteur manuel (intensif), les deux
  // passent par cette même fonction. Sans effet sur les flux existants (auto,
  // restauration de brouillon) : PA et station y sont toujours déjà cohérents
  // avant l'appel, donc la vérification ci-dessous ne change jamais rien pour eux.
  function applyPa(poste: PosteAcridien): void {
    setPa(poste);
    setStation((current) => (current && current.paId === poste.id ? current : null));
  }

  function setPaAuto() {
    setPaMode('auto');
    if (!autoPa) return;
    applyPa(autoPa);
    if (stationModeRef.current === 'auto' && autoStation) setStation(autoStation);
  }

  function setPaManuel() {
    setPaMode('manuel');
  }

  function setStationAuto() {
    setStationMode('auto');
    if (autoStation) setStation(autoStation);
  }

  function setStationManuel() {
    setStationMode('manuel');
  }

  // Détection du type intensif
  const isIntensive = draft?.type_prospection === 'intensive';

  // #manuel-referentiel-pa-station : en intensif, le mode Manuel choisit un
  // PA/une Station du référentiel (comme l'auto) — `pa`/`station` restent de
  // vrais objets référentiel dans les deux modes. Seul l'extensif garde la
  // saisie libre historique (`paManualNom`/`stationManualNom`).
  const paEstSaisieLibre = paMode === 'manuel' && !isIntensive;
  const stationEstSaisieLibre = stationMode === 'manuel' && !isIntensive;

  // Biotopes (#biotope-multi) : sélection multiple — hors du form tanstack, comme
  // `selectedTextures` dans veg.tsx (state à part, la validation « au moins un »
  // reste gérée dans l'objet `errors` manuel de onSubmit ci-dessous, cohérent avec
  // le style déjà en place dans ce fichier pour biotope).
  const [selectedBiotopes, setSelectedBiotopes] = useState<string[]>(
    parseSelectionMultiple(draft?.biotope ?? null)
  );
  const toggleBiotope = (value: string) => {
    setSelectedBiotopes((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const form = useForm({
    defaultValues: {
      surfaceStation: draft?.surface_station != null ? String(draft.surface_station) : '',
      surfaceProspectee: draft?.surface_prospectee != null ? String(draft.surface_prospectee) : '',
      surfaceInfestee: draft?.surface_infestee != null ? String(draft.surface_infestee) : '',
    } as ReferenceFormValues,
    onSubmit: async ({ value }) =>
      run(
        async () => {
          if (!position) {
            Alert.alert(
              '⚠️ Position GPS manquante',
              'La position GPS n\'a pas pu être capturée. Veuillez réessayer ou vérifier la localisation.'
            );
            return;
          }

          // Seuls les blocages (position hors Madagascar) arrêtent l'enregistrement.
          // Les avertissements de précision sont affichés en continu dans la carte GPS
          // ci-dessous : l'agent les a sous les yeux avant d'appuyer, inutile de lui
          // barrer la route au moment où il valide.
          const { blocages: gpsBlocages } = validateGpsPosition({
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
          });
          if (gpsBlocages.length > 0) {
            Alert.alert('⚠️ Position GPS invalide', gpsBlocages.join('\n'));
            return;
          }

          // VALIDATION PERSONNALISÉE
          const errors: Record<string, string> = {};

          // Biotope est TOUJOURS obligatoire (#biotope-multi : au moins un sélectionné)
          if (selectedBiotopes.length === 0) {
            errors.biotope = 'Le type de biotope est obligatoire';
          }

          // Surface station TOUJOURS obligatoire
          if (!value.surfaceStation || Number(value.surfaceStation) <= 0) {
            errors.surfaceStation = 'La surface de la station est obligatoire';
          }

          // Surface prospectée TOUJOURS obligatoire (intensif et extensif)
          if (!value.surfaceProspectee || Number(value.surfaceProspectee) <= 0) {
            errors.surfaceProspectee = 'La surface prospectée est obligatoire';
          }

          // Surface infestée : facultative (0 par défaut si non saisie)
          if (value.surfaceInfestee && Number(value.surfaceInfestee) < 0) {
            errors.surfaceInfestee = 'La surface infestée ne peut pas être négative';
          }

          // Cohérence relationnelle : station >= prospectée >= infestée (ADR-006)
          if (
            !errors.surfaceStation &&
            !errors.surfaceProspectee &&
            Number(value.surfaceProspectee) > Number(value.surfaceStation)
          ) {
            errors.surfaceProspectee = 'La surface prospectée ne peut pas dépasser la surface station';
          }

          const surfaceInfesteeNum = value.surfaceInfestee ? Number(value.surfaceInfestee) : 0;
          if (
            !errors.surfaceProspectee &&
            !errors.surfaceInfestee &&
            surfaceInfesteeNum > Number(value.surfaceProspectee)
          ) {
            errors.surfaceInfestee = 'La surface infestée ne peut pas dépasser la surface prospectée';
          }

          // Si des erreurs, on les affiche
          if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
          }

          setFormErrors({});

          const dateProspection = draft?.date_prospection ?? new Date().toISOString().slice(0, 10);
          const nFiche = generateNumeroFiche(draftId, dateProspection);

          // Préparer les données avec des valeurs par défaut (0 pour intensif)
          const surfaceProspecteeValue = value.surfaceProspectee ? Number(value.surfaceProspectee) : 0;
          const surfaceInfesteeValue = value.surfaceInfestee ? Number(value.surfaceInfestee) : 0;

          const updated = await updateProspectionReference(draftId, {
            latitude: position.latitude,
            longitude: position.longitude,
            altitude: position.altitude ?? null,
            surfaceStation: Number(value.surfaceStation),
            surfaceProspectee: surfaceProspecteeValue,
            surfaceInfestee: surfaceInfesteeValue,
            biotope: selectedBiotopes.length > 0 ? JSON.stringify(selectedBiotopes) : null,
            nFiche,
            region: adminArea.region,
            district: adminArea.district,
            commune: adminArea.commune,
            pa_code: paEstSaisieLibre ? null : pa?.code ?? null,
            pa_nom: paEstSaisieLibre ? (paManualNom.trim() || null) : pa?.nom ?? null,
            stationId: stationEstSaisieLibre ? null : station?.id ?? null,
            station_nom: stationEstSaisieLibre ? (stationManualNom.trim() || null) : station?.nom ?? null,
          });

          setDraft(updated);
          router.push({ pathname: '/(prospection)/species' as any, params: { draftId } });
        },
        {
          screen: 'reference',
          precondition: !!draftId,
          preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
          context: { draftId },
        }
      ),
  });

  const nFichePreview = draftId ? generateNumeroFiche(draftId, draft?.date_prospection ?? '') : '—';

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
            <Text style={styles.title}>Nouvelle prospection</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {/* ===== GPS ===== */}
            <View style={styles.gpsCard}>
              <View style={styles.gpsHeaderRow}>
                <Text style={styles.gpsTitle}>
                  📍 {isGpsLoading ? 'Capture GPS en cours...' : 'Position acquise'}
                </Text>
                <View
                  testID="gps-accuracy-badge"
                  style={[styles.accuracyBadge, accuracyBadgeStyle]}
                >
                  <Text style={styles.accuracyText}>
                    {position?.accuracy != null ? `± ${Math.round(position.accuracy)} m` : '…'}
                  </Text>
                </View>
              </View>

              {avertissementPrecision ? (
                <Text style={styles.gpsPrecisionAvertissement}>⚠️ {avertissementPrecision}</Text>
              ) : null}

              {isGpsLoading ? (
                <View style={styles.gpsLoadingContainer}>
                  <Text style={styles.gpsLoadingText}>⏳ Récupération de la position GPS...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.gpsFieldsRow}>
                    <View style={styles.gpsField}>
                      <Text style={styles.gpsFieldLabel}>Latitude</Text>
                      <Text style={styles.gpsFieldValue}>
                        {position ? position.latitude.toFixed(6) : '—'}
                      </Text>
                    </View>
                    <View style={styles.gpsField}>
                      <Text style={styles.gpsFieldLabel}>Longitude</Text>
                      <Text style={styles.gpsFieldValue}>
                        {position ? position.longitude.toFixed(6) : '—'}
                      </Text>
                    </View>
                    <View style={[styles.gpsField, { flex: 0.75 }]}>
                      <Text style={styles.gpsFieldLabel}>Altitude</Text>
                      <Text style={styles.gpsFieldValue}>
                        {position?.altitude != null ? `${Math.round(position.altitude)} m` : '—'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.gpsAdminText}>
                    {locationError ??
                      ([adminArea.region, adminArea.district, adminArea.commune].filter(Boolean).join(' · ') ||
                        'Localisation en cours…')}
                  </Text>
                </>
              )}
            </View>

            {/* ===== PA ===== */}
            <View style={styles.refCard}>
              <View style={styles.refHeaderRow}>
                <Text style={styles.refLabel}>2. Poste acridien (PA)</Text>
                <View style={styles.toggleTrack}>
                  <TouchableOpacity onPress={setPaAuto} activeOpacity={0.7}>
                    <Text style={[styles.toggleSegment, paMode === 'auto' && styles.toggleSegmentActive]}>
                      Auto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={setPaManuel} activeOpacity={0.7}>
                    <Text style={[styles.toggleSegment, paMode === 'manuel' && styles.toggleSegmentActive]}>
                      Manuel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {paMode === 'auto' ? (
                <View style={styles.autoValueRow}>
                  <Text style={styles.autoValueText}>{pa?.nom ?? '…'}</Text>
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>📡 via GPS</Text>
                  </View>
                </View>
              ) : isIntensive ? (
                <SelecteurReferentiel
                  valeur={pa}
                  options={postesReferentiel}
                  onSelect={applyPa}
                  placeholder="Sélectionner un poste acridien"
                />
              ) : (
                <TextInput
                  value={paManualNom}
                  onChangeText={setPaManualNom}
                  placeholder="Saisir le nom du poste acridien"
                  placeholderTextColor={INACTIVE_TEXT}
                  style={styles.manualInput}
                />
              )}
            </View>

            {/* ===== Station ===== */}
            <View style={styles.refCard}>
              <View style={styles.refHeaderRow}>
                <Text style={styles.refLabel}>5. Station</Text>
                <View style={styles.toggleTrack}>
                  <TouchableOpacity onPress={setStationAuto} activeOpacity={0.7}>
                    <Text style={[styles.toggleSegment, stationMode === 'auto' && styles.toggleSegmentActive]}>
                      Auto
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={setStationManuel} activeOpacity={0.7}>
                    <Text style={[styles.toggleSegment, stationMode === 'manuel' && styles.toggleSegmentActive]}>
                      Manuel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {stationMode === 'auto' ? (
                <View style={styles.autoValueRow}>
                  <Text style={styles.autoValueText}>{station?.nom ?? '…'}</Text>
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>📡 via GPS</Text>
                  </View>
                </View>
              ) : isIntensive ? (
                <SelecteurReferentiel
                  valeur={station}
                  options={stationsDisponibles}
                  onSelect={setStation}
                  placeholder="Sélectionner une station"
                  desactive={!pa}
                  messageDesactive="Choisissez d'abord un poste acridien"
                />
              ) : (
                <TextInput
                  value={stationManualNom}
                  onChangeText={setStationManualNom}
                  placeholder="Saisir le nom de la station"
                  placeholderTextColor={INACTIVE_TEXT}
                  style={styles.manualInput}
                />
              )}
            </View>

            {/* ===== Métadonnées ===== */}
            <View style={styles.metaRow}>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>N° Fiche ⟳</Text>
                <Text style={styles.metaValue}>{nFichePreview}</Text>
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>Date/heure ⟳</Text>
                <Text style={styles.metaValue}>{formatDateHeure(new Date())}</Text>
              </View>
            </View>

            {/* ===== Surfaces ===== */}
            <Text style={styles.sectionLabel}>Surfaces (ha) — saisie</Text>
            <Text style={styles.infoText}>
              ℹ️ La surface infestée est facultative (0 par défaut) — elle ne peut pas dépasser la
              surface prospectée, qui elle-même ne peut pas dépasser la surface station.
            </Text>
            <View style={styles.surfacesRow}>
              <form.Field name="surfaceStation">
                {(field) => (
                  <View style={styles.surfaceField}>
                    <Text style={[styles.surfaceLabel, styles.requiredLabel]}>Station *</Text>
                    <TextInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      keyboardType="decimal-pad"
                      style={styles.surfaceInput}
                      placeholder="0"
                    />
                  </View>
                )}
              </form.Field>
              <form.Field name="surfaceProspectee">
                {(field) => (
                  <View style={styles.surfaceField}>
                    <Text style={[styles.surfaceLabel, styles.requiredLabel]}>
                      Prospectée *
                    </Text>
                    <TextInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      keyboardType="decimal-pad"
                      style={styles.surfaceInput}
                      placeholder={isIntensive ? '0' : '0'}
                    />
                  </View>
                )}
              </form.Field>
              <form.Field name="surfaceInfestee">
                {(field) => (
                  <View style={styles.surfaceField}>
                    <Text style={styles.surfaceLabel}>Infestée</Text>
                    <TextInput
                      value={field.state.value ?? ''}
                      onChangeText={field.handleChange}
                      keyboardType="decimal-pad"
                      style={styles.surfaceInput}
                      placeholder="0"
                    />
                  </View>
                )}
              </form.Field>
            </View>

            {/* ===== Biotopes (#biotope-multi : sélection multiple) ===== */}
            <View style={styles.biotopeContainer}>
              <Text style={[styles.sectionLabel, styles.requiredLabel]}>Biotopes *</Text>
              <View style={styles.biotopeOptions}>
                {BIOTOPE_OPTIONS.map((option) => {
                  const active = selectedBiotopes.includes(option.value);
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.biotopeChip, active && styles.biotopeChipActive]}
                      onPress={() => toggleBiotope(option.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.biotopeChipText, active && styles.biotopeChipTextActive]}>
                        {option.label}
                        {active && ' ✓'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {Object.values(formErrors).map((message) => (
              <Text key={message} style={styles.errorText}>
                {message}
              </Text>
            ))}
            <Text style={styles.hintText}>
              Tapez une valeur — les autres champs se calculent ensuite automatiquement.
            </Text>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 12) + 8,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.continueButton,
                (isSaving || isGpsLoading) && styles.continueButtonDisabled,
              ]}
              onPress={form.handleSubmit}
              disabled={isSaving || isGpsLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>
                {isGpsLoading
                  ? '⏳ GPS en cours...'
                  : isSaving
                    ? 'Enregistrement…'
                    : 'Continuer  ›'}
              </Text>
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
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  gpsCard: { backgroundColor: GREEN, borderRadius: 13, padding: 14, marginBottom: 12 },
  gpsLoadingContainer: { paddingVertical: 8 },
  gpsLoadingText: { color: '#ffffffcc', fontSize: 12, textAlign: 'center' },
  gpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  gpsTitle: { color: '#fff', fontWeight: '700', fontSize: 12 },
  accuracyBadge: {
    backgroundColor: '#ffffff2e',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  /** Ambre : « utilisable, mais attends encore un peu ». */
  accuracyBadgeMoyenne: { backgroundColor: '#f59e0b' },
  /** Rouge : « position peu fiable » — signal fort, mais jamais bloquant. */
  accuracyBadgeInsuffisante: { backgroundColor: '#dc2626' },
  accuracyText: { color: '#fff', fontSize: 9.5, fontWeight: '600' },
  gpsPrecisionAvertissement: {
    color: '#fff',
    fontSize: 10.5,
    lineHeight: 14,
    marginBottom: 9,
  },
  gpsFieldsRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  gpsField: { flex: 1, backgroundColor: '#ffffff1f', borderRadius: 8, padding: 7 },
  gpsFieldLabel: { color: '#ffffffbf', fontSize: 8.5, textTransform: 'uppercase' },
  gpsFieldValue: { color: '#fff', fontWeight: '600', fontSize: 12.5 },
  gpsAdminText: { color: '#ffffffd9', fontSize: 10.5 },
  refCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 13,
    marginBottom: 11,
  },
  refHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  refLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: INACTIVE_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleTrack: { flexDirection: 'row', backgroundColor: INACTIVE_BG, borderRadius: 8, padding: 2, gap: 2 },
  toggleSegment: {
    fontSize: 9.5,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    color: INACTIVE_TEXT,
    overflow: 'hidden',
  },
  toggleSegmentActive: { backgroundColor: GREEN, color: '#fff' },
  autoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  autoValueText: { fontSize: 15, fontWeight: '700', color: TEXT },
  manualInput: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    backgroundColor: INACTIVE_BG,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  gpsBadge: { backgroundColor: GPS_BADGE_BG, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  gpsBadgeText: { fontSize: 9, fontWeight: '600', color: GREEN },
  selectTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectTriggerDisabled: { opacity: 0.55 },
  selectTriggerText: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT },
  selectTriggerPlaceholder: { color: INACTIVE_TEXT, fontWeight: '600' },
  selectChevron: { fontSize: 13, color: TEXT_SECONDARY, marginLeft: 8 },
  selectVoile: { flex: 1, backgroundColor: 'rgba(22,32,26,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  selectCarte: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  selectListe: { flexGrow: 0 },
  selectVide: { fontSize: 12.5, color: TEXT_SECONDARY, padding: 12 },
  selectLigne: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  selectLigneTexte: { fontSize: 14, fontWeight: '600', color: TEXT },
  selectLien: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    backgroundColor: INACTIVE_BG,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: GREEN, color: '#fff', fontWeight: '700' },
  metaRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  metaField: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 9,
  },
  metaLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  metaValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  requiredLabel: {
    color: '#c0412b',
  },
  surfacesRow: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  surfaceField: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 9,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  surfaceLabel: { fontSize: 9.5, color: '#9a9484', marginBottom: 2 },
  surfaceInput: { fontSize: 18, fontWeight: '700', color: TEXT, padding: 0 },
  biotopeContainer: { marginTop: 4, marginBottom: 12 },
  biotopeOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  biotopeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: INACTIVE_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  biotopeChipActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  biotopeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  biotopeChipTextActive: {
    color: '#fff',
  },
  hintText: { fontSize: 10.5, color: '#9a9484', paddingHorizontal: 2 },
  errorText: { color: '#c0412b', fontSize: 11, marginBottom: 4 },
  infoText: {
    fontSize: 11,
    color: '#6f6a59',
    marginBottom: 8,
    fontStyle: 'italic',
    backgroundColor: '#f0ede6',
    padding: 8,
    borderRadius: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: BG,
  },
  continueButton: {
    backgroundColor: GREEN,
    borderRadius: 13,
    padding: 15,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
