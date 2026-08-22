import {
  useRequestLogStore,
  RequestLogEntry,
} from './request-log-store';
import type { components } from './api-schema.generated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REDACTED = '[redacted]';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Erreur HTTP typée.
 *
 * Permet aux appelants de distinguer :
 * - 401 : authentification invalide / session expirée
 * - 409 : conflit métier
 * - 422 : erreur de validation
 * - 5xx : erreur serveur
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Ne jamais logger de secrets. S'applique aux DEUX moitiés de l'échange :
 * - requête : mot de passe de login, mot de passe de changement, refresh token
 * - réponse : access_token et refresh_token renvoyés par /auth/login et /auth/refresh
 *
 * L'oubli de la moitié « réponse » journalisait les deux jetons en clair
 * (cf. issue #161).
 */
function redactBody(
  url: string,
  body: string | null | undefined
): string | null | undefined {
  if (body == null) {
    return body;
  }

  if (
    url.includes('/auth/login') ||
    url.includes('/auth/change-password') ||
    url.includes('/auth/refresh')
  ) {
    return REDACTED;
  }

  return body;
}

function logRequest(
  entry: Omit<RequestLogEntry, 'id'>
): void {
  useRequestLogStore.getState().addEntry({
    ...entry,
    requestBody: redactBody(
      entry.url,
      entry.requestBody
    ),
    responseBody: redactBody(
      entry.url,
      entry.responseBody
    ),
  });
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type?: string;
}

export interface Poste {
  id: number;
  name: string;
}

export interface Station {
  id: number;
  name: string;
}

export interface Campagne {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

export type UserRole =
  | 'prospecteur'
  | 'chef_equipe'
  | 'agent_encadreur'
  | 'pilote'
  | 'mecanicien'
  | 'chef_de_base'
  | 'admin';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  actif: boolean;
  created_at: string;
}

// Types alignés sur le contrat OpenAPI backend.
export type ProspectionCaptureInput =
  components['schemas']['CaptureCreate'];

export type ProspectionPopulationInput =
  components['schemas']['PopulationCreate'];

export type ProspectionInfestationInput =
  components['schemas']['InfestationCreate'];

export type ProspectionCreateInput =
  components['schemas']['ProspectionCreate'];

export interface ProspectionCreateResponse {
  id: string;
}

export type PopulationRead =
  components['schemas']['PopulationRead'];

export type CaptureRead =
  components['schemas']['CaptureRead'];

export type InfestationRead =
  components['schemas']['InfestationRead'];

export type ProspectionRead =
  components['schemas']['ProspectionRead'];

export interface ListProspectionsParams {
  statut?: string;
  prospecteur_id?: string;
}

export interface EntityPull<T> {
  upserts: T[];
  server_time: string;
}

export interface PosteAcridienSync {
  id: string;
  code: string;
  nom: string;
  region: string | null;
  actif: boolean;
  updated_at: string;
}

export interface StationFixeSync {
  id: string;
  code: string;
  nom: string;
  pa_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  actif: boolean;
  updated_at: string;
}

export interface UtilisateurEquipeSync {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  pa_id: string | null;
  actif: boolean;
  updated_at: string;
}

export interface PesticideSync {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  updated_at: string;
}

export interface CultureSync {
  id: string;
  code: string;
  nom: string;
  actif: boolean;
  updated_at: string;
}

export interface CodeStadeSync {
  id: string;
  code: string;
  espece: string;
  libelle: string;
  actif: boolean;
  updated_at: string;
}

export interface CampagneSync {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  updated_at: string;
}

export interface ReferentielPullResponse {
  postes_acridiens: EntityPull<PosteAcridienSync>;
  stations_fixes: EntityPull<StationFixeSync>;
  utilisateurs_equipe: EntityPull<UtilisateurEquipeSync>;
  pesticides: EntityPull<PesticideSync>;
  cultures: EntityPull<CultureSync>;
  codes_stades: EntityPull<CodeStadeSync>;
  campagnes: EntityPull<CampagneSync>;
}

/**
 * Curseur `since` propre à chaque type d'entité référentiel.
 *
 * ADR-007 :
 * rafraîchissement indépendant par table.
 */
export type ReferentielSinceCursors = {
  [K in keyof ReferentielPullResponse]: string | null;
};

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    'http://localhost:8000'
  );
};

