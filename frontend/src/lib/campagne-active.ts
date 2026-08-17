/**
 * Campagne « en cours ».
 *
 * `campagne` n'a aucune colonne de statut côté backend (#121) : l'état est
 * dérivé des dates. La règle vit ici pour que la pilule du header (Layout) et
 * le tableau de bord ne divergent jamais — deux dérivations séparées, c'est
 * deux campagnes actives différentes à l'écran le jour d'un chevauchement.
 */
export interface CampagneDatee {
  id: string
  name: string
  start_date: string
  end_date: string | null
}

/** En cas de chevauchement, la plus récemment commencée gagne. */
export function campagneActive<T extends CampagneDatee>(
  campagnes: T[],
  today = new Date().toISOString().slice(0, 10),
): T | undefined {
  return campagnes
    .filter((c) => c.start_date <= today && (!c.end_date || c.end_date >= today))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
}
