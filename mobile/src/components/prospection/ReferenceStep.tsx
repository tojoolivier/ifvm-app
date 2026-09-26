import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, PrimaryButton } from '@/components/ui';
import { UiSpace } from '@/constants/theme';
import { useEcritureBrouillon } from '@/hooks/use-ecriture-brouillon';
import { usePositionReference, type PositionRetenue } from '@/hooks/use-position-reference';
import { useReferenceForm } from '@/hooks/use-reference-form';
import { useRattachement } from '@/hooks/use-rattachement';
import { useAuthStore } from '@/lib/auth-store';
import { resoudreZoneHorsLigne, type ZoneAdministrative } from '@/lib/geo-administratif';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';
import type { ProspectionCreate } from '@/lib/prospection-db';
import { generateNumeroFiche, generateNumeroMessage } from '@/lib/prospection-numeros';
import {
  construireSaisieReference,
  dateLocale,
  stationLibreDepuisZone,
  valeursDeReference,
} from '@/lib/prospection-reference';
import type { ModeReference, ReferenceValeurs } from '@/lib/prospection-reference-schema';
import { BiotopeCard } from './reference/BiotopeCard';
import { CoordonneesManuelles } from './reference/CoordonneesManuelles';
import { DateReleveCard } from './reference/DateReleveCard';
import { FicheCard } from './reference/FicheCard';
import { ListeChoixSheet } from './reference/ListeChoixSheet';
import { LocalisationLibreCard } from './reference/LocalisationLibreCard';
import { PositionCard } from './reference/PositionCard';
import { RattachementCard } from './reference/RattachementCard';
import { SurfacesCard } from './reference/SurfacesCard';

const log = logger.child({ module: 'reference-step' });

type Props = {
  type: 'intensive' | 'extensive' | 'validation';
  onContinuer: (id: string) => void;
  /** Publié dès l'affichage : l'en-tête du wizard reprend le N° de fiche avant la première sauvegarde. */
  onNumeroFiche?: (numero: string) => void;
  /** Reprise : la fiche déjà enregistrée, dont l'écran rouvre les valeurs et garde les champs qu'il ne gère pas. */
  brouillon?: ProspectionCreate & { id: string };
};

const VALEURS_INITIALES: ReferenceValeurs = {
  surface_station: '',
  surface_prospectee: '',
  surface_infestee: '0',
  station_libre: '',
  biotope: [],
};

/**
 * Étape 1 du wizard : Référence (#684), commune à l'intensive, l'extensive et la validation.
 * L'écran assemble les cartes ; la position, le rattachement, le formulaire et l'écriture du brouillon
 * vivent dans leurs hooks.
 */
