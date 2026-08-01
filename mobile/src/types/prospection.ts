export type ProspectionType = 'cdv' | 'ifvm';
export type FicheStatus = 'brouillon' | 'envoye' | 'verifie' | 'rejete' | 'valide';

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
    region: string;
    district: string;
    commune: string;
    za: string;
  };
  images: {
    captures: {
      a1: string; a2: string; a3: string; a4: string; a5: string;
      a1b: string; a2b: string; a5b: string;
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
      l1: string; l2: string; l3: string; l4: string; l5: string; l6: string; l7: string;
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
