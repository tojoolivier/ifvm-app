import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Utilisateur } from '../types'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { FilterChip } from '@/components/ui/filter-chip'
import { ErrorBanner } from '@/components/ui/error-banner'
import { cn } from '@/lib/utils'
import {
  AXES_GROUPEMENT,
  buildAgregats,
  buildCouvertureTraitement,
  buildProspectionsCsv,
  definitionAxe,
  filterProspectionsForSynthese,
  filterTraitementsForSynthese,
  type AgregatLigne,
  type AxeGroupement,
  type CouvertureZone,
  type SyntheseProspection,
  type SyntheseTraitement,
} from '@/lib/prospection-syntheses'

interface Station {
  id: string
  code: string
  nom: string
}

/** Formatage `12 480` de la maquette : espace insécable fine comme en typographie FR. */
const nombreFr = new Intl.NumberFormat('fr-FR')

function fmtEntier(value: number): string {
  return nombreFr.format(Math.round(value))
}

function fmtDensite(value: number | null): string {
  return value === null ? '—' : nombreFr.format(Math.round(value))
}

/**
 * Ton des barres de couverture — prototype ligne 1503 : vert au-dessus de 60 %,
 * ambre entre 40 et 60 %, rouge en dessous (82/64 verts, 41 ambre, 23 rouge).
 */
function tonCouverture(pct: number): string {
  if (pct >= 60) return 'bg-ifvm-green-text'
  if (pct >= 40) return 'bg-ifvm-amber'
  return 'bg-ifvm-danger'
}

