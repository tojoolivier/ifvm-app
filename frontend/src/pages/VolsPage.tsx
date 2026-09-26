import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Pill } from '@/components/ui/pill'
import type { components } from '@/lib/api-schema.generated'
import {
  CATEGORIES_VOL,
  FILTRES_VIDES,
  LIBELLE_CATEGORIE,
  TEINTE_CATEGORIE,
  dureeMinutes,
  filtresActifs,
  filtrerVols,
  formaterDateVol,
  formaterDuree,
  formaterHeure,
  libelleCategorie,
  libelleSite,
  totalMinutes,
  type CategorieVol,
  type FiltresVols,
  type SiteAerien,
  type Vol,
} from '@/lib/vols'

type Equipe = components['schemas']['EquipeRead']
type Aeronef = components['schemas']['AeronefRead']

const champClass =
  'h-9 rounded-[8px] border border-[#e0d9c4] bg-[#fffdf8] px-[10px] font-sans text-[12px] focus:outline-none focus:ring-2 focus:ring-green-500'
const libelleClass = 'font-sans text-[11px] font-semibold text-[#3a3a30]'

function messageChargement(erreur: unknown, defaut: string): string {
  return (erreur as AxiosError<{ detail?: string }>)?.response?.data?.detail ?? defaut
}

/**
 * Vols (#608, #610) — remplace la page provisoire « Heures de vol ». La liste de tous les vols de la
 * campagne, filtrable par catégorie, équipe, aéronef et période, avec le total d'heures de vol de la
 * sélection. Un vol ouvre son détail (`/vols/:id`).
 *
 * Le backend ne filtre `GET /vols` que par équipe et ne pagine pas : la page charge la liste une fois
 * et filtre en mémoire (`filtrerVols`), ce qui garde le total cohérent avec ce qui est affiché.
 */
