import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** Résout l'écran d'édition d'un brouillon de prospection selon son type (#Q4 grilling). */
export function getProspectionEditRoute(typeProspection: string): string {
  return typeProspection === 'intensive' ? '/(prospection)/reference' : '/(prospection)/extensive-reference';
}

export const PROSPECTION_CONSULT_ROUTE = '/(prospection)/fiche-lecture';
export const TRAITEMENT_EDIT_ROUTE = '/(traitement)/references';

/**
 * Navigue vers l'écran d'édition d'un brouillon de prospection (intensive, extensive
 * ou validation). `extensive-reference.tsx` ne s'auto-hydrate pas depuis `draftId`
 * (contrairement à `reference.tsx`) : on hydrate systématiquement le store avant de
 * naviguer pour couvrir les deux cas, comme le fait déjà `type-chooser.tsx`.
 */
export async function navigateToProspectionDraft(
  router: Router,
  hydrateFromDraft: (draftId: string) => Promise<void>,
  draft: { id: string; type_prospection: string }
): Promise<void> {
  await hydrateFromDraft(draft.id);
  router.push({
    pathname: getProspectionEditRoute(draft.type_prospection) as any,
    params: { draftId: draft.id },
  });
}

/** Navigue vers l'écran de lecture seule (#16) d'une prospection validée. */
export function navigateToProspectionConsult(router: Router, prospection: { id: string }): void {
  router.push({ pathname: PROSPECTION_CONSULT_ROUTE as any, params: { id: prospection.id } });
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
