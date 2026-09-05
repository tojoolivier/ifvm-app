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

export function computeNbRotations(rotations: unknown[]): number {
  return rotations.length;
}

function sumQuantites(items: QuantiteLike[]): number {
  return items.reduce((total, item) => total + (item.quantite_l ?? 0), 0);
}

export function computeTotalPesticideTerrestre(produits: QuantiteLike[]): number {
  return sumQuantites(produits);
}

/**
 * Rotations aériennes (migration 0046) : quantite + unite (L/kg) remplace
 * quantite_l — deux rotations d'unités différentes ne s'additionnent jamais dans le
 * même total (une poudre en kg et un ULV en litres n'ont pas la même grandeur), d'où
 * deux totaux séparés plutôt qu'un seul comme `computeTotalPesticideTerrestre`.
 */
export interface QuantiteUniteLike {
  quantite?: number | null;
  unite?: 'L' | 'KG' | null;
}

export function computeTotalPesticideAerienParUnite(
  rotations: QuantiteUniteLike[]
): { l: number; kg: number } {
  return rotations.reduce(
    (totaux, r) => {
      const quantite = r.quantite ?? 0;
      if (r.unite === 'KG') totaux.kg += quantite;
      // Défaut L (unite non renseignée) — cohérent avec le défaut serveur.
      else totaux.l += quantite;
      return totaux;
    },
    { l: 0, kg: 0 }
  );
}

/**
 * traitement_aerien.surface_traitee_ha n'est plus une saisie directe (migration 0046) :
 * dérivée de la somme des `surface_ha` de chaque rotation, même principe que
 * computeTotalPesticideAerienParUnite ci-dessus.
 */
export interface SurfaceHaLike {
  surface_ha?: number | null;
}

export function computeSurfaceTraiteeAerien(rotations: SurfaceHaLike[]): number {
  return rotations.reduce((total, r) => total + (r.surface_ha ?? 0), 0);
}

/**
 * Durée entre deux `HH:MM`, jamais saisie par l'agent — même algorithme que
 * `calculerDureeMinutes` dans prospection-extensive.ts (franchissement de minuit
 * compris). Dupliqué plutôt que mutualisé : traitement et prospection n'ont pas de
 * dépendance commune adaptée pour l'instant (même choix que `parseDecimalInput` entre
 * veg.tsx et moyens.tsx).
 */
function calculerDureeMinutes(debutHeure: string, finHeure: string): number {
  const [heureDebut, minuteDebut] = debutHeure.split(':').map(Number);
  const [heureFin, minuteFin] = finHeure.split(':').map(Number);
  const debut = heureDebut * 60 + minuteDebut;
  let fin = heureFin * 60 + minuteFin;
  if (fin < debut) fin += 24 * 60;
  return fin - debut;
}

