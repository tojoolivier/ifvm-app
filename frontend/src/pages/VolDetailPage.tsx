import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { EquipeLien } from '@/components/EquipeLien'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Pill } from '@/components/ui/pill'
import { STATUT_LABELS, type Statut } from '@/components/ui/status-badge'
import type { components } from '@/lib/api-schema.generated'
import {
  TEINTE_CATEGORIE,
  champsSpecifiques,
  dureeMinutes,
  formaterDateVol,
  formaterDuree,
  formaterHeure,
  libelleCategorie,
  peutPorterProspections,
  peutPorterTraitement,
  type CategorieVol,
  type SiteAerien,
  type Vol,
} from '@/lib/vols'

type Aeronef = components['schemas']['AeronefRead']
type Traitement = components['schemas']['TraitementRead']
type Prospection = components['schemas']['ProspectionRead']

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 font-sans text-[11.5px] font-semibold uppercase tracking-[.6px] text-ifvm-text-weak">
        {libelle}
      </dt>
      <dd className="min-w-0 font-sans text-[13px]">{children}</dd>
    </div>
  )
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[11px] border border-[#e7e0cd] bg-card p-4">
      <h2 className="font-sans text-[13px] font-bold">{titre}</h2>
      {children}
    </section>
  )
}

/**
 * Détail d'un vol (#608, #610) : les champs communs, ceux de sa catégorie (sites, motif, lieux) et,
 * pour les catégories qui en portent, ce qui lui a été relié après coup — le traitement aérien d'un
 * vol d'application, les fiches de prospection d'un vol de prospection.
 */
