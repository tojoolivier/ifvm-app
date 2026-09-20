/**
 * Règles métier pures pour l'assistant "fiche de traitement" (8 écrans).
 * Aucune I/O ici : ces fonctions sont appelées à la fois par les écrans
 * (validation inline) et par le récapitulatif (aggregateRecapErrors), afin
 * que les deux ne puissent jamais diverger.
 */

import { estDansMadagascar } from './madagascar-boundary';

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
  // 'kg' en minuscule : c'est la valeur exacte du contrat backend
  // (components['schemas']['UniteQuantite'], cf. api-schema.generated.ts) et de la
  // contrainte CHECK ck_traitement_rotation_unite ("unite IN ('L','kg')") — un 'KG'
  // majuscule est rejeté par le serveur en 422 (cf. migration 0047).
  unite?: 'L' | 'kg' | null;
}

export function computeTotalPesticideAerienParUnite(
  rotations: QuantiteUniteLike[]
): { l: number; kg: number } {
  return rotations.reduce(
    (totaux, r) => {
      const quantite = r.quantite ?? 0;
      if (r.unite === 'kg') totaux.kg += quantite;
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
  surface_atomiseur_autoporte_ha?: number | null;
}

export function computeSurfaceTraitee(surfaces: SurfacesMoyensTerrestre): number {
  return (
    (surfaces.surface_atomiseur_ha ?? 0) +
    (surfaces.surface_disque_rotatif_ha ?? 0) +
    (surfaces.surface_atomiseur_autoporte_ha ?? 0)
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
 * Suggestion de « Pesticides consommés » (#pesticide-consomme-suggere-mode-traitement),
 * dérivée de « Cumulée (ha) » selon le mode de traitement et l'unité choisie
 * (#produits-unite-l-kg) — un simple pré-remplissage, jamais verrouillé : le
 * champ reste modifiable, cette fonction ne sert qu'à calculer la valeur
 * affichée tant que l'agent n'a rien saisi lui-même (cf. TerrestreForm.tsx).
 *
 * Règles confirmées avec l'utilisateur (aucune autre combinaison n'a de
 * formule pour l'instant — Irrégulier et Barrière+kg restent entièrement
 * manuels, `null` ci-dessous) :
 * - Barrière + L : Cumulée / 5.
 * - Couverture totale + L : Cumulée.
 * - Couverture totale + kg : Cumulée / 20.
 */
export function computePesticideConsommeSuggere(
  modeTraitement: 'TOTAL' | 'BARRIERE' | 'IRREGULIER' | null | undefined,
  unite: 'L' | 'kg' | null | undefined,
  surfaceCumuleeHa: number
): number | null {
  const uniteEffective = unite ?? 'L';
  let valeur: number | null = null;
  if (modeTraitement === 'BARRIERE' && uniteEffective === 'L') {
    valeur = surfaceCumuleeHa / 5;
  } else if (modeTraitement === 'TOTAL') {
    valeur = uniteEffective === 'kg' ? surfaceCumuleeHa / 20 : surfaceCumuleeHa;
  }
  return valeur === null ? null : Math.round(valeur * 100) / 100;
}

/**
 * « Reste en stock » = reçu − consommé, plancher à 0 (même convention que
 * computeSurfaceRestante) — miroir de `_stock_pesticide_restant` côté backend.
 * `null` tant que « reçu » n'est pas renseigné : un stock ne se déduit pas
 * d'une consommation seule.
 */
/**
 * « Stock final » = stock initial + reçu − consommé, plancher à 0 — même
 * formule que `_stock_pesticide_restant` (backend/app/domain/traitement.py).
 * `stockInitialL` est optionnel : l'Aérien (`rotations.tsx`), qui n'a pas cette
 * notion, appelle cette fonction avec 2 arguments, comme avant l'ajout du
 * stock initial (Terrestre uniquement, migration backend 0075).
 */
export function computePesticideStockRestant(
  pesticideRecuL: number | null | undefined,
  pesticideConsommeL: number,
  stockInitialL?: number | null
): number | null {
  if (pesticideRecuL == null && stockInitialL == null) return null;
  return Math.max(0, (stockInitialL ?? 0) + (pesticideRecuL ?? 0) - pesticideConsommeL);
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
  latitude?: number | null;
  longitude?: number | null;
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
  // #position-hors-madagascar : même garde-fou que la Prospection (Intensif/
  // Extensif/Validation) — une position hors de Madagascar, y compris en
  // pleine mer, n'est jamais acceptée. Ne s'applique que si un point a déjà
  // été capturé (facultatif tant que le GPS n'a pas encore renvoyé de fix).
  if (input.latitude != null && input.longitude != null && !estDansMadagascar(input.latitude, input.longitude)) {
    errors.push({
      field: 'latitude',
      message: 'Vous semblez être hors de la zone de prospection (hors de Madagascar). Vérifiez votre position GPS et réessayez.',
    });
  }

  return errors;
}

// ==========================================
// ÉQUIPE (écran C, branche aérienne) — #equipe-slide-aerien
// ==========================================

export interface AerienEquipeValidationInput {
  chefDeBaseId: string | null | undefined;
  // Nom complet résolu du chef de base (via le référentiel utilisateur) — le chef
  // reste un id (FK), mais pilote/mécanicien sont redevenus du texte libre
  // (migration backend 0048) : la distinction ne peut plus se faire par id, elle
  // compare des noms (cf. `normaliserNom`).
  chefDeBaseNom: string | null | undefined;
  pilote: string | null | undefined;
  mecanicien: string | null | undefined;
  consultantInternational?: string | null | undefined;
  immatriculeAeronef: string | null | undefined;
  basePrincipale: string | null | undefined;
}

const MESSAGE_ROLE_DEJA_AFFECTE =
  'Cette personne est déjà affectée à un autre rôle. Veuillez sélectionner une personne différente.';

/** Espaces superflus et casse ignorés — le texte libre ne garantit pas l'identité
 * comme un id, mais « Jean RAKOTO » et « jean   rakoto » doivent être reconnus
 * comme la même personne. Miroir de `_normaliser_nom` côté backend. */
function normaliserNom(valeur: string): string {
  return valeur.trim().split(/\s+/).join(' ').toLowerCase();
}

/**
 * Chef de base, pilote et mécanicien sont obligatoires et deux-à-deux distincts
 * (même personne dans deux rôles obligatoires = fiche invalide) — le consultant
 * reste facultatif et exempté de cette règle. Reflète côté mobile la validation
 * applicative backend `valider_roles_aerien_distincts` (migration 0048 — la
 * contrainte SQL `ck_traitement_aerien_roles_distincts` n'existe plus, pilote/
 * mécanicien n'étant plus des FK comparables par id).
 */
export function validateAerienEquipe(input: AerienEquipeValidationInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.chefDeBaseId) errors.push({ field: 'chefDeBaseId', message: 'Le chef de base est obligatoire' });
  if (!input.pilote || input.pilote.trim() === '') {
    errors.push({ field: 'pilote', message: 'Le pilote est obligatoire' });
  }
  if (!input.mecanicien || input.mecanicien.trim() === '') {
    errors.push({ field: 'mecanicien', message: 'Le mécanicien est obligatoire' });
  }
  if (!input.immatriculeAeronef || input.immatriculeAeronef.trim() === '') {
    errors.push({ field: 'immatriculeAeronef', message: "L'immatriculation de l'aéronef est obligatoire" });
  }
  if (!input.basePrincipale || input.basePrincipale.trim() === '') {
    errors.push({ field: 'basePrincipale', message: 'La base principale est obligatoire' });
  }

  const rolesObligatoires: { field: string; nom: string | null | undefined }[] = [
    { field: 'chefDeBaseId', nom: input.chefDeBaseNom },
    { field: 'pilote', nom: input.pilote },
    { field: 'mecanicien', nom: input.mecanicien },
  ];
  for (let i = 0; i < rolesObligatoires.length; i++) {
    for (let j = i + 1; j < rolesObligatoires.length; j++) {
      const nomA = rolesObligatoires[i].nom;
      const nomB = rolesObligatoires[j].nom;
      if (nomA && nomB && normaliserNom(nomA) === normaliserNom(nomB)) {
        errors.push({ field: rolesObligatoires[i].field, message: MESSAGE_ROLE_DEJA_AFFECTE });
        errors.push({ field: rolesObligatoires[j].field, message: MESSAGE_ROLE_DEJA_AFFECTE });
      }
    }
  }

  return errors;
}

/**
 * #traitement-aerien-brouillon-incomplet-bloque-synchro : une fiche Aérien est
 * créée en base (`statut_sync = 'local'`) dès l'écran de sélection, bien avant
 * que l'écran Équipe & Références (ci-dessus) n'ait renseigné quoi que ce
 * soit — pilote/mécanicien/chef de base/immatriculation/base principale valent
 * alors tous `null`. Si une synchronisation (automatique ou manuelle) se
 * déclenche avant que l'agent n'ait complété cet écran (brouillon abandonné en
 * cours de route, appel entrant, etc.), le serveur renvoie ses messages Pydantic
 * bruts et par défaut, en anglais ("String should have at least 1 character"...)
 * — la fiche reste ensuite marquée en échec indéfiniment. Sert de garde-fou
 * avant tout envoi (file d'attente ET bouton « Réessayer » ciblé) : une fiche
 * qui ne satisfait pas encore ces champs, tous obligatoires côté backend
 * (`TraitementAerienCreate`), n'est simplement jamais transmise.
 */
export interface RotationSyncPreconditionInput {
  produitId: string | null | undefined;
  quantite: number | null | undefined;
}

export interface AerienSyncPreconditionInput {
  pilote: string | null | undefined;
  mecanicien: string | null | undefined;
  chefDeBaseId: string | null | undefined;
  immatriculeAeronef: string | null | undefined;
  basePrincipale: string | null | undefined;
  rotations: RotationSyncPreconditionInput[];
}

/**
 * `RotationCreate` côté backend exige `produit_id` (UUID) et `quantite` (> 0)
 * sans défaut possible — contrairement à `estAerienPretPourSynchro`, une
 * rotation ajoutée (bouton « + ») mais jamais remplie (produit non choisi,
 * quantité vide) n'était pas couverte par ce garde-fou : `pushRotationsEtProduits`
 * (traitement-sync.ts) coalesce alors `produit_id` en `''` et `quantite` en `0`
 * pour ne pas planter l'appel, et c'est le serveur qui renvoie ses messages
 * Pydantic bruts ("produit_id: Input should be a valid UUID... found 0";
 * "quantite: Input should be greater than 0"), fiche bloquée en échec
 * indéfiniment (#traitement-aerien-rotation-incomplete-bloque-synchro).
 *
 * Une fiche sans aucune rotation n'est PAS bloquée ici : `pushRotationsEtProduits`
 * ne boucle sur rien dans ce cas, donc rien n'est envoyé au serveur — seule une
 * rotation existante mais incomplète pose problème.
 */
function rotationsAerienPretesPourSynchro(rotations: RotationSyncPreconditionInput[]): boolean {
  return rotations.every((r) => !!r.produitId && r.quantite != null && r.quantite > 0);
}

export function estAerienPretPourSynchro(input: AerienSyncPreconditionInput): boolean {
  return Boolean(
    input.pilote?.trim() &&
      input.mecanicien?.trim() &&
      input.chefDeBaseId &&
      input.immatriculeAeronef?.trim() &&
      input.basePrincipale?.trim() &&
      rotationsAerienPretesPourSynchro(input.rotations)
  );
}

/**
 * Miroir de `estAerienPretPourSynchro` pour la branche Terrestre — mêmes champs
 * obligatoires sans valeur par défaut côté backend (`TraitementTerrestreCreate`) :
 * chef d'équipe, heures de début/fin, vitesse du vent, température. Une fiche
 * Terrestre est créée en base dès l'écran de sélection, avant l'écran
 * Conditions qui les renseigne (traitement.tsx).
 */
export interface ProduitUtiliseSyncPreconditionInput {
  produitId: string | null | undefined;
  quantiteL: number | null | undefined;
}

export interface TerrestreSyncPreconditionInput {
  chefEquipeId: string | null | undefined;
  heureDebut: string | null | undefined;
  heureFin: string | null | undefined;
  vitesseVentMs: number | null | undefined;
  temperatureC: number | null | undefined;
  produits: ProduitUtiliseSyncPreconditionInput[];
}

/** Même raison que `rotationsAerienPretesPourSynchro` : `ProduitUtiliseCreate`
 * exige aussi `produit_id` (UUID) et `quantite_l` (> 0) sans défaut côté
 * backend. Une fiche sans aucun produit n'est pas bloquée, même règle. */
function produitsTerrestrePretsPourSynchro(produits: ProduitUtiliseSyncPreconditionInput[]): boolean {
  return produits.every((p) => !!p.produitId && p.quantiteL != null && p.quantiteL > 0);
}

export function estTerrestrePretPourSynchro(input: TerrestreSyncPreconditionInput): boolean {
  return Boolean(
    input.chefEquipeId &&
      input.heureDebut &&
      input.heureFin &&
      input.vitesseVentMs != null &&
      input.temperatureC != null &&
      produitsTerrestrePretsPourSynchro(input.produits)
  );
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
  surfaceRestanteHa: number;
  surfaceRestanteAbandonnee: boolean | null;
  motifSurfaceRestanteAbandonnee: string | null;
}

export function validateTerrestreConditions(input: TerrestreConditionsInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.heureDebut && input.heureFin && input.heureFin <= input.heureDebut) {
    errors.push({ field: 'heureFin', message: "L'heure de fin doit être postérieure à l'heure de début" });
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
  agent_encadreur?: string | null;
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
