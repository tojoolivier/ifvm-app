import type { components } from '@/lib/api-schema.generated'

// Types tirés du contrat OpenAPI (généré par `npm run generate:api-types`) — jamais recopiés à
// la main, même règle que côté mobile (CLAUDE.md, « Contrat API mobile ↔ backend »).
export type Equipe = components['schemas']['EquipeRead']
export type MembreEquipe = components['schemas']['MembreEquipeRead']
export type TypeEquipe = Equipe['type']

export const LIBELLE_TYPE_EQUIPE: Record<TypeEquipe, string> = {
  terrestre: 'Terrestre',
  aerien: 'Aérienne',
}

/** Libellé lisible d'une fonction de membre (`equipe_membre.fonction`, ADR-018). */
export const LIBELLE_FONCTION: Record<string, string> = {
  chef: 'Chef',
  chef_de_base: 'Chef de base',
  chef_equipe: "Chef d'équipe",
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  consultant_international: 'Consultant international',
  agent_encadreur: 'Agent encadreur',
  membre: 'Membre',
}

/** Fonctions qu'on peut attribuer à un membre saisi par son seul nom (compte créé à la volée). */
export const FONCTIONS_A_LA_VOLEE = ['membre', 'pilote', 'mecanicien', 'consultant_international'] as const
export type FonctionALaVolee = (typeof FONCTIONS_A_LA_VOLEE)[number]

export function libelleFonction(fonction: string): string {
  return LIBELLE_FONCTION[fonction] ?? fonction
}

/** Le chef n'est pas une colonne de l'équipe mais un membre `fonction: 'chef'` (ADR-018). */
export function chefDe(equipe: Equipe): MembreEquipe | undefined {
  return equipe.membres?.find((m) => m.fonction === 'chef')
}

export function membreParFonction(equipe: Equipe, fonction: string): MembreEquipe | undefined {
  return equipe.membres?.find((m) => m.fonction === fonction)
}

export function nomComplet(membre: MembreEquipe | undefined): string {
  return membre ? [membre.prenom, membre.nom].filter(Boolean).join(' ') : '—'
}

/** Membres autres que le chef, dans l'ordre reçu : la liste générique « nom (fonction) ». */
export function autresMembres(equipe: Equipe): MembreEquipe[] {
  return (equipe.membres ?? []).filter((m) => m.fonction !== 'chef')
}

/** Adresse de l'équipe dans l'administration — cible des liens des fiches (prospection, traitement). */
export function lienEquipe(equipeId: string): string {
  return `/administration?section=equipes&equipe=${encodeURIComponent(equipeId)}`
}
