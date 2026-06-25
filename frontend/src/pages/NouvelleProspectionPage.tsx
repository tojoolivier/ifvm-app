import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { prospectionFormSchema, validateProspectionCrossFields } from '@/lib/prospection-schema'

// ---------------------------------------------------------------------------
// Données de référence
// ---------------------------------------------------------------------------

const STADES_LMC_LARVE = ['A1', 'A2', 'A3', 'A3-1/4', 'A3-2/4', 'A3-3/4', 'A3-4/4', 'A4', 'A5']
const STADES_NSE_LARVE = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']

function getStades(espece: string, categorie: string): string[] {
  if (categorie === 'imago') return ['imago']
  if (espece === 'LMC') return STADES_LMC_LARVE
  if (espece === 'NSE') return STADES_NSE_LARVE
  return []
}

const PHASES = [
  { value: 'solitaire', label: 'Solitaire' },
  { value: 'solitaro_trans', label: 'Solitaro-transiens' },
  { value: 'transiens', label: 'Transiens' },
  { value: 'gregaire', label: 'Grégaire' },
]

const ABONDANCE = [
  { value: 'neant', label: 'Néant' },
  { value: 'rare', label: 'Rare' },
  { value: 'peu', label: 'Peu' },
  { value: 'beaucoup', label: 'Beaucoup' },
  { value: 'dominant', label: 'Dominant' },
]

const TYPES_INFESTATION = [
  { value: 'tache_larvaire', label: 'Tache larvaire' },
  { value: 'bande_larvaire', label: 'Bande larvaire' },
  { value: 'vol_clair', label: 'Vol clair' },
  { value: 'essaim', label: 'Essaim' },
]

const STRATES_VEGETATION = [
  { key: 'H1', label: 'H1 — Herbe rase (< 10 cm)' },
  { key: 'H2', label: 'H2 — Herbe courte (10–50 cm)' },
  { key: 'H3', label: 'H3 — Herbe haute (> 50 cm)' },
  { key: 'A1', label: 'A1 — Arbuste bas (< 1 m)' },
  { key: 'A2', label: 'A2 — Arbuste haut (1–3 m)' },
  { key: 'Ar', label: 'Ar — Arbre (> 3 m)' },
  { key: 'L', label: 'L — Litière / sol nu' },
]

const RECOUVREMENT_OPTIONS = ['0-25', '25-50', '50-75', '75-100']
const PHENOLOGIE_OPTIONS = [
  { value: 'sec', label: 'Sec' },
  { value: 'vert', label: 'Vert' },
  { value: 'floraison', label: 'Floraison' },
  { value: 'fructification', label: 'Fructification' },
]
const ACTIVITE_OPTIONS = [
  { value: 'nulle', label: 'Nulle' },
  { value: 'faible', label: 'Faible' },
  { value: 'forte', label: 'Forte' },
]

const HUMIDITE_SOL = [
  { value: 'sec', label: 'Sec' },
  { value: 'frais', label: 'Frais' },
  { value: 'humide', label: 'Humide' },
  { value: 'tres_humide', label: 'Très humide' },
]

const TEXTURE_SOL = [
  { value: 'sableux', label: 'Sableux' },
  { value: 'limoneux_sableux', label: 'Limoneux-sableux' },
  { value: 'limoneux', label: 'Limoneux' },
  { value: 'limoneux_argileux', label: 'Limoneux-argileux' },
  { value: 'argileux', label: 'Argileux' },
  { value: 'caillouteux', label: 'Caillouteux' },
]

const STEPS = [
  { label: 'Général & Localisation' },
  { label: 'Captures & Population' },
  { label: 'Infestation, Végétation & Sol' },
  { label: 'Conditions & Récap.' },
]

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

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
  pa_id: string
  pa_code: string
  pa_nom: string
  latitude: number
  longitude: number
  altitude: number | null
  actif: boolean
}

interface CaptureRow {
  id: number
  espece: string
  categorie: string
  stade: string
  sexe: string
  phase: string
  effectif: string
}

interface PopulationRow {
  espece: 'LMC' | 'NSE'
  categorie: 'imago' | 'larve'
  densite_diffuse: string
  densite_groupee: string
  captures_nombre: string
  temps_capture: string
  accouplement: string
  ponte: string
}

interface InfestationRow {
  id: number
  espece: string
  type_cible: string
  taille_min: string
  taille_max: string
  taille_moy: string
  surface_tot: string
  densite_min: string
  densite_max: string
  densite_moy: string
  interdistance: string
  comportement: string
  direction_de: string
  direction_vers: string
  vent_de: string
  vent_vitesse: string
}

