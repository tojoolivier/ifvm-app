import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Écran Référentiels — docs/design_handoff_web/README.md §11.
 *
 * Grille `216px 1fr` : colonne gauche de 7 cartes de navigation, colonne droite
 * carte d'en-tête + carte « Enregistrements » + grille `1fr 320px` (panneau
 * Modifier / panneau Fraîcheur terrain).
 *
 * L'écran est en lecture seule là où le backend n'expose pas d'écriture
 * (#124) : pesticide, culture et station_fixe. Les affordances d'écriture de
 * la maquette y sont rendues mais désactivées, avec l'état API réel affiché
 * en pastille — la consigne du handoff est de ne pas masquer ces écarts.
 *
 * `code_stade` a ses écritures depuis #131, `poste_acridien` depuis #132 :
 * `write` porte le formulaire, et la sortie de service passe par
 * `actif=false`. Aucune suppression n'est offerte — `GET /referentiel/pull`
 * ne transporte que des upserts, une ligne effacée resterait indéfiniment sur
 * les téléphones déjà synchronisés.
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
  lieux_aeriens: EntityPull
}

type PullKey = keyof ReferentielPullResponse

interface FieldSpec {
  label: string
  mono?: boolean
  hint?: string
  value: (row: Row) => string
}

/**
 * Champ éditable d'un référentiel administrable. `nullable` distingue « — » de
 * la chaîne vide : `code_stade.sexe` et `code_stade.espece` sont NULL en base
 * (larve non sexée, stade valable pour les deux espèces).
 */
interface EditableField {
  /** Nom de colonne backend — clé du corps envoyé à l'API. */
  name: string
  label: string
  kind: 'text' | 'number' | 'select' | 'foreign-key'
  mono?: boolean
  required?: boolean
  nullable?: boolean
  options?: { value: string; label: string }[]
  /**
   * Options dynamiques pour `kind: 'foreign-key'` : liste déroulante alimentée
   * par sa propre route (clé étrangère — ex. `poste_acridien.za_id`).
   */
  optionsFrom?: {
    path: string
    queryKey: string
    /** Valeur postée (colonne FK) et libellé affiché. */
    valueKey: string
    labelKey: string
  }
  hint?: string
}

