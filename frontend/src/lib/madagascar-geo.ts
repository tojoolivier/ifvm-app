// lib/madagascar-geo.ts
// Référentiel géographique statique extrait de StationPage.tsx (Lot 3, #123) —
// aucun changement de comportement, seulement un découpage structurel.

export const TYPES = ['meteo', 'pluviométrie', 'vent', 'température']
export const STATUTS = ['active', 'inactive', 'maintenance']

// ─────────────────────────────────────────────────────────────
// ✅ Hiérarchie administrative : Région → Districts
// ⚠️ Sofia (Antsohihy) et Ihorombe (Ihosy) ajoutées car présentes
//    dans tes zones antiacridiennes mais absentes de la liste
//    d'origine (Diana + ex-province de Toliara). À confirmer.
// ─────────────────────────────────────────────────────────────
export const REGION_DISTRICTS: Record<string, string[]> = {
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
export const ZONES = [
  'Ambovombe Androy',
  'Ampanihy Ouest',
  'Akilizato',
  'Antsohihy',
  'Befandriana Sud',
  'Ejeda',
  'Ihosy',
  'Sakaraha',
]

export const POSTES = [
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
export const DISTRICT_COMMUNES: Record<string, string[]> = {
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

export const getCommunesForDistrict = (district: string): string[] => DISTRICT_COMMUNES[district] ?? []

export const REGIONS = Object.keys(REGION_DISTRICTS)