interface StrateVegetation {
  recouvrement: string
  phenologie: string
  activite: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyCapture(id: number): CaptureRow {
  return { id, espece: 'LMC', categorie: 'larve', stade: 'A1', sexe: 'M', phase: 'solitaire', effectif: '0' }
}

function emptyInfestation(id: number): InfestationRow {
  return {
    id, espece: 'LMC', type_cible: 'tache_larvaire',
    taille_min: '', taille_max: '', taille_moy: '',
    surface_tot: '', densite_min: '', densite_max: '', densite_moy: '',
    interdistance: '', comportement: '', direction_de: '', direction_vers: '',
    vent_de: '', vent_vitesse: '',
  }
}

function initialPopulations(): PopulationRow[] {
  return [
    { espece: 'LMC', categorie: 'imago', densite_diffuse: '', densite_groupee: '', captures_nombre: '', temps_capture: '', accouplement: '', ponte: '' },
    { espece: 'LMC', categorie: 'larve', densite_diffuse: '', densite_groupee: '', captures_nombre: '', temps_capture: '', accouplement: '', ponte: '' },
    { espece: 'NSE', categorie: 'imago', densite_diffuse: '', densite_groupee: '', captures_nombre: '', temps_capture: '', accouplement: '', ponte: '' },
    { espece: 'NSE', categorie: 'larve', densite_diffuse: '', densite_groupee: '', captures_nombre: '', temps_capture: '', accouplement: '', ponte: '' },
  ]
}

function initialVegetation(): Record<string, StrateVegetation> {
  return Object.fromEntries(
    STRATES_VEGETATION.map(({ key }) => [key, { recouvrement: '', phenologie: '', activite: '' }])
  )
}

function parseNum(s: string): number | null {
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseInt0(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Draft auto-save
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'prospection-draft'

interface ProspectionDraftData {
  savedAt: string
  campagneId: string
  stationId: string
  stationSearch: string
  dateProspection: string
  nReleve: string
  nFiche: string
  latitude: string
  longitude: string
  altitude: string
  surfStation: string
  surfProspectee: string
  surfInfestee: string
  degats: string
  dernieresPluies: string
  intensitePluie: string
  ennemis: string
  observations: string
  nextId: number
  captures: CaptureRow[]
  populations: PopulationRow[]
  infestations: InfestationRow[]
  vegetation: Record<string, StrateVegetation>
  sol: { humidite: string; texture: string }
}

function loadDraft(): ProspectionDraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as ProspectionDraftData) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function NouvelleProspectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- champs de base ---
  const [campagneId, setCampagneId] = useState('')
  const [stationId, setStationId] = useState('')
  const [stationSearch, setStationSearch] = useState('')
  const [dateProspection, setDateProspection] = useState(new Date().toISOString().slice(0, 10))
  const [nReleve, setNReleve] = useState('')
  const [nFiche, setNFiche] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [altitude, setAltitude] = useState('')
  const [surfStation, setSurfStation] = useState('')
  const [surfProspectee, setSurfProspectee] = useState('')
  const [surfInfestee, setSurfInfestee] = useState('')
  const [degats, setDegats] = useState('')
  const [dernieresPluies, setDernieresPluies] = useState('')
  const [intensitePluie, setIntensitePluie] = useState('')
  const [ennemis, setEnnemis] = useState('')
  const [observations, setObservations] = useState('')

  // --- sections complexes ---
  const [nextId, setNextId] = useState(1)
  const [captures, setCaptures] = useState<CaptureRow[]>([emptyCapture(0)])
  const [populations, setPopulations] = useState<PopulationRow[]>(initialPopulations())
  const [infestations, setInfestations] = useState<InfestationRow[]>([])
  const [vegetation, setVegetation] = useState<Record<string, StrateVegetation>>(initialVegetation())
  const [sol, setSol] = useState({ humidite: '', texture: '' })

  const [errors, setErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Draft auto-save
  const [storedDraft] = useState<ProspectionDraftData | null>(loadDraft)
  const [draftDismissed, setDraftDismissed] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const formRef = useRef<Omit<ProspectionDraftData, 'savedAt'>>({} as Omit<ProspectionDraftData, 'savedAt'>)
  const lastSnapshotRef = useRef('')
  const isSubmittedRef = useRef(false)

  // Stepper
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const stepChangedRef = useRef(false)

  // --- données ---
  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  const { data: stations = [] } = useQuery<Station[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  const filteredStations = useMemo(() => {
    if (!stationSearch) return stations
    const q = stationSearch.toLowerCase()
    return stations.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.nom.toLowerCase().includes(q) ||
        s.pa_code.toLowerCase().includes(q)
    )
  }, [stations, stationSearch])

  // Auto-sélection de la campagne en cours si unique
  const campagnesEnCours = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return campagnes.filter(
      (c) => c.start_date <= today && (c.end_date === null || c.end_date >= today)
    )
  }, [campagnes])

  useEffect(() => {
    if (campagnesEnCours.length === 1 && !campagneId) {
      setCampagneId(campagnesEnCours[0].id)
    }
  }, [campagnesEnCours, campagneId])

  // Validation date en temps réel quand la campagne change.
  useEffect(() => {
    if (!campagneId || !dateProspection) return
    const campagne = campagnes.find((c) => c.id === campagneId)
    if (!campagne) return
    let err: string | undefined
    if (dateProspection < campagne.start_date) {
      err = `La date est antérieure au début de la campagne (${campagne.start_date}).`
    } else if (campagne.end_date && dateProspection > campagne.end_date) {
      err = `La date est postérieure à la fin de la campagne (${campagne.end_date}).`
    }
    setFieldErrors((prev) => {
      if (err) return { ...prev, date_prospection: err }
      const { date_prospection: _, ...rest } = prev
      return rest
    })
  }, [campagneId, campagnes])

  // Déplacer le focus vers le heading de l'étape après navigation
  useEffect(() => {
    if (!stepChangedRef.current) return
    stepHeadingRef.current?.focus()
  }, [currentStep])