export function ReferenceStep({ type, onContinuer, onNumeroFiche, brouillon }: Props) {
  const { t } = useTranslation();
  const mode: ModeReference = type === 'intensive' ? 'intensive' : 'extensive';
  const intensif = mode === 'intensive';
  const user = useAuthStore((s) => s.user);

  // Identité de la fiche : fixée une fois pour toute la vie de l'écran (ou reprise du brouillon).
  const [horodatage] = useState(() => new Date());
  const dateFiche = brouillon?.date_prospection ?? dateLocale(horodatage);
  const [brouillonId] = useState(() => brouillon?.id ?? generateId());
  const [numeroFiche] = useState(() => brouillon?.n_fiche ?? generateNumeroFiche(brouillonId, dateFiche, type));
  useEffect(() => onNumeroFiche?.(numeroFiche), [numeroFiche, onNumeroFiche]);
  const [numeroMessageSaisi, setNumeroMessage] = useState<string | null>(brouillon?.n_message ?? null);
  const numeroMessage = numeroMessageSaisi ?? generateNumeroMessage(brouillonId, dateFiche);

  const { form, erreurs } = useReferenceForm(mode, brouillon ? valeursDeReference(brouillon) : VALEURS_INITIALES);
  const position = usePositionReference(brouillon);
  const rattachement = useRattachement({ type, brouillon, position: position.position });
  const ecrire = useEcritureBrouillon(!!brouillon);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);

  // Sans station du référentiel : région / district / commune d'après la position (GPS ou saisie à la main),
  // sinon celles du brouillon repris.
  const source = position.positionManuelle ?? position.positionGps;
  const sourceLat = source?.latitude;
  const sourceLon = source?.longitude;
  const zoneDeLaPosition = useMemo(
    () => (!intensif && sourceLat !== undefined && sourceLon !== undefined ? resoudreZoneHorsLigne(sourceLat, sourceLon) : null),
    [intensif, sourceLat, sourceLon]
  );
  const zoneDuBrouillon = useMemo<ZoneAdministrative | null>(
    () =>
      brouillon?.region || brouillon?.district || brouillon?.commune
        ? { region: brouillon.region ?? '', district: brouillon.district ?? '', commune: brouillon.commune ?? '' }
        : null,
    [brouillon]
  );
  const zone = zoneDeLaPosition ?? zoneDuBrouillon;

  // Station libre pré-remplie hors ligne, sans jamais écraser une saisie.
  useEffect(() => {
    if (zoneDeLaPosition && !form.getFieldValue('station_libre')) {
      form.setFieldValue('station_libre', stationLibreDepuisZone(zoneDeLaPosition));
    }
  }, [zoneDeLaPosition, form]);

  const saisieDe = (
    ids: { campagneId: string; equipeId: string },
    capture?: { position: PositionRetenue; zone: ZoneAdministrative | null }
  ) =>
    construireSaisieReference({
      brouillon,
      id: brouillonId,
      type,
      ...ids,
      dateProspection: dateFiche,
      numeroFiche,
      numeroMessage,
      stationId: rattachement.auto?.station.id ?? null,
      paCode: rattachement.auto?.pa?.code ?? null,
      zone: capture ? capture.zone : zone,
      position: capture ? capture.position : position.position,
      valeurs: form.state.values,
    });

  // Extensive / validation : la position est persistée dès la capture, rien n'est perdu si l'appli est
  // tuée avant « Continuer ».
  const fixLat = position.positionGps?.latitude;
  const fixLon = position.positionGps?.longitude;
  useEffect(() => {
    const fix = position.positionGps;
    if (intensif || !fix) return;
    ecrire((ids) => saisieDe(ids, { position: fix, zone: zoneDeLaPosition })).catch((e) =>
      log.failure('reference_capture_position', e)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule écriture, au fix
  }, [fixLat, fixLon]);

  const continuer = async () => {
    setErreurEnregistrement(null);
    try {
      const res = await ecrire((ids) => saisieDe(ids));
      if ('erreur' in res) return setErreurEnregistrement(t(`prospection.reference.${res.erreur}`));
      onContinuer(res.id);
    } catch (e) {
      log.failure('reference_enregistrement', e);
      setErreurEnregistrement(t('prospection.reference.erreurEnregistrement'));
    }
  };

  // En intensive, la station du référentiel est obligatoire : détectée ou choisie à la main.
  const manques = [...erreurs.manques, ...(intensif && !rattachement.auto ? [t('prospection.reference.station')] : [])];

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {position.gpsEchec && intensif && <Banner tone="warning" message={t('prospection.reference.positionIndisponible')} />}
        {intensif && (
          <RattachementCard
            rattachement={rattachement.auto}
            onChangerPa={rattachement.changerPa}
            onChangerStation={rattachement.changerStation}
          />
        )}
        <FicheCard
          numeroFiche={numeroFiche}
          prospecteur={user}
          numeroMessage={type === 'extensive' ? { valeur: numeroMessage, onChange: setNumeroMessage } : undefined}
        />
        {position.position && <PositionCard position={position.position} />}
        {!intensif && (
          <CoordonneesManuelles saisie={position.saisie} onChange={position.setSaisie} invalide={position.coordonneesInvalides} />
        )}
        {!intensif && <LocalisationLibreCard form={form} erreurs={erreurs} />}
        <DateReleveCard horodatage={horodatage} />
        <SurfacesCard form={form} erreurs={erreurs} intensif={intensif} />
        <BiotopeCard form={form} />
        {erreurEnregistrement && <Banner tone="error" message={erreurEnregistrement} />}
      </ScrollView>
      <ListeChoixSheet
        feuille={rattachement.feuille}
        recherche={rattachement.recherche}
        onRecherche={rattachement.setRecherche}
        onClose={rattachement.fermerFeuille}
      />
      <PrimaryButton
        label={t('prospection.reference.continuer')}
        onPress={continuer}
        manques={manques}
        disabled={Object.keys(erreurs.parChamp).length > 0 || position.coordonneesInvalides}
        testID="reference-continuer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
});
