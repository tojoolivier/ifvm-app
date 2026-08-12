import { useRequestLogStore, RequestLogEntry } from './request-log-store';
import type { components } from './api-schema.generated';

const REDACTED = '[redacted]';

/** Ne jamais logger de secrets : mots de passe en clair dans le body des routes auth. */
function redactBody(url: string, body: string | null | undefined): string | null | undefined {
  if (body == null) return body;
  if (url.includes('/auth/login') || url.includes('/auth/change-password') || url.includes('/auth/refresh')) {
    return REDACTED;
  }
  return body;
}

function logRequest(entry: Omit<RequestLogEntry, 'id'>): void {
  useRequestLogStore.getState().addEntry({
    ...entry,
    requestBody: redactBody(entry.url, entry.requestBody),
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

export type UserRole = 'prospecteur' | 'chef_equipe' | 'agent_encadreur' | 'pilote' | 'mecanicien' | 'chef_de_base' | 'admin';

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
  actif: boolean;
  created_at: string;
}

// Types alignés sur le contrat OpenAPI backend (mobile/src/lib/api-schema.generated.ts),
// pour ne plus recopier les champs à la main (voir CLAUDE.md "Contrat API mobile ↔ backend").
export type ProspectionCaptureInput = components['schemas']['CaptureCreate'];
export type ProspectionPopulationInput = components['schemas']['PopulationCreate'];
export type ProspectionInfestationInput = components['schemas']['InfestationCreate'];
export type ProspectionCreateInput = components['schemas']['ProspectionCreate'];

export interface ProspectionCreateResponse {
  id: string;
}

export type PopulationRead = components['schemas']['PopulationRead'];
export type CaptureRead = components['schemas']['CaptureRead'];
export type InfestationRead = components['schemas']['InfestationRead'];
export type ProspectionRead = components['schemas']['ProspectionRead'];

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

export interface ReferentielPullResponse {
  postes_acridiens: EntityPull<PosteAcridienSync>;
  stations_fixes: EntityPull<StationFixeSync>;
  utilisateurs_equipe: EntityPull<UtilisateurEquipeSync>;
  pesticides: EntityPull<PesticideSync>;
  cultures: EntityPull<CultureSync>;
  codes_stades: EntityPull<CodeStadeSync>;
}

/** Curseur `since` propre à chaque type d'entité référentiel (ADR-007 : rafraîchissement indépendant par table). */
export type ReferentielSinceCursors = { [K in keyof ReferentielPullResponse]: string | null };

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
};

interface FastApiValidationError {
  loc: (string | number)[];
  msg: string;
}

/**
 * FastAPI renvoie les erreurs sous `detail` — une chaîne pour les HTTPException
 * métier, ou un tableau d'erreurs Pydantic pour les 422 de validation. Sans ceci,
 * l'appelant ne voit qu'un générique "HTTP error! status: 422" inexploitable.
 */
function extractErrorMessage(errorData: unknown): string | null {
  if (typeof errorData !== 'object' || errorData === null) return null;
  const data = errorData as Record<string, unknown>;

  if (typeof data.message === 'string') return data.message;

  const detail = data.detail;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .filter((item): item is FastApiValidationError => typeof item?.msg === 'string')
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
        return field ? `${field}: ${item.msg}` : item.msg;
      });
    if (messages.length > 0) return messages.join('; ');
  }

  return null;
}

const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
  onUnauthorized?: OnUnauthorized
): Promise<T> => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const startedAt = new Date();
  const startTime = Date.now();
  let response: Response;
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
      durationMs: Date.now() - startTime,
      startedAt: startedAt.toISOString(),
      requestBody: typeof options.body === 'string' ? options.body : null,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    });
    throw error;
  }

  const responseClone = response.clone();

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logRequest({
      method: options.method || 'GET',
      url,
      status: response.status,
      ok: false,
      durationMs: Date.now() - startTime,
      startedAt: startedAt.toISOString(),
      requestBody: typeof options.body === 'string' ? options.body : null,
      responseBody: await responseClone.text().catch(() => null),
    });
    throw new Error(extractErrorMessage(errorData) || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    logRequest({
      method: options.method || 'GET',
      url,
      status: response.status,
      ok: true,
      durationMs: Date.now() - startTime,
      startedAt: startedAt.toISOString(),
      requestBody: typeof options.body === 'string' ? options.body : null,
      responseBody: null,
    });
    return undefined as T;
  }

  logRequest({
    method: options.method || 'GET',
    url,
    status: response.status,
    ok: true,
    durationMs: Date.now() - startTime,
    startedAt: startedAt.toISOString(),
    requestBody: typeof options.body === 'string' ? options.body : null,
    responseBody: await responseClone.text().catch(() => null),
  });

  return response.json();
};