  const mutation = useMutation({
    mutationFn: (data: { statut: string }) =>
      api.post('/prospections', {
        type_prospection: 'intensive',
        campagne_id: campagneId,
        station_id: stationId || null,
        date_prospection: dateProspection,
        n_releve: nReleve || null,
        n_fiche: nFiche || null,
        latitude: parseNum(latitude),
        longitude: parseNum(longitude),
        altitude: parseNum(altitude),
        surf_station: parseNum(surfStation),
        surf_prospectee: parseNum(surfProspectee),
        surf_infestee: parseNum(surfInfestee),
        degats_cultures: degats || null,
        derniere_pluie: dernieresPluies || null,
        intensite_pluie: intensitePluie || null,
        ennemis_naturels: ennemis || null,
        observations: observations || null,
        vegetation: buildVegetation(),
        sol: buildSol(),
        captures: buildCaptures(),
        populations: buildPopulations(),
        infestations: buildInfestations(),
        statut: data.statut,
      }),
    onSuccess: () => {
      isSubmittedRef.current = true
      localStorage.removeItem(DRAFT_KEY)
      queryClient.invalidateQueries({ queryKey: ['prospections'] })
      navigate('/prospections')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErrors([msg ?? 'Erreur lors de la sauvegarde'])
    },
  })

  function buildVegetation() {
    const result: Record<string, unknown> = {}
    for (const { key } of STRATES_VEGETATION) {
      const s = vegetation[key]
      if (s.recouvrement || s.phenologie || s.activite) {
        result[key] = { recouvrement: s.recouvrement || null, phenologie: s.phenologie || null, activite: s.activite || null }
      }
    }
    return Object.keys(result).length ? result : null
  }

  function buildSol() {
    if (!sol.humidite && !sol.texture) return null
    return { humidite: sol.humidite || null, texture: sol.texture || null }
  }

  // Sérialise les captures : sexe forcé à null pour les larves (CHECK sexe IN F/M).
  function buildCaptures() {
    return captures.map((r) => ({
      espece: r.espece,
      categorie: r.categorie,
      sexe: r.categorie === 'larve' ? null : r.sexe || null,
      phase: r.phase,
      stade: r.stade,
      effectif: parseInt0(r.effectif) ?? 0,
    }))
  }

  // N'envoie que les lignes de population réellement renseignées (évite 4 lignes vides).
  function buildPopulations() {
    return populations
      .filter(
        (r) =>
          r.densite_diffuse ||
          r.densite_groupee ||
          r.captures_nombre ||
          r.temps_capture ||
          r.accouplement ||
          r.ponte,
      )
      .map((r) => ({
        espece: r.espece,
        categorie: r.categorie,
        densite_diffuse: parseNum(r.densite_diffuse),
        densite_groupee: parseNum(r.densite_groupee),
        captures_nombre: parseInt0(r.captures_nombre),
        temps_capture: parseInt0(r.temps_capture),
        accouplement: r.accouplement || null,
        ponte: r.ponte || null,
      }))
  }

  function buildInfestations() {
    return infestations.map((r) => ({
      espece: r.espece,
      type_cible: r.type_cible,
      taille_min: parseNum(r.taille_min),
      taille_max: parseNum(r.taille_max),
      taille_moy: parseNum(r.taille_moy),
      surface_tot: parseNum(r.surface_tot),
      densite_min: parseNum(r.densite_min),
      densite_max: parseNum(r.densite_max),
      densite_moy: parseNum(r.densite_moy),
      interdistance: parseNum(r.interdistance),
      comportement: r.comportement || null,
      direction_de: r.direction_de || null,
      direction_vers: r.direction_vers || null,
      vent_de: r.vent_de || null,
      vent_vitesse: parseNum(r.vent_vitesse),
    }))
  }

