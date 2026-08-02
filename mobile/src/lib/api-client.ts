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

export interface ProspectionCaptureInput {
  espece: string;
  categorie: string;
  sexe: string | null;
  phase: string;
  stade: string;
  effectif: number;
}

export interface ProspectionCreateInput {
  type_prospection: string;
  campagne_id: string;
  station_id?: string | null;
  n_fiche?: string | null;
  date_prospection: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  surf_station?: number | null;
  surf_prospectee?: number | null;
  surf_infestee?: number | null;
  degats_cultures?: string | null;
  vegetation?: Record<string, unknown> | null;
  sol?: Record<string, unknown> | null;
  statut?: string;
  captures?: ProspectionCaptureInput[];
  // ========== NOUVEAUX CHAMPS ==========
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  za?: string | null;
  pa_code?: string | null;
  degats_cultures_pourcent?: number | null;
  verdissement_pourcent?: number | null;
  hauteur_herbe_cm?: number | null;
}

export interface ProspectionCreateResponse {
  id: string;
}

export interface PopulationRead {
  id: string;
  espece: string;
  categorie: string;
  densite_diffuse: number | null;
  densite_groupee: number | null;
  captures_nombre: number | null;
  temps_capture: number | null;
  accouplement: string | null;
  ponte: string | null;
}

export interface CaptureRead {
  id: string;
  espece: string;
  categorie: string;
  sexe: string | null;
  phase: string;
  stade: string;
  effectif: number;
}

export interface InfestationRead {
  id: string;
  espece: string | null;
  type_cible: string;
  taille_min: number | null;
  taille_max: number | null;
  taille_moy: number | null;
  surface_tot: number | null;
  densite_min: number | null;
  densite_max: number | null;
  densite_moy: number | null;
  interdistance: number | null;
  comportement: string | null;
  direction_de: string | null;
  direction_vers: string | null;
  vent_de: string | null;
  vent_vitesse: number | null;
  // ========== NOUVEAUX CHAMPS ==========
  pullulation_nb: number | null;
  taille_long: number | null;
  taille_large: number | null;
  taille_epaisseur: number | null;
  essaim_en_vol: boolean | null;
  essaim_pose: boolean | null;
  type_essaim: string | null;
  nb_taches_bandes: number | null;
  interdistance_m: number | null;
  surface_contaminee_ha: number | null;
  type_larve: string | null;
  surf_infestee_pourcent: number | null;
}

export interface ProspectionRead {
  id: string;
  type_prospection: string;
  campagne_id: string;
  prospecteur_id: string;
  station_id: string | null;
  n_releve: string | null;
  n_fiche: string | null;
  n_message: string | null;
  date_prospection: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  biotope: string | null;
  surf_station: number | null;
  surf_prospectee: number | null;
  surf_infestee: number | null;
  degats_cultures: string | null;
  derniere_pluie: string | null;
  intensite_pluie: string | null;
  vegetation: Record<string, unknown> | null;
  sol: Record<string, unknown> | null;
  ennemis_naturels: string | null;
  observations: string | null;
  statut: string;
  statut_sync: string;
  created_at: string;
  updated_at: string;
  populations: PopulationRead[];
  captures: CaptureRead[];
  infestations: InfestationRead[];
  // ========== NOUVEAUX CHAMPS ==========
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  pa_code: string | null;
  degats_cultures_pourcent: number | null;
  verdissement_pourcent: number | null;
  hauteur_herbe_cm: number | null;
}

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

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
};

const API_URL = getBaseUrl();

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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData) || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

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
    since: string | null,
    onUnauthorized?: OnUnauthorized
  ): Promise<ReferentielPullResponse> => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return makeRequest<ReferentielPullResponse>(
      `/referentiel/pull${qs}`,
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

  changePassword: async (
    data: { currentPassword: string; newPassword: string },
    token: string | null
  ): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
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