import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { NavTabs } from '@/components/ui/nav-tabs'
import { PILL_TONES, Pill } from '@/components/ui/pill'
import { MODE_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/lib/traitement-labels'
import {
  compteurSignatures,
  formatSurface,
  responsableTraitement,
} from '@/lib/traitement-fiche'

interface Traitement {
  id: string
  numero_fiche: string
  type_traitement: string
  mode_traitement: string | null
  date_traitement: string
  localite: string
  statut: string
  // `pilote` : champ legacy, plus jamais renvoyé par l'API depuis le passage à
  // pilote_id (migration 0047) — conservé ici uniquement parce que
  // `responsableTraitement` (traitement-fiche.ts) l'attend encore dans son
  // repli sans chef signataire ; ce repli est mort en pratique (bug préexistant,
  // hors périmètre de cette modification).
  aerien: {
    pilote: string
    surface_traitee_ha: number | null
    surface_restante_ha: number | null
  } | null
  terrestre: { surface_traitee_ha: number | null; surface_restante_ha: number | null } | null
  signatures: { role: string; signataire_nom: string }[]
}

/**
 * Badge « Type » — prototype ligne 1461 : l'aérien est **bleu**, le terrestre
 * **vert**. L'implémentation précédente avait les deux tons inversés.
 */
function TypeBadge({ type }: { type: string }) {
  return (
    <Pill tone={type === 'AERIEN' ? PILL_TONES.aerien : PILL_TONES.terrestre}>
      {TYPE_LABELS[type] ?? type}
    </Pill>
  )
}

export function TraitementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // La maquette ne dessine aucune barre de filtres sur cet écran. Les filtres
  // restent portés par l'URL : `/traitements?prospection_id=…` est le lien
  // émis par la fiche de prospection, il doit continuer de fonctionner.
  const filtreType = searchParams.get('type_traitement') ?? ''
  const filtreReprenable = searchParams.get('reprenable') ?? ''
  const filtreProspectionId = searchParams.get('prospection_id') ?? ''

  const { data: traitements = [], isLoading, isError, error } = useQuery<Traitement[]>({
    queryKey: ['traitements', filtreType, filtreReprenable, filtreProspectionId],
    queryFn: () =>
      api
        .get('/traitements', {
          params: {
            type_traitement: filtreType || undefined,
            reprenable: filtreReprenable || undefined,
            prospection_id: filtreProspectionId || undefined,
          },
        })
        .then((r) => r.data),
  })

  const errorStatus = (error as { response?: { status?: number } })?.response?.status
  const errorDetail = (error as { response?: { data?: { detail?: string } } })?.response?.data
    ?.detail
  const errorLabel = errorStatus ? STATUS_LABELS[errorStatus] ?? `Erreur ${errorStatus}` : 'Erreur'
  const errorMessage = errorDetail ?? 'Impossible de charger les traitements.'

  const columns: DataTableColumn<Traitement>[] = [
    {
      key: 'numero_fiche',
      header: 'N° de fiche',
      render: (t) => (
        <span className="font-mono text-[11.5px] font-semibold text-ifvm-green-text">
          {t.numero_fiche}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (t) => <TypeBadge type={t.type_traitement} /> },
    {
      key: 'mode',
      header: 'Mode',
      render: (t) => (
        <span className="text-ifvm-text-tertiary">
          {t.mode_traitement ? MODE_LABELS[t.mode_traitement] ?? t.mode_traitement : '—'}
        </span>
      ),
    },
    { key: 'date', header: 'Date', mono: true, render: (t) => t.date_traitement },
    { key: 'responsable', header: 'Responsable', render: responsableTraitement },
    {
      key: 'traitee',
      header: 'Traitée (ha)',
      align: 'right',
      mono: true,
      render: (t) => formatSurface(t.terrestre?.surface_traitee_ha ?? t.aerien?.surface_traitee_ha),
    },
    {
      key: 'restante',
      header: 'Restante',
      align: 'right',
      mono: true,
      // Ambre dès qu'il reste de la surface — c'est le signal « fiche
      // reprenable » de la maquette (prototype : `restColor`). Le chaînage de
      // reprise (migration 0050) couvre désormais aussi l'Aérien : chaque
      // fiche n'a qu'une seule des deux spécialisations renseignée.
      render: (t) => {
        const restante = t.terrestre?.surface_restante_ha ?? t.aerien?.surface_restante_ha
        const enAlerte = restante != null && Number(restante) > 0
        return (
          <span className={enAlerte ? 'text-ifvm-amber-text' : 'text-[#16201a]'}>
            {formatSurface(restante)}
          </span>
        )
      },
    },
    {
      key: 'signatures',
      header: 'Signatures',
      mono: true,
      render: (t) => {
        const compteur = compteurSignatures(t.signatures)
        return (
          <span className={compteur.complet ? 'text-ifvm-green-text' : 'text-ifvm-amber-text'}>
            {compteur.libelle}
          </span>
        )
      },
    },
    {
      key: 'ouvrir',
      header: '',
      align: 'right',
      render: () => (
        <span className="font-sans text-[11px] font-semibold text-ifvm-green-text">Ouvrir ›</span>
      ),
    },
  ]

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <div className="flex items-center gap-2">
        <NavTabs
          ariaLabel="Vues des traitements"
          items={[{ label: 'Liste des fiches', to: '/traitements', active: true }]}
        />
        <div className="flex-1" />
        <p className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
          Chaque fiche est rattachée à une prospection validée
        </p>
      </div>

      {filtreProspectionId && (
        <div className="flex items-center gap-[10px]">
          <span className="font-sans text-[12px] font-medium text-ifvm-text-weak">
            Fiches de la prospection{' '}
            <span className="font-mono text-ifvm-text-tertiary">{filtreProspectionId}</span>
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="rounded-[8px] border border-ifvm-brouillon-border bg-card px-[10px] py-1 font-sans text-[11px] font-semibold text-ifvm-text-tertiary"
          >
            Voir toutes les fiches
          </button>
        </div>
      )}

      {isError ? (
        <ErrorBanner label={errorLabel} message={errorMessage} />
      ) : (
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <DataTable
            columns={columns}
            rows={traitements}
            getRowKey={(t) => t.id}
            onRowClick={(t) => navigate(`/traitements/${t.id}`)}
            emptyMessage={isLoading ? 'Chargement…' : 'Aucun traitement trouvé.'}
          />
        </div>
      )}
    </div>
  )
}
