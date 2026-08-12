/**
 * Règles métier pures pour l'assistant "fiche de traitement" (8 écrans).
 * Aucune I/O ici : ces fonctions sont appelées à la fois par les écrans
 * (validation inline) et par le récapitulatif (aggregateRecapErrors), afin
 * que les deux ne puissent jamais diverger.
 */

export interface ValidationError {
  field: string;
  message: string;
}

// ==========================================
// GRANDEURS DÉRIVÉES
// ==========================================

export interface QuantiteLike {
  quantite_l?: number | null;
}

export function computeNbRotations(rotations: QuantiteLike[]): number {
  return rotations.length;
}

function sumQuantites(items: QuantiteLike[]): number {
  return items.reduce((total, item) => total + (item.quantite_l ?? 0), 0);
}

export function computeTotalPesticideAerien(rotations: QuantiteLike[]): number {
  return sumQuantites(rotations);
}

export function computeTotalPesticideTerrestre(produits: QuantiteLike[]): number {
  return sumQuantites(produits);
}

export interface SurfacesMoyensTerrestre {
  surface_atomiseur_ha?: number | null;
  surface_disque_rotatif_ha?: number | null;
  surface_ulvamast_ha?: number | null;
}

export function computeSurfaceTraitee(surfaces: SurfacesMoyensTerrestre): number {
  return (
    (surfaces.surface_atomiseur_ha ?? 0) +
    (surfaces.surface_disque_rotatif_ha ?? 0) +
    (surfaces.surface_ulvamast_ha ?? 0)
  );
}

export function computeSurfaceCumulee(
  surfaceTraiteeHa: number,
  repriseTraitement: boolean | null | undefined,
  origineSurfaceCumuleeHa: number | null | undefined
): number {
  if (!repriseTraitement) return surfaceTraiteeHa;
  return surfaceTraiteeHa + (origineSurfaceCumuleeHa ?? 0);
}

export function computeSurfaceRestante(
  surfaceInfesteeHa: number | null | undefined,
  surfaceCumuleeHa: number
): number {
  return Math.max(0, (surfaceInfesteeHa ?? 0) - surfaceCumuleeHa);
}

// ==========================================
// RÉFÉRENCES (écran A)
// ==========================================

export interface ReferencesValidationInput {
  typeTraitement: 'AERIEN' | 'TERRESTRE' | null;
  dateTraitement: string | null;
  dateValidation: string | null;
  localite: string | null;
  prospectionId: string | null;
}

export function validateReferences(input: ReferencesValidationInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.typeTraitement) {
    errors.push({ field: 'typeTraitement', message: 'Le type de traitement est obligatoire' });
  }
  if (!input.prospectionId) {
    errors.push({ field: 'prospectionId', message: 'La fiche de prospection liée est obligatoire' });
  }
  if (!input.dateTraitement) {
    errors.push({ field: 'dateTraitement', message: 'La date de traitement est obligatoire' });
  }
  if (!input.dateValidation) {
    errors.push({ field: 'dateValidation', message: 'La date de validation est obligatoire' });
  } else if (input.dateTraitement && input.dateValidation < input.dateTraitement) {
    errors.push({
      field: 'dateValidation',
      message: 'La date de validation ne peut pas être antérieure à la date de traitement',
    });
  }
  if (!input.localite || input.localite.trim() === '') {
    errors.push({ field: 'localite', message: 'La localité est obligatoire' });
  }

  return errors;
}

// ==========================================
// CONDITIONS TERRESTRE (écran C, branche terrestre)
// ==========================================

export interface TerrestreConditionsInput {
  heureDebut: string | null;
  heureFin: string | null;
  repriseTraitement: boolean | null;
  traitementOrigineId: string | null;
  surfaceRestanteHa: number;
  surfaceRestanteAbandonnee: boolean | null;
  motifSurfaceRestanteAbandonnee: string | null;
}

export function validateTerrestreConditions(input: TerrestreConditionsInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.heureDebut && input.heureFin && input.heureFin <= input.heureDebut) {
    errors.push({ field: 'heureFin', message: "L'heure de fin doit être postérieure à l'heure de début" });
  }

  if (input.repriseTraitement && !input.traitementOrigineId) {
    errors.push({ field: 'traitementOrigineId', message: 'La fiche précédente immédiate est obligatoire en cas de reprise' });
  }

  if (input.surfaceRestanteHa > 0) {
    if (input.surfaceRestanteAbandonnee === null || input.surfaceRestanteAbandonnee === undefined) {
      errors.push({
        field: 'surfaceRestanteAbandonnee',
        message: 'Vous devez indiquer si la surface restante est abandonnée',
      });
    } else if (input.surfaceRestanteAbandonnee && !input.motifSurfaceRestanteAbandonnee) {
      errors.push({
        field: 'motifSurfaceRestanteAbandonnee',
        message: "Le motif d'abandon de la surface restante est obligatoire",
      });
    }
  }

  return errors;
}

