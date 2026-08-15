import { create } from 'zustand';
import { generateId } from './id';

/**
 * État en cours de saisie de l'assistant "fiche de traitement" (8 écrans).
 * Pur état + actions, sans I/O : la persistance vers SQLite se fait via des
 * appels explicites à traitement-repository.ts depuis les écrans (même
 * séparation que prospection-capture-store.ts).
 */

export type TraitementScreen =
  | 'reference'
  | 'aerien'
  | 'terrestre'
  | 'cible'
  | 'environnement'
  | 'impact'
  | 'observations'
  | 'signatures';

export type SignatureRole =
  | 'PILOTE'
  | 'MECANICIEN'
  | 'CHEF_DE_BASE'
  | 'CHEF_EQUIPE'
  | 'CONSULTANT_INTERNATIONAL';

export interface ReferenceDraft {
  numeroFiche?: string | null;
  dateTraitement?: string | null;
  localite?: string | null;
  region?: string | null;
  district?: string | null;
  commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  modeTraitement?: 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null;
}

export interface RotationDraft {
  localId: string;
  numero_cuve?: string | null;
  produit_id?: string | null;
  quantite_l?: number | null;
  temperature_debut_c?: number | null;
  temperature_fin_c?: number | null;
  vent_debut_ms?: number | null;
  vent_fin_ms?: number | null;
}

export interface RotationInput {
  numero_cuve?: string | null;
  produit_id?: string | null;
  quantite_l?: number | null;
  temperature_debut_c?: number | null;
  temperature_fin_c?: number | null;
  vent_debut_ms?: number | null;
  vent_fin_ms?: number | null;
}

export interface AerienDraft {
  pilote?: string | null;
  mecanicien?: string | null;
  chefDeBaseId?: string | null;
  consultantInternational?: string | null;
  rotations: RotationDraft[];
}

export interface ProduitDraft {
  localId: string;
  produit_id?: string | null;
  quantite_l?: number | null;
}

export interface ProduitInput {
  produit_id?: string | null;
  quantite_l?: number | null;
}

export interface TerrestreDraft {
  chefEquipeId?: string | null;
  agentEncadreurId?: string | null;
  consultantInternational?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
  vitesse_vent_ms?: number | null;
  direction_vent?: string | null;
  temperature_c?: number | null;
  repriseTraitement?: boolean;
  traitementOrigineId?: string | null;
  surface_atomiseur_ha?: number | null;
  surface_disque_rotatif_ha?: number | null;
  surface_ulvamast_ha?: number | null;
  surfaceRestanteAbandonnee?: boolean | null;
  motifSurfaceRestanteAbandonnee?: string | null;
  essence_litres?: number | null;
  nb_piles?: number | null;
  produits: ProduitDraft[];
}

export interface EnvironnementDraft {
  zonesExposees?: Record<string, boolean>;
  hauteur_strate_herbeuse_m?: number | null;
  hauteur_strate_arboree_m?: number | null;
  recouvrement_percent?: number | null;
}

export interface ImpactDraft {
  empoisonnement?: boolean | null;
  empoisonnementType?: 'AGENT' | 'POPULATION' | null;
  empoisonnementMode?: 'INGESTION' | 'INHALATION' | 'CONTACT' | 'AUTRE' | null;
  empoisonnementAutre?: string | null;
  evaluationRisque?: {
    ressources_eau?: 'FAIBLE' | 'MOYEN' | 'ELEVE';
    sol?: 'FAIBLE' | 'MOYEN' | 'ELEVE';
    faune_non_cible?: 'FAIBLE' | 'MOYEN' | 'ELEVE';
    abeilles?: 'FAIBLE' | 'MOYEN' | 'ELEVE';
  };
  comportementAnormal?: boolean | null;
  comportementNonCibles?: string[];
  mortalite?: boolean | null;
  mortaliteFamilles?: string[];
}

interface TraitementCaptureState {
  screen: TraitementScreen;
  isValidationView: boolean;
  typeTraitement: 'AERIEN' | 'TERRESTRE' | null;
  ref: ReferenceDraft;
  aerien: AerienDraft;
  terrestre: TerrestreDraft;
  env: EnvironnementDraft;
  imp: ImpactDraft;
  observations: string | null;
  signed: Partial<Record<SignatureRole, string>>;
  stamps: Partial<Record<SignatureRole, string>>;

