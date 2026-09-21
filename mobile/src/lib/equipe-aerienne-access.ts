import type { UserRole } from './api-client';

/**
 * Rôles qui voient la tuile « Équipes aériennes » de l'accueil : le chef de base et
 * l'équipe aérienne (pilote/mécanicien) — décision produit du 2026-09-17, héritée de
 * la fiche de vol (supprimée depuis), pas des autres rôles terrain (prospecteur, chef
 * d'équipe, agent encadreur) ni de l'administration.
 *
 * Contrôle côté mobile (UI) uniquement — aucune vérification côté serveur :
 * `equipe_aerienne` (référentiel backend) ne modélise que `chef_de_base_id`,
 * pas une liste de pilotes/mécaniciens membres, donc « équipe aérienne » se
 * traduit ici par les rôles `pilote`/`mecanicien` en général, pas par
 * l'appartenance à une équipe précise.
 */
export const ROLES_EQUIPES_AERIENNES: readonly UserRole[] = ['chef_de_base', 'pilote', 'mecanicien'];

export function peutVoirEquipesAeriennes(role: UserRole | null | undefined): boolean {
  return !!role && ROLES_EQUIPES_AERIENNES.includes(role);
}

/**
 * Le chef de base crée les lieux aériens (bases, stands) de SON équipe — seul compte
 * utilisateur de l'équipe (pilote/mécanicien sont des noms libres, sans accès à
 * l'API) — et un admin peut le faire pour n'importe quelle équipe (ex. avant même
 * qu'un compte chef de base n'existe pour elle). `_resoudre_equipe_creation`
 * (backend/app/application/referentiel_use_cases.py) autorise explicitement les deux ;
 * ce contrôle mobile évite seulement de proposer un formulaire voué à l'échec.
 */
export function peutCreerLieuAerien(role: UserRole | null | undefined): boolean {
  return role === 'chef_de_base' || role === 'admin';
}
