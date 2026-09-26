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
 * Sigle utilisable dans un numéro de fiche : lettres et chiffres seulement (un tiret ou un espace
 * brouillerait la lecture du numéro), casse conservée. Chaîne vide si absent — le segment est alors
 * omis. Miroir de `normaliser_sigle` (backend/app/domain/traitement.py).
 */
export function normaliserSigle(sigle: string | null | undefined): string {
  return (sigle ?? '').replace(/[^A-Za-z0-9]/g, '');
}

export interface OptionsNumeroFiche {
  /** Sigle du chef concerné par la fiche, inséré entre la date et le numéro d'ordre. */
  sigle?: string | null;
  /** 2, 3, … : seulement en cas de collision d'un même numéro. */
  suffixe?: number | null;
}

/**
 * Numéro de fiche de traitement (#numero-fiche-traitement-trt) :
 * « TRT-[TERR|AER]-[Date ISO]-[Sigle du chef]-[Numéro d'ordre sur 3 chiffres] »,
 * ex. `TRT-TERR-2026-09-26-ABC-001`. Le sigle est omis quand le chef n'en a pas :
 * `TRT-TERR-2026-09-26-001`.
 *
 * Le numéro d'ordre (001, 002, …) ne dépend PAS de la date : il continue, par type de
 * traitement, d'une fiche à l'autre (cf. `genererNumeroFicheDisponible`,
 * traitement-repository.ts). Il a trois chiffres au minimum, et grandit naturellement
 * au-delà de 999.
 *
 * Reproduit `generer_numero_fiche()` (backend/app/domain/traitement.py) : le mobile doit
 * pouvoir l'afficher et le persister hors ligne, avant toute synchronisation.
 */
export function composerNumeroFiche(
  typeTraitement: TypeTraitement,
  dateTraitementIso: string,
  sequence: number,
  options: OptionsNumeroFiche = {}
): string {
  const ordre = String(sequence).padStart(3, '0');
  const sigle = normaliserSigle(options.sigle);
  const segmentSigle = sigle ? `-${sigle}` : '';
  const base = `${PREFIXE_NUMERO_FICHE}-${CODE_TYPE[typeTraitement]}-${dateTraitementIso.slice(0, 10)}${segmentSigle}-${ordre}`;
  return options.suffixe ? `${base}-${options.suffixe}` : base;
}

function motifNumeroBase(typeTraitement: TypeTraitement): RegExp {
  // Groupes : 1 = date, 2 = sigle (facultatif), 3 = numéro d'ordre, 4 = suffixe de collision (facultatif).
  return new RegExp(
    `^${PREFIXE_NUMERO_FICHE}-${CODE_TYPE[typeTraitement]}-(\\d{4}-\\d{2}-\\d{2})(?:-([A-Za-z0-9]+))?-(\\d{3,})(?:-(\\d+))?$`
  );
}

/**
 * Numéro d'ordre porté par un numéro de fiche de base au nouveau format, pour ce type — `null`
 * pour tout autre numéro (ancien format « Prénom-Type-Date », autre type). Un numéro suffixé par
 * une collision (`…-001-2`) ne compte pas : seul le numéro de base fait avancer le compteur.
 * Le sigle du chef, s'il est présent, est ignoré.
 */
export function extraireSequenceNumeroFiche(typeTraitement: TypeTraitement, numeroFiche: string): number | null {
  const correspondance = motifNumeroBase(typeTraitement).exec(numeroFiche);
  if (!correspondance || correspondance[4] !== undefined) return null;
  return Number(correspondance[3]);
}

/**
 * Le même numéro, avec le sigle du chef choisi (ou sans sigle si le chef n'en a pas) — la date, le
 * numéro d'ordre et l'éventuel suffixe de collision sont conservés. Renvoie le numéro tel quel
 * s'il n'est pas au nouveau format de ce type (ancienne fiche) : on ne réécrit jamais un ancien
 * numéro.
 */
export function appliquerSigleAuNumeroFiche(
  typeTraitement: TypeTraitement,
  numeroFiche: string,
  sigle: string | null | undefined
): string {
  const correspondance = motifNumeroBase(typeTraitement).exec(numeroFiche);
  if (!correspondance) return numeroFiche;
  const [, date, , ordre, suffixe] = correspondance;
  return composerNumeroFiche(typeTraitement, date, Number(ordre), {
    sigle,
    suffixe: suffixe !== undefined ? Number(suffixe) : null,
  });
}
