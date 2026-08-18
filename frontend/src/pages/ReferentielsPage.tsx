import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Switch } from '@/components/ui/switch'

/**
 * Écran Référentiels — docs/design_handoff_web/README.md §11.
 *
 * Grille `216px 1fr` : colonne gauche de 7 cartes de navigation, colonne droite
 * carte d'en-tête + carte « Enregistrements » + grille `1fr 320px` (panneau
 * Modifier / panneau Fraîcheur terrain).
 *
 * Périmètre volontairement en lecture seule (#124) : le backend n'expose aucune
 * écriture pour pesticide, culture, code_stade, utilisateur_equipe,
 * poste_acridien et station_fixe. Les affordances d'écriture de la maquette sont
 * rendues mais désactivées, avec l'état API réel affiché en pastille — la
 * consigne du handoff est de ne pas masquer ces écarts.
 */

type Row = Record<string, unknown>

interface EntityPull {
  upserts: Row[]
  server_time: string
}

interface ReferentielPullResponse {
  postes_acridiens: EntityPull
  stations_fixes: EntityPull
  utilisateurs_equipe: EntityPull
  pesticides: EntityPull
  cultures: EntityPull
  codes_stades: EntityPull
  campagnes: EntityPull
}

type PullKey = keyof ReferentielPullResponse

interface FieldSpec {
  label: string
  mono?: boolean
  hint?: string
  value: (row: Row) => string
}

interface EntitySpec {
  key: string
  /** Clé correspondante dans le payload `GET /referentiel/pull`. */
  pullKey: PullKey
  label: string
  /** Nom de table affiché en mono sous le libellé. */
  table: string
  addLabel: string
  /** Une écriture existe-t-elle réellement côté backend ? Pilote la pastille. */
  apiOk: boolean
  apiLabel: string
  desc: string
  /** Encart ambre signalant un écart backend — vide si aucun. */
  note?: string
  /** Route existante vers laquelle renvoyer l'ajout, quand un CRUD est déjà livré ailleurs. */
  addRoute?: string
  /** `campagne` n'a pas de colonne `actif` en base. */
  hasActif: boolean
  /**
   * Identifiant lisible de la ligne sélectionnée, affiché sous « Modifier ».
   * La maquette y met la valeur de la première colonne — ce n'est donc pas
   * toujours `code` (utilisateur et campagne n'en ont pas).
   */
  rowLabel: (row: Row) => string
  columns: DataTableColumn<Row>[]
  fields: FieldSpec[]
}

const GREEN_CODE = 'text-[#235a36]'

/**
 * Les interrupteurs de cet écran affichent `actif` sans le piloter (aucune route
 * d'écriture). On neutralise l'estompage `disabled` du composant : actif/inactif
 * est une information métier qui doit rester lisible, comme dans la maquette.
 */
const READONLY_SWITCH = 'pointer-events-none data-[disabled]:opacity-100'

/**
 * Affordance d'écriture présente dans la maquette mais sans route backend.
 * `aria-disabled` plutôt que `disabled` : l'état reste annoncé et le bouton
 * atteignable au clavier, sans délaver les couleurs pleines de la maquette —
 * l'indisponibilité est déjà portée par la pastille « à créer » et le `title`.
 */
const UNAVAILABLE = 'cursor-not-allowed'

function noop(event: React.MouseEvent) {
  event.preventDefault()
}

