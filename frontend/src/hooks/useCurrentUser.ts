import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Utilisateur } from '../types'

export function useCurrentUser() {
  return useQuery<Utilisateur>({
    queryKey: ['currentUser'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })
}