// ==========================================
// VÉGÉTATION (écran D)
// ==========================================

export function validateRecouvrement(percent: number | null | undefined): ValidationError[] {
  if (percent === null || percent === undefined) return [];
  if (percent < 0 || percent > 100) {
    return [{ field: 'recouvrementPercent', message: 'Le recouvrement doit être compris entre 0 et 100 %' }];
  }
  return [];
}

// ==========================================
// IMPACTS (écran E)
// ==========================================

export interface EmpoisonnementValidationInput {
  empoisonnement: boolean | null;
  empoisonnementType: string | null;
  empoisonnementMode: string | null;
  empoisonnementAutre: string | null;
}

export function validateEmpoisonnement(input: EmpoisonnementValidationInput): ValidationError[] {
  if (!input.empoisonnement) return [];

  const errors: ValidationError[] = [];
  if (!input.empoisonnementType) {
    errors.push({ field: 'empoisonnementType', message: 'La personne concernée est obligatoire' });
  }
  if (!input.empoisonnementMode) {
    errors.push({ field: 'empoisonnementMode', message: 'Le mode de contamination est obligatoire' });
  }
  if (input.empoisonnementMode === 'AUTRE' && !input.empoisonnementAutre) {
    errors.push({ field: 'empoisonnementAutre', message: 'Merci de préciser le mode de contamination' });
  }
  return errors;
}

// ==========================================
// SIGNATURES (écran F) — matrice depuis backend/app/domain/traitement.py
// ==========================================

export type SignatureRole = 'PILOTE' | 'MECANICIEN' | 'CHEF_DE_BASE' | 'CHEF_EQUIPE' | 'CONSULTANT_INTERNATIONAL';

export interface SignatureRequirement {
  role: SignatureRole;
  required: boolean;
  champRenseigne: boolean;
}

export interface AerienSignatureFields {
  pilote?: string | null;
  mecanicien?: string | null;
  chef_de_base_id?: string | null;
  consultant_international?: string | null;
}

export interface TerrestreSignatureFields {
  chef_equipe_id?: string | null;
  agent_encadreur_id?: string | null;
  consultant_international?: string | null;
}

/** Reflète _MATRICE_SIGNATURES du backend : agent_encadreur ne signe jamais. */
export function computeSignatureMatrix(
  typeTraitement: 'AERIEN',
  fields: AerienSignatureFields
): SignatureRequirement[];
export function computeSignatureMatrix(
  typeTraitement: 'TERRESTRE',
  fields: TerrestreSignatureFields
): SignatureRequirement[];
export function computeSignatureMatrix(
  typeTraitement: 'AERIEN' | 'TERRESTRE',
  fields: AerienSignatureFields | TerrestreSignatureFields
): SignatureRequirement[] {
  const matrice: [SignatureRole, keyof (AerienSignatureFields & TerrestreSignatureFields)][] =
    typeTraitement === 'AERIEN'
      ? [
          ['PILOTE', 'pilote'],
          ['MECANICIEN', 'mecanicien'],
          ['CHEF_DE_BASE', 'chef_de_base_id'],
          ['CONSULTANT_INTERNATIONAL', 'consultant_international'],
        ]
      : [
          ['CHEF_EQUIPE', 'chef_equipe_id'],
          ['CONSULTANT_INTERNATIONAL', 'consultant_international'],
        ];

  const result: SignatureRequirement[] = [];
  for (const [role, champ] of matrice) {
    const value = (fields as Record<string, unknown>)[champ as string];
    const champRenseigne = value !== null && value !== undefined && value !== '';
    if (champRenseigne) {
      result.push({ role, required: true, champRenseigne: true });
    }
  }
  return result;
}

// ==========================================
// AGRÉGATION (écran récapitulatif)
// ==========================================

export interface SignatureRequirementWithState extends SignatureRequirement {
  signe: boolean;
}

export interface RecapAggregateInput {
  typeTraitement: 'AERIEN' | 'TERRESTRE';
  references: ReferencesValidationInput;
  recouvrementPercent: number | null | undefined;
  empoisonnement: EmpoisonnementValidationInput;
  terrestreConditions: TerrestreConditionsInput | null;
  signatureMatrix: SignatureRequirementWithState[];
}

export function aggregateRecapErrors(input: RecapAggregateInput): ValidationError[] {
  const errors: ValidationError[] = [
    ...validateReferences(input.references),
    ...validateRecouvrement(input.recouvrementPercent),
    ...validateEmpoisonnement(input.empoisonnement),
  ];

  if (input.typeTraitement === 'TERRESTRE' && input.terrestreConditions) {
    errors.push(...validateTerrestreConditions(input.terrestreConditions));
  }

  for (const requirement of input.signatureMatrix) {
    if (requirement.required && !requirement.signe) {
      errors.push({
        field: `signature.${requirement.role}`,
        message: `La signature du rôle ${requirement.role} est obligatoire`,
      });
    }
  }

  return errors;
}