export function VolsPage() {
  const [filtres, setFiltres] = useState<FiltresVols>(FILTRES_VIDES)

  const {
    data: vols = [],
    isLoading,
    isError,
    error,
  } = useQuery<Vol[]>({
    queryKey: ['vols'],
    queryFn: () => api.get('/vols').then((r) => r.data),
  })

  // Mêmes clés et mêmes paramètres qu'Administration > Équipes et Parc aéronefs : requêtes partagées.
  const { data: equipes = [] } = useQuery<Equipe[]>({
    queryKey: ['equipes'],
    queryFn: () => api.get('/equipes', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })
  const { data: aeronefs = [] } = useQuery<Aeronef[]>({
    queryKey: ['aeronefs'],
    queryFn: () => api.get('/aeronefs', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })
  const { data: sites = [] } = useQuery<SiteAerien[]>({
    queryKey: ['sites-aeriens', 'tous'],
    queryFn: () => api.get('/sites-aeriens', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  const visibles = useMemo(() => filtrerVols(vols, filtres), [vols, filtres])
  const minutesTotales = totalMinutes(visibles)

  const nomEquipe = (id: string) => equipes.find((e) => e.id === id)?.nom ?? '—'
  const immatriculation = (id: string) => aeronefs.find((a) => a.id === id)?.immatriculation ?? '—'

  function modifier<K extends keyof FiltresVols>(cle: K, valeur: FiltresVols[K]) {
    setFiltres((precedents) => ({ ...precedents, [cle]: valeur }))
  }

  const colonnes: DataTableColumn<Vol>[] = [
    {
      key: 'date',
      header: 'Date',
      mono: true,
      render: (v) => (
        <Link to={`/vols/${v.id}`} className="font-semibold underline">
          {formaterDateVol(v.date_vol)}
        </Link>
      ),
    },
    {
      key: 'categorie',
      header: 'Catégorie',
      render: (v) => (
        <Pill tone={TEINTE_CATEGORIE[v.type as CategorieVol] ?? TEINTE_CATEGORIE.divers}>
          {libelleCategorie(v.type)}
        </Pill>
      ),
    },
    { key: 'equipe', header: 'Équipe', render: (v) => nomEquipe(v.equipe_id) },
    {
      key: 'aeronef',
      header: 'Aéronef',
      mono: true,
      render: (v) => immatriculation(v.aeronef_id),
    },
    {
      key: 'site',
      header: 'Site',
      render: (v) => {
        const site = libelleSite(v.site_principal_id, sites)
        return site ?? <span className="text-ifvm-text-weak">—</span>
      },
    },
    {
      key: 'horaires',
      header: 'Horaires',
      mono: true,
      render: (v) => `${formaterHeure(v.heure_debut)} – ${formaterHeure(v.heure_fin)}`,
    },
    {
      key: 'duree',
      header: 'Durée',
      align: 'right',
      mono: true,
      render: (v) => formaterDuree(dureeMinutes(v)),
    },
    {
      key: 'lien',
      header: 'Traitement',
      render: (v) =>
        v.traitement_id ? (
          <Link to={`/traitements/${v.traitement_id}`} className="font-sans text-[12px] font-semibold underline">
            Voir
          </Link>
        ) : (
          <span className="text-ifvm-text-weak">—</span>
        ),
    },
  ]

  const messageVide = isLoading
    ? 'Chargement…'
    : vols.length === 0
      ? 'Aucun vol enregistré.'
      : 'Aucun vol ne correspond à ces filtres.'

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px]">
      <div>
        <h1 className="text-2xl font-bold">Vols</h1>
        <p className="font-sans text-[12px] text-ifvm-text-weak">
          Les vols de la campagne (mise en place, application, convoyage, prospection, divers) et leurs
          heures de vol.
        </p>
      </div>

      <form
        aria-label="Filtres des vols"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-[11px] border border-[#e7e0cd] bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-categorie" className={libelleClass}>
            Catégorie
          </label>
          <select
            id="filtre-categorie"
            value={filtres.categorie}
            onChange={(e) => modifier('categorie', e.target.value as CategorieVol | '')}
            className={champClass}
          >
            <option value="">— Toutes —</option>
            {CATEGORIES_VOL.map((c) => (
              <option key={c} value={c}>
                {LIBELLE_CATEGORIE[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-equipe" className={libelleClass}>
            Équipe
          </label>
          <select
            id="filtre-equipe"
            value={filtres.equipeId}
            onChange={(e) => modifier('equipeId', e.target.value)}
            className={champClass}
          >
            <option value="">— Toutes —</option>
            {equipes
              .filter((e) => e.type === 'aerien')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-aeronef" className={libelleClass}>
            Aéronef
          </label>
          <select
            id="filtre-aeronef"
            value={filtres.aeronefId}
            onChange={(e) => modifier('aeronefId', e.target.value)}
            className={champClass}
          >
            <option value="">— Tous —</option>
            {aeronefs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.immatriculation}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-du" className={libelleClass}>
            Du
          </label>
          <input
            id="filtre-du"
            type="date"
            value={filtres.dateDebut}
            max={filtres.dateFin || undefined}
            onChange={(e) => modifier('dateDebut', e.target.value)}
            className={champClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-au" className={libelleClass}>
            Au
          </label>
          <input
            id="filtre-au"
            type="date"
            value={filtres.dateFin}
            min={filtres.dateDebut || undefined}
            onChange={(e) => modifier('dateFin', e.target.value)}
            className={champClass}
          />
        </div>
        {filtresActifs(filtres) && (
          <button
            type="button"
            onClick={() => setFiltres(FILTRES_VIDES)}
            className="h-9 rounded-[8px] border border-[#e0d9c4] bg-white px-3 font-sans text-[12px] font-semibold text-[#3a3a30] hover:bg-[#faf7ef]"
          >
            Réinitialiser
          </button>
        )}
      </form>

      {isError ? (
        <ErrorBanner label="Erreur" message={messageChargement(error, 'Impossible de charger les vols.')} />
      ) : (
        <>
          <p
            data-testid="total-heures-vol"
            aria-live="polite"
            className="rounded-[10px] border border-ifvm-green-border bg-ifvm-green-bg px-4 py-3 font-sans text-[13px] text-ifvm-green-text"
          >
            <b>{visibles.length}</b> vol{visibles.length > 1 ? 's' : ''} · total des heures de vol :{' '}
            <b className="font-mono">{formaterDuree(minutesTotales)}</b>
          </p>
          <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
            <DataTable columns={colonnes} rows={visibles} getRowKey={(v) => v.id} emptyMessage={messageVide} />
          </div>
        </>
      )}
    </div>
  )
}