  // Validation finale (soumission) — tous les champs du formulaire.
  function validate(): boolean {
    const formValues = {
      campagne_id: campagneId,
      date_prospection: dateProspection,
      station_id: stationId,
      latitude,
      longitude,
      altitude,
      surf_station: surfStation,
      surf_prospectee: surfProspectee,
      surf_infestee: surfInfestee,
      captures,
    }

    const result = prospectionFormSchema.safeParse(formValues)
    const errs: Record<string, string> = {}
    const summary: string[] = []

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !errs[key]) errs[key] = issue.message
        summary.push(issue.message)
      }
    }

    const crossErrs = validateProspectionCrossFields(formValues, campagnes)
    for (const [key, msg] of Object.entries(crossErrs)) {
      if (!errs[key]) {
        errs[key] = msg
        summary.push(msg)
      }
    }

    setFieldErrors(errs)
    setErrors(summary)
    return summary.length === 0
  }

  // Validation par étape — ne vérifie que les champs de l'étape courante.
  function validateStep(step: number): boolean {
    const errs: Record<string, string> = {}

    if (step === 1) {
      if (!campagneId) errs.campagne_id = 'La campagne est obligatoire.'
      if (!dateProspection) errs.date_prospection = 'La date est obligatoire.'
      if (!stationId) errs.station_id = 'La station fixe est obligatoire pour une prospection intensive.'

      if (campagneId && dateProspection) {
        const campagne = campagnes.find((c) => c.id === campagneId)
        if (campagne) {
          if (dateProspection < campagne.start_date) {
            errs.date_prospection = `La date est antérieure au début de la campagne (${campagne.start_date}).`
          } else if (campagne.end_date && dateProspection > campagne.end_date) {
            errs.date_prospection = `La date est postérieure à la fin de la campagne (${campagne.end_date}).`
          }
        }
      }

      if (latitude) {
        const lat = parseFloat(latitude)
        if (isNaN(lat) || lat < -90 || lat > 90) errs.latitude = 'La latitude doit être comprise entre -90 et 90.'
      }
      if (longitude) {
        const lon = parseFloat(longitude)
        if (isNaN(lon) || lon < -180 || lon > 180) errs.longitude = 'La longitude doit être comprise entre -180 et 180.'
      }
      if (altitude) {
        const alt = parseFloat(altitude)
        if (isNaN(alt) || alt < 0) errs.altitude = "L'altitude doit être un nombre positif."
      }
      const sp = surfProspectee ? parseFloat(surfProspectee) : null
      const ss = surfStation ? parseFloat(surfStation) : null
      const si = surfInfestee ? parseFloat(surfInfestee) : null
      if (sp !== null && ss !== null && sp > ss)
        errs.surf_prospectee = 'La surface prospectée ne peut pas dépasser la surface de la station.'
      if (si !== null && sp !== null && si > sp)
        errs.surf_infestee = 'La surface infestée ne peut pas dépasser la surface prospectée.'
    } else if (step === 2) {
      const hasCapture = captures.some((c) => parseInt(c.effectif, 10) > 0)
      if (!hasCapture) errs.captures = 'Au moins une capture avec un effectif supérieur à 0 est requise.'
    }
    // Étapes 3 : tout optionnel, aucun blocage.

    setFieldErrors(errs)
    setErrors(Object.values(errs))
    return Object.keys(errs).length === 0
  }

  function goToStep(step: number) {
    stepChangedRef.current = true
    setCurrentStep(step)
    setErrors([])
    setFieldErrors({})
  }

  function handleNext() {
    const valid = validateStep(currentStep)
    if (!valid) return
    setCompletedSteps((prev) => { const s = new Set(prev); s.add(currentStep); return s })
    goToStep(currentStep + 1)
  }

  function handlePrev() {
    goToStep(currentStep - 1)
  }

  function applyDraft(draft: ProspectionDraftData) {
    setCampagneId(draft.campagneId)
    setStationId(draft.stationId)
    setStationSearch(draft.stationSearch)
    setDateProspection(draft.dateProspection)
    setNReleve(draft.nReleve)
    setNFiche(draft.nFiche)
    setLatitude(draft.latitude)
    setLongitude(draft.longitude)
    setAltitude(draft.altitude)
    setSurfStation(draft.surfStation)
    setSurfProspectee(draft.surfProspectee)
    setSurfInfestee(draft.surfInfestee)
    setDegats(draft.degats)
    setDernieresPluies(draft.dernieresPluies)
    setIntensitePluie(draft.intensitePluie)
    setEnnemis(draft.ennemis)
    setObservations(draft.observations)
    setNextId(draft.nextId)
    setCaptures(draft.captures)
    setPopulations(draft.populations)
    setInfestations(draft.infestations)
    setVegetation(draft.vegetation)
    setSol(draft.sol)
  }

  function handleSave(statut: 'brouillon' | 'en_attente') {
    if (!validate()) return
    mutation.mutate({ statut })
  }

  // --- Captures handlers ---
  function addCapture() {
    setCaptures((prev) => [...prev, emptyCapture(nextId)])
    setNextId((n) => n + 1)
  }

  function removeCapture(id: number) {
    setCaptures((prev) => prev.filter((r) => r.id !== id))
  }

  function updateCapture(id: number, field: keyof CaptureRow, value: string) {
    setCaptures((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === 'espece' || field === 'categorie') {
          const stades = getStades(
            field === 'espece' ? value : r.espece,
            field === 'categorie' ? value : r.categorie,
          )
          updated.stade = stades[0] ?? ''
        }
        return updated
      })
    )
  }

  // --- Populations handlers ---
  function updatePopulation(idx: number, field: keyof PopulationRow, value: string) {
    setPopulations((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  // --- Infestations handlers ---
  function addInfestation() {
    setInfestations((prev) => [...prev, emptyInfestation(nextId)])
    setNextId((n) => n + 1)
  }

  function removeInfestation(id: number) {
    setInfestations((prev) => prev.filter((r) => r.id !== id))
  }

  function updateInfestation(id: number, field: keyof InfestationRow, value: string) {
    setInfestations((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r))
  }

  // --- Végétation handlers ---
  function updateStrate(key: string, field: keyof StrateVegetation, value: string) {
    setVegetation((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  // Keep formRef fresh every render so the auto-save interval always reads latest state.
  formRef.current = {
    campagneId, stationId, stationSearch, dateProspection, nReleve, nFiche,
    latitude, longitude, altitude, surfStation, surfProspectee, surfInfestee,
    degats, dernieresPluies, intensitePluie, ennemis, observations,
    nextId, captures, populations, infestations, vegetation, sol,
  }

  const isPending = mutation.isPending

  // Auto-save toutes les 30s si l'état a changé depuis la dernière sauvegarde.
  useEffect(() => {
    if (isPending) return
    const id = setInterval(() => {
      const snap = JSON.stringify(formRef.current)
      if (snap === lastSnapshotRef.current) return
      const draft: ProspectionDraftData = { savedAt: new Date().toISOString(), ...formRef.current }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      lastSnapshotRef.current = snap
      setLastSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    }, 30_000)
    return () => clearInterval(id)
  }, [isPending])

  // Avertissement navigateur natif (onglet fermé, F5…)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmittedRef.current) return
      if (!formRef.current.campagneId && !formRef.current.stationId) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !isSubmittedRef.current &&
    (formRef.current.campagneId !== '' || formRef.current.stationId !== '') &&
    currentLocation.pathname !== nextLocation.pathname,
  )

  // Lookup helpers pour le récapitulatif
  const campagneLabel = campagnes.find((c) => c.id === campagneId)?.name ?? '—'
  const stationObj = stations.find((s) => s.id === stationId)
  const stationLabel = stationObj ? `${stationObj.code} — ${stationObj.nom}` : '—'
  const totalEffectif = captures.reduce((sum, c) => sum + (parseInt(c.effectif, 10) || 0), 0)
  const stratesRenseignees = Object.values(vegetation).filter((v) => v.recouvrement).length

  return (
    <>
      <a
        href="#step-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Aller au contenu
      </a>

      <div className="px-8 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/prospections')}>
            ← Retour
          </Button>
          <h1 className="text-2xl font-bold">Nouvelle fiche de prospection intensive</h1>
          {lastSavedAt && (
            <span className="ml-auto text-xs text-muted-foreground">
              Brouillon sauvegardé à {lastSavedAt}
            </span>
          )}
        </div>

        {/* Bannière de restauration de brouillon */}
        {storedDraft && !draftDismissed && (
          <div className="mb-4 flex items-center justify-between rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <span>
              Un brouillon du{' '}
              {new Date(storedDraft.savedAt).toLocaleDateString('fr-FR')} à{' '}
              {new Date(storedDraft.savedAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              existe.
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  applyDraft(storedDraft)
                  setDraftDismissed(true)
                }}
              >
                Reprendre
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY)
                  setDraftDismissed(true)
                }}
              >
                Commencer à zéro
              </Button>
            </div>
          </div>
        )}

        {/* Barre de progression */}
        <Stepper
          steps={STEPS}
          current={currentStep}
          completed={completedSteps}
          onStepClick={goToStep}
        />

        {/* Heading de l'étape (cible du focus après navigation) */}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="sr-only focus:not-sr-only focus:mb-4 focus:text-lg focus:font-semibold focus:outline-none"
        >
          Étape {currentStep} sur {STEPS.length} — {STEPS[currentStep - 1].label}
        </h2>

        {/* Erreurs de l'étape courante */}
        {errors.length > 0 && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Contenu de l'étape */}
        <div id="step-content">

          {/* ── Étape 1 : Informations générales + Localisation ── */}
          {currentStep === 1 && (
            <div role="group" aria-label="Étape 1 sur 4 : Informations générales et localisation">
              <div className="space-y-6">
                <Section title="1. Informations générales">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Campagne"
                      required
                      error={fieldErrors.campagne_id}
                      className="col-span-2"
                      fieldId="campagne"
                    >
                      <Select value={campagneId} onValueChange={(v) => setCampagneId(v ?? '')}>
                        <SelectTrigger
                          id="campagne"
                          aria-describedby={fieldErrors.campagne_id ? 'campagne-error' : undefined}
                        >
                          <SelectValue placeholder="Sélectionner une campagne" />
                        </SelectTrigger>
                        <SelectContent>
                          {campagnes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {campagnesEnCours.some((e) => e.id === c.id) && ' (en cours)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>

                    <div className="flex flex-col gap-4">
                      <FormField label="Date de prospection" required error={fieldErrors.date_prospection}>
                        <Input
                          id="date"
                          type="date"
                          value={dateProspection}
                          onChange={(e) => setDateProspection(e.target.value)}
                          aria-describedby={fieldErrors.date_prospection ? 'date-error' : undefined}
                        />
                      </FormField>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="n-releve">N° relevé</Label>
                          <Input id="n-releve" value={nReleve} onChange={(e) => setNReleve(e.target.value)} placeholder="ex: R-2026-001" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="n-fiche">N° fiche</Label>
                          <Input id="n-fiche" value={nFiche} onChange={(e) => setNFiche(e.target.value)} placeholder="ex: F-001" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="station">
                        Station fixe <span aria-hidden="true"> *</span>
                      </Label>
                      <Input
                        id="station-search"
                        type="text"
                        value={stationSearch}
                        onChange={(e) => setStationSearch(e.target.value)}
                        placeholder="Rechercher par nom ou code..."
                      />
                      <Select
                        value={stationId}
                        onValueChange={(v) => {
                          const id = v ?? ''
                          setStationId(id)
                          const station = stations.find((s) => s.id === id)
                          if (station) {
                            setLatitude(String(station.latitude))
                            setLongitude(String(station.longitude))
                            setAltitude(station.altitude != null ? String(station.altitude) : '')
                          }
                        }}
                      >
                        <SelectTrigger
                          id="station"
                          aria-describedby={fieldErrors.station_id ? 'station-error' : undefined}
                        >
                          <SelectValue placeholder="— Choisir une station —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— Choisir une station —</SelectItem>
                          {filteredStations.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} — {s.nom} ({s.pa_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.station_id && (
                        <p id="station-error" role="alert" aria-live="polite" className="text-sm text-destructive">
                          {fieldErrors.station_id}
                        </p>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="2. Localisation">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField label="Latitude" error={fieldErrors.latitude}>
                      <Input
                        id="lat"
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="-20.1234"
                        aria-describedby={fieldErrors.latitude ? 'lat-error' : undefined}
                      />
                    </FormField>
                    <FormField label="Longitude" error={fieldErrors.longitude}>
                      <Input
                        id="lon"
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="44.5678"
                        aria-describedby={fieldErrors.longitude ? 'lon-error' : undefined}
                      />
                    </FormField>
                    <FormField label="Altitude (m)" error={fieldErrors.altitude}>
                      <Input
                        id="alt"
                        type="number"
                        value={altitude}
                        onChange={(e) => setAltitude(e.target.value)}
                        placeholder="ex: 850"
                        aria-describedby={fieldErrors.altitude ? 'alt-error' : undefined}
                      />
                    </FormField>
                    <FormField label="Surface station (ha)" error={fieldErrors.surf_station}>
                      <Input
                        id="surf-station"
                        type="number"
                        step="any"
                        value={surfStation}
                        onChange={(e) => setSurfStation(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Surface prospectée (ha)" error={fieldErrors.surf_prospectee}>
                      <Input
                        id="surf-prospectee"
                        type="number"
                        step="any"
                        value={surfProspectee}
                        onChange={(e) => setSurfProspectee(e.target.value)}
                        aria-describedby={fieldErrors.surf_prospectee ? 'surf-prospectee-error' : undefined}
                      />
                    </FormField>
                    <FormField label="Surface infestée (ha)" error={fieldErrors.surf_infestee}>
                      <Input
                        id="surf-infestee"
                        type="number"
                        step="any"
                        value={surfInfestee}
                        onChange={(e) => setSurfInfestee(e.target.value)}
                        aria-describedby={fieldErrors.surf_infestee ? 'surf-infestee-error' : undefined}
                      />
                    </FormField>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {/* ── Étape 2 : Captures + Population acridienne ── */}
          {currentStep === 2 && (
            <div role="group" aria-label="Étape 2 sur 4 : Captures et population acridienne">
              <div className="space-y-6">
                <Section title="3. Captures">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-2 font-medium">Espèce</th>
                          <th className="pb-2 pr-2 font-medium">Catégorie</th>
                          <th className="pb-2 pr-2 font-medium">Stade</th>
                          <th className="pb-2 pr-2 font-medium">Sexe</th>
                          <th className="pb-2 pr-2 font-medium">Phase</th>
                          <th className="pb-2 pr-2 font-medium">Effectif</th>
                          <th className="pb-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {captures.map((row) => {
                          const stades = getStades(row.espece, row.categorie)
                          return (
                            <tr key={row.id} className="py-1">
                              <td className="pr-2 py-1">
                                <Select value={row.espece} onValueChange={(v) => updateCapture(row.id, 'espece', v ?? '')}>
                                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="LMC">LMC</SelectItem>
                                    <SelectItem value="NSE">NSE</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="pr-2 py-1">
                                <Select value={row.categorie} onValueChange={(v) => updateCapture(row.id, 'categorie', v ?? '')}>
                                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="imago">Imago</SelectItem>
                                    <SelectItem value="larve">Larve</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="pr-2 py-1">
                                <Select value={row.stade} onValueChange={(v) => updateCapture(row.id, 'stade', v ?? '')}>
                                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {stades.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="pr-2 py-1">
                                <Select
                                  value={row.sexe}
                                  onValueChange={(v) => updateCapture(row.id, 'sexe', v ?? '')}
                                  disabled={row.categorie === 'larve'}
                                >
                                  <SelectTrigger className="w-16"><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="M">M</SelectItem>
                                    <SelectItem value="F">F</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="pr-2 py-1">
                                <Select value={row.phase} onValueChange={(v) => updateCapture(row.id, 'phase', v ?? '')}>
                                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {PHASES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="pr-2 py-1">
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-20"
                                  value={row.effectif}
                                  onChange={(e) => updateCapture(row.id, 'effectif', e.target.value)}
                                />
                              </td>
                              <td className="py-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeCapture(row.id)}
                                  type="button"
                                >
                                  ✕
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {fieldErrors.captures && (
                    <p role="alert" aria-live="polite" className="mt-2 text-sm text-destructive">
                      {fieldErrors.captures}
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="mt-3" onClick={addCapture} type="button">
                    + Ajouter une ligne
                  </Button>
                </Section>

                <Section title="4. Population acridienne (densités)">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-2 font-medium">Espèce</th>
                          <th className="pb-2 pr-2 font-medium">Cat.</th>
                          <th className="pb-2 pr-2 font-medium">D. diffuse (/ha)</th>
                          <th className="pb-2 pr-2 font-medium">D. groupée (/m²)</th>
                          <th className="pb-2 pr-2 font-medium">Nb captures</th>
                          <th className="pb-2 pr-2 font-medium">Temps (min)</th>
                          <th className="pb-2 pr-2 font-medium">Accouplement</th>
                          <th className="pb-2 font-medium">Ponte</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {populations.map((row, idx) => (
                          <tr key={`${row.espece}-${row.categorie}`}>
                            <td className="pr-2 py-1 font-medium">{row.espece}</td>
                            <td className="pr-2 py-1 capitalize">{row.categorie}</td>
                            <td className="pr-2 py-1">
                              <Input type="number" step="any" className="w-24" value={row.densite_diffuse} onChange={(e) => updatePopulation(idx, 'densite_diffuse', e.target.value)} />
                            </td>
                            <td className="pr-2 py-1">
                              <Input type="number" step="any" className="w-24" value={row.densite_groupee} onChange={(e) => updatePopulation(idx, 'densite_groupee', e.target.value)} />
                            </td>
                            <td className="pr-2 py-1">
                              <Input type="number" className="w-20" value={row.captures_nombre} onChange={(e) => updatePopulation(idx, 'captures_nombre', e.target.value)} />
                            </td>
                            <td className="pr-2 py-1">
                              <Input type="number" className="w-20" value={row.temps_capture} onChange={(e) => updatePopulation(idx, 'temps_capture', e.target.value)} />
                            </td>
                            <td className="pr-2 py-1">
                              <Select value={row.accouplement} onValueChange={(v) => updatePopulation(idx, 'accouplement', v ?? '')}>
                                <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {ABONDANCE.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-1">
                              <Select value={row.ponte} onValueChange={(v) => updatePopulation(idx, 'ponte', v ?? '')}>
                                <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {ABONDANCE.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Infestation + Végétation + Sol ── */}
          {currentStep === 3 && (
            <div role="group" aria-label="Étape 3 sur 4 : Infestation, végétation et sol">
              <div className="space-y-6">
                <Section title="5. Infestation (taches, bandes, vols, essaims)">
                  {infestations.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Aucune infestation enregistrée.</p>
                  )}
                  <div className="space-y-4">
                    {infestations.map((row, idx) => (
                      <div key={row.id} className="border rounded p-3 relative">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeInfestation(row.id)}
                          type="button"
                        >
                          ✕ Supprimer
                        </Button>
                        <p className="text-xs font-medium mb-3 text-muted-foreground">Infestation #{idx + 1}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-2">
                            <Label>Espèce</Label>
                            <Select value={row.espece} onValueChange={(v) => updateInfestation(row.id, 'espece', v ?? '')}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LMC">LMC</SelectItem>
                                <SelectItem value="NSE">NSE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Type</Label>
                            <Select value={row.type_cible} onValueChange={(v) => updateInfestation(row.id, 'type_cible', v ?? '')}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TYPES_INFESTATION.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Comportement</Label>
                            <Select value={row.comportement} onValueChange={(v) => updateInfestation(row.id, 'comportement', v ?? '')}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="repos">Repos</SelectItem>
                                <SelectItem value="deplacement">Déplacement</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Taille min (ha)</Label>
                            <Input type="number" step="any" value={row.taille_min} onChange={(e) => updateInfestation(row.id, 'taille_min', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Taille moy (ha)</Label>
                            <Input type="number" step="any" value={row.taille_moy} onChange={(e) => updateInfestation(row.id, 'taille_moy', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Taille max (ha)</Label>
                            <Input type="number" step="any" value={row.taille_max} onChange={(e) => updateInfestation(row.id, 'taille_max', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Surface tot. (ha)</Label>
                            <Input type="number" step="any" value={row.surface_tot} onChange={(e) => updateInfestation(row.id, 'surface_tot', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Densité min</Label>
                            <Input type="number" step="any" value={row.densite_min} onChange={(e) => updateInfestation(row.id, 'densite_min', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Densité moy</Label>
                            <Input type="number" step="any" value={row.densite_moy} onChange={(e) => updateInfestation(row.id, 'densite_moy', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Densité max</Label>
                            <Input type="number" step="any" value={row.densite_max} onChange={(e) => updateInfestation(row.id, 'densite_max', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Interdistance (m)</Label>
                            <Input type="number" step="any" value={row.interdistance} onChange={(e) => updateInfestation(row.id, 'interdistance', e.target.value)} />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Direction de</Label>
                            <Input value={row.direction_de} onChange={(e) => updateInfestation(row.id, 'direction_de', e.target.value)} placeholder="ex: N, NE…" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Direction vers</Label>
                            <Input value={row.direction_vers} onChange={(e) => updateInfestation(row.id, 'direction_vers', e.target.value)} placeholder="ex: S, SW…" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Vent de</Label>
                            <Input value={row.vent_de} onChange={(e) => updateInfestation(row.id, 'vent_de', e.target.value)} placeholder="ex: N" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Vitesse vent (km/h)</Label>
                            <Input type="number" step="any" value={row.vent_vitesse} onChange={(e) => updateInfestation(row.id, 'vent_vitesse', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addInfestation} type="button">
                    + Ajouter une infestation
                  </Button>
                </Section>

                <Section title="6. Végétation (strates ORPAD)">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-3 font-medium w-48">Strate</th>
                          <th className="pb-2 pr-3 font-medium">Recouvrement (%)</th>
                          <th className="pb-2 pr-3 font-medium">Phénologie</th>
                          <th className="pb-2 font-medium">Activité végétative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {STRATES_VEGETATION.map(({ key, label }) => (
                          <tr key={key}>
                            <td className="pr-3 py-2 text-xs text-muted-foreground">{label}</td>
                            <td className="pr-3 py-2">
                              <Select value={vegetation[key].recouvrement} onValueChange={(v) => updateStrate(key, 'recouvrement', v ?? '')}>
                                <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {RECOUVREMENT_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r} %</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="pr-3 py-2">
                              <Select value={vegetation[key].phenologie} onValueChange={(v) => updateStrate(key, 'phenologie', v ?? '')}>
                                <SelectTrigger className="w-32"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {PHENOLOGIE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2">
                              <Select value={vegetation[key].activite} onValueChange={(v) => updateStrate(key, 'activite', v ?? '')}>
                                <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  {ACTIVITE_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section title="7. Sol">
                  <div className="grid grid-cols-2 gap-4 max-w-sm">
                    <div className="flex flex-col gap-2">
                      <Label>Humidité du sol</Label>
                      <Select value={sol.humidite} onValueChange={(v) => setSol((s) => ({ ...s, humidite: v ?? '' }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {HUMIDITE_SOL.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Texture du sol</Label>
                      <Select value={sol.texture} onValueChange={(v) => setSol((s) => ({ ...s, texture: v ?? '' }))}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {TEXTURE_SOL.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Conditions environnementales + Récapitulatif ── */}
          {currentStep === 4 && (
            <div role="group" aria-label="Étape 4 sur 4 : Conditions environnementales et récapitulatif">
              <div className="space-y-6">
                <Section title="8. Conditions environnementales">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="degats">Dégâts cultures</Label>
                      <Select value={degats} onValueChange={(v) => setDegats(v ?? '')}>
                        <SelectTrigger id="degats"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nuls">Nuls</SelectItem>
                          <SelectItem value="faibles">Faibles</SelectItem>
                          <SelectItem value="moyens">Moyens</SelectItem>
                          <SelectItem value="forts">Forts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="derniere-pluie">Dernière pluie</Label>
                      <Input id="derniere-pluie" type="date" value={dernieresPluies} onChange={(e) => setDernieresPluies(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="intensite-pluie">Intensité pluie</Label>
                      <Input id="intensite-pluie" value={intensitePluie} onChange={(e) => setIntensitePluie(e.target.value)} placeholder="ex: forte, faible…" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="ennemis">Ennemis naturels</Label>
                      <Input id="ennemis" value={ennemis} onChange={(e) => setEnnemis(e.target.value)} placeholder="ex: parasites, prédateurs…" />
                    </div>
                    <div className="col-span-2 flex flex-col gap-2">
                      <Label htmlFor="observations">Observations</Label>
                      <Textarea
                        id="observations"
                        rows={3}
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Observations libres…"
                        className="resize-none"
                      />
                    </div>
                  </div>
                </Section>

                {/* Récapitulatif des étapes 1–3 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Récapitulatif</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">

                    {/* Étape 1 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">Étape 1 — Général &amp; Localisation</h3>
                        <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>Modifier</Button>
                      </div>
                      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Campagne</dt>
                        <dd>{campagneLabel}</dd>
                        <dt className="text-muted-foreground">Date</dt>
                        <dd>{dateProspection || '—'}</dd>
                        <dt className="text-muted-foreground">Station</dt>
                        <dd>{stationLabel}</dd>
                        {nReleve && <><dt className="text-muted-foreground">N° relevé</dt><dd>{nReleve}</dd></>}
                        {nFiche && <><dt className="text-muted-foreground">N° fiche</dt><dd>{nFiche}</dd></>}
                        {latitude && (
                          <>
                            <dt className="text-muted-foreground">Coordonnées</dt>
                            <dd>{latitude}, {longitude}{altitude ? `, alt. ${altitude} m` : ''}</dd>
                          </>
                        )}
                        {surfStation && (
                          <>
                            <dt className="text-muted-foreground">Surfaces (ha)</dt>
                            <dd>
                              Station : {surfStation}
                              {surfProspectee ? ` · Prospectée : ${surfProspectee}` : ''}
                              {surfInfestee ? ` · Infestée : ${surfInfestee}` : ''}
                            </dd>
                          </>
                        )}
                      </dl>
                    </div>

                    <hr />

                    {/* Étape 2 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">Étape 2 — Captures &amp; Population</h3>
                        <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>Modifier</Button>
                      </div>
                      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Captures</dt>
                        <dd>{captures.length} ligne(s) — effectif total : {totalEffectif}</dd>
                        {populations.some((r) => r.densite_diffuse || r.densite_groupee) && (
                          <>
                            <dt className="text-muted-foreground">Populations</dt>
                            <dd>Données de densité renseignées</dd>
                          </>
                        )}
                      </dl>
                    </div>

                    <hr />

                    {/* Étape 3 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">Étape 3 — Infestation, Végétation &amp; Sol</h3>
                        <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>Modifier</Button>
                      </div>
                      <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Infestations</dt>
                        <dd>{infestations.length} enregistrée(s)</dd>
                        <dt className="text-muted-foreground">Végétation</dt>
                        <dd>{stratesRenseignees} strate(s) renseignée(s)</dd>
                        <dt className="text-muted-foreground">Sol</dt>
                        <dd>
                          {sol.humidite || sol.texture
                            ? [sol.humidite, sol.texture].filter(Boolean).join(' · ')
                            : 'Non renseigné'}
                        </dd>
                      </dl>
                    </div>

                  </CardContent>
                </Card>
              </div>
            </div>
          )}

        </div>

        {/* Navigation entre étapes */}
        <div className="flex items-center justify-between mt-6 pb-8">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            ← Précédent
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Suivant →
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave('brouillon')}
                disabled={isPending}
              >
                {isPending ? 'Enregistrement…' : 'Sauvegarder (brouillon)'}
              </Button>
              <Button
                onClick={() => handleSave('en_attente')}
                disabled={isPending}
              >
                {isPending ? 'Envoi…' : 'Soumettre'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de confirmation de navigation */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <p className="mb-4 text-sm">
              Des modifications non soumises seront perdues. Quitter quand même ?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => blocker.reset()}>
                Rester
              </Button>
              <Button variant="destructive" size="sm" onClick={() => blocker.proceed()}>
                Quitter
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