/** Écritures exposées par le backend pour ce référentiel. */
interface WriteSpec {
  /** Collection REST : `POST {path}`, `PUT {path}/{id}`. Jamais de DELETE. */
  path: string
  createTitle: string
  fields: EditableField[]
  /**
   * Source de la liste, quand elle diffère du pull hors-ligne. `postes_acridiens`
   * n'y porte que le contrat mobile (`za_id` brut, pas d'agrégat) : ni la
   * jointure `za_nom` ni `nb_stations` que l'écran d'administration affiche.
   */
  listPath?: string
  /** Champs calculés côté backend, lecture seule, affichés sous les champs éditables. */
  derivedFields?: FieldSpec[]
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
  /** Présent quand le backend expose POST/PUT : active l'ajout et le panneau Modifier. */
  write?: WriteSpec
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
 * Classification pesticide (migration backend 0044) : produit de choc (action
 * rapide, traitement d'urgence) ou produit barrière (action rémanente,
 * prévention). Nullable côté backend — les pesticides déjà enregistrés n'ont
 * pas cette classification — d'où l'option vide en tête de la liste déroulante.
 */
const TYPE_PRODUIT_LABELS: Record<string, string> = {
  produit_choc: 'Produit de choc',
  produit_barriere: 'Produit barrière',
}

const TYPE_PRODUIT_OPTIONS: EditableField['options'] = [
  { value: '', label: '— Non classé —' },
  { value: 'produit_choc', label: TYPE_PRODUIT_LABELS.produit_choc },
  { value: 'produit_barriere', label: TYPE_PRODUIT_LABELS.produit_barriere },
]

/**
 * `lieu_aerien.type_lieu` — #prospection-lieu-base. Le sélecteur BASE de la
 * prospection extensive aérienne (mobile) ne filtre que sur « principale » ;
 * « secondaire »/« stand » restent des types valides du référentiel partagé,
 * utiles au Traitement (hors périmètre de cet écran, non consommés ici).
 */
const TYPE_LIEU_AERIEN_LABELS: Record<string, string> = {
  principale: 'Principale',
  secondaire: 'Secondaire',
  stand: 'Stand',
}

const TYPE_LIEU_AERIEN_OPTIONS: EditableField['options'] = [
  { value: 'principale', label: TYPE_LIEU_AERIEN_LABELS.principale },
  { value: 'secondaire', label: TYPE_LIEU_AERIEN_LABELS.secondaire },
  { value: 'stand', label: TYPE_LIEU_AERIEN_LABELS.stand },
]

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

/** `sortValue` d'une colonne date : timestamp numérique, `null` si absente/invalide (voir `compareSortValues`). */
function dateSortValue(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function codeColumn(header = 'Code'): DataTableColumn<Row> {
  return {
    key: 'code',
    header,
    mono: true,
    render: (row) => <span className={GREEN_CODE}>{text(row, 'code')}</span>,
    sortValue: (row) => text(row, 'code'),
  }
}

const PAGE_SIZE = 15

/** Recherche insensible aux accents et à la casse ("Réunion" trouvé par "reunion"). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Compare deux `sortValue` de colonne. `null` (valeur absente, « — » à
 * l'affichage) est toujours relégué en fin de liste, quel que soit le sens du
 * tri — sinon un tri descendant ferait remonter les lignes incomplètes en
 * premier, ce qui n'aide personne.
 */
function compareSortValues(a: string | number | boolean | null, b: string | number | boolean | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (typeof a === 'boolean' || typeof b === 'boolean') return Number(a) - Number(b)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'fr', { sensitivity: 'base', numeric: true })
}

function nextSort(current: DataTableSort | null, key: string): DataTableSort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
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
    apiOk: true,
    apiLabel: 'GET · POST · PUT /pesticides',
    desc: 'Alimente les chips « Produit » des rotations aériennes et des produits utilisés en terrestre.',
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      {
        key: 'nom',
        header: 'Nom commercial',
        render: (row) => text(row, 'nom'),
        sortValue: (row) => text(row, 'nom'),
      },
      {
        key: 'ma',
        header: 'Matière active',
        render: (row) => text(row, 'matiere_active') || '—',
        sortValue: (row) => text(row, 'matiere_active'),
      },
      {
        key: 'dose',
        header: 'Dose de référence',
        align: 'right',
        mono: true,
        render: (row) => text(row, 'dose_reference') || '—',
        sortValue: (row) => text(row, 'dose_reference'),
      },
      {
        key: 'type_produit',
        header: 'Type de produit',
        render: (row) => {
          const value = row.type_produit
          return typeof value === 'string' && TYPE_PRODUIT_LABELS[value]
            ? TYPE_PRODUIT_LABELS[value]
            : '—'
        },
        sortValue: (row) => text(row, 'type_produit'),
      },
    ],
    fields: [],
    write: {
      path: '/pesticides',
      listPath: '/pesticides?inclure_inactifs=true',
      createTitle: 'Nouveau pesticide',
      fields: [
        { name: 'code', label: 'Code', kind: 'text', mono: true, required: true },
        { name: 'nom', label: 'Nom commercial', kind: 'text', required: true },
        { name: 'matiere_active', label: 'Matière active', kind: 'text', nullable: true },
        { name: 'dose_reference', label: 'Dose de référence', kind: 'text', nullable: true },
        {
          name: 'type_produit',
          label: 'Type de produit',
          kind: 'select',
          nullable: true,
          options: TYPE_PRODUIT_OPTIONS,
        },
      ],
    },
  },
  {
    key: 'culture',
    pullKey: 'cultures',
    label: 'Cultures',
    table: 'culture',
    addLabel: '+ Nouvelle culture',
    apiOk: true,
    apiLabel: 'GET · POST · PUT /cultures',
    desc: "Doit alimenter les dégâts sur culture (prospection) et les zones exposées (traitement), aujourd'hui codés en dur.",
    note: "Synchronisée dans le SQLite du terrain mais aucune fonction de lecture : listCultures() n'existe pas dans referentiel-db.ts.",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom'), sortValue: (row) => text(row, 'nom') },
    ],
    // Panneau en lecture seule inutilisé : `write` prend le relais.
    fields: [],
    write: {
      path: '/cultures',
      // `inclure_inactifs` : l'écran d'administration affiche un badge « État »,
      // il lui faut les cultures désactivées autant que les actives.
      listPath: '/cultures?inclure_inactifs=true',
      createTitle: 'Nouvelle culture',
      fields: [
        { name: 'code', label: 'Code', kind: 'text', mono: true, required: true },
        { name: 'nom', label: 'Nom', kind: 'text', required: true },
      ],
    },
  },
  {
    key: 'code_stade',
    pullKey: 'codes_stades',
    label: 'Codes stades',
    table: 'code_stade',
    addLabel: '+ Nouveau code stade',
    apiOk: true,
    apiLabel: 'GET · POST · PUT /codes-stades',
    desc: 'Doit alimenter le stade dominant (infestation larvaire) et les phases du compteur de captures.',
    note: "Écriture disponible côté serveur ; la lecture terrain manque encore : listCodesStades() n'existe pas dans referentiel-db.ts, les phases et stades restent des constantes dans le code mobile.",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      {
        key: 'categorie',
        header: 'Catégorie',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'categorie')}</span>,
        sortValue: (row) => text(row, 'categorie'),
      },
      {
        key: 'sexe',
        header: 'Sexe',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'sexe')}</span>,
        sortValue: (row) => text(row, 'sexe'),
      },
      {
        key: 'espece',
        header: 'Espèce',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'espece')}</span>,
        sortValue: (row) => text(row, 'espece'),
      },
      {
        key: 'libelle',
        header: 'Libellé',
        render: (row) => text(row, 'libelle'),
        sortValue: (row) => text(row, 'libelle'),
      },
      {
        key: 'ordre',
        header: 'Ordre',
        align: 'right',
        mono: true,
        render: (row) => text(row, 'ordre'),
        sortValue: (row) => (typeof row.ordre === 'number' ? row.ordre : null),
      },
    ],
    // Panneau en lecture seule inutilisé : `write` prend le relais.
    fields: [],
    write: {
      path: '/codes-stades',
      createTitle: 'Nouveau code stade',
      fields: [
        {
          name: 'code',
          label: 'Code',
          kind: 'text',
          mono: true,
          required: true,
          hint: 'doit exister dans le vocabulaire `stade`',
        },
        {
          name: 'categorie',
          label: 'Catégorie',
          kind: 'select',
          required: true,
          options: [
            { value: 'imago', label: 'imago' },
            { value: 'larve', label: 'larve' },
          ],
        },
        {
          name: 'sexe',
          label: 'Sexe',
          kind: 'select',
          nullable: true,
          options: [
            { value: '', label: '— (larve, non sexée)' },
            { value: 'F', label: 'F' },
            { value: 'M', label: 'M' },
          ],
        },
        {
          name: 'espece',
          label: 'Espèce',
          kind: 'text',
          nullable: true,
          hint: 'vide = les deux espèces',
        },
        { name: 'libelle', label: 'Libellé', kind: 'text', required: true },
        { name: 'ordre', label: 'Ordre', kind: 'number', mono: true },
      ],
    },
  },
  {
    key: 'poste_acridien',
    pullKey: 'postes_acridiens',
    label: 'Postes acridiens',
    table: 'poste_acridien',
    addLabel: '+ Nouveau poste acridien',
    apiOk: true,
    apiLabel: 'GET · POST · PUT /postes-acridiens',
    desc: 'Niveau supérieur de la hiérarchie géographique : chaque station fixe et chaque agent y sont rattachés.',
    note: "La maquette annonce une colonne « Région » : poste_acridien n'en porte pas. Son rattachement réel est la zone anti-acridienne (za_id) ; la région n'existe qu'au niveau des stations, via commune → district → région.",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom'), sortValue: (row) => text(row, 'nom') },
      {
        key: 'za_nom',
        header: 'Zone anti-acridienne',
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'za_nom')}</span>,
        sortValue: (row) => text(row, 'za_nom'),
      },
      {
        key: 'nb_stations',
        header: 'Stations',
        align: 'right',
        mono: true,
        render: (row) => text(row, 'nb_stations'),
        sortValue: (row) => (typeof row.nb_stations === 'number' ? row.nb_stations : null),
      },
    ],
    // Panneau en lecture seule inutilisé : `write` prend le relais.
    fields: [],
    write: {
      path: '/postes-acridiens',
      // `inclure_inactifs` : l'écran d'administration a besoin des deux états,
      // contrairement au sélecteur de station d'une prospection.
      listPath: '/postes-acridiens?inclure_inactifs=true',
      createTitle: 'Nouveau poste acridien',
      fields: [
        { name: 'code', label: 'Code', kind: 'text', mono: true, required: true },
        { name: 'nom', label: 'Nom', kind: 'text', required: true },
        {
          name: 'za_id',
          label: 'Zone anti-acridienne',
          kind: 'foreign-key',
          required: true,
          optionsFrom: {
            path: '/zones-anti-acridiennes',
            queryKey: 'zones-anti-acridiennes',
            valueKey: 'id',
            labelKey: 'nom',
          },
        },
      ],
      derivedFields: [
        {
          label: 'Stations rattachées',
          mono: true,
          hint: 'dérivé',
          value: (row) => text(row, 'nb_stations'),
        },
      ],
    },
  },
  {
    key: 'station_fixe',
    pullKey: 'stations_fixes',
    label: 'Stations fixes',
    table: 'station_fixe',
    addLabel: '+ Nouvelle station',
    apiOk: true,
    apiLabel: 'GET · POST · PUT /stations',
    desc: 'Point de référence des prospections : code, nom, poste acridien de rattachement et coordonnées.',
    note: "Une station est référencée par des prospections et le pull hors-ligne ne transporte que des upserts : aucune route DELETE n'est exposée, la sortie de service passe par l'interrupteur « Actif ».",
    hasActif: true,
    rowLabel: (row) => text(row, 'code'),
    columns: [
      codeColumn(),
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom'), sortValue: (row) => text(row, 'nom') },
      {
        key: 'coord',
        header: 'Coordonnées',
        mono: true,
        render: (row) =>
          typeof row.latitude === 'number' && typeof row.longitude === 'number'
            ? `${row.latitude.toFixed(4)} · ${row.longitude.toFixed(4)}`
            : '—',
        // Trie par latitude — les coordonnées combinent deux valeurs, pas de tri
        // parfaitement naturel possible, mais reste plus utile que rien.
        sortValue: (row) => (typeof row.latitude === 'number' ? row.latitude : null),
      },
    ],
    // Panneau en lecture seule inutilisé : `write` prend le relais.
    fields: [],
    write: {
      path: '/stations',
      // `inclure_inactifs` : l'administration montre les deux états. Cette route est
      // aussi la seule à porter `commune_id` — le pull n'en transporte que les
      // libellés, avec lesquels on ne peut pas présélectionner la commune.
      listPath: '/stations?inclure_inactifs=true',
      createTitle: 'Nouvelle station',
      fields: [
        { name: 'code', label: 'Code', kind: 'text', mono: true, required: true },
        { name: 'nom', label: 'Nom', kind: 'text', required: true },
        {
          name: 'pa_id',
          label: 'Poste acridien',
          kind: 'foreign-key',
          required: true,
          optionsFrom: {
            path: '/postes-acridiens',
            queryKey: 'postes-acridiens',
            valueKey: 'id',
            labelKey: 'nom',
          },
        },
        {
          name: 'commune_id',
          label: 'Commune',
          kind: 'foreign-key',
          required: true,
          optionsFrom: {
            path: '/communes',
            queryKey: 'communes',
            valueKey: 'id',
            labelKey: 'nom',
          },
        },
        { name: 'latitude', label: 'Latitude', kind: 'number', mono: true, required: true },
        { name: 'longitude', label: 'Longitude', kind: 'number', mono: true, required: true },
        { name: 'altitude', label: 'Altitude (m)', kind: 'number', mono: true, nullable: true },
      ],
      derivedFields: [
        { label: 'District', value: (row) => text(row, 'district') },
        { label: 'Région', value: (row) => text(row, 'region') },
      ],
    },
  },
  {
    key: 'lieu_aerien',
    pullKey: 'lieux_aeriens',
    label: 'Lieux aériens',
    table: 'lieu_aerien',
    addLabel: '+ Nouveau lieu aérien',
    apiOk: true,
    apiLabel: 'GET · POST · PUT /lieux-aeriens',
    desc: "Alimente le champ « Base » de la prospection extensive aérienne (mobile) — seuls les lieux de type « Principale » y sont proposés.",
    hasActif: true,
    rowLabel: (row) => text(row, 'nom'),
    columns: [
      {
        key: 'type_lieu',
        header: 'Type',
        render: (row) => {
          const value = row.type_lieu
          return typeof value === 'string' && TYPE_LIEU_AERIEN_LABELS[value]
            ? TYPE_LIEU_AERIEN_LABELS[value]
            : '—'
        },
        sortValue: (row) => text(row, 'type_lieu'),
      },
      { key: 'nom', header: 'Nom', render: (row) => text(row, 'nom'), sortValue: (row) => text(row, 'nom') },
      {
        key: 'coord',
        header: 'Coordonnées',
        mono: true,
        render: (row) =>
          typeof row.latitude === 'number' && typeof row.longitude === 'number'
            ? `${row.latitude.toFixed(4)} · ${row.longitude.toFixed(4)}`
            : '—',
        sortValue: (row) => (typeof row.latitude === 'number' ? row.latitude : null),
      },
      {
        key: 'altitude',
        header: 'Altitude (m)',
        align: 'right',
        mono: true,
        render: (row) => text(row, 'altitude'),
        sortValue: (row) => (typeof row.altitude === 'number' ? row.altitude : null),
      },
    ],
    // Panneau en lecture seule inutilisé : `write` prend le relais.
    fields: [],
    write: {
      path: '/lieux-aeriens',
      // `inclure_inactifs` : l'administration montre les deux états, comme les
      // autres référentiels avec badge « État ».
      listPath: '/lieux-aeriens?inclure_inactifs=true',
      createTitle: 'Nouveau lieu aérien',
      fields: [
        {
          name: 'type_lieu',
          label: 'Type',
          kind: 'select',
          required: true,
          options: TYPE_LIEU_AERIEN_OPTIONS,
        },
        { name: 'nom', label: 'Nom', kind: 'text', required: true },
        { name: 'latitude', label: 'Latitude', kind: 'number', mono: true, required: true },
        { name: 'longitude', label: 'Longitude', kind: 'number', mono: true, required: true },
        { name: 'altitude', label: 'Altitude (m)', kind: 'number', mono: true, nullable: true },
      ],
    },
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
        sortValue: (row) => `${text(row, 'nom')} ${text(row, 'prenom')}`,
      },
      {
        key: 'email',
        header: 'Email',
        mono: true,
        render: (row) => <span className="text-ifvm-text-tertiary">{text(row, 'email')}</span>,
        sortValue: (row) => text(row, 'email'),
      },
      { key: 'role', header: 'Rôle', render: (row) => text(row, 'role'), sortValue: (row) => text(row, 'role') },
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
      { key: 'name', header: 'Nom', render: (row) => text(row, 'name'), sortValue: (row) => text(row, 'name') },
      {
        key: 'start_date',
        header: 'Début',
        mono: true,
        render: (row) => formatDate(row.start_date),
        sortValue: (row) => dateSortValue(row.start_date),
      },
      {
        key: 'end_date',
        header: 'Fin',
        mono: true,
        render: (row) =>
          row.end_date ? formatDate(row.end_date) : <span className="text-[#bdb6a2]">—</span>,
        sortValue: (row) => dateSortValue(row.end_date),
      },
    ],
    fields: [
      { label: 'Nom *', value: (row) => text(row, 'name') },
      { label: 'Date de début *', mono: true, value: (row) => formatDate(row.start_date) },
      { label: 'Date de fin', mono: true, value: (row) => (row.end_date ? formatDate(row.end_date) : '—') },
    ],
  },
]

