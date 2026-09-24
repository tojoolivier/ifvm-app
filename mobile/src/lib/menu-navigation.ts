import type { MenuEntree } from '@/components/menu/MenuDrawer';
import type { UserRole } from './api-client';
import { peutVoirEquipesAeriennes } from './equipe-aerienne-access';

/**
 * Section NAVIGATION du tiroir de l'Accueil (Figma « Tiroir menu ») : Équipes, Sites, Référentiels.
 * « Sites » n'apparaît que pour l'équipe aérienne (chef de base, pilote, mécanicien) : les sites
 * sont un sous-domaine de l'équipe aérienne (#643), il n'y a rien à y montrer aux autres rôles.
 */
export function entreesNavigation(
  role: UserRole | null | undefined,
  aller: (chemin: string) => void
): MenuEntree[] {
  return [
    { cle: 'equipes', libelle: 'Équipes', icone: 'utilisateurs', onPress: () => aller('/(app)/equipes') },
    ...(peutVoirEquipesAeriennes(role)
      ? [{ cle: 'sites', libelle: 'Sites', icone: 'sites' as const, onPress: () => aller('/(app)/sites') }]
      : []),
    { cle: 'referentiels', libelle: 'Référentiels', icone: 'referentiels', onPress: () => aller('/(app)/sync') },
  ];
}