function text(row: Row, key: string): string {
  const value = row[key]
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function formatDateTime(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR')
}

function codeColumn(header = 'Code'): DataTableColumn<Row> {
  return {
    key: 'code',
    header,
    mono: true,
    render: (row) => <span className={GREEN_CODE}>{text(row, 'code')}</span>,
  }
}

/**
 * Ordre et contenu repris de la maquette (`REF_ORDER`). Les colonnes et champs
 * n'affichent que ce que le backend fournit réellement ; les deux écarts
 * signalés par le handoff (matière active / dose de référence) restent visibles
 * en « — » avec le hint, plutôt que d'être masqués.
 */
const ENTITES: EntitySpec[] = [
  {
    key: 'pesticide',
    pullKey: 'pesticides',
    label: 'Pesticides',
    table: 'pesticide',
    addLabel: '+ Nouveau pesticide',
    apiOk: false,
    apiLabel: 'Écriture à créer — pull hors-ligne seulement',
    desc: 'Alimente les chips « Produit » des rotations aériennes et des produits utilisés en terrestre.',
    note: "La matière active affichée sur la fiche de traitement n'existe pas en base : la table pesticide ne porte que code, nom et actif. À ajouter comme colonne ou à retirer de l'UI.",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom commercial', render: (row) => text(row, 'nom') },
      { key: 'ma', header: 'Matière active', render: () => <span className="text-[#bdb6a2]">—</span> },
      {
        key: 'dose',
        header: 'Dose de référence',
        align: 'right',
        mono: true,
        render: () => <span className="text-[#bdb6a2]">—</span>,
      },
    ],
    fields: [
      { label: 'Code *', mono: true, value: (row) => text(row, 'code') },
      { label: 'Nom commercial *', value: (row) => text(row, 'nom') },
      { label: 'Matière active', hint: 'colonne absente en base', value: () => '—' },
      { label: 'Dose de référence (l/ha)', mono: true, hint: 'colonne absente en base', value: () => '—' },
    ],
  },
  {
    key: 'culture',
    pullKey: 'cultures',
    label: 'Cultures',
    table: 'culture',
    addLabel: '+ Nouvelle culture',
    apiOk: false,
    apiLabel: 'Écriture à créer — référentiel non lu par le mobile',
    desc: "Doit alimenter les dégâts sur culture (prospection) et les zones exposées (traitement), aujourd'hui codés en dur.",
    note: "Synchronisée dans le SQLite du terrain mais aucune fonction de lecture : listCultures() n'existe pas dans referentiel-db.ts.",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [codeColumn(), { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom') }],
    fields: [
      { label: 'Code *', mono: true, value: (row) => text(row, 'code') },
      { label: 'Nom *', value: (row) => text(row, 'nom') },
    ],
  },
  {
    key: 'code_stade',
    pullKey: 'codes_stades',
    label: 'Codes stades',
    table: 'code_stade',
    addLabel: '+ Nouveau code stade',
    apiOk: false,
    apiLabel: 'Écriture à créer — référentiel non lu par le mobile',
    desc: 'Doit alimenter le stade dominant (infestation larvaire) et les phases du compteur de captures.',
    note: 'Synchronisée dans le SQLite du terrain mais aucune fonction de lecture : les phases et stades restent des constantes dans le code mobile.',
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      {
        key: 'espece',
        header: 'Espèce',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'espece')}</span>,
      },
      { key: 'libelle', header: 'Libellé', render: (row) => text(row, 'libelle') },
    ],
    fields: [
      { label: 'Code *', mono: true, value: (row) => text(row, 'code') },
      { label: 'Espèce *', value: (row) => text(row, 'espece') },
      { label: 'Libellé *', value: (row) => text(row, 'libelle') },
    ],
  },
  {
    key: 'poste_acridien',
    pullKey: 'postes_acridiens',
    label: 'Postes acridiens',
    table: 'poste_acridien',
    addLabel: '+ Nouveau poste acridien',
    apiOk: true,
    apiLabel: 'GET /postes-acridiens — écriture à créer',
    desc: 'Niveau supérieur de la hiérarchie géographique : chaque station fixe et chaque agent y sont rattachés.',
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom') },
      {
        key: 'region',
        header: 'Région',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'region')}</span>,
      },
    ],
    fields: [
      { label: 'Code *', mono: true, value: (row) => text(row, 'code') },
      { label: 'Nom *', value: (row) => text(row, 'nom') },
      { label: 'Région *', value: (row) => text(row, 'region') },
    ],
  },
  {
    key: 'station_fixe',
    pullKey: 'stations_fixes',
    label: 'Stations fixes',
    table: 'station_fixe',
    addLabel: '+ Nouvelle station',
    apiOk: false,
    apiLabel: 'GET seulement — POST / PUT / DELETE appelés par le web mais absents du serveur',
    desc: 'Point de référence des prospections : code, nom, poste acridien de rattachement et coordonnées.',
    note: 'Écart bloquant : StationPage.tsx appelle POST /stations, PUT /stations/{id} et DELETE /stations/{id}, qui ne sont pas exposés par referentiel_routes.py. Préférer une désactivation (actif=false) à la suppression, une station étant référencée par des prospections.',
    addRoute: '/stations',
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom') },
      {
        key: 'coord',
        header: 'Coordonnées',
        mono: true,
        render: (row) =>
          typeof row.latitude === 'number' && typeof row.longitude === 'number'
            ? `${row.latitude.toFixed(4)} · ${row.longitude.toFixed(4)}`
            : '—',
      },
    ],
    fields: [
      { label: 'Code *', mono: true, value: (row) => text(row, 'code') },
      { label: 'Nom *', value: (row) => text(row, 'nom') },
      {
        label: 'Latitude · longitude',
        mono: true,
        value: (row) =>
          typeof row.latitude === 'number' && typeof row.longitude === 'number'
            ? `${row.latitude.toFixed(4)} · ${row.longitude.toFixed(4)}`
            : '—',
      },
      {
        label: 'Altitude',
        mono: true,
        value: (row) => (typeof row.altitude === 'number' ? `${row.altitude} m` : '—'),
      },
    ],
  },
  {
    key: 'utilisateur',
    pullKey: 'utilisateurs_equipe',
    label: 'Utilisateurs',
    table: 'utilisateur',
    addLabel: '+ Nouvel utilisateur',
    apiOk: true,
    apiLabel: 'GET /users/ · POST /users/ · PATCH /users/{id}',
    desc: 'Agents et encadrants. Le rôle conditionne la navigation web et les rôles signataires des fiches de traitement.',
    note: "Le pull expose ces comptes sous utilisateurs_equipe : tout utilisateur authentifié reçoit la liste complète des agents. Une règle de rôle reste à poser avant d'ouvrir les écritures du référentiel.",
    addRoute: '/users',
    hasActif: true,
    rowLabel: (row) => `${text(row, 'prenom')} ${text(row, 'nom')}`.trim(),
    columns: [
      {
        key: 'nom',
        header: 'Nom',
        render: (row) => `${text(row, 'prenom')} ${text(row, 'nom')}`.replace('— ', '').trim(),
      },
      {
        key: 'email',
        header: 'Email',
        mono: true,
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'email')}</span>,
      },
      { key: 'role', header: 'Rôle', render: (row) => text(row, 'role') },
    ],
    fields: [
      { label: 'Nom complet *', value: (row) => `${text(row, 'prenom')} ${text(row, 'nom')}`.trim() },
      { label: 'Email *', mono: true, value: (row) => text(row, 'email') },
      { label: 'Rôle *', value: (row) => text(row, 'role') },
    ],
  },
  {
    key: 'campagne',
    pullKey: 'campagnes',
    label: 'Campagnes',
    table: 'campagne',
    addLabel: '+ Nouvelle campagne',
    apiOk: true,
    apiLabel: 'GET · POST · PUT · DELETE /campagnes',
    desc: 'Seul référentiel administrable de bout en bout. Cadre les prospections et les traitements sur une période.',
    addRoute: '/campagnes',
    hasActif: false,
    rowLabel: (row) => text(row, 'name'),
    columns: [
      { key: 'name', header: 'Nom', render: (row) => text(row, 'name') },
      { key: 'start_date', header: 'Début', mono: true, render: (row) => formatDate(row.start_date) },
      {
        key: 'end_date',
        header: 'Fin',
        mono: true,
        render: (row) =>
          row.end_date ? formatDate(row.end_date) : <span className="text-[#bdb6a2]">—</span>,
      },
    ],
    fields: [
      { label: 'Nom *', value: (row) => text(row, 'name') },
      { label: 'Date de début *', mono: true, value: (row) => formatDate(row.start_date) },
      { label: 'Date de fin', mono: true, value: (row) => (row.end_date ? formatDate(row.end_date) : '—') },
    ],
  },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pb-[3px] font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
      {children}
    </div>
  )
}