type FormValues = Record<string, string>

/** État du serveur → champs de formulaire. NULL et absent deviennent la chaîne vide. */
function toFormValues(fields: EditableField[], row: Row | undefined): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    const value = row?.[field.name]
    values[field.name] = value === null || value === undefined ? '' : String(value)
  }
  return values
}

/** Valeurs initiales d'une création : la première option pour les listes fermées. */
function blankFormValues(fields: EditableField[]): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    values[field.name] = field.kind === 'select' ? (field.options?.[0]?.value ?? '') : ''
  }
  return values
}

/**
 * Champs de formulaire → corps JSON. La chaîne vide vaut NULL sur un champ
 * nullable ; ailleurs elle part telle quelle, le backend restant l'autorité
 * (409 code hors vocabulaire, 409 grille déjà occupée, 422 valeur interdite).
 */
function toPayload(fields: EditableField[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = values[field.name] ?? ''
    if (field.kind === 'number') payload[field.name] = raw === '' ? 0 : Number(raw)
    else payload[field.name] = raw === '' && field.nullable ? null : raw
  }
  return payload
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as AxiosError<{ detail?: string }>)?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

const inputClass =
  'min-h-9 w-full rounded-lg border border-[#e0d9c4] bg-white px-[11px] text-[12.5px] font-semibold text-[#16201a] focus:outline-none focus:ring-2 focus:ring-[#235a36]'

