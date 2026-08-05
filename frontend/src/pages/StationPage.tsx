// pages/StationPage.tsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Plus, Edit, Trash2, Search, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Station {
  id: string
  nom: string
  code: string
  commune: string
  region: string
  district: string
  zone: string
  poste: string
  type: string
  statut: string
  latitude?: number
  longitude?: number
  altitude?: number
  responsable?: string
  contact?: string
  observations?: string
  dateCreation: string
  dateMiseEnService?: string
}

const TYPES = ['meteo', 'pluviométrie', 'vent', 'température']
const STATUTS = ['active', 'inactive', 'maintenance']

// ─────────────────────────────────────────────────────────────
// ✅ Hiérarchie administrative : Région → Districts
// ⚠️ Sofia (Antsohihy) et Ihorombe (Ihosy) ajoutées car présentes
//    dans tes zones antiacridiennes mais absentes de la liste
//    d'origine (Diana + ex-province de Toliara). À confirmer.
// ─────────────────────────────────────────────────────────────
const REGION_DISTRICTS: Record<string, string[]> = {
  Diana: [
    'Antsiranana I',
    'Antsiranana II',
    'Ambanja',
    'Ambilobe',
    'Antsakoamanondro',
    'Nosy Be',
  ],
  Sofia: ['Antsohihy'], // ⚠️ à compléter si d'autres districts de Sofia sont utilisés
  Ihorombe: ['Ihosy'], // ⚠️ à compléter si d'autres districts d'Ihorombe sont utilisés
  'Atsimo-Andrefana': [
    'Ampanihy',
    'Ankazoabo',
    'Benenitra',
    'Beroroha',
    'Betioky',
    'Morombe',
    'Sakaraha',
    'Toliara I',
    'Toliara II',
  ],
  Androy: ['Ambovombe', 'Bekily', 'Beloha', 'Tsihombe'],
  Anosy: ['Amboasary Sud', 'Betroka', 'Tôlanaro'],
  Menabe: ['Belo-sur-Tsiribihina', 'Mahabo', 'Manja', 'Miandrivazo', 'Morondava'],
}

// ─────────────────────────────────────────────────────────────
// ✅ Zones et postes : listes plates indépendantes (structure
// d'origine conservée telle quelle, non rattachées à un district).
// ─────────────────────────────────────────────────────────────
const ZONES = [
  'Ambovombe Androy',
  'Ampanihy Ouest',
  'Akilizato',
  'Antsohihy',
  'Befandriana Sud',
  'Ejeda',
  'Ihosy',
  'Sakaraha',
]

const POSTES = [
  'Ambovombe',
  'Bekily',
  'Beloha',
  'Tsihombe',
  'Ampanihy',
  'Ejeda',
  'Betioky Sud',
  'Sakaraha',
  'Morombe',
  'Toliara',
  'Ihosy',
  'Ranohira',
  'Akilizato',
  'Miandrivazo',
  'Antsohihy',
  'Befandriana Sud',
]