interface FastApiValidationError {
  loc: (string | number)[];
  msg: string;
}

/**
 * Extrait un message exploitable depuis une réponse FastAPI.
 */
function extractErrorMessage(
  errorData: unknown
): string | null {
  if (
    typeof errorData !== 'object' ||
    errorData === null
  ) {
    return null;
  }

  const data =
    errorData as Record<string, unknown>;

  if (typeof data.message === 'string') {
    return data.message;
  }

  const detail = data.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .filter(
        (
          item
        ): item is FastApiValidationError =>
          typeof item?.msg === 'string'
      )
      .map((item) => {
        const field =
          Array.isArray(item.loc)
            ? item.loc[item.loc.length - 1]
            : null;

        return field
          ? `${field}: ${item.msg}`
          : item.msg;
      });

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  return null;
}

/**
 * Vérifie si un token JWT est expiré.
 *
 * Retourne true également si le token est mal formé.
 */
export function isTokenExpired(
  token: string
): boolean {
  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return true;
    }

    const payload = JSON.parse(
      atob(parts[1])
    );

    if (typeof payload.exp !== 'number') {
      return true;
    }

    const exp = payload.exp * 1000;

    return Date.now() >= exp;
  } catch {
    return true;
  }
}

/**
 * Rafraîchit réellement le token d'accès.
 *
 * IMPORTANT :
 * Cette fonction ne doit pas être appelée directement
 * par les différentes fonctionnalités de l'application.
 *
 * Utiliser refreshAccessTokenSingleFlight().
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken =
      await AsyncStorage.getItem(
        REFRESH_TOKEN_KEY
      );

    if (!refreshToken) {
      console.warn(
        '[api-client] Pas de refresh token disponible'
      );

      return null;
    }

    const baseUrl = getBaseUrl();

    const response = await fetch(
      `${baseUrl}/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      console.warn(
        '[api-client] Échec du rafraîchissement du token:',
        response.status
      );

      return null;
    }

    const data =
      (await response.json()) as RefreshResponse;

    if (!data.access_token) {
      console.warn(
        '[api-client] Réponse refresh sans access_token'
      );

      return null;
    }

    await AsyncStorage.setItem(
      TOKEN_KEY,
      data.access_token
    );

    return data.access_token;
  } catch (error) {
    console.error(
      '[api-client] Erreur lors du rafraîchissement du token:',
      error
    );

    return null;
  }
}

/**
 * Promise globale de refresh en cours.
 *
 * Single-flight :
 *
 * Si plusieurs appels demandent un refresh au même moment,
 * un seul appel HTTP /auth/refresh est effectué.
 *
 * Tous les autres appels attendent cette même Promise.
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh du token avec protection single-flight.
 */
export async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (refreshPromise) {
    console.log(
      '[api-client] Refresh déjà en cours, attente du refresh existant...'
    );

    return refreshPromise;
  }

  console.log(
    '[api-client] Démarrage du refresh single-flight...'
  );

  refreshPromise = refreshAccessToken();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;

    console.log(
      '[api-client] Refresh single-flight terminé'
    );
  }
}