function telechargerCsv(csv: string, filename: string) {
  // BOM UTF‑8 : sans lui Excel lit les accents en Latin‑1 (encart §9 de la maquette).
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function estAxe(value: string | null): value is AxeGroupement {
  return AXES_GROUPEMENT.some((a) => a.axe === value)
}

export function SynthesesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const dateDebut = searchParams.get('debut') ?? ''
  const dateFin = searchParams.get('fin') ?? ''
  const axeParam = searchParams.get('groupe')
  const axe: AxeGroupement = estAxe(axeParam) ? axeParam : 'espece'

  function setFiltre(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  const {
    data: prospectionsData = [],
    isLoading,
    isError,
    error,
  } = useQuery<SyntheseProspection[]>({
    queryKey: ['prospections', 'all'],
    queryFn: () => api.get('/prospections').then((r) => r.data),
  })
  // Identité stable : sans `useMemo`, le `[]` de repli serait un nouveau
  // tableau à chaque rendu et invaliderait tous les agrégats en aval.
  const prospections = useMemo(
    () => (Array.isArray(prospectionsData) ? prospectionsData : []),
    [prospectionsData],
  )

  // La couverture croise prospections et traitements : si les traitements sont
  // indisponibles, la carte le dit au lieu d'afficher 0 % partout.
  const { data: traitementsData = [], isError: couvertureIndisponible } = useQuery<
    SyntheseTraitement[]
  >({
    queryKey: ['traitements', 'all'],
    queryFn: () => api.get('/traitements').then((r) => r.data),
  })
  const traitements = useMemo(
    () => (Array.isArray(traitementsData) ? traitementsData : []),
    [traitementsData],
  )

  const { data: stationsData = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const { data: usersData = [] } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })

  const libelles = useMemo(() => {
    const station: Record<string, string> = {}
    for (const s of Array.isArray(stationsData) ? stationsData : []) {
      station[s.id] = `${s.code} — ${s.nom}`
    }
    const prospecteur: Record<string, string> = {}
    for (const u of Array.isArray(usersData) ? usersData : []) {
      prospecteur[u.id] = `${u.prenom} ${u.nom}`.trim()
    }
    return { station, prospecteur }
  }, [stationsData, usersData])

  // Une seule période, appliquée aux deux jeux : le numérateur et le
  // dénominateur de la couverture doivent porter sur la même fenêtre.
  const periode = useMemo(() => ({ dateDebut, dateFin }), [dateDebut, dateFin])

  const filtered = useMemo(
    () => filterProspectionsForSynthese(prospections, periode),
    [prospections, periode],
  )

  const traitementsPeriode = useMemo(
    () => filterTraitementsForSynthese(traitements, periode),
    [traitements, periode],
  )

  const agregats = useMemo(
    () => buildAgregats(filtered, axe, libelles),
    [filtered, axe, libelles],
  )

  const couverture = useMemo(
    () => buildCouvertureTraitement(filtered, traitementsPeriode),
    [filtered, traitementsPeriode],
  )

  const def = definitionAxe(axe)

  const colonnes: DataTableColumn<AgregatLigne>[] = [
    {
      key: 'label',
      header: def.colonne,
      // L'espèce est en italique dans la maquette (nom scientifique) ; une
      // station ou un agent ne l'est pas.
      render: (l) => <span className={cn(def.italique && 'italic')}>{l.label}</span>,
    },
    { key: 'fiches', header: 'Fiches', align: 'right', mono: true, render: (l) => fmtEntier(l.nbFiches) },
    {
      key: 'individus',
      header: 'Individus',
      align: 'right',
      mono: true,
      render: (l) => fmtEntier(l.individus),
    },
    {
      key: 'densite',
      header: 'Densité moy.',
      align: 'right',
      mono: true,
      render: (l) => fmtDensite(l.densiteMoyenne),
    },
    {
      key: 'surface',
      header: 'Surf. inf. (ha)',
      align: 'right',
      mono: true,
      render: (l) => (
        <span className="text-ifvm-green-text">{fmtEntier(l.surfaceInfestee)}</span>
      ),
    },
  ]

  function handleExportCsv() {
    telechargerCsv(
      buildProspectionsCsv(filtered, libelles),
      `syntheses-prospections-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const errorDetail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px] print:px-0 print:pt-0">
      {/* Barre de filtres — maquette §9 : période, groupement, exports à droite */}
      <div className="flex flex-wrap items-end gap-[14px] rounded-[11px] border border-[#e7e0cd] bg-card px-[18px] py-4 print:hidden">
        <fieldset className="flex flex-col gap-[6px]">
          <legend className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
            Période
          </legend>
          <div className="flex h-9 items-center gap-2 rounded-[8px] border border-[#e0d9c4] bg-[#fffdf8] px-[11px]">
            <input
              type="date"
              aria-label="Début de période"
              value={dateDebut}
              onChange={(e) => setFiltre('debut', e.target.value)}
              className="bg-transparent font-mono text-[12px] font-semibold outline-none"
            />
            <span aria-hidden className="text-ifvm-text-weak">
              →
            </span>
            <input
              type="date"
              aria-label="Fin de période"
              value={dateFin}
              onChange={(e) => setFiltre('fin', e.target.value)}
              className="bg-transparent font-mono text-[12px] font-semibold outline-none"
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-[6px]">
          <legend className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
            Groupement
          </legend>
          <div className="flex gap-[5px]">
            {AXES_GROUPEMENT.map((a) => (
              <FilterChip
                key={a.axe}
                label={a.label}
                active={axe === a.axe}
                onClick={() => setFiltre('groupe', a.axe)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex-1" />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="rounded-[9px] border border-[#e0d9c4] bg-card px-4 py-[10px] font-sans text-[12px] font-bold text-foreground disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={filtered.length === 0}
            className="rounded-[9px] bg-ifvm-green-text px-4 py-[10px] font-sans text-[12px] font-bold text-white disabled:opacity-50"
          >
            Export rapport PDF
          </button>
        </div>
      </div>

      {isError && (
        <ErrorBanner
          label="Synthèses indisponibles"
          message={errorDetail ?? 'Impossible de charger les fiches de prospection.'}
        />
      )}

      {/* Grille 1.4fr / 1fr de la maquette */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-card">
          <div className="border-b border-[#f1ecdd] px-5 py-[15px] font-sans text-[14px] font-bold">
            Agrégats par {def.label.toLowerCase()}
          </div>
          <DataTable
            columns={colonnes}
            rows={agregats}
            getRowKey={(l) => l.cle}
            emptyMessage={isLoading ? 'Chargement…' : 'Aucune fiche sur la période.'}
          />
          {def.multiGroupe && agregats.length > 0 && (
            // Sans cette note, un lecteur additionnerait la colonne et
            // obtiendrait une surface supérieure à la surface réelle.
            <p className="border-t border-[#f4efe2] px-5 py-3 font-sans text-[10.5px] text-ifvm-text-weak">
              Une fiche portant plusieurs espèces voit sa surface infestée comptée sur chaque
              ligne : cette colonne ne s'additionne pas en un total de terrain.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <CarteCouverture zones={couverture} indisponible={couvertureIndisponible} />

          {/* Encart « Contenu de l'export » — maquette §9 */}
          <div className="rounded-[11px] border border-ifvm-green-border bg-ifvm-green-bg px-[18px] py-4">
            <div className="mb-2 font-sans text-[12.5px] font-bold text-ifvm-green-text">
              Contenu de l'export
            </div>
            <p className="font-sans text-[11.5px] font-medium leading-[1.6] text-[#3a5c43]">
              Une ligne par fiche : références, localisation, captures agrégées, surfaces et statut.
              Encodage UTF‑8 avec BOM, séparateur «&nbsp;;&nbsp;» pour Excel.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Carte « Couverture du traitement » : barres 6px, rayon 4px, piste `#f1ecdd`. */
function CarteCouverture({
  zones,
  indisponible,
}: {
  zones: CouvertureZone[]
  indisponible: boolean
}) {
  return (
    <div className="rounded-[11px] border border-[#e7e0cd] bg-card px-5 py-[18px]">
      <div className="mb-3 font-sans text-[13px] font-bold">Couverture du traitement</div>
      {indisponible ? (
        <p className="font-sans text-[11.5px] text-ifvm-text-weak">
          Traitements indisponibles — couverture non calculable.
        </p>
      ) : zones.length === 0 ? (
        <p className="font-sans text-[11.5px] text-ifvm-text-weak">
          Aucune surface infestée relevée sur la période.
        </p>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {zones.map((z) => (
            <div key={z.zone} className="flex flex-col gap-[5px]">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary">
                  {z.zone}
                </span>
                <span className="font-mono text-[11.5px] font-semibold">{z.pct}%</span>
              </div>
              <div
                role="meter"
                aria-label={`Couverture ${z.zone}`}
                aria-valuenow={z.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-[6px] overflow-hidden rounded-[4px] bg-[#f1ecdd]"
              >
                <div className={cn('h-full', tonCouverture(z.pct))} style={{ width: `${z.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