// ─────────────────────────────────────────────────────────────
// ✅ Hiérarchie : District → Communes
// Source : jeu de données public (github.com/raherygino/madagascar-data),
// croisé avec les sources IFVM/officielles déjà vérifiées (Ejeda,
// Fotadrevo, Itampolo, Beahitse confirmées dans le district d'Ampanihy).
// ⚠️ INCOMPLET par endroits — ex. Ampanihy compte ~20 communes
// officiellement, seulement 13 trouvées ici ; Morombe en compte 8,
// seulement 3 trouvées. À compléter avec les données officielles
// IFVM/INSTAT quand tu les auras.
// ⚠️ Antsiranana I, Nosy Be et Toliara I sont des districts à commune
// unique (la commune = le district) — absents du jeu de données
// utilisé, donc pas encore dans la liste ci-dessous.
// ─────────────────────────────────────────────────────────────
const DISTRICT_COMMUNES: Record<string, string[]> = {
  'Antsiranana II': ['Ambondrona', 'Andrafiabe', 'Andranofanjava', 'Andranovondronina', 'Anketrakabe', 'Antanamitarana', 'Antsahampano', 'Antsalaka', 'Antsoha', 'Bobakilandy', 'Bobasakoa', 'Mahalina', 'Mahavanona', 'Mangaoka', 'Mosorolava', 'Ramena', 'Sadjoavato', 'Sakaramy'],
  Ambanja: ['Ambalahonko', 'Ambanja', 'Ambodimanga', 'Ambohimarina', 'Ankatafa', 'Antafiambotry', 'Antranokarany', 'Antsahabe', 'Antsakoamanondro', 'Antsatsaka', 'Antsirabe', 'Benavony', 'Djangoa', 'Maevatanana', 'Maherivaratra', 'Marotolana', 'Marovato'],
  Ambilobe: ['Ambakirano', 'Ambarakaraka', 'Ambilobe', 'Ambodibonara', 'Ampondralava', 'Antanambe', 'Antsaravibe', 'Antsohimbondrona', 'Beramanja', 'Manambato', 'Mantaly'],
  Antsohihy: ['Ambodimanary', 'Ambodimandresy', 'Anahidrano', 'Andreba', 'Anjalazala', 'Ankerika', 'Antsahabe', 'Antsohihy', 'Maroala'],
  Ihosy: ['Ambatolahy', 'Ambia', 'Analaliry', 'Analavoka', 'Andiolava', 'Ankily', 'Ihosy', 'Ilakaka', 'Irina', 'Mahasoa', 'Ranohira', 'Sahambano', 'Sakalalina', 'Satrokala', 'Soamatasy', 'Zazafotsy'],
  Ampanihy: ['Ampanihy', 'Androka', 'Ankiliabo', 'Ankilimivory', 'Ankilizato', 'Antaly', 'Beahitse', 'Ejeda', 'Fotadrevo', 'Gogogogo', 'Itampolo', 'Maniry', 'Vohitany'],
  Ankazoabo: ['Andranomafana', 'Berenty', 'Tandrano'],
  Benenitra: ['Benenitra', 'Ehara', 'Ianapera'],
  Beroroha: ['Bemavo', 'Beroroha', 'Fanjakana', 'Mandronarivo', 'Marerano', 'Sakena', 'Tanamary'],
  Betioky: ['Andranomangatsiaka', 'Antohabato', 'Beantake', 'Belamoty', 'Bezaha', 'Fenoandala', 'Lazarivo', 'Manalobe', 'Masiaboay', 'Montifeno', 'Salobe', 'Soamanonga', 'Soaserana', 'Tameantsoa', 'Tongobory', 'Vatolatsaka'],
  Morombe: ['Ambahikily', 'Basibasy', 'Befandefa'],
  Sakaraha: ['Ambinany', 'Amboronabo', 'Andranolava', 'Bereketa', 'Mahaboboka', 'Mihavatsy', 'Mikoboka', 'Mitsinjo', 'Sakaraha'],
  'Toliara II': ['Ambohimahavelona', 'Ambolofoty', 'Analamisampy', 'Andranovory', 'Ankilimalinike', 'Behompy', 'Belalanda', 'Marofoty', 'Maromiandra', 'Milenaka', 'Tsianisiha'],
  Ambovombe: ['Ambazoa', 'Ambohimalaza', 'Ambonaivo', 'Ambondro', 'Ambovombe', 'Ampamata', 'Andalatanosy', 'Erada', 'Imanombo', 'Jafaro', 'Maroalomainty', 'Maroalopoty', 'Sihanamaro'],
  Bekily: ['Ambahita', 'Ambatosola', 'Antsakoamaro', 'Bekitro', 'Beraketa', 'Beteza', 'Bevitiky', 'Manakompy', 'Maroviro', 'Tanandava', 'Tsikolaky', 'Vohimanga'],
  Beloha: ['Beloha', 'Kopoky', 'Marolinta', 'Tranoroa', 'Tranovaho'],
  Tsihombe: ['Antaritarika', 'Imongy', 'Marovato', 'Tsihombe'],
  'Amboasary Sud': ['Behara', 'Ebelo', 'Elonty', 'Esira', 'Ifotaka', 'Mahaly', 'Manevy', 'Maromby', 'Marotsiraka', 'Sampona', 'Tranomaro', 'Tsivory'],
  Betroka: ['Ambalasoa', 'Ambatomivary', 'Analamary', 'Andriandampy', 'Bekorobo', 'Betroka', 'Iaborotra', 'Ianabinda', 'Ianakafy', 'Isoanala', 'Ivahona', 'Jangany', 'Mahabo', 'Naninora'],
  Tôlanaro: ['Ambatoabo', 'Ampasimena', 'Analamary', 'Analapatsy', 'Ankaramena', 'Bevoay', 'Enakara-Haut', 'Enaniliha', 'Ifarantsa', 'Isaka-Ivondro', 'Mahatalaky', 'Manambaro', 'Manantenina', 'Mandiso', 'Ranomafana', 'Ranopiso', 'Soanierana'],
  'Belo-sur-Tsiribihina': ['Ambiky', 'Ankalalobe', 'Antsoha', 'Belinta', 'Berevo', 'Masoarivo', 'Tsaraotana', 'Tsimafana'],
  Mahabo: ['Ambia', 'Ampanihy', 'Ankilivalo', 'Ankilizato', 'Befotaka', 'Beronono', 'Mahabo', 'Malaimbandy', 'Mandabe'],
  Manja: ['Andranopasy', 'Ankiliabo', 'Beharona', 'Manja', 'Soaserana'],
  Miandrivazo: ['Ambatolahy', 'Ampanihy', 'Ankavandra', 'Ankondromena', 'Ankotrofotsy', 'Anosimena', 'Bemahatazana', 'Betsipolitra', 'Dabolava', 'Isalo', 'Itondy', 'Manambina', 'Manandaza', 'Miandrivazo', 'Soaloka'],
  Morondava: ['Analaiva', 'Befasy', 'Bemanonga', 'Morondava'],
}

