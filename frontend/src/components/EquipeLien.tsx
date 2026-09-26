import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { LIBELLE_TYPE_EQUIPE, chefDe, lienEquipe, nomComplet, type Equipe } from '@/lib/equipes'

/**
 * « Équipe : … » des fiches de prospection et de traitement (#602, #607) — le nom de l'équipe
 * (`equipe_id` de la fiche), son type et son chef, avec un lien vers l'équipe dans
 * Administration > Équipes.
 *
 * L'Administration n'est ouverte qu'aux profils admin et chef : pour les autres, le nom s'affiche
 * sans lien (un lien y mènerait à une page qu'ils ne voient pas). Une fiche sans équipe (fiches
 * antérieures) le dit plutôt que de laisser la ligne vide.
 */
export function EquipeLien({ equipeId }: { equipeId: string | null | undefined }) {
  const { data: currentUser } = useCurrentUser()
  const peutAdministrer = currentUser?.role === 'admin' || currentUser?.role === 'chef'

  const {
    data: equipe,
    isLoading,
    isError,
  } = useQuery<Equipe>({
    queryKey: ['equipe', equipeId],
    queryFn: () => api.get(`/equipes/${equipeId}`).then((r) => r.data),
    enabled: !!equipeId,
  })

  let contenu: React.ReactNode
  if (!equipeId) {
    contenu = <span>non renseignée</span>
  } else if (isLoading) {
    contenu = <span>…</span>
  } else if (isError || !equipe) {
    contenu = <span>introuvable</span>
  } else {
    const nom = peutAdministrer ? (
      <Link to={lienEquipe(equipe.id)} className="font-semibold underline">
        {equipe.nom}
      </Link>
    ) : (
      <span className="font-semibold">{equipe.nom}</span>
    )
    const chef = chefDe(equipe)
    contenu = (
      <>
        {nom} ({LIBELLE_TYPE_EQUIPE[equipe.type].toLowerCase()}
        {chef ? ` · chef ${nomComplet(chef)}` : ''})
      </>
    )
  }

  return (
    <p data-testid="fiche-equipe" className="font-sans text-[12px] text-ifvm-text-tertiary">
      Équipe : {contenu}
    </p>
  )
}
