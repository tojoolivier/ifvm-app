import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
  created_at: string
}

/**
 * Statuts de la maquette §2 (prototype ligne 1330) : la ligne « Campagne »
 * porte `Active`, `Clôturée` ou `En préparation`, avec la palette des statuts
 * de fiche (vert / gris / ambre).
 *
 * Le backend n'a aucune colonne de statut sur `campagne` : on le dérive des
 * dates, exactement comme `Layout` dérive déjà la campagne active pour la
 * pilule du header. Les deux dérivations doivent rester cohérentes.
 */
type StatutCampagne = 'active' | 'cloturee' | 'preparation'

const STATUT_LABELS: Record<StatutCampagne, string> = {
  active: 'Active',
  cloturee: 'Clôturée',
  preparation: 'En préparation',
}

const STATUT_CLASSES: Record<StatutCampagne, string> = {
  active: 'bg-ifvm-green-bg text-ifvm-green-text border-ifvm-green-border',
  cloturee: 'bg-ifvm-brouillon-bg text-ifvm-brouillon-text border-ifvm-brouillon-border',
  preparation: 'bg-ifvm-amber-bg text-ifvm-amber-text border-ifvm-amber-border',
}

function statutCampagne(campagne: Campagne, today: string): StatutCampagne {
  if (campagne.start_date > today) return 'preparation'
  if (campagne.end_date && campagne.end_date < today) return 'cloturee'
  return 'active'
}

/** Bouton d'ajout de la maquette : `padding 10px 16px`, rayon `9px`, `700 12px`. */
const addButtonClass =
  'rounded-[9px] bg-ifvm-green-text px-4 py-[10px] font-sans text-[12px] font-bold text-white'

interface CampagnesPageProps {
  /** Injectable pour les tests : fige le jour de référence des statuts dérivés. */
  today?: string
}

