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

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
};

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
    throw new Error(`HTTP error! status: ${response.status}`);
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
};
