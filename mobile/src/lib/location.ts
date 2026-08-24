import * as Location from 'expo-location';
import { PermissionError } from './errors';
import { logger } from './logger';

const log = logger.child({ module: 'location' });

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}

/** Demande la permission de localisation puis acquiert la position courante. */
export async function getCurrentPosition(): Promise<GpsPosition> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // `PermissionError` remplace l'ancienne `LocationPermissionDeniedError`
    // (ADR-012 décision 2) : hors du jeu fermé, celle-ci était classée `(bug)`
    // et l'agent se voyait proposer « Signaler au support » là où le seul
    // recours utile est « Ouvrir les réglages ».
    throw new PermissionError('Permission de localisation refusée', {
      cause: status,
    });
  }

  const position = await Location.getCurrentPositionAsync({});
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy,
  };
}

export interface AdministrativeArea {
  region: string | null;
  district: string | null;
  commune: string | null;
}

/**
 * Géocodage inverse best-effort : l'API d'Expo renvoie des champs administratifs
 * génériques (region/subregion/city) qui ne correspondent pas exactement au découpage
 * malgache région/district/commune — mapping heuristique, jamais bloquant en cas d'échec.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<AdministrativeArea> {
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!result) return { region: null, district: null, commune: null };
    return {
      region: result.region ?? null,
      district: result.subregion ?? null,
      commune: result.city ?? result.district ?? null,
    };
  } catch (error) {
    // Silence délibéré : le géocodage inverse est un confort, et il échoue
    // normalement hors-ligne. Les coordonnées, elles, sont déjà acquises.
    log.ignore(
      error,
      'Géocodage inverse indisponible — les coordonnées suffisent, la zone administrative est un confort.'
    );
    return { region: null, district: null, commune: null };
  }
}