export const apiClient = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    return makeRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    return makeRequest<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  pullReferentiel: async (
    token: string,
    cursors: ReferentielSinceCursors,
    onUnauthorized?: OnUnauthorized
  ): Promise<ReferentielPullResponse> => {
    const query = new URLSearchParams();
    if (cursors.postes_acridiens) query.set('since_postes_acridiens', cursors.postes_acridiens);
    if (cursors.stations_fixes) query.set('since_stations_fixes', cursors.stations_fixes);
    if (cursors.utilisateurs_equipe) query.set('since_utilisateurs_equipe', cursors.utilisateurs_equipe);
    if (cursors.pesticides) query.set('since_pesticides', cursors.pesticides);
    if (cursors.cultures) query.set('since_cultures', cursors.cultures);
    if (cursors.codes_stades) query.set('since_codes_stades', cursors.codes_stades);
    const qs = query.toString();
    return makeRequest<ReferentielPullResponse>(
      `/referentiel/pull${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  getPostes: async (token: string, onUnauthorized?: OnUnauthorized): Promise<Poste[]> => {
    return makeRequest<Poste[]>('/geo/postes', { method: 'GET' }, token, onUnauthorized);
  },

  getStations: async (token: string, onUnauthorized?: OnUnauthorized): Promise<Station[]> => {
    return makeRequest<Station[]>('/geo/stations', { method: 'GET' }, token, onUnauthorized);
  },

  getProfile: async (token: string, onUnauthorized?: OnUnauthorized): Promise<User> => {
    return makeRequest<User>('/users/me', { method: 'GET' }, token, onUnauthorized);
  },

  getCampagnes: async (token: string, onUnauthorized?: OnUnauthorized): Promise<Campagne[]> => {
    return makeRequest<Campagne[]>('/campagnes', { method: 'GET' }, token, onUnauthorized);
  },

  createProspection: async (
    token: string,
    body: ProspectionCreateInput,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionCreateResponse> => {
    return makeRequest<ProspectionCreateResponse>(
      '/prospections',
      { method: 'POST', body: JSON.stringify(body) },
      token,
      onUnauthorized
    );
  },

  listProspections: async (
    token: string,
    params: ListProspectionsParams = {},
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead[]> => {
    const query = new URLSearchParams();
    if (params.statut) query.set('statut', params.statut);
    if (params.prospecteur_id) query.set('prospecteur_id', params.prospecteur_id);
    const qs = query.toString();
    return makeRequest<ProspectionRead[]>(
      `/prospections${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  getProspection: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead> => {
    return makeRequest<ProspectionRead>(`/prospections/${id}`, { method: 'GET' }, token, onUnauthorized);
  },

  deleteProspection: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<void> => {
    return makeRequest<void>(`/prospections/${id}`, { method: 'DELETE' }, token, onUnauthorized);
  },

  addRotation: async (
    token: string,
    traitementId: string,
    body: components['schemas']['RotationCreate'],
    onUnauthorized?: OnUnauthorized
  ): Promise<unknown> => {
    return makeRequest<unknown>(
      `/traitements/${traitementId}/rotations`,
      { method: 'POST', body: JSON.stringify(body) },
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
      { method: 'PUT', body: JSON.stringify(body) },
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
      { method: 'DELETE' },
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
      { method: 'POST', body: JSON.stringify(body) },
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
      { method: 'DELETE' },
      token,
      onUnauthorized
    );
  },

  /**
   * POST /traitements/sync — contrairement à makeRequest(), ne jette pas sur un
   * 409 (conflit ou fiche verrouillée) : l'appelant a besoin du corps
   * `TraitementRead` renvoyé par le serveur pour le mettre en cache localement
   * (statut_sync = 'conflict'). Jette bien sur toute autre erreur (réseau,
   * 4xx ≠ 409, 5xx), comme changePassword ci-dessous.
   */
  syncTraitement: async (
    token: string,
    body: unknown
  ): Promise<{ status: number; body: unknown }> => {
    const url = `${getBaseUrl()}/traitements/sync`;
    const startedAt = new Date();
    const startTime = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      logRequest({
        method: 'POST',
        url,
        status: null,
        ok: false,
        durationMs: Date.now() - startTime,
        startedAt: startedAt.toISOString(),
        requestBody: JSON.stringify(body),
        error: error instanceof Error ? error.message : 'Erreur réseau',
      });
      throw error;
    }

    const responseBody = await response.json().catch(() => ({}));

    logRequest({
      method: 'POST',
      url,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startTime,
      startedAt: startedAt.toISOString(),
      requestBody: JSON.stringify(body),
      responseBody: JSON.stringify(responseBody),
    });

    if (!response.ok && response.status !== 409) {
      throw new Error(extractErrorMessage(responseBody) || `HTTP error! status: ${response.status}`);
    }

    return { status: response.status, body: responseBody };
  },

  changePassword: async (
    data: { currentPassword: string; newPassword: string },
    token: string | null
  ): Promise<void> => {
    const url = `${getBaseUrl()}/auth/change-password`;
    const startedAt = new Date();
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      logRequest({
        method: 'POST',
        url,
        status: response.status,
        ok: response.ok,
        durationMs: Date.now() - startTime,
        startedAt: startedAt.toISOString(),
        requestBody: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erreur lors du changement de mot de passe');
      }
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      throw error;
    }
  },
};