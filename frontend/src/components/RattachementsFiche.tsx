import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { components } from '@/lib/api-schema.generated'
import {
  aeronefDeFiche,
  libelleVolLie,
  prospectionAerienne,
  siteDeFiche,
  type ValeurRattachement,
} from '@/lib/rattachements'
import type { SiteAerien, Vol } from '@/lib/vols'

type Aeronef = components['schemas']['AeronefRead']

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 font-sans text-[11px] font-semibold uppercase tracking-[.6px] text-ifvm-text-weak">
        {libelle}
      </dt>
      <dd className="min-w-0 font-sans text-[12.5px]">{children}</dd>
    </div>
  )
}

/** Une valeur de rattachement : le texte, signalé « saisie libre » quand il vient de l'historique. */
function Valeur({ valeur }: { valeur: ValeurRattachement | null }) {
  if (!valeur) return <span className="text-ifvm-text-weak">non renseigné</span>
  return (
    <>
      <span className={valeur.historique ? 'italic' : 'font-semibold'}>{valeur.texte}</span>
      {valeur.historique && (
        <span
          title="Texte saisi librement, avant le rattachement au référentiel"
          className="ml-2 font-sans text-[10.5px] text-ifvm-text-weak"
        >
          (saisie libre)
        </span>
      )}
    </>
  )
}

/** Le vol lié : un lien vers le détail du vol, ou l'état (chargement, introuvable, aucun). */
function VolLie({ vol, chargement, erreur }: { vol: Vol | undefined; chargement: boolean; erreur: boolean }) {
  if (chargement) return <span className="text-ifvm-text-weak">…</span>
  if (erreur) return <span className="text-ifvm-text-weak">vol introuvable</span>
  if (!vol) return <span className="text-ifvm-text-weak">aucun vol rattaché</span>
  return (
    <Link to={`/vols/${vol.id}`} className="font-semibold underline">
      {libelleVolLie(vol)}
    </Link>
  )
}

function Carte({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Rattachements"
      data-testid="rattachements-fiche"
      className="flex flex-col gap-2 rounded-[10px] border border-[#e7e0cd] bg-card px-4 py-3"
    >
      <h2 className="font-sans text-[12.5px] font-bold">Rattachements</h2>
      <dl className="flex flex-col gap-2">{children}</dl>
    </section>
  )
}

// Mêmes clés et paramètres que Vols, Parc aéronefs et Stock : requêtes partagées.
function useReferentielsAeriens(actif: boolean) {
  const { data: aeronefs = [] } = useQuery<Aeronef[]>({
    queryKey: ['aeronefs'],
    queryFn: () => api.get('/aeronefs', { params: { inclure_inactifs: true } }).then((r) => r.data),
    enabled: actif,
  })
  const { data: sites = [] } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens', 'tous'],
    queryFn: () => api.get('/sites-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
    enabled: actif,
  })
  return { aeronefs, sites }
}

/**
 * Rattachements d'une fiche de TRAITEMENT AÉRIEN (#647–#651) : site principal, aéronef et vol lié.
 * L'équipe est affichée juste au-dessus par `EquipeLien`, et la consommation de pesticide par
 * `ConsommationPesticide`. Un traitement terrestre n'a ni site aérien, ni aéronef, ni vol : rien à afficher.
 *
 * Fiches antérieures : sans rattachement au référentiel, le site et l'aéronef retombent sur le texte libre
 * d'origine (`base_principale`, `immatricule_aeronef`), signalé « saisie libre ».
 */
export function RattachementsTraitement({
  traitementId,
  aerien,
}: {
  traitementId: string
  aerien: { site_principal_id?: string | null; base_principale?: string | null; immatricule_aeronef?: string | null } | null
}) {
  const estAerien = aerien !== null
  const { aeronefs, sites } = useReferentielsAeriens(estAerien)

  // Le vol qui porte ce traitement (`vol.traitement_id`, #610) : au plus un.
  const {
    data: vols = [],
    isLoading: volChargement,
    isError: volErreur,
  } = useQuery<Vol[]>({
    queryKey: ['vols', 'traitement', traitementId],
    queryFn: () => api.get('/vols', { params: { traitement_id: traitementId } }).then((r) => r.data),
    enabled: estAerien,
  })

  if (!aerien) return null
  const vol = vols[0]

  return (
    <Carte>
      <Ligne libelle="Site principal">
        <Valeur valeur={siteDeFiche(aerien.site_principal_id ?? vol?.site_principal_id, aerien.base_principale, null, sites)} />
      </Ligne>
      <Ligne libelle="Aéronef">
        <Valeur valeur={aeronefDeFiche(vol, aerien.immatricule_aeronef, aeronefs)} />
      </Ligne>
      <Ligne libelle="Vol lié">
        <VolLie vol={vol} chargement={volChargement} erreur={volErreur} />
      </Ligne>
    </Carte>
  )
}

/**
 * Rattachements d'une fiche de PROSPECTION AÉRIENNE (#647–#651) : site principal, aéronef et vol lié.
 * Le site et l'aéronef viennent du vol quand il y en a un ; à défaut, des anciens champs texte de
 * l'extensif aérien (`base`, `immatricule_aeronef`), signalés « saisie libre ». Une prospection sans
 * aucun de ces éléments (terrestre) n'affiche pas ce bloc.
 */
export function RattachementsProspection({
  prospection,
}: {
  prospection: {
    vol_id?: string | null
    base?: string | null
    base_numero?: number | null
    immatricule_aeronef?: string | null
  }
}) {
  const affiche = prospectionAerienne(prospection)
  const { aeronefs, sites } = useReferentielsAeriens(affiche)

  const {
    data: vol,
    isLoading: volChargement,
    isError: volErreur,
  } = useQuery<Vol>({
    queryKey: ['vol', prospection.vol_id],
    queryFn: () => api.get(`/vols/${prospection.vol_id}`).then((r) => r.data),
    enabled: !!prospection.vol_id,
  })

  if (!affiche) return null

  return (
    <Carte>
      <Ligne libelle="Site principal">
        <Valeur valeur={siteDeFiche(vol?.site_principal_id, prospection.base, prospection.base_numero, sites)} />
      </Ligne>
      <Ligne libelle="Aéronef">
        <Valeur valeur={aeronefDeFiche(vol, prospection.immatricule_aeronef, aeronefs)} />
      </Ligne>
      <Ligne libelle="Vol lié">
        {prospection.vol_id ? (
          <VolLie vol={vol} chargement={volChargement} erreur={volErreur} />
        ) : (
          <span className="text-ifvm-text-weak">aucun vol rattaché</span>
        )}
      </Ligne>
    </Carte>
  )
}