  setScreen: (screen: TraitementScreen) => void;
  setValidationView: (isValidationView: boolean) => void;
  setTypeTraitement: (typeTraitement: 'AERIEN' | 'TERRESTRE' | null) => void;
  updateRef: (patch: Partial<ReferenceDraft>) => void;
  updateAerien: (patch: Partial<Omit<AerienDraft, 'rotations'>>) => void;
  addRotation: (input: RotationInput) => void;
  updateRotation: (localId: string, patch: RotationInput) => void;
  removeRotation: (localId: string) => void;
  updateTerrestre: (patch: Partial<Omit<TerrestreDraft, 'produits'>>) => void;
  addProduit: (input: ProduitInput) => void;
  removeProduit: (localId: string) => void;
  updateEnv: (patch: Partial<EnvironnementDraft>) => void;
  updateImp: (patch: Partial<ImpactDraft>) => void;
  setObservations: (observations: string | null) => void;
  setSigned: (role: SignatureRole, signataireNom: string) => void;
  setStamp: (role: SignatureRole, horodatage: string) => void;
  reset: () => void;
}

function initialState(): Pick<
  TraitementCaptureState,
  | 'screen'
  | 'isValidationView'
  | 'typeTraitement'
  | 'ref'
  | 'aerien'
  | 'terrestre'
  | 'env'
  | 'imp'
  | 'observations'
  | 'signed'
  | 'stamps'
> {
  return {
    screen: 'reference',
    isValidationView: false,
    typeTraitement: null,
    ref: {},
    aerien: { rotations: [] },
    terrestre: { produits: [] },
    env: {},
    imp: {},
    observations: null,
    signed: {},
    stamps: {},
  };
}

export const useTraitementCaptureStore = create<TraitementCaptureState>((set) => ({
  ...initialState(),

  setScreen: (screen) => set({ screen }),
  setValidationView: (isValidationView) => set({ isValidationView }),
  setTypeTraitement: (typeTraitement) => set({ typeTraitement }),

  updateRef: (patch) => set((state) => ({ ref: { ...state.ref, ...patch } })),

  updateAerien: (patch) => set((state) => ({ aerien: { ...state.aerien, ...patch } })),

  addRotation: (input) => {
    const rotation: RotationDraft = { localId: generateId(), ...input };
    set((state) => ({ aerien: { ...state.aerien, rotations: [...state.aerien.rotations, rotation] } }));
  },

  updateRotation: (localId, patch) => {
    set((state) => ({
      aerien: {
        ...state.aerien,
        rotations: state.aerien.rotations.map((rotation) =>
          rotation.localId === localId ? { ...rotation, ...patch } : rotation
        ),
      },
    }));
  },

  removeRotation: (localId) => {
    set((state) => ({
      aerien: {
        ...state.aerien,
        rotations: state.aerien.rotations.filter((rotation) => rotation.localId !== localId),
      },
    }));
  },

  updateTerrestre: (patch) => set((state) => ({ terrestre: { ...state.terrestre, ...patch } })),

  addProduit: (input) => {
    const produit: ProduitDraft = { localId: generateId(), ...input };
    set((state) => ({ terrestre: { ...state.terrestre, produits: [...state.terrestre.produits, produit] } }));
  },

  removeProduit: (localId) => {
    set((state) => ({
      terrestre: {
        ...state.terrestre,
        produits: state.terrestre.produits.filter((produit) => produit.localId !== localId),
      },
    }));
  },

  updateEnv: (patch) => set((state) => ({ env: { ...state.env, ...patch } })),
  updateImp: (patch) => set((state) => ({ imp: { ...state.imp, ...patch } })),
  setObservations: (observations) => set({ observations }),

  setSigned: (role, signataireNom) =>
    set((state) => ({ signed: { ...state.signed, [role]: signataireNom } })),
  setStamp: (role, horodatage) =>
    set((state) => ({ stamps: { ...state.stamps, [role]: horodatage } })),

  reset: () => set(initialState()),
}));
