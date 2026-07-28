import * as Location from 'expo-location';

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export class LocationPermissionDeniedError extends Error {
  constructor() {
    super('Permission de localisation refusée');
    this.name = 'LocationPermissionDeniedError';
  }
}

// Mode simulation pour les tests (à désactiver en production)
const SIMULATE_ALTITUDE = true; // Mettre à false pour utiliser le vrai GPS

/** Demande la permission de localisation puis acquiert la position courante. */
export async function getCurrentPosition(): Promise<GpsPosition> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationPermissionDeniedError();
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  let altitude = position.coords.altitude;
  let altitudeAccuracy = position.coords.altitudeAccuracy;

  // Si l'altitude est null et que le mode simulation est activé
  if ((altitude === null || altitude === undefined) && SIMULATE_ALTITUDE) {
    // Simuler une altitude en utilisant la latitude (pour les tests)
    altitude = Math.round((position.coords.latitude * 100) % 2000 + 100);
    altitudeAccuracy = 10;
    console.log(`[SIMULATION] Altitude simulée: ${altitude}m`);
  }

  // Si toujours null, essayer avec getLastKnownPositionAsync
  if (altitude === null || altitude === undefined) {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown && lastKnown.coords.altitude !== null && lastKnown.coords.altitude !== undefined) {
        altitude = lastKnown.coords.altitude;
        altitudeAccuracy = lastKnown.coords.altitudeAccuracy;
      }
    } catch (error) {
      console.warn('Impossible d\'obtenir l\'altitude via getLastKnownPosition:', error);
    }
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: altitude ?? null,
    accuracy: position.coords.accuracy ?? null,
    altitudeAccuracy: altitudeAccuracy ?? null,
    heading: position.coords.heading ?? null,
    speed: position.coords.speed ?? null,
  };
}

/** Vérifie si le GPS est disponible et activé. */
export async function isGpsAvailable(): Promise<boolean> {
  try {
    const providerStatus = await Location.getProviderStatusAsync();
    // Vérifier explicitement les valeurs boolean
    const gpsAvailable = providerStatus.gpsAvailable === true;
    const locationServicesEnabled = providerStatus.locationServicesEnabled === true;
    return gpsAvailable && locationServicesEnabled;
  } catch {
    return false;
  }
}

/** Récupère la position en continu. */
export function watchPosition(
  callback: (position: GpsPosition) => void,
  onError?: (error: Error) => void
): () => void {
  let subscription: Location.LocationSubscription | null = null;

  const startWatching = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (onError) onError(new LocationPermissionDeniedError());
      return;
    }

    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        let altitude = location.coords.altitude;
        if ((altitude === null || altitude === undefined) && SIMULATE_ALTITUDE) {
          altitude = Math.round((location.coords.latitude * 100) % 2000 + 100);
        }
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: altitude ?? null,
          accuracy: location.coords.accuracy ?? null,
          altitudeAccuracy: location.coords.altitudeAccuracy ?? null,
          heading: location.coords.heading ?? null,
          speed: location.coords.speed ?? null,
        });
      }
    );
  };

  startWatching();

  return () => {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

/** Récupère la position avec une tentative supplémentaire pour l'altitude. */
export async function getPositionWithAltitude(): Promise<GpsPosition> {
  const position = await getCurrentPosition();
  
  // Si l'altitude est null, essayer une deuxième fois avec une approche différente
  if (position.altitude === null) {
    try {
      // Essayer avec getCurrentPositionAsync avec accuracy High
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const highAccuracyPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (highAccuracyPosition.coords.altitude !== null && highAccuracyPosition.coords.altitude !== undefined) {
          return {
            ...position,
            altitude: highAccuracyPosition.coords.altitude,
            altitudeAccuracy: highAccuracyPosition.coords.altitudeAccuracy ?? null,
          };
        }
      }
    } catch (error) {
      console.warn('Tentative haute précision échouée:', error);
    }
  }
  
  return position;
}