const getCommunesForDistrict = (district: string): string[] => DISTRICT_COMMUNES[district] ?? []

const REGIONS = Object.keys(REGION_DISTRICTS)

export function StationPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatut, setSelectedStatut] = useState('all')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedZone, setSelectedZone] = useState('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [formData, setFormData] = useState({
    nom: '',
    code: '',
    commune: '',
    region: '',
    district: '',
    zone: '',
    poste: '',
    type: 'meteo',
    statut: 'active',
    latitude: '',
    longitude: '',
    altitude: '',
    responsable: '',
    contact: '',
    observations: '',
    dateMiseEnService: ''
  })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [stats, setStats] = useState({ total: 0, actives: 0, maintenance: 0, inactives: 0 })

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/stations')
      setStations(data)

      const total = data.length
      const actives = data.filter((s: Station) => s.statut === 'active').length
      const maintenance = data.filter((s: Station) => s.statut === 'maintenance').length
      const inactives = data.filter((s: Station) => s.statut === 'inactive').length
      setStats({ total, actives, maintenance, inactives })
      setError('')
    } catch {
      setError('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  // ✅ Listes dérivées pour la BARRE DE FILTRES (cascade)
  // ─────────────────────────────────────────────────────────
  const filterDistricts = useMemo(() => {
    if (selectedRegion === 'all') {
      return Object.values(REGION_DISTRICTS).flat()
    }
    return REGION_DISTRICTS[selectedRegion] ?? []
  }, [selectedRegion])

  // Quand la région change dans les filtres, on réinitialise le district (incohérent sinon)
  const handleFilterRegionChange = (region: string) => {
    setSelectedRegion(region)
    setSelectedDistrict('all')
  }

  // ✅ Filtrage
  const filtered = stations.filter(s => {
    const matchSearch = s.nom.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.commune.toLowerCase().includes(search.toLowerCase())
    const matchType = selectedType === 'all' || s.type === selectedType
    const matchStatut = selectedStatut === 'all' || s.statut === selectedStatut
    const matchRegion = selectedRegion === 'all' || s.region === selectedRegion
    const matchDistrict = selectedDistrict === 'all' || s.district === selectedDistrict
    const matchZone = selectedZone === 'all' || s.zone === selectedZone
    return matchSearch && matchType && matchStatut && matchRegion && matchDistrict && matchZone
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const currentStations = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  // ─────────────────────────────────────────────────────────
  // ✅ Listes dérivées pour le FORMULAIRE (cascade stricte)
  // ─────────────────────────────────────────────────────────
  const formDistricts = useMemo(
    () => (formData.region ? REGION_DISTRICTS[formData.region] ?? [] : []),
    [formData.region]
  )

  const formCommunes = useMemo(
    () => (formData.district ? getCommunesForDistrict(formData.district) : []),
    [formData.district]
  )

  // ✅ Handlers de cascade dans le formulaire : changer la région
  // réinitialise le district et la commune (dépendants). Changer le
  // district réinitialise la commune. Zone et Poste restent indépendants.
  const handleFormRegionChange = (region: string) => {
    setFormData(prev => ({ ...prev, region, district: '', commune: '' }))
  }

  const handleFormDistrictChange = (district: string) => {
    setFormData(prev => ({ ...prev, district, commune: '' }))
  }

  const handleCreate = () => {
    setModalMode('create')
    setSelectedStation(null)
    setFormData({
      nom: '', code: '', commune: '', region: '', district: '',
      zone: '', poste: '', type: 'meteo', statut: 'active',
      latitude: '', longitude: '', altitude: '', responsable: '',
      contact: '', observations: '', dateMiseEnService: ''
    })
    setFormError('')
    setFormSuccess('')
    setIsModalOpen(true)
  }

  const handleEdit = (station: Station) => {
    setModalMode('edit')
    setSelectedStation(station)
    setFormData({
      nom: station.nom,
      code: station.code,
      commune: station.commune,
      region: station.region,
      district: station.district,
      zone: station.zone,
      poste: station.poste,
      type: station.type,
      statut: station.statut,
      latitude: station.latitude?.toString() || '',
      longitude: station.longitude?.toString() || '',
      altitude: station.altitude?.toString() || '',
      responsable: station.responsable || '',
      contact: station.contact || '',
      observations: station.observations || '',
      dateMiseEnService: station.dateMiseEnService || ''
    })
    setFormError('')
    setFormSuccess('')
    setIsModalOpen(true)
  }

  const handleView = (station: Station) => {
    setModalMode('view')
    setSelectedStation(station)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('⚠️ Supprimer cette station ?')) return
    try {
      await api.delete(`/stations/${id}`)
      setStations(stations.filter(s => s.id !== id))
      setFormSuccess('✅ Supprimée')
      setTimeout(() => setFormSuccess(''), 3000)
      fetchStations()
    } catch {
      setError('Erreur de suppression')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const data = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        altitude: formData.altitude ? parseFloat(formData.altitude) : undefined,
      }

      if (modalMode === 'create') {
        const res = await api.post('/stations', data)
        setStations([...stations, res.data])
        setFormSuccess('✅ Station créée')
      } else if (selectedStation) {
        const res = await api.put(`/stations/${selectedStation.id}`, data)
        setStations(stations.map(s => s.id === selectedStation.id ? res.data : s))
        setFormSuccess('✅ Station modifiée')
      }
      setTimeout(() => { setIsModalOpen(false); fetchStations() }, 1000)
    } catch {
      setFormError('Erreur lors de l\'opération')
    } finally {
      setSubmitting(false)
    }
  }

  const exportCSV = () => {
    const headers = ['Nom', 'Code', 'Région', 'District', 'Commune', 'Zone', 'Poste', 'Type', 'Statut']
    const rows = filtered.map(s => [s.nom, s.code, s.region, s.district, s.commune, s.zone, s.poste, s.type, s.statut])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stations_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      meteo: 'bg-blue-100 text-blue-800',
      pluviométrie: 'bg-cyan-100 text-cyan-800',
      vent: 'bg-green-100 text-green-800',
      température: 'bg-purple-100 text-purple-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100'}`}>{type}</span>
  }

  const getStatusBadge = (statut: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statut] || 'bg-gray-100'}`}>{statut}</span>
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">📡 Gestion des Stations</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez les stations météorologiques</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportCSV} 
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Exporter
            </button>
            <button 
              onClick={handleCreate} 
              className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-sm text-gray-500">Total</h3>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="border rounded-lg p-4 border-green-200 bg-green-50">
            <h3 className="text-sm text-gray-500">Actives</h3>
            <p className="text-2xl font-bold text-green-600">{stats.actives}</p>
          </div>
          <div className="border rounded-lg p-4 border-yellow-200 bg-yellow-50">
            <h3 className="text-sm text-gray-500">Maintenance</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.maintenance}</p>
          </div>
          <div className="border rounded-lg p-4 border-red-200 bg-red-50">
            <h3 className="text-sm text-gray-500">Inactives</h3>
            <p className="text-2xl font-bold text-red-600">{stats.inactives}</p>
          </div>
        </div>

        {/* Filters - ✅ cascade Région → District → Zone */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-green-500"
            />
          </div>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="px-4 py-2 border rounded-xl text-sm bg-white">
            <option value="all">Tous les types</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={selectedStatut} onChange={(e) => setSelectedStatut(e.target.value)} className="px-4 py-2 border rounded-xl text-sm bg-white">
            <option value="all">Tous les statuts</option>
            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedRegion} onChange={(e) => handleFilterRegionChange(e.target.value)} className="px-4 py-2 border rounded-xl text-sm bg-white">
            <option value="all">Toutes les régions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            value={selectedDistrict} 
            onChange={(e) => setSelectedDistrict(e.target.value)} 
            className="px-4 py-2 border rounded-xl text-sm bg-white"
          >
            <option value="all">Tous les districts</option>
            {filterDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)} className="px-4 py-2 border rounded-xl text-sm bg-white">
            <option value="all">Toutes les zones</option>
            {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Station</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Localisation</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600">Statut</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStations.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-gray-500">Aucune station</td></tr>
                  ) : (
                    currentStations.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium">{s.nom}</p>
                          <p className="text-xs text-gray-500">{s.code}</p>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className="font-medium">{s.commune}</span><br />
                          <span className="text-xs text-gray-500">{s.district}</span><br />
                          <span className="text-xs text-gray-400">{s.region}</span>
                          {s.zone && <><br /><span className="text-xs text-gray-400">Zone: {s.zone}</span></>}
                          {s.poste && <><br /><span className="text-xs text-gray-400">Poste: {s.poste}</span></>}
                        </td>
                        <td className="py-3 px-4">{getTypeBadge(s.type)}</td>
                        <td className="py-3 px-4">{getStatusBadge(s.statut)}</td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleView(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleEdit(s)} className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex justify-between items-center">
                <span className="text-sm text-gray-600">{filtered.length} stations</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded-lg disabled:opacity-50">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 text-sm">{page}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border rounded-lg disabled:opacity-50">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between">
              <h2 className="text-xl font-bold">
                {modalMode === 'create' ? '➕ Nouvelle station' :
                 modalMode === 'edit' ? '✏️ Modifier' : '👁️ Détails'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {modalMode === 'view' && selectedStation ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-gray-500">Nom</p><p className="font-medium">{selectedStation.nom}</p></div>
                  <div><p className="text-xs text-gray-500">Code</p><p className="font-medium">{selectedStation.code}</p></div>
                  <div><p className="text-xs text-gray-500">Région</p><p>{selectedStation.region}</p></div>
                  <div><p className="text-xs text-gray-500">District</p><p>{selectedStation.district}</p></div>
                  <div><p className="text-xs text-gray-500">Commune</p><p>{selectedStation.commune}</p></div>
                  <div><p className="text-xs text-gray-500">Zone</p><p>{selectedStation.zone}</p></div>
                  <div><p className="text-xs text-gray-500">Poste</p><p>{selectedStation.poste}</p></div>
                  <div><p className="text-xs text-gray-500">Type</p><p>{getTypeBadge(selectedStation.type)}</p></div>
                  <div><p className="text-xs text-gray-500">Statut</p><p>{getStatusBadge(selectedStation.statut)}</p></div>
                  {selectedStation.latitude && <div><p className="text-xs text-gray-500">Latitude</p><p>{selectedStation.latitude}</p></div>}
                  {selectedStation.longitude && <div><p className="text-xs text-gray-500">Longitude</p><p>{selectedStation.longitude}</p></div>}
                  {selectedStation.altitude && <div><p className="text-xs text-gray-500">Altitude</p><p>{selectedStation.altitude}m</p></div>}
                  {selectedStation.responsable && <div><p className="text-xs text-gray-500">Responsable</p><p>{selectedStation.responsable}</p></div>}
                  {selectedStation.contact && <div><p className="text-xs text-gray-500">Contact</p><p>{selectedStation.contact}</p></div>}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nom *</label>
                      <input required value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Code *</label>
                      <input required value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>

                  {/* ✅ Cascade Région → District */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Région *</label>
                      <select required value={formData.region} onChange={(e) => handleFormRegionChange(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white">
                        <option value="">Sélectionner</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">District *</label>
                      <select
                        required
                        value={formData.district}
                        onChange={(e) => handleFormDistrictChange(e.target.value)}
                        disabled={!formData.region}
                        className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">{formData.region ? 'Sélectionner' : 'Choisir une région d\'abord'}</option>
                        {formDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* ✅ Cascade District → Commune */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Commune *</label>
                      {formCommunes.length > 0 ? (
                        <select
                          required
                          value={formData.commune}
                          onChange={(e) => setFormData({...formData, commune: e.target.value})}
                          disabled={!formData.district}
                          className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Sélectionner</option>
                          {formCommunes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input
                          required
                          value={formData.commune}
                          onChange={(e) => setFormData({...formData, commune: e.target.value})}
                          disabled={!formData.district}
                          placeholder={formData.district ? `Commune du district de ${formData.district} (liste non disponible)` : 'Choisir un district d\'abord'}
                          className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Zone antiacridienne *</label>
                      <select
                        required
                        value={formData.zone}
                        onChange={(e) => setFormData({...formData, zone: e.target.value})}
                        className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                      >
                        <option value="">Sélectionner</option>
                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Poste antiacridien *</label>
                      <select
                        required
                        value={formData.poste}
                        onChange={(e) => setFormData({...formData, poste: e.target.value})}
                        className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                      >
                        <option value="">Sélectionner</option>
                        {POSTES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Type *</label>
                      <select required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white">
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Latitude</label>
                      <input type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({...formData, latitude: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="-18.8792" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Longitude</label>
                      <input type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({...formData, longitude: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="47.5079" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Altitude (m)</label>
                      <input type="number" step="any" value={formData.altitude} onChange={(e) => setFormData({...formData, altitude: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="1276" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Statut *</label>
                      <select required value={formData.statut} onChange={(e) => setFormData({...formData, statut: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white">
                        {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date mise en service</label>
                      <input type="date" value={formData.dateMiseEnService} onChange={(e) => setFormData({...formData, dateMiseEnService: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Responsable</label>
                    <input value={formData.responsable} onChange={(e) => setFormData({...formData, responsable: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="Nom" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Contact</label>
                    <input value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" placeholder="Téléphone" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Observations</label>
                    <textarea rows={2} value={formData.observations} onChange={(e) => setFormData({...formData, observations: e.target.value})} className="w-full border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500" />
                  </div>

                  {formError && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm">{formError}</div>}
                  {formSuccess && <div className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-sm">{formSuccess}</div>}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50">Annuler</button>
                    <button type="submit" disabled={submitting} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">
                      {submitting ? 'Enregistrement...' : modalMode === 'create' ? 'Créer' : 'Modifier'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}