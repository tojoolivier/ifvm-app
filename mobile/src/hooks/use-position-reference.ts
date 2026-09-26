import { useEffect, useMemo, useState } from 'react';
import { getCurrentPosition, type GpsPosition } from '@/lib/location';
import { logger } from '@/lib/logger';
import type { ProspectionCreate } from '@/lib/prospection-db';
import { coordonneesValides, parserCoordonnee } from '@/lib/prospection-rattachement';

const log = logger.child({ module: 'position-reference' });

export type SaisieCoordonnees = { latitude: string; longitude: string };
export type PositionRetenue = Pick<GpsPosition, 'latitude' | 'longitude' | 'altitude' | 'accuracy'>;

/**
 * Position de la fiche : fix GPS (une seule acquisition), ou celle du brouillon repris, ou des coordonnées
 * saisies à la main. `positionGps` n'est renseignée que par un vrai fix — c'est lui qui déclenche les effets
 * de « première capture » ; `position` est la position retenue pour la fiche.
 */
export function usePositionReference(brouillon?: ProspectionCreate) {
  const [positionGps, setPositionGps] = useState<GpsPosition | null>(null);
  const [gpsEchec, setGpsEchec] = useState(false);
  const [saisie, setSaisie] = useState<SaisieCoordonnees | null>(null);

  useEffect(() => {
    if (brouillon) return; // Reprise : on ne relance pas le GPS.
    let annule = false;
    getCurrentPosition()
      .then((fix) => !annule && setPositionGps(fix))
      .catch((e) => {
        log.failure('reference_gps', e);
        if (!annule) setGpsEchec(true);
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule acquisition par écran
  }, []);

  const positionBrouillon = useMemo<PositionRetenue | null>(
    () =>
      brouillon?.latitude != null && brouillon.longitude != null
        ? { latitude: brouillon.latitude, longitude: brouillon.longitude, altitude: brouillon.altitude ?? null, accuracy: null }
        : null,
    [brouillon]
  );

  const latitude = saisie ? parserCoordonnee(saisie.latitude) : undefined;
  const longitude = saisie ? parserCoordonnee(saisie.longitude) : undefined;
  const coordonneesInvalides = latitude !== undefined && longitude !== undefined && !coordonneesValides(latitude, longitude);
  const altitude = (positionGps ?? positionBrouillon)?.altitude ?? null;
  const positionManuelle = useMemo<PositionRetenue | null>(
    () =>
      latitude !== undefined && longitude !== undefined && !coordonneesInvalides
        ? { latitude, longitude, altitude, accuracy: null }
        : null,
    [latitude, longitude, coordonneesInvalides, altitude]
  );

  return {
    position: positionManuelle ?? positionGps ?? positionBrouillon,
    positionGps,
    positionManuelle,
    gpsEchec,
    saisie,
    setSaisie,
    coordonneesInvalides,
  };
}