/** `123` minutes → `"02:03"`. */
export function formatDureeRotation(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface RotationDureesInput {
  heureDebut: string | null;
  heureFin: string | null;
  heureOuvertureVanne: string | null;
  heureFermetureVanne: string | null;
}

export interface RotationDurees {
  /** heure_fermeture_vanne − heure_ouverture_vanne. */
  applicationMinutes: number | null;
  /** heure_fin − heure_debut (borne la rotation entière). */
  totaleMinutes: number | null;
  /** totale − application, jamais négative (plancher à 0 en affichage). */
  miseEnPlaceMinutes: number | null;
}

/** Les 3 durées affichées par rotation (écran Pesticides & rotations) — jamais
 * saisies, toujours calculées depuis les 4 heures de la rotation. `null` tant que
 * les heures nécessaires ne sont pas toutes renseignées. */
export function computeDureesRotation(input: RotationDureesInput): RotationDurees {
  const totaleMinutes =
    input.heureDebut && input.heureFin
      ? calculerDureeMinutes(input.heureDebut, input.heureFin)
      : null;
  const applicationMinutes =
    input.heureOuvertureVanne && input.heureFermetureVanne
      ? calculerDureeMinutes(input.heureOuvertureVanne, input.heureFermetureVanne)
      : null;
  const miseEnPlaceMinutes =
    totaleMinutes != null && applicationMinutes != null
      ? Math.max(0, totaleMinutes - applicationMinutes)
      : null;
  return { applicationMinutes, totaleMinutes, miseEnPlaceMinutes };
}

/**
 * Nom commercial (#produit-nom-commercial) : dérivé du nom complet du pesticide
 * sélectionné (référentiel `pesticide`, cf. `listPesticides()`) — texte avant le
 * premier chiffre, espaces débord retirés. Ex. "Fyfanon 440 ULV" -> "Fyfanon".
 * Si le nom ne contient aucun chiffre (ex. "GREEN MUSCLE" dans le référentiel
 * seedé), le nom complet est utilisé tel quel plutôt que de renvoyer une chaîne
 * vide. Valeur figée au moment de la sélection, jamais recalculée à la lecture
 * (cf. persistance de `nom_commercial` sur la rotation/le produit utilisé).
 */
export function deriveNomCommercial(nomComplet: string): string {
  const indexPremierChiffre = nomComplet.search(/\d/);
  const nomAvantChiffre = indexPremierChiffre === -1 ? nomComplet : nomComplet.slice(0, indexPremierChiffre);
  return nomAvantChiffre.trim();
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

/**
 * « Reste en stock » = reçu − consommé, plancher à 0 (même convention que
 * computeSurfaceRestante) — miroir de `_stock_pesticide_restant` côté backend.
 * `null` tant que « reçu » n'est pas renseigné : un stock ne se déduit pas
 * d'une consommation seule.
 */
export function computePesticideStockRestant(
  pesticideRecuL: number | null | undefined,
  pesticideConsommeL: number
): number | null {
  if (pesticideRecuL == null) return null;
  return Math.max(0, pesticideRecuL - pesticideConsommeL);
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
  } else if (input.dateValidation && input.dateTraitement < input.dateValidation) {
    errors.push({
      field: 'dateTraitement',
      message: 'La date de traitement ne peut pas être antérieure à la date de validation',
    });
  }
  if (!input.dateValidation) {
    errors.push({ field: 'dateValidation', message: 'La date de validation est obligatoire' });
  }
  if (!input.localite || input.localite.trim() === '') {
    errors.push({ field: 'localite', message: 'La localité est obligatoire' });
  }

  return errors;
}

// ==========================================
// ÉQUIPE (écran C, branche aérienne) — #equipe-slide-aerien
// ==========================================

export interface AerienEquipeValidationInput {
  chefDeBaseId: string | null | undefined;
  piloteId: string | null | undefined;
  mecanicienId: string | null | undefined;
  consultantId?: string | null | undefined;
  immatriculeAeronef: string | null | undefined;
  lieuBasePrincipaleId: string | null | undefined;
}

const MESSAGE_ROLE_DEJA_AFFECTE =
  'Cette personne est déjà affectée à un autre rôle. Veuillez sélectionner une personne différente.';

/**
 * Chef de base, pilote et mécanicien sont obligatoires et deux-à-deux distincts
 * (même personne dans deux rôles obligatoires = fiche invalide) — le consultant
 * reste facultatif et exempté de cette règle. Reflète côté mobile la contrainte
 * backend `ck_traitement_aerien_roles_distincts` (migration 0047).
 */
export function validateAerienEquipe(input: AerienEquipeValidationInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.chefDeBaseId) errors.push({ field: 'chefDeBaseId', message: 'Le chef de base est obligatoire' });
  if (!input.piloteId) errors.push({ field: 'piloteId', message: 'Le pilote est obligatoire' });
  if (!input.mecanicienId) errors.push({ field: 'mecanicienId', message: 'Le mécanicien est obligatoire' });
  if (!input.immatriculeAeronef || input.immatriculeAeronef.trim() === '') {
    errors.push({ field: 'immatriculeAeronef', message: "L'immatriculation de l'aéronef est obligatoire" });
  }
  if (!input.lieuBasePrincipaleId) {
    errors.push({ field: 'lieuBasePrincipaleId', message: 'La base principale est obligatoire' });
  }

  const rolesObligatoires: { field: string; id: string | null | undefined }[] = [
    { field: 'chefDeBaseId', id: input.chefDeBaseId },
    { field: 'piloteId', id: input.piloteId },
    { field: 'mecanicienId', id: input.mecanicienId },
  ];
  for (let i = 0; i < rolesObligatoires.length; i++) {
    for (let j = i + 1; j < rolesObligatoires.length; j++) {
      if (rolesObligatoires[i].id && rolesObligatoires[i].id === rolesObligatoires[j].id) {
        errors.push({ field: rolesObligatoires[i].field, message: MESSAGE_ROLE_DEJA_AFFECTE });
        errors.push({ field: rolesObligatoires[j].field, message: MESSAGE_ROLE_DEJA_AFFECTE });
      }
    }
  }

  return errors;
}

// ==========================================
// ROTATIONS (écran C, branche aérienne)
// ==========================================

export interface RotationHeuresInput {
  heureDebut: string | null;
  heureFin: string | null;
  heureOuvertureVanne?: string | null;
  heureFermetureVanne?: string | null;
}

/** Même règle que TerrestreConditionsInput.heureDebut/heureFin (backend :
 * ck_traitement_rotation_heures) pour heure_debut/heure_fin, et
 * ck_traitement_rotation_heures_vanne pour heure_ouverture_vanne/heure_fermeture_vanne
 * (migration 0046) — appliquées à chaque rotation aérienne, numérotées à partir de 1
 * dans le message, dans l'ordre de saisie. */
export function validateRotationsHeures(rotations: RotationHeuresInput[]): ValidationError[] {
  const errors: ValidationError[] = [];
  rotations.forEach((r, index) => {
    if (r.heureDebut && r.heureFin && r.heureFin <= r.heureDebut) {
      errors.push({
        field: 'rotations',
        message: `Rotation ${index + 1} : l'heure de fin doit être postérieure à l'heure de début`,
      });
    }
    if (
      r.heureOuvertureVanne &&
      r.heureFermetureVanne &&
      r.heureFermetureVanne <= r.heureOuvertureVanne
    ) {
      errors.push({
        field: 'rotations',
        message: `Rotation ${index + 1} : l'heure de fermeture de vanne doit être postérieure à l'heure d'ouverture`,
      });
    }
  });
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
  pilote_id?: string | null;
  mecanicien_id?: string | null;
  chef_de_base_id?: string | null;
  consultant_id?: string | null;
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
          ['PILOTE', 'pilote_id'],
          ['MECANICIEN', 'mecanicien_id'],
          ['CHEF_DE_BASE', 'chef_de_base_id'],
          ['CONSULTANT_INTERNATIONAL', 'consultant_id'],
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
  aerienEquipe: AerienEquipeValidationInput | null;
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

  if (input.typeTraitement === 'AERIEN' && input.aerienEquipe) {
    errors.push(...validateAerienEquipe(input.aerienEquipe));
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
