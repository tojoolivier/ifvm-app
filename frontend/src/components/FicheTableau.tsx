import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { ErrorBanner } from '@/components/ui/error-banner'

/**
 * Fiche en lecture, présentée en tableaux exactement comme le PDF : le backend sert le même
 * gabarit HTML que pour `/pdf` (`GET …/fiche-html`), on l'affiche ici sans le réécrire — la
 * mise en page n'existe qu'à un seul endroit.
 *
 * Isolé dans un `<iframe>` : le gabarit porte son propre CSS d'impression (`body`, `table`, …)
 * qui déformerait le reste de la page s'il y était injecté. `sandbox="allow-same-origin"` sans
 * `allow-scripts` : aucun script du document ne peut s'exécuter, et l'accès au contenu reste
 * possible pour ajuster la hauteur (pas de double barre de défilement).
 */
export function FicheTableau({
  endpoint,
  cleVersion,
  titre,
}: {
  /** Route relative, ex. `/prospections/{id}/fiche-html`. */
  endpoint: string
  /**
   * Change quand la fiche change (statut, mise à jour) : sans elle, une validation faite
   * pendant que la fiche est ouverte laisserait l'ancien HTML affiché.
   */
  cleVersion?: string
  titre: string
}) {
  const { data, isLoading, isError, error } = useQuery<string>({
    queryKey: ['fiche-html', endpoint, cleVersion ?? null],
    queryFn: () => api.get(endpoint, { responseType: 'text' }).then((r) => (typeof r.data === 'string' ? r.data : '')),
  })

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [hauteur, setHauteur] = useState(600)
  const ajusterHauteur = useCallback(() => {
    const contenu = iframeRef.current?.contentDocument?.documentElement
    if (contenu) setHauteur(contenu.scrollHeight)
  }, [])

  if (isLoading) {
    return <p className="font-sans text-[12px] text-ifvm-text-weak">Chargement de la fiche…</p>
  }
  if (isError || !data) {
    return <ErrorBanner label="Fiche" message={messageErreur(error)} />
  }

  return (
    <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-white">
      <iframe
        ref={iframeRef}
        title={titre}
        srcDoc={data}
        sandbox="allow-same-origin"
        onLoad={ajusterHauteur}
        style={{ height: hauteur }}
        className="block w-full border-0 bg-white"
      />
    </div>
  )
}

/**
 * Message d'erreur avec le code HTTP quand il existe : « Impossible de charger la fiche »
 * seul ne dit pas si c'est une session expirée (401), une route absente d'un backend pas
 * encore à jour (404) ou une vraie erreur du gabarit (500).
 */
function messageErreur(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  if (!status) return 'Impossible de charger la fiche.'
  if (status === 404) return 'Impossible de charger la fiche (erreur 404) : route introuvable, le serveur est-il à jour ?'
  return `Impossible de charger la fiche (erreur ${status}).`
}
