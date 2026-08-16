import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FilterChip } from '@/components/ui/filter-chip'
import { useAnnuaire, type Utilisateur } from '@/lib/use-annuaire'

/**
 * Maquette §4 du handoff (`data-screen-label="Nouvelle prospection"`).
 *
 * L'écran ne crée que l'**en-tête de fiche** : la saisie terrain complète
 * (captures, végétation, GPS) se fait sur mobile hors-ligne. L'assistant web
 * multi-étapes qui occupait ce fichier a été retiré avec ce lot (#126).
 */

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
}

interface Station {
  id: string
  code: string
  nom: string
  pa_code: string
}

interface ProspectionBrouillon {
  id: string
  prospecteur_id: string
  statut: string
}

const TYPES = [
  { value: 'intensive' as const, label: 'Intensive' },
  { value: 'extensive' as const, label: 'Extensive' },
]

const SECTIONS_TERRAIN = [
  'A · Référence & localisation GPS',
  'B · Locusta migratoria (compteur)',
  'C · Nomadacris septemfasciata',
  'D · Infestation & surface',
  'E · Végétation & sol',
]

/** Sur-titre de champ du handoff : `600 9.5px` uppercase, interlettrage .8px. */
function ChampLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label
      htmlFor={htmlFor}
      className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak"
    >
      {children}
    </Label>
  )
}

// `Select` de shadcn est un composant Radix sans élément natif : il ne se prête
// pas au `<label for>` ni au `fireEvent.change` des tests. Les deux listes de
// cet écran restent donc des `<select>` natifs, stylés sur les tokens du handoff.
const CHAMP_CLASSES =
  'h-[38px] rounded-[8px] border border-[#e0d9c4] bg-[#fffdf8] px-3 font-sans text-[12.5px] font-semibold text-foreground'

