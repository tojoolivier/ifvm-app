import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================
// TYPES DE BASE
// ============================================

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

// ============================================
// TYPES PROSPECTION - INPUTS
// ============================================

export interface ProspectionCaptureInput {
  espece: string;
  categorie: string;
  sexe: string | null;
  phase: string;
  stade: string;
  effectif: number;
}

export interface ProspectionPopulationInput {
  espece: string;
  categorie: string;
  densite_diffuse?: number;
  densite_groupee?: number;
  accouplement?: string;
  ponte?: string;
}

export interface ProspectionInfestationInput {
  type_cible: string;
  taille_min?: number;
  taille_max?: number;
  taille_moy?: number;
  surface_tot?: number;
  densite_min?: number;
  densite_max?: number;
  densite_moy?: number;
  interdistance?: number;
  comportement?: string;
  direction_vers?: string;
  vent_de?: string;
  vent_vitesse?: number;
}

export interface ProspectionCreateInput {
  type_prospection: 'intensive' | 'extensive' | 'validation';
  campagne_id: string;
  station_id?: string | null;
  n_releve?: string | null;
  n_fiche?: string | null;
  n_message?: string | null;
  date_prospection: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  biotope?: string | null;
  surf_station?: number | null;
  surf_prospectee?: number | null;
  surf_infestee?: number | null;
  degats_cultures?: string | null;
  derniere_pluie?: string | null;
  intensite_pluie?: string | null;
  vegetation?: any | null;
  sol?: any | null;
  verdissement?: number | null;
  hauteur_strate?: number | null;
  ennemis_naturels?: string | null;
  pullulation_nb?: number | null;
  interdistance?: number | null;
  taille_info?: any | null;
  essaim_type?: string | null;
  essaim_vol_dir_de?: string | null;
  essaim_vol_dir_vers?: string | null;
  essaim_pose?: boolean | null;
  surface_contaminee?: number | null;
  observations?: string | null;
  statut?: string;
  populations?: ProspectionPopulationInput[];
  captures?: ProspectionCaptureInput[];
  infestations?: ProspectionInfestationInput[];
}

export interface ProspectionUpdateInput {
  station_id?: string | null;
  n_releve?: string | null;
  n_fiche?: string | null;
  n_message?: string | null;
  date_prospection?: string;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  biotope?: string | null;
  surf_station?: number | null;
  surf_prospectee?: number | null;
  surf_infestee?: number | null;
  degats_cultures?: string | null;
  derniere_pluie?: string | null;
  intensite_pluie?: string | null;
  vegetation?: any | null;
  sol?: any | null;
  verdissement?: number | null;
  hauteur_strate?: number | null;
  ennemis_naturels?: string | null;
  pullulation_nb?: number | null;
  interdistance?: number | null;
  taille_info?: any | null;
  essaim_type?: string | null;
  essaim_vol_dir_de?: string | null;
  essaim_vol_dir_vers?: string | null;
  essaim_pose?: boolean | null;
  surface_contaminee?: number | null;
  observations?: string | null;
  statut?: string;
}

export interface ProspectionCreateResponse {
  id: string;
}

// ============================================
// TYPES PROSPECTION - READS
// ============================================

export interface PopulationRead {
  id: string;
  prospection_id: string;
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
  prospection_id: string;
  espece: string;
  categorie: string;
  sexe: string | null;
  phase: string;
  stade: string;
  effectif: number;
}

export interface InfestationRead {
  id: string;
  prospection_id: string;
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
  verdissement: number | null;
  hauteur_strate: number | null;
  ennemis_naturels: string | null;
  pullulation_nb: number | null;
  interdistance: number | null;
  taille_info: Record<string, unknown> | null;
  essaim_type: string | null;
  essaim_vol_dir_de: string | null;
  essaim_vol_dir_vers: string | null;
  essaim_pose: boolean | null;
  surface_contaminee: number | null;
  observations: string | null;
  statut: string;
  statut_sync: string;
  verified_by: string | null;
  verified_at: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  populations: PopulationRead[];
  captures: CaptureRead[];
  infestations: InfestationRead[];
}

export interface ListProspectionsParams {
  type?: string;
  statut?: string;
  campagne_id?: string;
  station_id?: string;
  prospecteur_id?: string;
}

export interface StatutChange {
  statut: string;
}

export interface CommentaireCreate {
  texte: string;
}

export interface AuditLogRead {
  id: string;
  fiche_type: string;
  fiche_id: string;
  auteur_id: string;
  action: string;
  details: any;
  created_at: string;
}

type OnUnauthorized = () => void;

const getBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
};

const BASE_URL = getBaseUrl(); // ✅ Renommé pour éviter le conflit

const makeRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
  onUnauthorized?: OnUnauthorized
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`📤 ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      console.error('❌ Détails de l\'erreur:', JSON.stringify(errorData, null, 2));
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      const text = await response.text();
      console.error('❌ Réponse brute:', text);
    }
    throw new Error(errorMessage);
  }

  return response.json();
};

// ============================================
// API CLIENT
// ============================================

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
    if (params.type) query.set('type', params.type);
    if (params.statut) query.set('statut', params.statut);
    if (params.campagne_id) query.set('campagne_id', params.campagne_id);
    if (params.station_id) query.set('station_id', params.station_id);
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

  updateProspection: async (
    token: string,
    id: string,
    body: ProspectionUpdateInput,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead> => {
    return makeRequest<ProspectionRead>(
      `/prospections/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      token,
      onUnauthorized
    );
  },

  deleteProspection: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<void> => {
    await makeRequest<void>(
      `/prospections/${id}`,
      { method: 'DELETE' },
      token,
      onUnauthorized
    );
  },

  changerStatut: async (
    token: string,
    id: string,
    statut: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<ProspectionRead> => {
    return makeRequest<ProspectionRead>(
      `/prospections/${id}/statut`,
      { method: 'PATCH', body: JSON.stringify({ statut }) },
      token,
      onUnauthorized
    );
  },

  ajouterCommentaire: async (
    token: string,
    id: string,
    texte: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<AuditLogRead> => {
    return makeRequest<AuditLogRead>(
      `/prospections/${id}/commentaire`,
      { method: 'POST', body: JSON.stringify({ texte }) },
      token,
      onUnauthorized
    );
  },

  getAuditLog: async (
    token: string,
    id: string,
    onUnauthorized?: OnUnauthorized
  ): Promise<AuditLogRead[]> => {
    return makeRequest<AuditLogRead[]>(
      `/prospections/${id}/audit-log`,
      { method: 'GET' },
      token,
      onUnauthorized
    );
  },

  changePassword: async (
    data: { currentPassword: string; newPassword: string },
    token: string | null
  ): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/auth/change-password`, {
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