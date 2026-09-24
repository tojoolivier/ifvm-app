import { listMembresEquipe } from '@/lib/equipe-db';
import { prefillTraitementAerien } from '@/lib/equipe-regles';
import { equipeDeTravailPour } from '@/lib/equipe-travail';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCurrentPosition, reverseGeocode } from '@/lib/location';
import {
  createDraftTraitementAerien,
  createDraftTraitementTerrestre,
  updateTraitementReference,
  genererNumeroFicheDisponible,
  getTraitement,
  saveCible,
} from '@/lib/traitement-repository';
import { construireCible } from '@/lib/traitement-cible';
import {
  getProspection,
  listAllProspectionPopulations,
  listAllProspectionInfestations,
  listAllProspectionCaptures,
} from '@/lib/prospection-repository';
import { STATUT_VALIDE } from '@/lib/prospection-fiche-lecture';
import { generateId } from '@/lib/id';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { validateReferences } from '@/lib/traitement-validation';
import { useAuthStore } from '@/lib/auth-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';
import { Card } from '@/components/traitement/Card';
import { DateField } from '@/components/traitement/DateField';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { SegmentedControl } from '@/components/traitement/SegmentedControl';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';

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
  const utilisateurConnecte = useAuthStore((s) => s.user);
  const [traitementId, setTraitementId] = useState<string | null>(routeTraitementId ?? null);
  const [prospectionId, setProspectionId] = useState<string | null>(routeProspectionId ?? null);
  const [dateValidation, setDateValidation] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prospectionStatut, setProspectionStatut] = useState<string | null>(null);
  const [prospectionUpdatedAt, setProspectionUpdatedAt] = useState<string | null>(null);
  // Numéro métier (#numero-fiche-prospection-liee) — jamais l'UUID technique
  // `prospectionId` affiché tel quel : dérivé de la fiche de prospection liée,
  // même ordre de priorité que « Consulter une fiche validée »
  // (prospection-picker.tsx : n_fiche, puis n_message).
  const [prospectionNFiche, setProspectionNFiche] = useState<string | null>(null);
  const typeSizes = useTraitementTypeSizes();
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  const readOnly = isValidationView === '1';
  // #zone-a-reprendre-numero-annexe : présence d'`origineId` = fiche démarrée
  // depuis « Zones à reprendre » (cf. zones-a-reprendre.tsx) — son numéro
  // porte alors « -ANNEXE », pour la distinguer au premier coup d'œil sur
  // « Mes fiches »/« Zones à reprendre » d'un traitement neuf sans lien.
  const estReprise = !!origineId;
  const hasGps = store.ref.latitude != null && store.ref.longitude != null;
  const { run: runGps, isRunning: isGpsLoading } = useAsyncAction();
  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('references');

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
          // Capture GPS automatique — même patron que reference.tsx/extensive-reference.tsx
          // côté prospection (déclenchée au montage de l'écran, pas seulement au clic sur
          // « Localiser » : c'est ce déclenchement tardif, manuel, qui laissait au GPS
          // beaucoup moins de temps réel pour converger avant que l'agent n'abandonne).
          // Jamais si la fiche a déjà une position enregistrée (brouillon repris) — ne
          // l'écrase pas avec une nouvelle acquisition.
          if (!readOnly && draft.latitude == null && draft.longitude == null) {
            void captureGps();
          }
        })
        .catch((error) => signalerChargement(error, { traitementId: routeTraitementId }));
    } else {
      store.reset();
      // Nouvelle fiche de traitement (pas encore de brouillon) : la date de
      // traitement est toujours celle du jour, non modifiable (cf. DateField
      // `editable={false}` plus bas) — la date de validation, elle aussi non
      // modifiable, se déduit de la fiche de prospection liée (effet suivant).
      store.updateRef({ dateTraitement: new Date().toISOString().slice(0, 10) });
      if (!readOnly) void captureGps();
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
        setProspectionNFiche(prospection.n_fiche ?? prospection.n_message ?? null);
        // Nouvelle fiche seulement (une fiche déjà créée garde sa date de
        // validation enregistrée, restaurée par l'effet précédent) : la date de
        // validation — non modifiable — est celle de la fiche de prospection liée,
        // quel que soit l'écran d'où l'agent est arrivé (sélecteur, zones à
        // reprendre, entrée directe par prospectionId).
        if (!routeTraitementId) {
          setDateValidation(prospection.date_prospection.slice(0, 10));
          // Localité pré-remplie depuis la fiche de prospection liée, déjà
          // validée — jamais ressaisie pour créer la fiche de traitement
          // (#localite-traitement-conservee-prospection). `station_nom`
          // (intensif, référentiel) ou `station_libre` (extensif, saisie
          // libre) : même ordre de priorité, et même exclusivité mutuelle
          // selon le type de prospection, que `stationLabel()`
          // ((app)/prospection.tsx et fiches.tsx). Modifiable ensuite (filet
          // de sécurité, ex. fiche sans aucun des deux champs renseigné).
          // N'écrase jamais une saisie déjà présente : lu via getState() (pas
          // la variable `store` de ce render, obsolète — cet effet ne dépend
          // pas de `store` et ne se rejoue pas si l'agent a déjà tapé quelque
          // chose pendant que cette requête était en vol).
          const localitePreremplie = prospection.station_nom || prospection.station_libre;
          if (localitePreremplie && !useTraitementCaptureStore.getState().ref.localite) {
            store.updateRef({ localite: localitePreremplie });
          }
        }
      })
      .catch((error) => signalerChargement(error, { prospectionId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectionId, routeTraitementId, signalerChargement]);

  // N° de fiche (auto) : « Prénom du chef — Type — Date ISO », suffixe en cas de
  // collision (même composition que generer_numero_fiche() côté backend). Le chef
  // n'est choisi qu'à l'écran suivant (traitement.tsx) — on utilise donc le prénom
  // de l'utilisateur connecté sur ce téléphone, celui qui fait la saisie (même
  // convention que le chef de base par défaut sur l'écran Traitement). Ne recalcule
  // jamais un numéro déjà présent (brouillon relu, ou déjà généré) : c'est le
  // changement de type ci-dessous qui le remet à zéro pour forcer une régénération.
  useEffect(() => {
    if (readOnly || store.ref.numeroFiche || !utilisateurConnecte || !typeTraitement || !store.ref.dateTraitement) return;
    let cancelled = false;
    genererNumeroFicheDisponible(
      utilisateurConnecte.prenom,
      typeTraitement,
      store.ref.dateTraitement,
      traitementId,
      utilisateurConnecte.sigle,
      estReprise
    )
      .then((numero) => {
        if (!cancelled) store.updateRef({ numeroFiche: numero });
      })
      .catch((error) => signalerChargement(error, { traitementId, source: 'genererNumeroFicheDisponible' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, store.ref.numeroFiche, utilisateurConnecte, typeTraitement, store.ref.dateTraitement, traitementId, estReprise]);

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
          latitude: store.ref.latitude ?? null,
          longitude: store.ref.longitude ?? null,
        });

        const byField: Record<string, string> = {};
        for (const e of validationErrors) byField[e.field] = e.message;
        setErrors(byField);
        // Déjà visible à l'écran (message par champ) : pas de second signal.
        if (validationErrors.length > 0) return;

        let id = traitementId;
        if (!id) {
          // #641 : équipe de travail reprise automatiquement ; bloque un type d'équipe qui ne
          // correspond pas au traitement (aérien / terrestre) en renvoyant vers Paramètres.
          const equipeId = await equipeDeTravailPour(typeTraitement === 'AERIEN' ? 'aerien' : 'terrestre');
          // Pilote, mécanicien, chef de base, consultant : auto-complétés depuis les membres de
          // l'équipe de travail quand elle les porte (ils restent modifiables — présents ce jour-là).
          const equipage = prefillTraitementAerien(equipeId ? await listMembresEquipe(equipeId) : []);
          const created =
            typeTraitement === 'AERIEN'
              ? await createDraftTraitementAerien({
                  id: generateId(),
                  equipeId,
                  prospectionId: prospectionId!,
                  dateTraitement: store.ref.dateTraitement,
                  ...equipage,
                })
              : await createDraftTraitementTerrestre({
                  id: generateId(),
                  equipeId,
                  prospectionId: prospectionId!,
                  dateTraitement: store.ref.dateTraitement,
                  chefEquipeId: '',
                });
          id = created.id;
          setTraitementId(id);

          // Snapshot de la cible, figé à la création (jamais recalculé ensuite,
          // cf. l'avertissement affiché sur l'écran Cibles) — dérivé de la fiche
          // de prospection liée, même logique que construire_cible() côté backend.
          if (prospectionId) {
            const [prospectionLiee, populations, infestations, captures] = await Promise.all([
              getProspection(prospectionId),
              listAllProspectionPopulations(prospectionId),
              listAllProspectionInfestations(prospectionId),
              listAllProspectionCaptures(prospectionId),
            ]);
            if (prospectionLiee) {
              const cible = construireCible(prospectionLiee, populations, infestations, captures);
              // #zone-a-reprendre-surface-reste-a-traiter : la référence de
              // surface pour CETTE fiche est le reste à traiter de l'origine,
              // pas sa `surface_infestee_ha` (qui reste affichée telle quelle,
              // inchangée — c'est une donnée de la prospection, pas de la
              // reprise). L'origine peut avoir un type de traitement différent
              // de celui choisi ici (terrestre/aérien restent libres l'un de
              // l'autre, cf. `estReprise`), donc on lit le sous-objet
              // réellement renseigné plutôt que de supposer lequel.
              if (origineId) {
                const origine = await getTraitement(origineId);
                cible.surface_restante_origine_ha =
                  origine?.terrestre?.surface_restante_ha ?? origine?.aerien?.surface_restante_ha ?? null;
              }
              await saveCible(id, cible);
            }
          }
        }

        // Filet de sécurité : l'effet de génération auto tourne en tâche de fond et
        // peut ne pas avoir résolu si l'agent enchaîne vite — on ne part jamais avec
        // numeroFiche encore null ici.
        let numeroFiche = store.ref.numeroFiche ?? null;
        if (!numeroFiche && utilisateurConnecte && typeTraitement && store.ref.dateTraitement) {
          numeroFiche = await genererNumeroFicheDisponible(
            utilisateurConnecte.prenom,
            typeTraitement,
            store.ref.dateTraitement,
            id,
            utilisateurConnecte.sigle,
            estReprise
          );
          store.updateRef({ numeroFiche });
        }

        await updateTraitementReference(id, {
          localite: store.ref.localite ?? null,
          region: store.ref.region ?? null,
          district: store.ref.district ?? null,
          commune: store.ref.commune ?? null,
          latitude: store.ref.latitude ?? null,
          longitude: store.ref.longitude ?? null,
          altitude: store.ref.altitude ?? null,
          // Bug corrigé (#persistance-fiches-traitement) : jamais transmis ici
          // auparavant, alors que le sélecteur ci-dessous reste modifiable sur
          // une fiche déjà créée — la modification disparaissait donc au
          // prochain enregistrement.
          modeTraitement: store.ref.modeTraitement ?? null,
          dateTraitement: store.ref.dateTraitement ?? null,
          dateValidation,
          numeroFiche,
        });

        // Aérien : « Cibles » devient « Synthèse » et s'enrichit de la végétation
        // (#326) — le terrestre garde son flux actuel, inchangé.
        router.push({
          pathname: (typeTraitement === 'AERIEN' ? '/(traitement)/synthese' : '/(traitement)/cibles') as any,
          params: { traitementId: id, isValidationView, origineId },
        });
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
          <ProgressBar
            currentIndex={0}
            segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Type de traitement *</Text>
            <SegmentedControl
              options={[
                { value: 'AERIEN', label: 'Aérien' },
                { value: 'TERRESTRE', label: 'Terrestre' },
              ]}
              value={typeTraitement}
              onChange={(v) => {
                if (readOnly || traitementId) return;
                store.setTypeTraitement(v as any);
                // Le type entre dans la composition du n° de fiche (auto) : remis à
                // zéro pour que l'effet de génération le recalcule avec le bon type.
                store.updateRef({ numeroFiche: null });
              }}
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
                <Text style={styles.prospectionText}>{prospectionNFiche ?? '(numéro non renseigné)'}</Text>
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
            {errors.latitude && <Text style={styles.error}>{errors.latitude}</Text>}

            <Card variant="default" style={styles.regionCard}>
              <Text style={styles.label}>Région · district · commune (auto, hors-ligne)</Text>
              <Text style={styles.coordValue}>{regionDistrictCommune || '—'}</Text>
            </Card>

            <View style={styles.field}>
              <Text style={styles.label}>Localité * (pré-remplie, modifiable)</Text>
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
              <Text style={styles.continueButtonText}>
                {isSaving ? 'Enregistrement…' : `Continuer — ${typeTraitement === 'AERIEN' ? 'Synthèse' : 'Cibles'} ›`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp },
    keyboardAvoidingView: { flex: 1 },
    content: { padding: 16, gap: 14, paddingBottom: 30 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backChevron: { fontFamily: traitementFonts.uiExtraBold, fontSize: typeSizes.titreEcran + 6, color: traitementColors.texteTitre },
    title: { fontFamily: traitementFonts.uiExtraBold, fontSize: typeSizes.titreEcran, color: traitementColors.texteTitre },
    field: { gap: 5 },
    row: { flexDirection: 'row', gap: 8 },
    flex1: { flex: 1 },
    label: {
      fontFamily: traitementFonts.uiSemiBold,
      fontSize: typeSizes.label,
      color: traitementColors.texteLabel,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    note: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteNote },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.chip,
      paddingHorizontal: 10,
      fontFamily: traitementFonts.ui,
      fontSize: typeSizes.corps,
      color: traitementColors.texteTitre,
      backgroundColor: '#fff',
    },
    monoReadonly: { fontFamily: traitementFonts.mono, fontSize: typeSizes.corps, color: traitementColors.texteSecondaire },
    error: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.erreurTexte },
    ficheCard: { gap: 4 },
    prospectionCard: { borderWidth: 2, borderColor: traitementColors.vertPrincipal, gap: 4 },
    prospectionText: { fontFamily: traitementFonts.monoBold, fontSize: typeSizes.valeurDerivee, color: traitementColors.texteTitre },
    prospectionPickerLink: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: traitementColors.vertPrincipal,
      borderRadius: traitementRadii.chip,
    },
    prospectionPickerLinkText: { fontFamily: traitementFonts.uiBold, color: traitementColors.vertPrincipal, fontSize: typeSizes.corps },
    gpsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
    gpsRowText: { fontFamily: traitementFonts.ui, fontSize: typeSizes.corps, color: traitementColors.texteSecondaire },
    gpsStatus: { fontFamily: traitementFonts.uiSemiBold, fontSize: typeSizes.corps, color: traitementColors.texteLabel },
    gpsStatusActive: { color: traitementColors.vertPrincipal },
    coordCard: { gap: 4 },
    coordValue: { fontFamily: traitementFonts.monoBold, fontSize: typeSizes.corps + 1, color: traitementColors.texteTitre },
    regionCard: { gap: 4 },
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