export function ReferentielsPage() {
  const navigate = useNavigate()
  const [selectedKey, setSelectedKey] = useState(ENTITES[0].key)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)

  const { data, isLoading } = useQuery<ReferentielPullResponse>({
    queryKey: ['referentiel-pull'],
    queryFn: () => api.get('/referentiel/pull').then((r) => r.data),
  })

  const entity = ENTITES.find((e) => e.key === selectedKey) ?? ENTITES[0]
  const rows = useMemo(() => data?.[entity.pullKey]?.upserts ?? [], [data, entity.pullKey])
  const selectedRow = rows[selectedRowIndex] ?? rows[0]
  const serverTime = data?.[entity.pullKey]?.server_time

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const trailing: DataTableColumn<Row>[] = []
    if (entity.hasActif) {
      trailing.push({
        key: 'actif',
        header: 'Actif',
        render: (row) => (
          <Switch
            checked={Boolean(row.actif)}
            disabled
            className={READONLY_SWITCH}
            aria-label={row.actif ? 'Actif' : 'Inactif'}
          />
        ),
      })
    }
    trailing.push({
      key: 'updated_at',
      header: 'Mis à jour',
      align: 'right',
      mono: true,
      render: (row) => (
        <span className="whitespace-nowrap text-ifvm-text-weak">{formatDateTime(row.updated_at)}</span>
      ),
    })
    return [...entity.columns, ...trailing]
  }, [entity])

  function selectEntity(key: string) {
    setSelectedKey(key)
    setSelectedRowIndex(0)
  }

  return (
    // Padding de contenu du handoff (README §Design tokens, « contenu 26px 28px 40px ») :
    // les 28px latéraux alignent la colonne de gauche sur le fil d'Ariane du header,
    // lui aussi à px-[28px] dans Layout.
    <div className="grid grid-cols-[216px_1fr] items-start gap-5 px-7 pb-10 pt-[26px]">
      {/* Colonne gauche — 7 cartes de navigation */}
      <nav aria-label="Référentiels" className="flex flex-col gap-[7px]">
        <SectionLabel>{`${ENTITES.length} référentiels`}</SectionLabel>
        {ENTITES.map((e) => {
          const active = e.key === entity.key
          const count = data?.[e.pullKey]?.upserts.length ?? 0
          return (
            <button
              key={e.key}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => selectEntity(e.key)}
              className={cn(
                'flex items-center gap-[9px] rounded-[10px] border-[1.5px] px-[13px] py-[11px] text-left transition-colors duration-[120ms]',
                active
                  ? 'border-[#235a36] bg-ifvm-green-bg'
                  : 'border-[#e7e0cd] bg-white hover:bg-[#faf7ef]',
              )}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[12.5px]',
                    active ? 'font-bold text-[#235a36]' : 'font-semibold text-[#3a3a30]',
                  )}
                >
                  {e.label}
                </span>
                <span className="block font-mono text-[10px] font-medium text-ifvm-text-weak">
                  {e.table}
                </span>
              </span>
              <span
                className={cn(
                  'rounded-full px-[7px] py-0.5 font-sans text-[9px] font-bold',
                  e.apiOk
                    ? 'bg-ifvm-green-bg text-ifvm-green-text'
                    : 'bg-ifvm-danger-bg text-ifvm-danger-text',
                )}
              >
                {e.apiOk ? 'API' : 'à créer'}
              </span>
              <span className="font-mono text-[11px] font-semibold text-ifvm-text-weak">{count}</span>
            </button>
          )
        })}
      </nav>

      {/* Colonne droite */}
      <div className="flex flex-col gap-[14px]">
        {/* Carte d'en-tête */}
        <div className="flex flex-col gap-[9px] rounded-[11px] border border-[#e7e0cd] bg-white px-5 py-4">
          <div className="flex items-center gap-[10px]">
            <h2 className="flex-1 font-sans text-[17px] font-extrabold">{entity.label}</h2>
            <span className="font-mono text-[11px] font-medium text-ifvm-text-weak">{entity.table}</span>
            <span
              className={cn(
                'rounded-full border px-[10px] py-1 font-sans text-[10px] font-bold',
                entity.apiOk
                  ? 'border-ifvm-green-border bg-ifvm-green-bg text-ifvm-green-text'
                  : 'border-ifvm-danger-border bg-ifvm-danger-bg text-ifvm-danger-text',
              )}
            >
              {entity.apiLabel}
            </span>
          </div>
          <p className="font-sans text-[12.5px] font-medium leading-[1.55] text-[#3a3a30]">{entity.desc}</p>
          {entity.note && (
            <p className="rounded-[9px] border border-ifvm-amber-border bg-ifvm-amber-bg px-[13px] py-[11px] font-sans text-[11.5px] font-medium leading-[1.55] text-ifvm-amber-text">
              {entity.note}
            </p>
          )}
        </div>

        {/* Carte Enregistrements */}
        <div className="overflow-hidden rounded-[11px] border border-[#e7e0cd] bg-white">
          <div className="flex items-center gap-[10px] border-b border-[#f1ecdd] px-5 py-[13px]">
            <h3 className="flex-1 font-sans text-[13px] font-bold">Enregistrements</h3>
            <button
              type="button"
              aria-disabled={entity.addRoute ? undefined : true}
              onClick={entity.addRoute ? () => navigate(entity.addRoute!) : noop}
              title={
                entity.addRoute
                  ? `Gestion complète sur ${entity.addRoute}`
                  : `${entity.apiLabel} — aucune route d'écriture exposée par le backend`
              }
              className={cn(
                'rounded-lg bg-[#235a36] px-[14px] py-2 font-sans text-[11.5px] font-bold text-white transition-colors duration-[120ms]',
                entity.addRoute ? 'hover:bg-[#1a4429]' : UNAVAILABLE,
              )}
            >
              {entity.addLabel}
            </button>
          </div>

          {isLoading ? (
            <div className="divide-y divide-[#f4efe2]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[43px] animate-pulse bg-[#faf7ef]" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => String(row.id)}
              onRowClick={(row) => setSelectedRowIndex(rows.indexOf(row))}
              rowClassName={(_, index) =>
                cn(
                  index === selectedRowIndex
                    ? 'bg-[#f7f4ea] shadow-[inset_3px_0_0_#235a36]'
                    : index % 2
                      ? 'bg-[#fffdf8]'
                      : 'bg-white',
                )
              }
              emptyMessage={`Aucun enregistrement pour ${entity.label.toLowerCase()}.`}
            />
          )}

          <p className="border-t border-[#f1ecdd] px-5 py-3 font-sans text-[11.5px] font-medium text-ifvm-text-weak">
            Désactiver plutôt que supprimer : le pull hors-ligne ne transporte que des{' '}
            <span className="font-mono">upserts</span>, une suppression physique resterait sur les
            téléphones.
          </p>
        </div>

        {/* Panneau Modifier + Fraîcheur terrain */}
        <div className="grid grid-cols-[1fr_320px] items-start gap-4">
          <div className="flex flex-col gap-[13px] rounded-[11px] border border-[#e7e0cd] bg-white px-5 py-[18px]">
            <div>
              <h3 className="font-sans text-[13px] font-bold">Modifier</h3>
              <p className="mt-0.5 font-mono text-[11px] font-medium text-ifvm-text-weak">
                {selectedRow ? entity.rowLabel(selectedRow) : '—'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {entity.fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-1.5">
                  <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak">
                    {field.label}
                  </span>
                  <div
                    className={cn(
                      'flex min-h-9 items-center rounded-lg border border-[#e0d9c4] bg-[#fffdf8] px-[11px] text-[12.5px] font-semibold text-[#16201a]',
                      field.mono ? 'font-mono' : 'font-sans',
                    )}
                  >
                    {selectedRow ? field.value(selectedRow) : '—'}
                  </div>
                  {field.hint && (
                    <span className="font-sans text-[10px] font-medium text-ifvm-amber-text">
                      {field.hint}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {entity.hasActif && (
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-sans text-[11.5px] font-semibold text-[#3a3a30]">Actif</span>
                <Switch
                  checked={Boolean(selectedRow?.actif)}
                  disabled
                  className={READONLY_SWITCH}
                  aria-label="Actif"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                aria-disabled
                onClick={noop}
                title={`${entity.apiLabel} — enregistrement impossible tant que la route d'écriture n'existe pas`}
                className={cn(
                  'flex-1 rounded-[9px] bg-[#235a36] py-[11px] font-sans text-[12px] font-bold text-white',
                  UNAVAILABLE,
                )}
              >
                Enregistrer
              </button>
              <button
                type="button"
                aria-disabled
                onClick={noop}
                className={cn(
                  'rounded-[9px] border border-[#e0d9c4] bg-white px-4 py-[11px] font-sans text-[12px] font-semibold text-ifvm-text-tertiary',
                  UNAVAILABLE,
                )}
              >
                Annuler
              </button>
            </div>
          </div>

          <div className="rounded-[11px] border border-ifvm-green-border bg-ifvm-green-bg px-[18px] py-4">
            <h3 className="mb-[7px] font-sans text-[12.5px] font-bold text-ifvm-green-text">
              Fraîcheur terrain
            </h3>
            <p className="font-sans text-[11.5px] font-medium leading-[1.6] text-[#3a5c43]">
              {isLoading
                ? 'Chargement…'
                : serverTime
                  ? `Dernier pull terrain : ${formatDateTime(serverTime)} — ${rows.length} enregistrement${rows.length > 1 ? 's' : ''} synchronisé${rows.length > 1 ? 's' : ''}`
                  : 'Aucun pull terrain enregistré.'}
            </p>
            <button
              type="button"
              aria-disabled
              onClick={noop}
              title="Le suivi par agent n'est pas exposé par GET /referentiel/pull"
              className={cn(
                'mt-[10px] w-full rounded-lg border border-ifvm-green-border bg-white px-3 py-[9px] font-sans text-[11.5px] font-bold text-ifvm-green-text',
                UNAVAILABLE,
              )}
            >
              Voir les agents en retard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