const fieldLabelClass =
  'font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak'

/** Un champ éditable — même gabarit dans le panneau « Modifier » et la boîte de création. */
function EditableInput({
  field,
  idPrefix,
  value,
  onChange,
  foreignKeyOptions,
}: {
  field: EditableField
  idPrefix: string
  value: string
  onChange: (value: string) => void
  /**
   * Options résolues par `optionsFrom.queryKey` — ignoré hors `kind: 'foreign-key'`.
   * Une table plutôt qu'une liste : `station_fixe` porte deux clés étrangères
   * (`pa_id`, `commune_id`), chacune alimentée par sa propre route.
   */
  foreignKeyOptions?: Record<string, Row[]>
}) {
  const id = `${idPrefix}-${field.name}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabelClass}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {field.kind === 'select' ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'font-sans')}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'foreign-key' ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'font-sans')}
        >
          <option value="">— Choisir —</option>
          {(foreignKeyOptions?.[field.optionsFrom!.queryKey] ?? []).map((option) => (
            <option
              key={String(option[field.optionsFrom!.valueKey])}
              value={String(option[field.optionsFrom!.valueKey])}
            >
              {String(option[field.optionsFrom!.labelKey])}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.kind === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, field.mono ? 'font-mono' : 'font-sans')}
        />
      )}
      {field.hint && (
        <span className="font-sans text-[10px] font-medium text-ifvm-text-weak">{field.hint}</span>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pb-[3px] font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
      {children}
    </div>
  )
}

export function ReferentielsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedKey, setSelectedKey] = useState(ENTITES[0].key)
  // Ligne survolée par le panneau « Modifier » en lecture seule (utilisateur, campagne —
  // sans `write`, donc sans bouton Action ni modale) : sélectionnée en cliquant la ligne,
  // comme avant. Les entités avec `write` n'y touchent plus, cf. `editingRow`.
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)

  const { data, isLoading } = useQuery<ReferentielPullResponse>({
    queryKey: ['referentiel-pull'],
    queryFn: () => api.get('/referentiel/pull').then((r) => r.data),
  })

  const entity = ENTITES.find((e) => e.key === selectedKey) ?? ENTITES[0]

  // Une entité peut lire sa liste depuis sa propre route plutôt que le pull :
  // celui-ci ne transporte que le contrat hors-ligne du mobile (clés étrangères
  // brutes), sans les jointures ni les champs dérivés dont l'administration a besoin.
  const { data: writeListData, isLoading: writeListLoading } = useQuery<Row[]>({
    queryKey: ['referentiel-write-list', entity.write?.listPath ?? 'none'],
    queryFn: () => api.get(entity.write!.listPath!).then((r) => r.data),
    enabled: Boolean(entity.write?.listPath),
  })

  const rows = useMemo(() => {
    if (entity.write?.listPath) return Array.isArray(writeListData) ? writeListData : []
    return data?.[entity.pullKey]?.upserts ?? []
  }, [data, entity, writeListData])
  const rowsLoading = entity.write?.listPath ? writeListLoading : isLoading
  const selectedRow = rows[selectedRowIndex] ?? rows[0]
  const serverTime = data?.[entity.pullKey]?.server_time

  // --- Écritures (entités portant un `write`) --------------------------------
  const writeFields = entity.write?.fields ?? []
  // Ligne en cours de modification dans la modale « Modifier » — `null` = modale
  // fermée. Remplace l'ancien panneau permanent : l'édition n'est plus liée à une
  // ligne « sélectionnée » par un simple clic, mais au bouton Action de sa ligne.
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [editValues, setEditValues] = useState<FormValues>({})
  const [editActif, setEditActif] = useState(true)
  const [editError, setEditError] = useState('')
  const [createValues, setCreateValues] = useState<FormValues>({})
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const selectedRowId = selectedRow ? String(selectedRow.id) : undefined

  function openEdit(row: Row) {
    setEditingRow(row)
    setEditValues(toFormValues(writeFields, row))
    setEditActif(Boolean(row.actif))
    setEditError('')
  }

  function closeEdit() {
    setEditingRow(null)
  }

  // Un formulaire peut porter plusieurs clés étrangères (`station_fixe` en a deux),
  // chacune avec sa route : `useQueries` garde un hook par source sans en fixer le
  // nombre à l'avance.
  const foreignKeySources = writeFields
    .filter((f) => f.kind === 'foreign-key' && f.optionsFrom)
    .map((f) => f.optionsFrom!)
  const foreignKeyResults = useQueries({
    queries: foreignKeySources.map((source) => ({
      queryKey: ['referentiel-fk-options', source.queryKey],
      queryFn: () => api.get(source.path).then((r) => r.data),
    })),
  })
  const foreignKeyOptions: Record<string, Row[]> = {}
  foreignKeySources.forEach((source, index) => {
    const data = foreignKeyResults[index]?.data
    foreignKeyOptions[source.queryKey] = Array.isArray(data) ? (data as Row[]) : []
  })

  function invalidateRows() {
    queryClient.invalidateQueries({ queryKey: ['referentiel-pull'] })
    if (entity.write?.listPath) {
      queryClient.invalidateQueries({ queryKey: ['referentiel-write-list', entity.write.listPath] })
    }
  }

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.put(`${entity.write!.path}/${editingRow ? String(editingRow.id) : ''}`, payload),
    onSuccess: () => {
      setEditError('')
      closeEdit()
      invalidateRows()
    },
    onError: (error) => setEditError(apiErrorMessage(error, "Enregistrement impossible.")),
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post(entity.write!.path, payload),
    onSuccess: () => {
      setCreating(false)
      setCreateError('')
      invalidateRows()
    },
    onError: (error) => setCreateError(apiErrorMessage(error, 'Création impossible.')),
  })

  function openCreate() {
    setCreateValues(blankFormValues(writeFields))
    setCreateError('')
    setCreating(true)
  }

  function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreateError('')
    createMutation.mutate(toPayload(writeFields, createValues))
  }

  function submitEdit(event: React.FormEvent) {
    event.preventDefault()
    setEditError('')
    updateMutation.mutate({ ...toPayload(writeFields, editValues), actif: editActif })
  }

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const trailing: DataTableColumn<Row>[] = []
    if (entity.hasActif) {
      trailing.push({
        key: 'actif',
        header: 'Actif',
        // Nom accessible porté par la ligne : un tableau de 20 interrupteurs tous
        // nommés « Actif » est illisible au lecteur d'écran, et se confond avec
        // celui du panneau « Modifier ».
        render: (row) => (
          <Switch
            checked={Boolean(row.actif)}
            disabled
            className={READONLY_SWITCH}
            aria-label={`${entity.rowLabel(row)} — ${row.actif ? 'actif' : 'inactif'}`}
          />
        ),
        sortValue: (row) => Boolean(row.actif),
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
      sortValue: (row) => dateSortValue(row.updated_at),
    })
    if (entity.write) {
      // Pas de `sortValue` : une colonne d'actions n'a rien à trier.
      trailing.push({
        key: 'actions',
        header: 'Action',
        align: 'right',
        render: (row) => (
          <button
            type="button"
            onClick={() => openEdit(row)}
            aria-label={`Modifier ${entity.rowLabel(row)}`}
            className="rounded-md border border-[#e0d9c4] bg-white px-2 py-1 font-sans text-[11px] font-semibold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
          >
            ✎ Modifier
          </button>
        ),
      })
    }
    return [...entity.columns, ...trailing]
    // `openEdit` est recréée à chaque rendu (elle capture `writeFields`), mais ne
    // change pas de comportement entre deux rendus pour la même entité : l'omettre
    // évite de recalculer `columns` en boucle sans jamais changer son contenu utile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity])

  // Recherche, tri et pagination — remis à zéro à chaque changement d'entité :
  // une recherche ou un tri de l'onglet précédent n'a pas de sens sur celui-ci,
  // et une page 4 laisserait un tableau vide si la nouvelle liste est plus courte.
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DataTableSort | null>(null)
  const [page, setPage] = useState(1)

  function selectEntity(key: string) {
    setSelectedKey(key)
    setSelectedRowIndex(0)
    setSearch('')
    setSort(null)
    setPage(1)
    closeEdit()
  }

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function toggleSort(key: string) {
    setSort((current) => nextSort(current, key))
    setPage(1)
  }

  // Le filtrage compare le texte saisi aux `sortValue` des colonnes affichées —
  // c'est exactement ce que l'utilisateur voit dans le tableau, ni plus (pas les
  // identifiants internes) ni moins (une recherche sur « Nom complet » retrouve
  // bien un utilisateur par son prénom grâce au `sortValue` combiné nom+prénom).
  const searchQuery = normalize(search.trim())
  const searchedRows = searchQuery
    ? rows.filter((row) =>
        columns.some((column) => {
          const value = column.sortValue?.(row)
          return value !== null && value !== undefined && normalize(String(value)).includes(searchQuery)
        }),
      )
    : rows

  const sortColumn = sort ? columns.find((c) => c.key === sort.key) : undefined
  const sortedRows =
    sort && sortColumn?.sortValue
      ? [...searchedRows].sort((a, b) => {
          const cmp = compareSortValues(sortColumn.sortValue!(a), sortColumn.sortValue!(b))
          return sort.direction === 'asc' ? cmp : -cmp
        })
      : searchedRows

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Partagé entre les deux mises en page du panneau du bas : pleine largeur pour
  // une entité `write` (le panneau Modifier permanent a cédé la place à la
  // modale), à côté du panneau lecture seule sinon.
  const fraicheurTerrain = (
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
  )

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
            <Label htmlFor="referentiel-recherche" className="sr-only">
              Rechercher parmi {entity.label.toLowerCase()}
            </Label>
            <Input
              id="referentiel-recherche"
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Rechercher…"
              className="h-9 w-48 rounded-[8px] border-[#e0d9c4] bg-[#fffdf8] text-[12px]"
            />
            <button
              type="button"
              aria-disabled={entity.write || entity.addRoute ? undefined : true}
              onClick={
                entity.write ? openCreate : entity.addRoute ? () => navigate(entity.addRoute!) : noop
              }
              title={
                entity.write
                  ? `POST ${entity.write.path}`
                  : entity.addRoute
                    ? `Gestion complète sur ${entity.addRoute}`
                    : `${entity.apiLabel} — aucune route d'écriture exposée par le backend`
              }
              className={cn(
                'rounded-lg bg-[#235a36] px-[14px] py-2 font-sans text-[11.5px] font-bold text-white transition-colors duration-[120ms]',
                entity.write || entity.addRoute ? 'hover:bg-[#1a4429]' : UNAVAILABLE,
              )}
            >
              {entity.addLabel}
            </button>
          </div>

          {rowsLoading ? (
            <div className="divide-y divide-[#f4efe2]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[43px] animate-pulse bg-[#faf7ef]" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={paginatedRows}
              getRowKey={(row) => String(row.id)}
              // Avec `write`, la modification passe par le bouton Action de la colonne
              // « Action » — plus par un clic de ligne qui « sélectionnait » la ligne pour
              // le panneau permanent (disparu, remplacé par la modale). Sans `write`
              // (utilisateur, campagne), le clic garde son rôle : prévisualiser la ligne
              // dans le panneau Modifier en lecture seule.
              onRowClick={entity.write ? undefined : (row) => setSelectedRowIndex(rows.indexOf(row))}
              // Idem : le surlignage de la ligne « sélectionnée » ne veut plus rien dire
              // pour une entité avec `write` (pas de sélection persistante) — seule la
              // zébrure reste. `selectedRowIndex` est un index dans `rows` (liste complète),
              // comparé par id plutôt que par position une fois triée/paginée.
              rowClassName={(row, index) =>
                cn(
                  !entity.write && String(row.id) === selectedRowId
                    ? 'bg-[#f7f4ea] shadow-[inset_3px_0_0_#235a36]'
                    : index % 2
                      ? 'bg-[#fffdf8]'
                      : 'bg-white',
                )
              }
              emptyMessage={
                searchQuery
                  ? `Aucun résultat pour « ${search.trim()} ».`
                  : `Aucun enregistrement pour ${entity.label.toLowerCase()}.`
              }
              sort={sort ?? undefined}
              onSortChange={toggleSort}
            />
          )}

          {!rowsLoading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#f1ecdd] px-5 py-3">
              <span className="font-sans text-[11.5px] font-medium text-ifvm-text-weak">
                Page {currentPage} / {totalPages} · {sortedRows.length} enregistrement
                {sortedRows.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-[8px] border border-[#e0d9c4] bg-white px-3 py-2 font-sans text-[11.5px] font-semibold text-ifvm-text-tertiary disabled:opacity-50"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}

          <p className="border-t border-[#f1ecdd] px-5 py-3 font-sans text-[11.5px] font-medium text-ifvm-text-weak">
            Désactiver plutôt que supprimer : le pull hors-ligne ne transporte que des{' '}
            <span className="font-mono">upserts</span>, une suppression physique resterait sur les
            téléphones.
          </p>
        </div>

        {/* Panneau Modifier (lecture seule, sans `write`) + Fraîcheur terrain.
            Avec `write`, la modification est passée en modale (bouton Action de
            chaque ligne) : ce panneau permanent disparaît, Fraîcheur terrain
            occupe seule la largeur. */}
        {entity.write ? (
          fraicheurTerrain
        ) : (
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

            {fraicheurTerrain}
          </div>
        )}
      </div>

      {editingRow && entity.write && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Modifier ${entity.rowLabel(editingRow)}`}
            className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-white shadow-xl"
          >
            <div className="border-b border-[#f4efe2] px-6 py-4">
              <h2 className="font-sans text-[15px] font-extrabold">Modifier</h2>
              <p className="mt-0.5 font-mono text-[11px] font-medium text-ifvm-text-weak">
                {entity.rowLabel(editingRow)}
              </p>
            </div>
            <form onSubmit={submitEdit} className="flex flex-col gap-4 px-6 py-4">
              {editError && <ErrorBanner label="Enregistrement impossible" message={editError} />}

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {entity.write.fields.map((field) => (
                  <EditableInput
                    key={field.name}
                    field={field}
                    idPrefix="ref-edit"
                    value={editValues[field.name] ?? ''}
                    onChange={(value) =>
                      setEditValues((current) => ({ ...current, [field.name]: value }))
                    }
                    foreignKeyOptions={foreignKeyOptions}
                  />
                ))}
                {entity.write.derivedFields?.map((field) => (
                  <div key={field.label} className="flex flex-col gap-1.5">
                    <span className={fieldLabelClass}>{field.label}</span>
                    <div
                      className={cn(
                        'flex min-h-9 items-center rounded-lg border border-[#e0d9c4] bg-[#f7f4ea] px-[11px] text-[12.5px] font-semibold text-ifvm-text-tertiary',
                        field.mono ? 'font-mono' : 'font-sans',
                      )}
                    >
                      {field.value(editingRow)}
                    </div>
                    {field.hint && (
                      <span className="font-sans text-[10px] font-medium text-ifvm-text-weak">
                        {field.hint}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="font-sans text-[11.5px] font-semibold text-[#3a3a30]">Actif</span>
                <Switch checked={editActif} onCheckedChange={setEditActif} aria-label="Actif" />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-[9px] bg-[#235a36] px-4 py-[10px] font-sans text-[12px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429] disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {creating && entity.write && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={entity.write.createTitle}
            className="mx-4 w-full max-w-md rounded-[11px] border border-[#e7e0cd] bg-white shadow-xl"
          >
            <div className="border-b border-[#f4efe2] px-6 py-4">
              <h2 className="font-sans text-[15px] font-extrabold">{entity.write.createTitle}</h2>
            </div>
            <form onSubmit={submitCreate} className="flex flex-col gap-4 px-6 py-4">
              {createError && <ErrorBanner label="Création impossible" message={createError} />}

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {entity.write.fields.map((field) => (
                  <EditableInput
                    key={field.name}
                    field={field}
                    idPrefix="ref-new"
                    value={createValues[field.name] ?? ''}
                    onChange={(value) =>
                      setCreateValues((current) => ({ ...current, [field.name]: value }))
                    }
                    foreignKeyOptions={foreignKeyOptions}
                  />
                ))}
              </div>

              {/* Pas de champ « Actif » : une création part active, la désactivation
                  est un geste explicite depuis la modale Modifier. */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-[9px] bg-[#235a36] px-4 py-[10px] font-sans text-[12px] font-bold text-white transition-colors duration-[120ms] hover:bg-[#1a4429] disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Création…' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-[9px] border border-[#e7e0cd] px-4 py-[10px] font-sans text-[12px] font-bold text-ifvm-text-tertiary transition-colors duration-[120ms] hover:bg-[#faf7ef]"
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