export function NouvelleProspectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [campagneId, setCampagneId] = useState('')
  const [type, setType] = useState<'intensive' | 'extensive'>('intensive')
  const [dateProspection, setDateProspection] = useState(new Date().toISOString().slice(0, 10))
  const [stationId, setStationId] = useState('')
  const [localite, setLocalite] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const { data: moi } = useQuery<Utilisateur>({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  })

  const { utilisateurs } = useAnnuaire()

  const { data: prospections = [] } = useQuery<ProspectionBrouillon[]>({
    queryKey: ['prospections'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })

  // La maquette affecte la fiche à un agent, mais POST /prospections force
  // `prospecteur_id = current_user.id` : le seul prospecteur possible est
  // l'utilisateur connecté, les autres pastilles restent inertes.
  const agents = useMemo(() => {
    if (!moi) return []
    const autres = utilisateurs.filter((u) => u.id !== moi.id && u.role === 'prospecteur')
    return [moi, ...autres]
  }, [moi, utilisateurs])

  const fileAgent = useMemo(
    () =>
      prospections.filter((p) => p.prospecteur_id === moi?.id && p.statut === 'brouillon').length,
    [prospections, moi],
  )

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/prospections', body).then((r) => r.data),
    onSuccess: (fiche: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['prospections'] })
      navigate(`/prospections/${fiche.id}`)
    },
    onError: () => setErreur("La création a échoué. Réessayez ou prévenez l'administrateur."),
  })

  function handleCreate() {
    if (!campagneId) {
      setErreur('Sélectionnez une campagne.')
      return
    }
    if (!dateProspection) {
      setErreur('Renseignez la date de prospection.')
      return
    }
    setErreur(null)
    mutation.mutate({
      type_prospection: type,
      campagne_id: campagneId,
      date_prospection: dateProspection,
      station_id: stationId || null,
      commune: localite || null,
      statut: 'brouillon',
    })
  }

  return (
    // Grille de la maquette : 1fr (formulaire) / 320px (encarts de contexte).
    <div className="grid grid-cols-1 items-start gap-5 px-7 pb-10 pt-[26px] lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <p className="rounded-[10px] border border-ifvm-amber-border bg-ifvm-amber-bg px-4 py-[13px] font-sans text-[12px] font-medium leading-[1.55] text-ifvm-amber-text">
          La saisie terrain complète (captures, végétation, GPS) se fait sur mobile hors-ligne.
          Cette page crée l’<b>en-tête de fiche</b> et l’assigne à un agent : elle apparaît ensuite
          dans sa file de travail.
        </p>

        <section className="flex flex-col gap-[18px] rounded-[11px] border border-[#e7e0cd] bg-card px-[22px] py-5">
          <h2 className="font-sans text-[14px] font-bold">Références</h2>

          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
            <div className="flex flex-col gap-[6px]">
              <ChampLabel htmlFor="np-campagne">Campagne *</ChampLabel>
              <select
                id="np-campagne"
                value={campagneId}
                onChange={(e) => setCampagneId(e.target.value)}
                className={CHAMP_CLASSES}
              >
                <option value="">Sélectionner…</option>
                {campagnes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-[6px]">
              <ChampLabel>Type de prospection *</ChampLabel>
              <div className="flex gap-[6px]">
                {TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                    className={cn(
                      'h-[38px] flex-1 rounded-[8px] font-sans text-[12px]',
                      type === value
                        ? 'bg-ifvm-green-text font-bold text-white'
                        : 'border border-[#e0d9c4] bg-background font-semibold text-ifvm-text-tertiary',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <ChampLabel htmlFor="np-date">Date de prospection *</ChampLabel>
              <Input
                id="np-date"
                type="date"
                value={dateProspection}
                onChange={(e) => setDateProspection(e.target.value)}
                className={cn(CHAMP_CLASSES, 'font-mono')}
              />
            </div>

            <div className="flex flex-col gap-[6px]">
              <ChampLabel>N° de fiche (auto)</ChampLabel>
              <div className="flex h-[38px] items-center rounded-[8px] border border-dashed border-[#e0d9c4] bg-background px-3 font-mono text-[12.5px] font-semibold text-ifvm-text-weak">
                généré à l’enregistrement
              </div>
            </div>
          </div>

          <div className="h-px bg-[#f1ecdd]" />
          <h2 className="font-sans text-[14px] font-bold">Affectation</h2>

          <div className="flex flex-col gap-2">
            <ChampLabel>Prospecteur * — référentiel utilisateurs</ChampLabel>
            <div className="flex flex-wrap gap-[6px]">
              {agents.map((a) =>
                a.id === moi?.id ? (
                  <FilterChip key={a.id} label={a.nom} active onClick={() => {}} />
                ) : (
                  <button
                    key={a.id}
                    type="button"
                    aria-disabled
                    className="cursor-not-allowed rounded-[8px] border border-[#e0d9c4] bg-background px-[13px] py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-weak"
                  >
                    {a.nom}
                  </button>
                ),
              )}
            </div>
            <p className="font-sans text-[10.5px] font-medium leading-[1.5] text-ifvm-text-weak">
              L’affectation à un autre agent demande une évolution backend :{' '}
              <code className="font-mono">POST /prospections</code> force le prospecteur au
              créateur de la fiche.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
            <div className="flex flex-col gap-[6px]">
              <ChampLabel htmlFor="np-station">Station / zone d’appartenance</ChampLabel>
              <select
                id="np-station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className={CHAMP_CLASSES}
              >
                <option value="">Aucune</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-[6px]">
              <ChampLabel htmlFor="np-localite">Localité</ChampLabel>
              <Input
                id="np-localite"
                type="text"
                value={localite}
                onChange={(e) => setLocalite(e.target.value)}
                className={CHAMP_CLASSES}
              />
            </div>
          </div>

          {erreur && (
            <p role="alert" className="font-sans text-[11.5px] font-semibold text-ifvm-danger-text">
              {erreur}
            </p>
          )}

          <div className="flex items-center gap-[10px] pt-1">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={mutation.isPending}
              className="h-auto rounded-[9px] bg-ifvm-green-text px-5 py-[11px] font-sans text-[12.5px] font-bold text-white"
            >
              {mutation.isPending ? 'Création…' : 'Créer et assigner'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/prospections')}
              className="h-auto rounded-[9px] border-[#e0d9c4] px-[18px] py-[11px] font-sans text-[12.5px] font-semibold text-ifvm-text-tertiary"
            >
              Annuler
            </Button>
          </div>
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-[14px]">
        <section className="rounded-[11px] border border-ifvm-green-border bg-ifvm-green-bg px-[18px] py-4">
          <h2 className="mb-2 font-sans text-[12.5px] font-bold text-ifvm-green-text">
            Ce qui est rempli sur le terrain
          </h2>
          <ul className="flex flex-col gap-[7px]">
            {SECTIONS_TERRAIN.map((s) => (
              <li key={s} className="font-sans text-[11.5px] font-medium leading-[1.4] text-[#3a5c43]">
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[11px] border border-[#e7e0cd] bg-card px-[18px] py-4">
          <h2 className="mb-2 font-sans text-[12.5px] font-bold">File de l’agent sélectionné</h2>
          <p className="font-mono text-[22px] font-semibold text-foreground">{fileAgent}</p>
          <p className="font-sans text-[11.5px] font-medium leading-[1.5] text-ifvm-text-tertiary">
            fiches ouvertes non synchronisées. Au-delà de 5, prévenir le chef de zone.
          </p>
        </section>
      </aside>
    </div>
  )
}
