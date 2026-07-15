// src/lib/api-client.ts
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
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
}

export interface ListProspectionsParams {
  statut?: string;
  prospecteur_id?: string;
}

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
};

// Constante pour l'URL de base (utilisée pour changePassword)
const API_URL = getBaseUrl();

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
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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

  // ============================================
  // CHANGEMENT DE MOT DE PASSE
  // ============================================
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