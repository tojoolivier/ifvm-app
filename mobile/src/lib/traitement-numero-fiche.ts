import { TypeTraitement } from './traitement-repository';

/** Préfixe commun à toute fiche de traitement. */
export const PREFIXE_NUMERO_FICHE = 'TRT';

const CODE_TYPE: Record<TypeTraitement, string> = {
  AERIEN: 'AER',
  TERRESTRE: 'TERR',
};

/** Code du type dans le numéro : « TERR » (terrestre) ou « AER » (aérien). */
export function codeTypeNumeroFiche(typeTraitement: TypeTraitement): string {
  return CODE_TYPE[typeTraitement];
}

/**
 * Numéro de fiche de traitement (#numero-fiche-traitement-trt) :
 * « TRT-[TERR|AER]-[Date ISO]-[Numéro sur 3 chiffres] », ex. `TRT-TERR-2026-09-26-001`.
 *
 * Le numéro d'ordre (001, 002, …) ne dépend PAS de la date : il continue, par type de
 * traitement, d'une fiche à l'autre (cf. `genererNumeroFicheDisponible`,
 * traitement-repository.ts). Il a trois chiffres au minimum, et grandit naturellement
 * au-delà de 999.
 *
 * Reproduit `generer_numero_fiche()` (backend/app/domain/traitement.py) : le mobile doit
 * pouvoir l'afficher et le persister hors ligne, avant toute synchronisation.
 *
 * `suffixe` (2, 3, …) n'est ajouté qu'en cas de collision (même numéro déjà porté par une
 * autre fiche) — `TRT-TERR-2026-09-26-001-2`.
 */
export function composerNumeroFiche(
  typeTraitement: TypeTraitement,
  dateTraitementIso: string,
  sequence: number,
  suffixe?: number | null
): string {
  const ordre = String(sequence).padStart(3, '0');
  const base = `${PREFIXE_NUMERO_FICHE}-${CODE_TYPE[typeTraitement]}-${dateTraitementIso.slice(0, 10)}-${ordre}`;
  return suffixe ? `${base}-${suffixe}` : base;
}

/**
 * Numéro d'ordre porté par un numéro de fiche au nouveau format, pour ce type — `null` pour
 * tout autre numéro (ancien format « Prénom-Type-Date », ou autre type). Un numéro suffixé
 * par une collision (`…-001-2`) ne compte pas : seul le numéro de base fait avancer le compteur.
 */
export function extraireSequenceNumeroFiche(typeTraitement: TypeTraitement, numeroFiche: string): number | null {
  const motif = new RegExp(`^${PREFIXE_NUMERO_FICHE}-${CODE_TYPE[typeTraitement]}-\\d{4}-\\d{2}-\\d{2}-(\\d{3,})$`);
  const correspondance = motif.exec(numeroFiche);
  return correspondance ? Number(correspondance[1]) : null;
}
