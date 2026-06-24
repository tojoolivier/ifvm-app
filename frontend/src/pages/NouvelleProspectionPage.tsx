import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

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

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface Campagne {
  id: string
  name: string
  start_date: string
  end_date: string | null
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

  // --- données ---
  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
  })

  // Auto-sélection de la campagne en cours si unique
  const campagnesEnCours = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return campagnes.filter(
      (c) => c.start_date <= today && (c.end_date === null || c.end_date >= today)
    )
  }, [campagnes])

  useMemo(() => {
    if (campagnesEnCours.length === 1 && !campagneId) {
      setCampagneId(campagnesEnCours[0].id)
    }
  }, [campagnesEnCours, campagneId])

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
        statut: data.statut,
      }),
    onSuccess: () => {
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

  function validate(): boolean {
    const errs: string[] = []
    if (!campagneId) errs.push('La campagne est obligatoire.')
    if (!dateProspection) errs.push('La date est obligatoire.')
    setErrors(errs)
    return errs.length === 0
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
        // Réinitialiser le stade si l'espèce ou la catégorie change
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

  const isPending = mutation.isPending

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/prospections')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </button>
        <h1 className="text-2xl font-bold">Nouvelle fiche de prospection intensive</h1>
      </div>

      {errors.length > 0 && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-disc list-inside space-y-1">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1 : Informations générales */}
        <Section title="1. Informations générales">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="campagne">
                Campagne <span className="text-red-500">*</span>
              </Label>
              <Select value={campagneId} onValueChange={(v) => setCampagneId(v ?? '')}>
                <SelectTrigger id="campagne">
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
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="date">
                Date de prospection <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={dateProspection}
                onChange={(e) => setDateProspection(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="station">Station fixe (ID)</Label>
              <Input
                id="station"
                type="text"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                placeholder="UUID de la station (optionnel)"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="n-releve">N° relevé</Label>
              <Input id="n-releve" value={nReleve} onChange={(e) => setNReleve(e.target.value)} placeholder="ex: R-2026-001" />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="n-fiche">N° fiche</Label>
              <Input id="n-fiche" value={nFiche} onChange={(e) => setNFiche(e.target.value)} placeholder="ex: F-001" />
            </div>
          </div>
        </Section>

        {/* Section 2 : Localisation */}
        <Section title="2. Localisation">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-20.1234" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="lon">Longitude</Label>
              <Input id="lon" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="44.5678" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="alt">Altitude (m)</Label>
              <Input id="alt" type="number" value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="ex: 850" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="surf-station">Surface station (ha)</Label>
              <Input id="surf-station" type="number" step="any" value={surfStation} onChange={(e) => setSurfStation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="surf-prospectee">Surface prospectée (ha)</Label>
              <Input id="surf-prospectee" type="number" step="any" value={surfProspectee} onChange={(e) => setSurfProspectee(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="surf-infestee">Surface infestée (ha)</Label>
              <Input id="surf-infestee" type="number" step="any" value={surfInfestee} onChange={(e) => setSurfInfestee(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Section 3 : Captures */}
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
                        <button
                          onClick={() => removeCapture(row.id)}
                          className="text-red-500 hover:text-red-700 text-xs px-1"
                          type="button"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={addCapture} type="button">
            + Ajouter une ligne
          </Button>
        </Section>

        {/* Section 4 : Population acridienne */}
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

        {/* Section 5 : Infestation */}
        <Section title="5. Infestation (taches, bandes, vols, essaims)">
          {infestations.length === 0 && (
            <p className="text-sm text-muted-foreground mb-3">Aucune infestation enregistrée.</p>
          )}
          <div className="space-y-4">
            {infestations.map((row, idx) => (
              <div key={row.id} className="border rounded p-3 relative">
                <button
                  onClick={() => removeInfestation(row.id)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs"
                  type="button"
                >
                  ✕ Supprimer
                </button>
                <p className="text-xs font-medium mb-3 text-muted-foreground">Infestation #{idx + 1}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label>Espèce</Label>
                    <Select value={row.espece} onValueChange={(v) => updateInfestation(row.id, 'espece', v ?? '')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LMC">LMC</SelectItem>
                        <SelectItem value="NSE">NSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Type</Label>
                    <Select value={row.type_cible} onValueChange={(v) => updateInfestation(row.id, 'type_cible', v ?? '')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES_INFESTATION.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Comportement</Label>
                    <Select value={row.comportement} onValueChange={(v) => updateInfestation(row.id, 'comportement', v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repos">Repos</SelectItem>
                        <SelectItem value="deplacement">Déplacement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Taille min (ha)</Label>
                    <Input type="number" step="any" value={row.taille_min} onChange={(e) => updateInfestation(row.id, 'taille_min', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Taille moy (ha)</Label>
                    <Input type="number" step="any" value={row.taille_moy} onChange={(e) => updateInfestation(row.id, 'taille_moy', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Taille max (ha)</Label>
                    <Input type="number" step="any" value={row.taille_max} onChange={(e) => updateInfestation(row.id, 'taille_max', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Surface tot. (ha)</Label>
                    <Input type="number" step="any" value={row.surface_tot} onChange={(e) => updateInfestation(row.id, 'surface_tot', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Densité min</Label>
                    <Input type="number" step="any" value={row.densite_min} onChange={(e) => updateInfestation(row.id, 'densite_min', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Densité moy</Label>
                    <Input type="number" step="any" value={row.densite_moy} onChange={(e) => updateInfestation(row.id, 'densite_moy', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Densité max</Label>
                    <Input type="number" step="any" value={row.densite_max} onChange={(e) => updateInfestation(row.id, 'densite_max', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Interdistance (m)</Label>
                    <Input type="number" step="any" value={row.interdistance} onChange={(e) => updateInfestation(row.id, 'interdistance', e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Direction de</Label>
                    <Input value={row.direction_de} onChange={(e) => updateInfestation(row.id, 'direction_de', e.target.value)} placeholder="ex: N, NE…" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Direction vers</Label>
                    <Input value={row.direction_vers} onChange={(e) => updateInfestation(row.id, 'direction_vers', e.target.value)} placeholder="ex: S, SW…" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Vent de</Label>
                    <Input value={row.vent_de} onChange={(e) => updateInfestation(row.id, 'vent_de', e.target.value)} placeholder="ex: N" />
                  </div>
                  <div className="flex flex-col gap-1">
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

        {/* Section 6 : Végétation */}
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

        {/* Section 7 : Sol */}
        <Section title="7. Sol">
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="flex flex-col gap-1">
              <Label>Humidité du sol</Label>
              <Select value={sol.humidite} onValueChange={(v) => setSol((s) => ({ ...s, humidite: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {HUMIDITE_SOL.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
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

        {/* Section 8 : Conditions environnementales */}
        <Section title="8. Conditions environnementales">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="derniere-pluie">Dernière pluie</Label>
              <Input id="derniere-pluie" type="date" value={dernieresPluies} onChange={(e) => setDernieresPluies(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="intensite-pluie">Intensité pluie</Label>
              <Input id="intensite-pluie" value={intensitePluie} onChange={(e) => setIntensitePluie(e.target.value)} placeholder="ex: forte, faible…" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ennemis">Ennemis naturels</Label>
              <Input id="ennemis" value={ennemis} onChange={(e) => setEnnemis(e.target.value)} placeholder="ex: parasites, prédateurs…" />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="observations">Observations</Label>
              <textarea
                id="observations"
                rows={3}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Observations libres…"
              />
            </div>
          </div>
        </Section>

        {/* Boutons d'action */}
        <div className="flex gap-3 pb-8">
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
          <Button
            variant="ghost"
            onClick={() => navigate('/prospections')}
            disabled={isPending}
          >
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}
