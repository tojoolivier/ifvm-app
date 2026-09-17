import type { UserRole } from './api-client';

/**
 * Rôles autorisés à saisir une fiche de vol (#fiche-vol-acces-roles) — décision
 * produit du 2026-09-17 : la saisie de fiche de vol est un geste du chef de
 * base ou de l'équipe aérienne (pilote/mécanicien), pas des autres rôles
 * terrain (prospecteur, chef d'équipe, agent encadreur) ni de l'administration.
 *
 * Contrôle côté mobile (UI) uniquement — aucune vérification côté serveur :
 * `equipe_aerienne` (référentiel backend) ne modélise que `chef_de_base_id`,
 * pas une liste de pilotes/mécaniciens membres, donc « équipe aérienne » se
 * traduit ici par les rôles `pilote`/`mecanicien` en général, pas par
 * l'appartenance à une équipe précise.
 */
export const ROLES_FICHE_VOL: readonly UserRole[] = ['chef_de_base', 'pilote', 'mecanicien'];

export function peutSaisirFicheVol(role: UserRole | null | undefined): boolean {
  return !!role && ROLES_FICHE_VOL.includes(role);
}
