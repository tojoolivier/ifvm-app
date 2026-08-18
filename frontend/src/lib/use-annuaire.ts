import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export interface Utilisateur {
  id: string
  nom: string
  role: string
}

/** Identifiant tronqué, repli quand l'annuaire n'est pas lisible. */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.slice(0, 8) + '…'
}

/**
 * Annuaire des agents pour l'affichage des noms.
 *
 * `GET /users/` est réservé aux admins (`require_admin`, backend/app/routers/users.py) :
 * la requête ne doit pas être retentée et les écrans doivent rester lisibles
 * sans elle — d'où le repli sur l'identifiant court.
 */
export function useAnnuaire() {
  const { data: utilisateurs = [] } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
    retry: false,
  })

  // Identité stable : sans `useCallback`, `nomAgent` est une nouvelle fonction
  // à chaque rendu et invalide toute mémoïsation qui en dépend côté écran.
  const nomAgent = useCallback(
    (id: string | null | undefined): string =>
      utilisateurs.find((u) => u.id === id)?.nom ?? shortId(id),
    [utilisateurs],
  )

  return { utilisateurs, nomAgent }
}
