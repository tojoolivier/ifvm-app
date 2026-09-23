import * as Location from 'expo-location';
import { PermissionError, PreconditionError } from './errors';
import { logger } from './logger';
import { PRECISION_GPS_CIBLE_M, PRECISION_GPS_TIMEOUT_MS } from './gps-precision';
import { resoudreZoneHorsLigne } from './geo-administratif';

const log = logger.child({ module: 'location' });

export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  /** Horodatage (ms epoch) fourni par le GPS lui-même au moment du fix — pas `Date.now()`,
   * pris à un instant potentiellement différent (calcul, attente réseau...). */
  timestamp: number;
}

export interface GetCurrentPositionOptions {
  /** Précision (m) à partir de laquelle on arrête d'attendre. */
  cibleM?: number;
  /** Délai (ms) au-delà duquel on retient le meilleur fix obtenu. */
  timeoutMs?: number;
  /** Appelé à chaque amélioration de la précision — sert à animer le badge « ± N m ». */
  onProgress?: (position: GpsPosition) => void;
}

const toGpsPosition = (position: Location.LocationObject): GpsPosition => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  altitude: position.coords.altitude,
  accuracy: position.coords.accuracy,
  timestamp: position.timestamp,
});

/** Une précision absente est traitée comme la pire possible : elle ne doit jamais gagner. */
const precisionOuPire = (position: GpsPosition) => position.accuracy ?? Number.POSITIVE_INFINITY;

/**
 * Demande la permission de localisation puis acquiert la position courante.
 *
 * Deux écarts délibérés au `getCurrentPositionAsync({})` d'origine :
 *
 * 1. `Accuracy.High` force un fix GNSS. Le défaut d'expo-location est `Balanced`,
 *    documenté « à cent mètres près » : sur Android il autorise une réponse
 *    purement réseau (WiFi/cellulaire), et une cellule GSM en brousse malgache
 *    couvre plusieurs kilomètres — d'où les fix à 400–500 m observés sur le terrain.
 * 2. On observe le flux de positions au lieu de retenir le premier fix. Un GPS qui
 *    démarre à froid converge de ~500 m vers ~5 m en plusieurs secondes ; prendre
 *    le premier fix, c'est capturer la phase de convergence.
 */
export async function getCurrentPosition(
  options: GetCurrentPositionOptions = {}
): Promise<GpsPosition> {
  const {
    cibleM = PRECISION_GPS_CIBLE_M,
    timeoutMs = PRECISION_GPS_TIMEOUT_MS,
    onProgress,
  } = options;

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

  return new Promise<GpsPosition>((resolve, reject) => {
    let meilleur: GpsPosition | null = null;
    let termine = false;
    let subscription: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cloturer = (finaliser: () => void) => {
      if (termine) return;
      termine = true;
      if (timer) clearTimeout(timer);
      subscription?.remove();
      finaliser();
    };

    timer = setTimeout(() => {
      cloturer(() => {
        if (meilleur) {
          log.event('gps_precision_cible_non_atteinte', {
            accuracy: meilleur.accuracy,
            cibleM,
            timeoutMs,
          });
          resolve(meilleur);
        } else {
          reject(
            new PreconditionError(
              'Position GPS indisponible : aucun signal reçu. Placez-vous à découvert et réessayez.'
            )
          );
        }
      });
    }, timeoutMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
      (position) => {
        if (termine) return;
        const candidat = toGpsPosition(position);
        // Un fix moins précis que le meilleur déjà obtenu n'apporte rien, et le
        // remonter ferait remonter le « ± N m » affiché — l'agent lirait une régression.
        if (meilleur && precisionOuPire(candidat) >= precisionOuPire(meilleur)) return;

        meilleur = candidat;
        onProgress?.(candidat);

        if (precisionOuPire(candidat) <= cibleM) {
          cloturer(() => resolve(candidat));
        }
      }
    )
      .then((sub) => {
        // La souscription peut arriver après une clôture (timeout très court) :
        // il faut alors la couper immédiatement pour ne pas laisser le GPS allumé.
        if (termine) sub.remove();
        else subscription = sub;
      })
      .catch((error) => {
        cloturer(() =>
          reject(
            new PreconditionError('Acquisition GPS impossible.', { cause: error })
          )
        );
      });
  });
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
 *
 * `Location.reverseGeocodeAsync` a besoin des services natifs (Google/Apple), donc
 * typiquement d'un accès réseau — il échoue normalement en brousse malgache hors
 * couverture. `resoudreZoneHorsLigne` (`./geo-administratif.ts`, jeu de données GeoNames
 * bundlé) comble alors, champ par champ, ce que le géocodeur natif n'a pas fourni —
 * jamais l'inverse : le natif reste prioritaire quand il répond, plus précis qu'un
 * plus-proche-voisin sur un jeu de données figé.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<AdministrativeArea> {
  let natif: AdministrativeArea = { region: null, district: null, commune: null };
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (result) {
      natif = {
        region: result.region ?? null,
        district: result.subregion ?? null,
        commune: result.city ?? result.district ?? null,
      };
    }
  } catch (error) {
    // Silence délibéré : le géocodage inverse est un confort, et il échoue
    // normalement hors-ligne. Les coordonnées, elles, sont déjà acquises.
    log.ignore(
      error,
      'Géocodage inverse indisponible — les coordonnées suffisent, la zone administrative est un confort.'
    );
  }

  if (natif.region && natif.district && natif.commune) return natif;

  const horsLigne = resoudreZoneHorsLigne(latitude, longitude);
  if (!horsLigne) return natif;

  return {
    region: natif.region ?? horsLigne.region,
    district: natif.district ?? horsLigne.district,
    commune: natif.commune ?? horsLigne.commune,
  };
}