const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
  onUnauthorized?: OnUnauthorized
): Promise<T> => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  let currentToken = token;

  /**
   * 1. Vérification locale de l'expiration du token.
   */
  if (
    currentToken &&
    isTokenExpired(currentToken)
  ) {
    console.log(
      '[api-client] Token expiré, tentative de rafraîchissement...'
    );

    const newToken =
      await refreshAccessTokenSingleFlight();

    if (newToken) {
      currentToken = newToken;

      console.log(
        '[api-client] Token rafraîchi avec succès'
      );
    } else {
      console.warn(
        '[api-client] Échec du rafraîchissement du token'
      );

      onUnauthorized?.();

      throw new ApiError(
        'Token invalide. Veuillez vous reconnecter.',
        401
      );
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ||
      {}),
  };

  if (currentToken) {
    headers.Authorization =
      `Bearer ${currentToken}`;
  }

  const startedAt = new Date();
  const startTime = Date.now();

  let response: Response;

  /**
   * 2. Première requête.
   */
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    logRequest({
      method: options.method || 'GET',
      url,
      status: null,
      ok: false,
      durationMs:
        Date.now() - startTime,
      startedAt:
        startedAt.toISOString(),
      requestBody:
        typeof options.body === 'string'
          ? options.body
          : null,
      error:
        error instanceof Error
          ? error.message
          : 'Erreur réseau',
    });

    throw error;
  }

  /**
   * 3. Gestion du 401 :
   *
   * refresh + retry une seule fois.
   *
   * Le refresh passe par le mécanisme single-flight.
   */
  if (
    response.status === 401 &&
    currentToken
  ) {
    console.log(
      '[api-client] 401 Unauthorized, tentative de rafraîchissement...'
    );

    const newToken =
      await refreshAccessTokenSingleFlight();

    if (newToken) {
      const retryHeaders: Record<string, string> = {
        ...headers,
        Authorization:
          `Bearer ${newToken}`,
      };

      try {
        const retryResponse =
          await fetch(url, {
            ...options,
            headers: retryHeaders,
          });

        const retryClone =
          retryResponse.clone();

        if (retryResponse.ok) {
          if (retryResponse.status === 204) {
            logRequest({
              method:
                options.method || 'GET',
              url,
              status:
                retryResponse.status,
              ok: true,
              durationMs:
                Date.now() - startTime,
              startedAt:
                startedAt.toISOString(),
              requestBody:
                typeof options.body === 'string'
                  ? options.body
                  : null,
              responseBody: null,
            });

            return undefined as T;
          }

          const responseData =
            await retryResponse.json();

          logRequest({
            method:
              options.method || 'GET',
            url,
            status:
              retryResponse.status,
            ok: true,
            durationMs:
              Date.now() - startTime,
            startedAt:
              startedAt.toISOString(),
            requestBody:
              typeof options.body === 'string'
                ? options.body
                : null,
            responseBody:
              JSON.stringify(responseData),
          });

          return responseData as T;
        }

        const retryErrorData =
          await retryResponse
            .json()
            .catch(() => ({}));

        logRequest({
          method:
            options.method || 'GET',
          url,
          status:
            retryResponse.status,
          ok: false,
          durationMs:
            Date.now() - startTime,
          startedAt:
            startedAt.toISOString(),
          requestBody:
            typeof options.body === 'string'
              ? options.body
              : null,
          responseBody:
            await retryClone
              .text()
              .catch(() => null),
        });

        throw new ApiError(
          extractErrorMessage(
            retryErrorData
          ) ||
            `HTTP error! status: ${retryResponse.status}`,
          retryResponse.status
        );
      } catch (retryError) {
        if (
          retryError instanceof ApiError
        ) {
          throw retryError;
        }

        console.error(
          '[api-client] Erreur lors de la retry:',
          retryError
        );

        throw retryError;
      }
    }

    /**
     * Refresh impossible :
     * la session n'est plus valide.
     */
    console.warn(
      '[api-client] Refresh impossible après 401'
    );

    onUnauthorized?.();

    throw new ApiError(
      'Token invalide. Veuillez vous reconnecter.',
      401
    );
  }

  /**
   * 4. Erreurs HTTP hors 401.
   */
  if (!response.ok) {
    const responseClone =
      response.clone();

    const errorData =
      await response
        .json()
        .catch(() => ({}));

    logRequest({
      method:
        options.method || 'GET',
      url,
      status: response.status,
      ok: false,
      durationMs:
        Date.now() - startTime,
      startedAt:
        startedAt.toISOString(),
      requestBody:
        typeof options.body === 'string'
          ? options.body
          : null,
      responseBody:
        await responseClone
          .text()
          .catch(() => null),
    });

    throw new ApiError(
      extractErrorMessage(errorData) ||
        `HTTP error! status: ${response.status}`,
      response.status
    );
  }

  /**
   * 5. 204 No Content.
   */
  if (response.status === 204) {
    logRequest({
      method:
        options.method || 'GET',
      url,
      status: response.status,
      ok: true,
      durationMs:
        Date.now() - startTime,
      startedAt:
        startedAt.toISOString(),
      requestBody:
        typeof options.body === 'string'
          ? options.body
          : null,
      responseBody: null,
    });

    return undefined as T;
  }

  /**
   * 6. Réponse normale.
   */
  const responseData =
    await response.json();

  logRequest({
    method:
      options.method || 'GET',
    url,
    status: response.status,
    ok: true,
    durationMs:
      Date.now() - startTime,
    startedAt:
      startedAt.toISOString(),
    requestBody:
      typeof options.body === 'string'
        ? options.body
        : null,
    responseBody:
      JSON.stringify(responseData),
  });

  return responseData as T;
};

