import * as Location from 'expo-location';

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
}

export class LocationPermissionDeniedError extends Error {
  constructor() {
    super('Permission de localisation refusée');
    this.name = 'LocationPermissionDeniedError';
  }
}

/** Demande la permission de localisation puis acquiert la position courante. */
export async function getCurrentPosition(): Promise<GpsPosition> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionDeniedError();
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
  } catch {
    return { region: null, district: null, commune: null };
  }
}
