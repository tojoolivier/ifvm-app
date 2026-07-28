export type ProspectionType = 'intensive' | 'extensive' | 'validation';
export type FicheStatus = 'brouillon' | 'en_attente' | 'verifiee' | 'rejetee' | 'validee';

export interface CdVData {
  references: {
    crt: string;
    chefEquipe: string;
    agentEncadreur: string;
    dateValidation: string;
    numeroValidation: string;
    dateTraitement: string;
    localite: string;
    cR: string;
    district: string;
    pa: string;
    za: string;
    region: string;
    coordonnees: {
      latitude: string;
      longitude: string;
    };
  };
  observations: {
    id: string;
    valeur: string | number;
  }[];
}

export interface IFVMData {
  references: {
    prospecteur: string;
    pa: string;
    date: string;
    numeroMessage: string;
    station: string;
    latitudeS: string;
    longitudeE: string;
    typeStation: string;
    surface: string;
  };
  images: {
    captures: {
      a1: string; a2: string; a3: string; a4: string; a5: string;
    };
    sol: {
      nbreSol: string;
      nbreTrans: string;
      nbreGreg: string;
    };
    population: {
      diffDHa: string;
      groupDM2: string;
    };
    pullulation: {
      nb: string;
      interdistance: string;
      taille: { long: string; large: string; epaisseur: string };
    };
    essaim: {
      vol: string;
      clair: boolean;
      dense: boolean;
      tresDense: boolean;
      direction: string;
      essEnVol: string;
      essaimPose: string;
    };
    surfaceInfestee: string;
    remarque: string;
  };
  larves: {
    captures: {
      l1: string; l2: string; l3: string; l4: string; l5: string; l6: string;
    };
    population: {
      diffDHa: string;
      groupDM2: string;
    };
    tlBl: {
      nbre: string;
      interdistance: string;
    };
    taille: { min: string; max: string; moyenne: string };
    superficie: {
      infestee: string;
      contaminée: string;
    };
    deplacement: string;
    reposPerchee: string;
  };
  observations: {
    degatsCultures: string;
    verdureStrH: string;
    hStrHerb: string;
    dernierePluie: string;
    intensite: string;
  };
}

export interface FicheHistorique {
  action: string;
  date: string;
  utilisateur: string;
  commentaire?: string;
}

export interface EssaimData {
  type: 'clair' | 'dense' | 'tres_dense' | null;
  directionDe: string | null;
  directionVers: string | null;
  pose: boolean | null;
  surfaceContaminee: number | null;
}

export interface Prospection {
  id: string;
  type: ProspectionType;
  date: string;
  station: string;
  prospecteurId: string;
  prospecteurNom: string;
  position?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  status: FicheStatus;
  synced: boolean;
  // Champs de la migration 0005
  verdissement?: number | null;
  hauteur_strate?: number | null;
  pullulation_nb?: number | null;
  interdistance?: number | null;
  taille_info?: {
    long?: number;
    large?: number;
    epaisseur?: number;
  } | null;
  essaim_type?: 'clair' | 'dense' | 'tres_dense' | null;
  essaim_vol_dir_de?: string | null;
  essaim_vol_dir_vers?: string | null;
  essaim_pose?: boolean | null;
  surface_contaminee?: number | null;
  // Données principales
  data: CdVData | IFVMData;
  createdAt: string;
  updatedAt?: string;
  images?: string[];
  historique?: FicheHistorique[];
  // Champs pour la validation
  envoyLe?: string;
  verifieLe?: string;
  verifiePar?: string;
  rejeteLe?: string;
  rejetePar?: string;
  motifRejet?: string;
  valideLe?: string;
  validePar?: string;
  tempsTraitement?: number;
  commentaires?: string;
}

export interface Notification {
  id: string;
  ficheId: string;
  type: 'validation' | 'rejet' | 'verification';
  message: string;
  date: string;
  lu: boolean;
  status: FicheStatus;
  motif?: string;
}