export function VolDetailPage() {
  const { id } = useParams<{ id: string }>()

  const {
    data: vol,
    isLoading,
    isError,
    error,
  } = useQuery<Vol>({
    queryKey: ['vol', id],
    queryFn: () => api.get(`/vols/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const { data: aeronef } = useQuery<Aeronef>({
    queryKey: ['aeronef', vol?.aeronef_id],
    queryFn: () => api.get(`/aeronefs/${vol!.aeronef_id}`).then((r) => r.data),
    enabled: !!vol,
  })

  const { data: sites = [] } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens', 'tous'],
    queryFn: () => api.get('/sites-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
    enabled: !!vol,
  })

  const { data: traitement, isError: traitementIsError } = useQuery<Traitement>({
    queryKey: ['traitement', vol?.traitement_id],
    queryFn: () => api.get(`/traitements/${vol!.traitement_id}`).then((r) => r.data),
    enabled: !!vol?.traitement_id,
  })

  const {
    data: prospections = [],
    isLoading: prospectionsLoading,
    isError: prospectionsIsError,
  } = useQuery<Prospection[]>({
    queryKey: ['prospections', 'vol', id],
    queryFn: () => api.get('/prospections', { params: { vol_id: id } }).then((r) => r.data),
    enabled: !!vol && peutPorterProspections(vol),
  })

  if (isLoading) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
        <p className="font-sans text-[12px] text-ifvm-text-tertiary">Chargement…</p>
      </div>
    )
  }

  if (isError || !vol) {
    const statut = (error as AxiosError | null)?.response?.status
    const detail = (error as AxiosError<{ detail?: string }> | null)?.response?.data?.detail
    return (
      <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
        <Link to="/vols" className="font-sans text-[12px] font-semibold underline">
          ← Tous les vols
        </Link>
        <ErrorBanner
          label={statut === 404 ? 'Introuvable' : 'Erreur'}
          message={detail ?? 'Impossible de charger ce vol.'}
        />
      </div>
    )
  }

  const categorie = vol.type as CategorieVol
  const champs = champsSpecifiques(vol, sites)
  const duree = formaterDuree(dureeMinutes(vol))

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
      <Link to="/vols" className="font-sans text-[12px] font-semibold underline">
        ← Tous les vols
      </Link>

      <header
        data-testid="vol-header"
        className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[12px] bg-ifvm-green-text px-4 py-4 text-white sm:px-[22px] sm:py-5"
      >
        <div className="min-w-0 flex-1">
          <h1 className="font-mono text-[17px] font-bold">Vol du {formaterDateVol(vol.date_vol)}</h1>
          <p className="mt-1 font-sans text-[12px] font-medium text-white/75">
            {libelleCategorie(vol.type)} · {formaterHeure(vol.heure_debut)} – {formaterHeure(vol.heure_fin)} · {duree}
          </p>
        </div>
        <Pill tone={TEINTE_CATEGORIE[categorie] ?? TEINTE_CATEGORIE.divers}>{libelleCategorie(vol.type)}</Pill>
      </header>

      <Carte titre="Vol">
        <EquipeLien equipeId={vol.equipe_id} />
        <dl className="flex flex-col gap-2">
          <Ligne libelle="Aéronef">
            {aeronef ? (
              <>
                <span className="font-mono font-semibold">{aeronef.immatriculation}</span> — {aeronef.societe}
              </>
            ) : (
              <span className="text-ifvm-text-weak">…</span>
            )}
          </Ligne>
          <Ligne libelle="Date">{formaterDateVol(vol.date_vol)}</Ligne>
          <Ligne libelle="Horaires">
            <span className="font-mono">
              {formaterHeure(vol.heure_debut)} – {formaterHeure(vol.heure_fin)}
            </span>
          </Ligne>
          <Ligne libelle="Durée">
            <span className="font-mono font-semibold">{duree}</span>
          </Ligne>
          {vol.observations && <Ligne libelle="Observations">{vol.observations}</Ligne>}
        </dl>
      </Carte>

      {champs.length > 0 && (
        <Carte titre={`Détails · ${libelleCategorie(vol.type).toLowerCase()}`}>
          <dl className="flex flex-col gap-2">
            {champs.map((champ) => (
              <Ligne key={champ.libelle} libelle={champ.libelle}>
                {champ.valeur === 'Non renseigné' ? (
                  <span className="text-ifvm-text-weak">{champ.valeur}</span>
                ) : (
                  champ.valeur
                )}
              </Ligne>
            ))}
          </dl>
        </Carte>
      )}

      {peutPorterTraitement(vol) && (
        <Carte titre="Traitement lié">
          {!vol.traitement_id ? (
            <p className="font-sans text-[12.5px] text-ifvm-text-weak">
              Aucun traitement aérien n'est encore rattaché à ce vol — le compte-rendu se rédige souvent en
              fin de journée.
            </p>
          ) : (
            <p className="font-sans text-[13px]">
              Fiche de traitement :{' '}
              <Link to={`/traitements/${vol.traitement_id}`} className="font-mono font-semibold underline">
                {traitement?.numero_fiche ?? (traitementIsError ? 'introuvable' : vol.traitement_id)}
              </Link>
            </p>
          )}
        </Carte>
      )}

      {peutPorterProspections(vol) && (
        <Carte titre="Prospections liées">
          {prospectionsIsError ? (
            <ErrorBanner label="Erreur" message="Impossible de charger les prospections de ce vol." />
          ) : prospectionsLoading ? (
            <p className="font-sans text-[12.5px] text-ifvm-text-weak">Chargement…</p>
          ) : prospections.length === 0 ? (
            <p className="font-sans text-[12.5px] text-ifvm-text-weak">
              Aucune fiche de prospection n'est encore rattachée à ce vol.
            </p>
          ) : (
            <ul aria-label="Prospections liées au vol" className="flex flex-col gap-2">
              {prospections.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px]">
                  <Link to={`/prospections/${p.id}`} className="font-mono font-semibold underline">
                    {p.n_fiche ?? p.n_message ?? p.id}
                  </Link>
                  <span className="text-ifvm-text-weak">{p.date_prospection}</span>
                  <span className="text-ifvm-text-weak">{STATUT_LABELS[p.statut as Statut] ?? p.statut}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}
    </div>
  )
}
