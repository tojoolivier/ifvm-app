export interface PosteAcridien {
  id: string
  code: string
  nom: string
  region: string
  district: string | null
  commune: string | null
  created_at: string
}

export interface Station {
  id: string
  pa_id: string
  code: string
  nom: string | null
  type: 'fixe' | 'ponctuelle'
  latitude: number
  longitude: number
  altitude_m: number | null
}

export interface Utilisateur {
  id: string
  nom: string
  prenom: string
  email: string
  role: string
  pa_id: string | null
  actif: boolean
  created_at: string
}

export type SyncStatus = 'local' | 'synced' | 'conflict'
export type Espece = 'LMC' | 'NSE' | 'mixte'
