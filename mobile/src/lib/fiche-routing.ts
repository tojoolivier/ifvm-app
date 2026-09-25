import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export const TRAITEMENT_EDIT_ROUTE = '/(traitement)/references';

/**
 * Retour arrière dans le tunnel de saisie : dépile l'historique.
 *
 * `router.replace` ne dépile pas — il échange l'entrée du dessus. L'utiliser comme
 * « retour » empile des écrans périmés dans le désordre : après un aller-retour entre
 * deux grilles, la pile contenait `[… species, captures, species]`, et le retour suivant
 * depuis « Qu'avez-vous observé ? » ramenait à l'écran de capture au lieu de remonter le
 * tunnel.
 *
 * `repli` ne sert qu'aux arrivées sans historique (lien profond, écran monté seul) : là,
 * il n'y a rien à dépiler et la destination doit être nommée.
 */
export function retourArriere(router: Router, repli: () => void): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  repli();
}

/**
 * Navigue vers l'écran de fiche de traitement (CRT) : édition si brouillon,
 * lecture seule (`isValidationView`) si déjà validée.
 */
export function navigateToTraitement(
  router: Router,
  traitement: { id: string },
  options?: { validationView?: boolean }
): void {
  router.push({
    pathname: TRAITEMENT_EDIT_ROUTE as any,
    params: {
      traitementId: traitement.id,
      ...(options?.validationView ? { isValidationView: '1' } : {}),
    },
  });
}
