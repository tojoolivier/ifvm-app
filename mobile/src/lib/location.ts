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