export function CampagnesPage({ today }: CampagnesPageProps = {}) {
  const queryClient = useQueryClient()
  const jour = today ?? new Date().toISOString().slice(0, 10)
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const {
    data: campagnesData = [],
    isLoading,
    isError,
    error: loadError,
  } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })
  const campagnes = Array.isArray(campagnesData) ? campagnesData : []

  const errorStatus = (loadError as AxiosError)?.response?.status
  const errorDetail = (loadError as AxiosError<{ detail?: string }>)?.response?.data?.detail

  // Colonnes « Prospections » et « Traitements » de la maquette : l'API n'expose
  // aucun agrégat par campagne (`GET /campagnes` ne renvoie que les 4 champs de
  // la table). On compte côté client, comme le fait déjà UtilisateursSection pour ses
  // fiches par prospecteur. Provisoire : les deux listes complètes transitent à
  // chaque affichage. La vraie réponse est un compteur côté API
  // (`GET /campagnes` enrichi, ou `?group_by=campagne_id`).
  const { data: prospectionsData = [], isError: prospectionsIndisponibles } = useQuery<
    { id: string; campagne_id: string | null }[]
  >({
    queryKey: ['prospections', 'all'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })
  const prospections = Array.isArray(prospectionsData) ? prospectionsData : []

  // `traitement` n'a pas de `campagne_id` : il est rattaché à une prospection,
  // qui porte la campagne. Le comptage passe donc par la table de correspondance.
  const { data: traitementsData = [], isError: traitementsIndisponibles } = useQuery<
    { id: string; prospection_id: string }[]
  >({
    queryKey: ['traitements'],
    queryFn: () => api.get('/traitements').then((r) => r.data),
  })
  const traitements = Array.isArray(traitementsData) ? traitementsData : []

  const campagneParProspection = new Map<string, string>()
  const prospectionsParCampagne = new Map<string, number>()
  for (const p of prospections) {
    if (!p.campagne_id) continue
    campagneParProspection.set(p.id, p.campagne_id)
    prospectionsParCampagne.set(p.campagne_id, (prospectionsParCampagne.get(p.campagne_id) ?? 0) + 1)
  }

  const traitementsParCampagne = new Map<string, number>()
  for (const t of traitements) {
    const campagneId = campagneParProspection.get(t.prospection_id)
    if (!campagneId) continue
    traitementsParCampagne.set(campagneId, (traitementsParCampagne.get(campagneId) ?? 0) + 1)
  }

  // Les traitements se rattachent à une campagne *via* les prospections : si la
  // liste des prospections manque, le compteur de traitements est faux lui aussi.
  const traitementsIncertains = traitementsIndisponibles || prospectionsIndisponibles

  const createMutation = useMutation({
    mutationFn: (data: { name: string; start_date: string; end_date: string | null }) =>
      api.post('/campagnes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campagnes'] })
      setShowModal(false)
      resetForm()
    },
    onError: (err: AxiosError<{ detail?: string }>) =>
      setError(err.response?.data?.detail || 'Erreur lors de la création'),
  })

  function resetForm() {
    setName('')
    setStartDate('')
    setEndDate('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    createMutation.mutate({ name, start_date: startDate, end_date: endDate || null })
  }

  const columns: DataTableColumn<Campagne>[] = [
    {
      key: 'name',
      header: 'Campagne',
      render: (c) => <span className="text-[12.5px] font-bold">{c.name}</span>,
    },
    {
      key: 'start_date',
      header: 'Début',
      render: (c) => (
        <span className="font-mono text-[11.5px] font-medium text-[#3a3a30]">{c.start_date}</span>
      ),
    },
    {
      key: 'end_date',
      header: 'Fin',
      render: (c) =>
        c.end_date ? (
          <span className="font-mono text-[11.5px] font-medium text-[#3a3a30]">{c.end_date}</span>
        ) : (
          <span className="font-mono text-[11.5px] font-medium text-ifvm-text-weak">—</span>
        ),
    },
    {
      key: 'prospections',
      header: 'Prospections',
      align: 'right',
      mono: true,
      // Un « ? » plutôt qu'un 0 trompeur si le comptage n'a pas pu être chargé.
      render: (c) =>
        prospectionsIndisponibles ? (
          <span className="text-ifvm-text-weak">?</span>
        ) : (
          (prospectionsParCampagne.get(c.id) ?? 0)
        ),
    },
    {
      key: 'traitements',
      header: 'Traitements',
      align: 'right',
      mono: true,
      render: (c) =>
        traitementsIncertains ? (
          <span className="text-ifvm-text-weak">?</span>
        ) : (
          (traitementsParCampagne.get(c.id) ?? 0)
        ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (c) => {
        const statut = statutCampagne(c, jour)
        return (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-[9px] py-[3px] font-sans text-[10px] font-bold',
              STATUT_CLASSES[statut],
            )}
          >
            {STATUT_LABELS[statut]}
          </span>
        )
      },
    },
  ]

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-[640px] font-sans text-[12.5px] font-medium text-ifvm-text-tertiary">
          Une campagne cadre les prospections et les traitements sur une période. Une seule campagne
          est active à la fois ; la clôture verrouille les fiches rattachées.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className={`${addButtonClass} shrink-0 transition hover:bg-[#1a4429]`}
        >
          + Nouvelle campagne
        </button>
      </div>

      {isError ? (
        <ErrorBanner
          label={errorStatus ? `Erreur ${errorStatus}` : 'Erreur'}
          message={errorDetail ?? 'Impossible de charger les campagnes.'}
        />
      ) : (
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <DataTable
            columns={columns}
            rows={campagnes}
            getRowKey={(c) => c.id}
            emptyMessage={isLoading ? 'Chargement…' : 'Aucune campagne enregistrée.'}
          />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-card shadow-xl">
            <div className="border-b border-[#f4efe2] px-6 py-4">
              <h2 className="font-sans text-[15px] font-extrabold">Nouvelle campagne</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
              {error && <ErrorBanner label="Création impossible" message={error} />}
              <div>
                <label
                  htmlFor="campagne-nom"
                  className="mb-1 block font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
                >
                  Nom *
                </label>
                <input
                  id="campagne-nom"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-[8px] border border-[#e7e0cd] px-3 py-2 font-sans text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ifvm-green-text"
                />
              </div>
              <div>
                <label
                  htmlFor="campagne-debut"
                  className="mb-1 block font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
                >
                  Date de début *
                </label>
                <input
                  id="campagne-debut"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full rounded-[8px] border border-[#e7e0cd] px-3 py-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-ifvm-green-text"
                />
              </div>
              <div>
                <label
                  htmlFor="campagne-fin"
                  className="mb-1 block font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
                >
                  Date de fin
                </label>
                <input
                  id="campagne-fin"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-[8px] border border-[#e7e0cd] px-3 py-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-ifvm-green-text"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className={`${addButtonClass} transition hover:bg-[#1a4429] disabled:opacity-50`}
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition hover:bg-background"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