export const apiClient = {
  /*
   * -------------------------------------------------------
   * AUTH
   * -------------------------------------------------------
   */

  login: async (
    credentials: LoginCredentials
  ): Promise<LoginResponse> => {
    return makeRequest<LoginResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    );
  },

  refresh: async (
    refreshToken: string
  ): Promise<RefreshResponse> => {
    return makeRequest<RefreshResponse>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      }
    );
  },

  /*
   * -------------------------------------------------------
   * REFERENTIEL
   * -------------------------------------------------------
   */

  pullReferentiel: async (
    token: string,
    cursors: ReferentielSinceCursors,
    onUnauthorized?: OnUnauthorized
  ): Promise<ReferentielPullResponse> => {
    const query =
      new URLSearchParams();

    if (cursors.postes_acridiens) {
      query.set(
        'since_postes_acridiens',
        cursors.postes_acridiens
      );
    }

    if (cursors.stations_fixes) {
      query.set(
        'since_stations_fixes',
        cursors.stations_fixes
      );
    }

    if (cursors.utilisateurs_equipe) {
      query.set(
        'since_utilisateurs_equipe',
        cursors.utilisateurs_equipe
      );
    }

    if (cursors.pesticides) {
      query.set(
        'since_pesticides',
        cursors.pesticides
      );
    }

    if (cursors.cultures) {
      query.set(
        'since_cultures',
        cursors.cultures
      );
    }

    if (cursors.codes_stades) {
      query.set(
        'since_codes_stades',
        cursors.codes_stades
      );
    }

    if (cursors.campagnes) {
      query.set(
        'since_campagnes',
        cursors.campagnes
      );
    }

    const qs = query.toString();

    return makeRequest<ReferentielPullResponse>(
      `/referentiel/pull${qs ? `?${qs}` : ''}`,
      {
        method: 'GET',
      },
      token,
      onUnauthorized
    );
  },

  getPostes: async (
    token: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<Poste[]> => {
    return makeRequest<Poste[]>(
      '/geo/postes',
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  getStations: async (
    token: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<Station[]> => {
    return makeRequest<Station[]>(
      '/geo/stations',
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  getProfile: async (
    token: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<User> => {
    return makeRequest<User>(
      '/users/me',
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  getCampagnes: async (
    token: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<Campagne[]> => {
    return makeRequest<Campagne[]>(
      '/campagnes',
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  /*
   * -------------------------------------------------------
   * PROSPECTIONS
   * -------------------------------------------------------
   */

  createProspection: async (
    token: string,
    body: ProspectionCreateInput,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionCreateResponse> => {
    return makeRequest<ProspectionCreateResponse>(
      '/prospections',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
      onUnauthorized
    );
  },

  listProspections: async (
    token: string,
    params: ListProspectionsParams = {},
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead[]> => {
    const query =
      new URLSearchParams();

    if (params.statut) {
      query.set(
        'statut',
        params.statut
      );
    }

    if (params.prospecteur_id) {
      query.set(
        'prospecteur_id',
        params.prospecteur_id
      );
    }

    const qs = query.toString();

    return makeRequest<ProspectionRead[]>(
      `/prospections${qs ? `?${qs}` : ''}`,
      {
        method: 'GET',
      },
      token,
      onUnauthorized
    );
  },

  getProspection: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead> => {
    return makeRequest<ProspectionRead>(
      `/prospections/${id}`,
      {
        method: 'GET',
      },
      token,
      onUnauthorized
    );
  },

  deleteProspection: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<void> => {
    return makeRequest<void>(
      `/prospections/${id}`,
      {
        method: 'DELETE',
      },
      token,
      onUnauthorized
    );
  },

  /*
   * -------------------------------------------------------
   * TRAITEMENTS
   * -------------------------------------------------------
   */

  addRotation: async (
    token: string,
    traitementId: string,
    body: components['schemas']['RotationCreate'],
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/rotations`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
      onUnauthorized
    );
  },

  updateRotation: async (
    token: string,
    traitementId: string,
    rotationId: string,
    body: components['schemas']['RotationCreate'],
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/rotations/${rotationId}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      token,
      onUnauthorized
    );
  },

  removeRotation: async (
    token: string,
    traitementId: string,
    rotationId: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/rotations/${rotationId}`,
      {
        method: 'DELETE',
      },
      token,
      onUnauthorized
    );
  },

  addProduitUtilise: async (
    token: string,
    traitementId: string,
    body: components['schemas']['ProduitUtiliseCreate'],
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/produits`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      token,
      onUnauthorized
    );
  },

  removeProduitUtilise: async (
    token: string,
    traitementId: string,
    produitUtiliseId: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/produits/${produitUtiliseId}`,
      {
        method: 'DELETE',
      },
      token,
      onUnauthorized
    );
  },

  /**
   * POST /traitements/sync
   *
   * Contrairement à makeRequest(), ne jette pas sur un
   * 409 : l'appelant a besoin du corps TraitementRead
   * renvoyé par le serveur pour le mettre en cache
   * localement avec statut_sync = 'conflict'.
   *
   * Jette sur toute autre erreur.
   */
  syncTraitement: async (
    token: string,
    body: unknown
  ): Promise<{
    status: number;
    body: unknown;
  }> => {
    const url =
      `${getBaseUrl()}/traitements/sync`;

    const startedAt = new Date();
    const startTime = Date.now();

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      logRequest({
        method: 'POST',
        url,
        status: null,
        ok: false,
        durationMs:
          Date.now() - startTime,
        startedAt:
          startedAt.toISOString(),
        requestBody:
          JSON.stringify(body),
        error:
          error instanceof Error
            ? error.message
            : 'Erreur réseau',
      });

      throw error;
    }

    const responseBody =
      await response
        .json()
        .catch(() => ({}));

    logRequest({
      method: 'POST',
      url,
      status: response.status,
      ok: response.ok,
      durationMs:
        Date.now() - startTime,
      startedAt:
        startedAt.toISOString(),
      requestBody:
        JSON.stringify(body),
      responseBody:
        JSON.stringify(responseBody),
    });

    if (
      !response.ok &&
      response.status !== 409
    ) {
      throw new ApiError(
        extractErrorMessage(
          responseBody
        ) ||
          `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    return {
      status: response.status,
      body: responseBody,
    };
  },

  /*
   * -------------------------------------------------------
   * CHANGE PASSWORD
   * -------------------------------------------------------
   */

  changePassword: async (
    data: {
      currentPassword: string;
      newPassword: string;
    },
    token: string | null
  ): Promise<void> => {
    const url =
      `${getBaseUrl()}/auth/change-password`;

    const startedAt = new Date();
    const startTime = Date.now();

    try {
      const response =
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        });

      logRequest({
        method: 'POST',
        url,
        status: response.status,
        ok: response.ok,
        durationMs:
          Date.now() - startTime,
        startedAt:
          startedAt.toISOString(),
        requestBody:
          JSON.stringify(data),
      });

      if (!response.ok) {
        const error =
          await response
            .json()
            .catch(() => ({}));

        throw new ApiError(
          extractErrorMessage(error) ||
            'Erreur lors du changement de mot de passe',
          response.status
        );
      }
    } catch (error) {
      console.error(
        'Erreur changement mot de passe:',
        error
      );

      throw error;
    }
  },
};