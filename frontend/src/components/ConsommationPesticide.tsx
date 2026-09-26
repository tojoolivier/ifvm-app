import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formaterQuantite, libelleProduit, libelleSite, type Mouvement, type Pesticide, type SiteAerien } from '@/lib/stock-pesticides'

/**
 * Consommation de pesticide générée par une fiche de traitement AÉRIEN (#609) — remplace les anciens
 * « Pesticide reçu » et « Stock restant » saisis à la main, supprimés de la fiche (migration 0094) : un
 * stock photographié par fiche n'avait pas de continuité d'une fiche à l'autre.
 *
 * Chaque écriture sur les rotations régénère les mouvements `consommation` de la fiche (un par produit
 * et par unité, débités du site principal). On les relit ici via le journal, filtré sur la fiche ; le
 * stock lui-même — ce qui reste — vit dans la page « Stock de pesticides ».
 */
export function ConsommationPesticide({ traitementId }: { traitementId: string }) {
  const {
    data: mouvements = [],
    isLoading,
    isError,
  } = useQuery<Mouvement[]>({
    // Sous le préfixe du journal : une saisie sur la page Stock invalide aussi cette liste.
    queryKey: ['stock-mouvements', 'traitement', traitementId],
    queryFn: () =>
      api.get('/mouvements-pesticide', { params: { traitement_id: traitementId } }).then((r) => r.data),
  })

  // Mêmes clés que la page Stock de pesticides : requêtes partagées.
  const { data: pesticides = [] } = useQuery<Pesticide[]>({
    queryKey: ['pesticides', 'tous'],
    queryFn: () => api.get('/pesticides', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })
  const { data: sites = [] } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens', 'tous'],
    queryFn: () => api.get('/sites-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  // Le débit d'une fiche porte sur un seul site : celui de sa base principale.
  const consommations = mouvements.filter((m) => m.type === 'consommation')

  return (
    <section
      aria-label="Consommation de pesticide"
      className="flex flex-col gap-[10px] rounded-[11px] border border-[#e7e0cd] bg-card px-[18px] py-4"
    >
      <h2 className="font-sans text-[12.5px] font-bold">Consommation de pesticide</h2>
      {isError ? (
        <p className="font-sans text-[11.5px] text-destructive">Impossible de charger la consommation.</p>
      ) : isLoading ? (
        <p className="font-sans text-[11.5px] text-ifvm-text-weak">Chargement…</p>
      ) : consommations.length === 0 ? (
        <p className="font-sans text-[11.5px] leading-[1.6] text-ifvm-text-weak">
          Aucune consommation générée : la fiche n'a pas encore de rotation, ou sa base principale n'est pas
          rapprochée d'un site.
        </p>
      ) : (
        <>
          <ul aria-label="Produits consommés" className="flex flex-col gap-2">
            {consommations.map((m) => (
              <li key={m.id} className="flex flex-col gap-0.5">
                <span className="font-sans text-[12px] font-semibold">{libelleProduit(m.pesticide_id, pesticides)}</span>
                <span className="font-mono text-[12px]">
                  {formaterQuantite(m.quantite)} {m.unite}
                </span>
              </li>
            ))}
          </ul>
          <p className="font-sans text-[11px] text-ifvm-text-weak">
            Débitée du stock de {libelleSite(consommations[0].site_id, sites)}. Le litre et le kilo ne sont
            jamais additionnés.
          </p>
        </>
      )}
      <p className="font-sans text-[11px] text-ifvm-text-weak">
        Générée automatiquement depuis les rotations.{' '}
        <Link to="/stock-pesticides" className="font-semibold underline">
          Voir le stock
        </Link>
      </p>
    </section>
  )
}
