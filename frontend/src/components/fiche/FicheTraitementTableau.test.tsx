import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { components } from '@/lib/api-schema.generated'
import { FicheTraitementTableau } from './FicheTraitementTableau'

type Traitement = components['schemas']['TraitementRead']
type Terrestre = NonNullable<Traitement['terrestre']>
type Aerien = NonNullable<Traitement['aerien']>

const NUMERO = 'Malala-Terrestre-2026-09-22-RMN-2'

const TERRESTRE: Terrestre = {
  heure_debut: '11:44:00',
  heure_fin: '12:44:00',
  vitesse_vent_ms: 6,
  direction_vent: 'NE',
  temperature_c: 25,
  taux_mortalite_pourcent: 80,
  evaluation_efficacite_heures_apres: 24,
  methode_evaluation_efficacite: 'ESTIMATION_VISUELLE',
  reprise_traitement: false,
  traitement_origine_id: null,
  chef_equipe_id: 'u-chef',
  agent_encadreur: 'Koto',
  consultant_international: 'Dialo',
  surface_atomiseur_ha: null,
  surface_disque_rotatif_ha: 50,
  surface_atomiseur_autoporte_ha: null,
  surface_traitee_ha: 50,
  surface_protegee_ha: 0,
  surface_cumulee_ha: 50,
  surface_restante_ha: 0,
  surface_restante_abandonnee: false,
  motif_surface_restante_abandonnee: null,
  essence_litres: null,
  nb_piles: null,
  pesticide_unite: 'L',
  total_pesticide_l: 50,
  pesticide_recu_l: null,
  stock_initial_l: 100,
  pesticide_stock_restant_l: 50,
  produits: [],
}

const AERIEN: Aerien = {
  pilote: 'Rabe',
  mecanicien: 'Soa',
  chef_de_base_id: 'u-cb',
  consultant_international: null,
  base_principale: 'B-01',
  site_principal_id: null,
  stand: 'Stand Nord',
  stand_date_installation: null,
  base_secondaire: null,
  base_secondaire_date_installation: null,
  immatricule_aeronef: '5R-ABC',
  nb_rotations: 3,
  total_pesticide_l: 0,
  total_pesticide_kg: 12,
  surface_traitee_ha: 30.1,
  surface_protegee_ha: 0.2,
  reprise_traitement: false,
  traitement_origine_id: null,
  surface_cumulee_ha: 30.3,
  surface_restante_ha: 5,
  surface_restante_abandonnee: false,
  motif_surface_restante_abandonnee: null,
  taux_mortalite_pourcent: null,
  evaluation_efficacite_heures_apres: null,
  methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
  rotations: [],
  blocs: [],
}

/** Valeurs du PDF « FICHE DE COMPTE-RENDU ET ÉVALUATION RAPIDE DE TRAITEMENT » (terrestre). */
function crt(overrides: Partial<Traitement> = {}): Traitement {
  return {
    id: 't1',
    prospection_id: 'p1',
    numero_fiche: NUMERO,
    type_traitement: 'TERRESTRE',
    mode_traitement: 'TOTAL',
    date_traitement: '2026-09-22',
    date_validation: '2026-09-21',
    localite: 'Mitsinjo',
    region: 'Atsimo-Andrefana',
    district: 'Toliary-II',
    commune: 'Betanimena',
    latitude: -23.3359732,
    longitude: 43.6839417,
    altitude: 15.1,
    nb_agents_permanents: 2,
    nb_agents_temporaires: 5,
    nb_personnel_local: 6,
    moyens_atomiseur_nb: 10,
    moyens_essence_litres: null,
    moyens_disque_rotatif_nb: null,
    moyens_piles_nb: null,
    moyens_ulvamast_nb: null,
    kit_combinaison: 5,
    kit_gants: 5,
    kit_lunettes: 5,
    kit_masques: 5,
    kit_botte: 5,
    zones_exposees: { cultures: true },
    hauteur_strate_herbeuse_m: 45,
    hauteur_strate_arboree_m: 1.4,
    recouvrement_percent: 40,
    empoisonnement: false,
    empoisonnement_type: null,
    empoisonnement_mode: null,
    empoisonnement_autre: null,
    evaluation_risque: { sol: 'Oui', abeilles: 'Non', ressources_eau: 'Non', faune_non_cible: 'Non' },
    comportement_anormal: false,
    comportement_non_cibles: {},
    mortalite: false,
    mortalite_familles: {},
    observations: 'Jklms',
    statut: 'validee',
    statut_sync: 'synced',
    created_at: '2026-09-22T08:00:00',
    updated_at: '2026-09-22T09:00:00',
    cible: {
      espece: 'MELANGE',
      petites_larves: 0,
      grandes_larves: 0,
      vols_clairs_essaims: 'non',
      repartition_population: 'GROUPEE',
      surface_infestee_ha: 50,
      petites_larves_lmc: 0,
      petites_larves_nse: 0,
      grandes_larves_lmc: 0,
      grandes_larves_nse: 0,
      densite_diffuse_lmc: 0,
      densite_groupee_lmc: 0,
      densite_diffuse_nse: 0,
      densite_groupee_nse: 0,
    },
    aerien: null,
    terrestre: TERRESTRE,
    signatures: [
      { id: 's1', role: 'CHEF_EQUIPE', signataire_nom: 'test 2', horodatage: '2026-09-22T08:50:00' },
      {
        id: 's2',
        role: 'CONSULTANT_INTERNATIONAL',
        signataire_nom: 'Dialo',
        horodatage: '2026-09-22T08:50:00',
        signature_image: 'M 10 20 L 60 40',
      },
    ],
    evaluations_risque_population: [
      { id: 'e1', ordre: 1, habitat_proche: 'Mangabe', distance_km: 2, sensibilisation: true },
      { id: 'e2', ordre: 2, habitat_proche: null, distance_km: null, sensibilisation: null },
    ],
    prospection_n_fiche: '20260921-RMN-8C9B',
    prospection_date_validation: '2026-09-21T10:00:00',
    ...overrides,
  }
}

/** Le `<span>Libellé :</span> valeur` d'un champ du formulaire. */
function champ(libelle: string): HTMLElement {
  return screen.getByText(`${libelle} :`).parentElement as HTMLElement
}

function cochee(nom: string): boolean {
  return screen.getByRole('checkbox', { name: nom }).getAttribute('aria-checked') === 'true'
}

describe('FicheTraitementTableau — fiche terrestre (comme le PDF)', () => {
  it("reprend l'en-tête et la section 1 (Références) du PDF", () => {
    render(<FicheTraitementTableau traitement={crt()} chefEquipeNom="Rabe" />)

    expect(
      screen.getByRole('heading', { name: 'FICHE DE COMPTE-RENDU ET ÉVALUATION RAPIDE DE TRAITEMENT' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Sigle/)).toHaveTextContent(`Sigle ${NUMERO} /CRT`)
    expect(champ('1.1 N° CRT')).toHaveTextContent(`1.1 N° CRT : ${NUMERO}`)
    expect(champ("1.2 Chef d'équipe")).toHaveTextContent("1.2 Chef d'équipe : Rabe")
    expect(champ('1.3 Agent encadreur')).toHaveTextContent('1.3 Agent encadreur : Koto')
    expect(champ('Consultant international')).toHaveTextContent('Consultant international : Dialo')
    // La validation référencée est celle de la prospection liée, pas celle du CRT.
    expect(champ('1.4 Date de validation')).toHaveTextContent('1.4 Date de validation : 21/09/2026')
    expect(champ('1.5 N° de validation')).toHaveTextContent('1.5 N° de validation : 20260921-RMN-8C9B')
    expect(champ('1.6 Date de traitement')).toHaveTextContent('1.6 Date de traitement : 22/09/2026')
    expect(champ('1.7 Localité')).toHaveTextContent('1.7 Localité : Mitsinjo')
    expect(champ('1.8 C/R')).toHaveTextContent('1.8 C/R : Betanimena')
    expect(champ('1.9 District')).toHaveTextContent('1.9 District : Toliary-II')
    expect(champ('1.12 Région')).toHaveTextContent('1.12 Région : Atsimo-Andrefana')
    expect(champ('Coordonnées')).toHaveTextContent('Coordonnées : -23.3359732 / 43.6839417 / 15.1')
  })

  it('laisse en pointillés les champs sans donnée : chef d’équipe non résolu, PA, ZA', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(champ("1.2 Chef d'équipe")).toHaveTextContent("1.2 Chef d'équipe : non renseigné")
    expect(champ('1.10 PA')).toHaveTextContent('1.10 PA : non renseigné')
    expect(champ('1.11 ZA')).toHaveTextContent('1.11 ZA : non renseigné')
    expect(champ('Coordonnées 1ère passe')).toHaveTextContent('Coordonnées 1ère passe : non renseigné')
  })

  it('coche les cibles : mélange, population groupée, surface infestée', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(cochee('Mélange')).toBe(true)
    expect(cochee('2.1 Espèces — LMC')).toBe(false)
    expect(cochee('NSE')).toBe(false)
    expect(cochee('groupée')).toBe(true)
    expect(cochee('Population — Diffuse')).toBe(false)
    expect(champ('Petites larves')).toHaveTextContent('Petites larves : 0')
    expect(champ('Vols clairs / essaims')).toHaveTextContent('Vols clairs / essaims : non')
    expect(champ('2.2 Surface infestée (ha)')).toHaveTextContent('2.2 Surface infestée (ha) : 50')
  })

  it('déduit la densité de la paire (espèce, répartition)', () => {
    const cible = { ...crt().cible!, espece: 'LMC' as const, repartition_population: 'DIFFUSE' as const, densite_diffuse_lmc: 2500 }
    render(<FicheTraitementTableau traitement={crt({ cible })} />)
    expect(champ('Densité (ind./ha)')).toHaveTextContent('Densité (ind./ha) : 2500')
  })

  it('reproduit la section 3 : mode, surfaces, conditions, efficacité', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(cochee('3.1 Mode de traitement — Couverture Total')).toBe(true)
    expect(cochee('Barrière')).toBe(false)
    expect(champ('par disque rotatif (ha)')).toHaveTextContent('par disque rotatif (ha) : 50')
    expect(champ('par aéronef (ha)')).toHaveTextContent('par aéronef (ha) : non renseigné')
    // Zéro saisi : une valeur, pas un champ à remplir.
    expect(champ('3.3 Surface reste à traiter (ha)')).toHaveTextContent('3.3 Surface reste à traiter (ha) : 0')
    expect(champ('Début (heure)')).toHaveTextContent('Début (heure) : 11:44:00')
    expect(champ('Fin (heure)')).toHaveTextContent('Fin (heure) : 12:44:00')
    expect(champ('Vent — Vitesse (m/s)')).toHaveTextContent('Vent — Vitesse (m/s) : 6')
    expect(champ('Direction')).toHaveTextContent('Direction : NE')
    expect(champ('Température (°C)')).toHaveTextContent('Température (°C) : 25')
    expect(champ('3.5 Efficacité — Taux de mortalité (%)')).toHaveTextContent('80')
    expect(champ('Évalué après traitement (h)')).toHaveTextContent('Évalué après traitement (h) : 24')
    expect(cochee("Méthode d'évaluation — Estimation visuelle")).toBe(true)
    expect(cochee('Comptages pré/post-traitement')).toBe(false)
  })

  it('reproduit les sections 4 à 7 : moyens, kit, pesticides, zones, végétation', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(champ('4.1 Humains — Nb agents permanents')).toHaveTextContent('4.1 Humains — Nb agents permanents : 2')
    expect(champ('Nb agents temporaires')).toHaveTextContent('Nb agents temporaires : 5')
    expect(champ('Nb personnel local')).toHaveTextContent('Nb personnel local : 6')
    expect(champ('4.2 Matériels — Atomiseur')).toHaveTextContent('4.2 Matériels — Atomiseur : 10')
    expect(champ('Piles (nb)')).toHaveTextContent('Piles (nb) : non renseigné')
    for (const kit of ['Combinaison', 'Gants', 'Lunettes', 'Masques', 'Botte']) {
      expect(champ(kit)).toHaveTextContent(`${kit} : 5`)
    }
    expect(champ('5.3 Stock initial')).toHaveTextContent('5.3 Stock initial : 100')
    expect(champ('5.5 Produit consommé (L)')).toHaveTextContent('5.5 Produit consommé (L) : 50')
    expect(champ('5.6 Stock final (L)')).toHaveTextContent('5.6 Stock final (L) : 50')
    expect(cochee('6.1 Culture')).toBe(true)
    expect(cochee('6.2 Pâturage')).toBe(false)
    expect(champ('7.1 Hauteur strate herbeuse (m)')).toHaveTextContent('45')
    expect(champ('7.2 Hauteur strate arborée (m)')).toHaveTextContent('1.4')
    expect(champ('7.3 Recouvrement (%)')).toHaveTextContent('7.3 Recouvrement (%) : 40')
  })

  it('reproduit les sections 8, 10 et 11 : « Non » coché, aucune famille cochée', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(cochee("8.1 Cas d'empoisonnement — Oui")).toBe(false)
    // 8.1, 10.1 et 11 : trois « Non » cochés dans ce PDF, chacun avec son propre nom.
    expect(cochee("8.1 Cas d'empoisonnement — Non")).toBe(true)
    expect(cochee('10.1 Comportement anormal — Non')).toBe(true)
    expect(cochee('11. Mortalité — Non')).toBe(true)
    expect(cochee('11. Mortalité — Oui')).toBe(false)
    expect(cochee('10.2 Oiseux')).toBe(false)
    expect(cochee('11. Famille — Oiseaux')).toBe(false)
  })

  it('reproduit la section 9 : une colonne par évaluation, la sensibilisation en cases', () => {
    render(<FicheTraitementTableau traitement={crt()} />)
    const table = screen.getByRole('table', { name: 'Évaluation du risque pour la population' })

    expect(within(table).getByText('Mangabe')).toBeInTheDocument()
    const distance = within(table).getByText('9.2 Distance (km)').closest('tr') as HTMLElement
    expect(within(distance).getByText('2')).toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['', '1', '2'])
    // 1re évaluation : « Oui » ; 2e (vide) : aucune case cochée.
    const case_ = (nom: string) => within(table).getByRole('checkbox', { name: nom })
    expect(case_('Évaluation 1 — sensibilisation Oui')).toHaveAttribute('aria-checked', 'true')
    expect(case_('Évaluation 1 — sensibilisation Non')).toHaveAttribute('aria-checked', 'false')
    expect(case_('Évaluation 2 — sensibilisation Oui')).toHaveAttribute('aria-checked', 'false')
    expect(case_('Évaluation 2 — sensibilisation Non')).toHaveAttribute('aria-checked', 'false')
  })

  it('reproduit la section 12 et les axes de risque du PDF', () => {
    render(<FicheTraitementTableau traitement={crt()} />)

    expect(screen.getByText('Jklms')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Axes de risque environnemental (complément)' })).toBeInTheDocument()
    expect(champ('Sol')).toHaveTextContent('Sol : Oui')
    expect(champ('Abeilles / pollinisateurs')).toHaveTextContent('Abeilles / pollinisateurs : Non')
    expect(champ('Ressources en eau')).toHaveTextContent('Ressources en eau : Non')
    expect(champ('Faune non cible')).toHaveTextContent('Faune non cible : Non')
  })

  it("reproduit le tableau des signatures, avec le tracé du consultant et l'horodatage", () => {
    render(<FicheTraitementTableau traitement={crt()} />)
    const table = screen.getByRole('table', { name: 'Signatures' })

    const chef = within(table).getByText('CHEF_EQUIPE').closest('tr') as HTMLElement
    expect(within(chef).getByText('test 2')).toBeInTheDocument()
    expect(within(chef).getByText('22/09/2026 08:50')).toBeInTheDocument()
    expect(within(chef).getByText('—')).toBeInTheDocument()
    const consultant = within(table).getByText('CONSULTANT_INTERNATIONAL').closest('tr') as HTMLElement
    const trace = within(consultant).getByRole('img', { name: 'Signature de Dialo' })
    expect(trace).toHaveAttribute('viewBox', '7 17 56 26')
    expect(trace.querySelector('path')).toHaveAttribute('d', 'M 10 20 L 60 40')
  })

  it("ajoute une ligne « à signer » pour le consultant nommé qui n'a pas encore signé", () => {
    render(
      <FicheTraitementTableau
        traitement={crt({ signatures: [{ id: 's1', role: 'CHEF_EQUIPE', signataire_nom: 'test 2', horodatage: '2026-09-22T08:50:00' }] })}
      />,
    )
    const ligne = screen.getByText('CONSULTANT_INTERNATIONAL').closest('tr') as HTMLElement
    expect(within(ligne).getByText('à signer')).toBeInTheDocument()
  })

  it('omet les compléments vides : pas de signatures, pas d’axes de risque', () => {
    render(
      <FicheTraitementTableau
        traitement={crt({ signatures: [], evaluation_risque: {}, terrestre: { ...TERRESTRE, consultant_international: null } })}
      />,
    )
    expect(screen.queryByRole('table', { name: 'Signatures' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Axes de risque/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Détail Terrestre/ })).toBeNull()
  })

  it("affiche le détail terrestre quand l'essence ou les piles sont renseignées", () => {
    render(
      <FicheTraitementTableau traitement={crt({ terrestre: { ...TERRESTRE, essence_litres: 12, nb_piles: 4 } })} />,
    )
    expect(screen.getByRole('heading', { name: 'Détail Terrestre (complément)' })).toBeInTheDocument()
    expect(champ('Nb piles')).toHaveTextContent('Nb piles : 4')
  })

  it('rapproche les familles saisies des cases papier et garde les autres à part', () => {
    render(
      <FicheTraitementTableau
        traitement={crt({
          comportement_anormal: true,
          comportement_non_cibles: { 'Insectes utiles': true, Abeilles: true },
          mortalite: true,
          mortalite_familles: { Oiseaux: true },
        })}
      />,
    )
    expect(cochee('10.1 Comportement anormal — Oui')).toBe(true)
    expect(cochee('10.2 Insecte')).toBe(true)
    expect(champ('Autres familles concernées')).toHaveTextContent('Autres familles concernées : Abeilles')
    expect(cochee('11. Famille — Oiseaux')).toBe(true)
    expect(cochee('11. Famille — Insecte')).toBe(false)
  })

  it('affiche une fiche sans cible, sans évaluation et sans observation sans planter', () => {
    render(<FicheTraitementTableau traitement={crt({ cible: null, evaluations_risque_population: [], observations: null })} />)

    expect(cochee('Mélange')).toBe(false)
    expect(champ('2.2 Surface infestée (ha)')).toHaveTextContent('non renseigné')
    expect(within(screen.getByRole('table', { name: 'Évaluation du risque pour la population' })).getByText('—')).toBeInTheDocument()
  })
})

describe('FicheTraitementTableau — fiche aérienne', () => {
  const aerien = () => crt({ type_traitement: 'AERIEN', terrestre: null, aerien: AERIEN, mode_traitement: 'BARRIERE' })

  it('somme la surface traitée et protégée pour « par aéronef », sans dérive de virgule flottante', () => {
    render(<FicheTraitementTableau traitement={aerien()} />)
    expect(champ('par aéronef (ha)')).toHaveTextContent('par aéronef (ha) : 30.3')
    expect(cochee('Barrière')).toBe(true)
  })

  it('bascule en kg quand aucun litre n’a été épandu (produit en poudre)', () => {
    render(<FicheTraitementTableau traitement={aerien()} />)
    expect(champ('5.5 Produit consommé (kg)')).toHaveTextContent('5.5 Produit consommé (kg) : 12')
    // Le stock n'existe que côté terrestre.
    expect(champ('5.3 Stock initial')).toHaveTextContent('non renseigné')
  })

  it('reste en litres quand des litres ont été épandus', () => {
    render(<FicheTraitementTableau traitement={crt({ type_traitement: 'AERIEN', terrestre: null, aerien: { ...AERIEN, total_pesticide_l: 8, total_pesticide_kg: 0 } })} />)
    expect(champ('5.5 Produit consommé (L)')).toHaveTextContent('5.5 Produit consommé (L) : 8')
  })

  it('remplace le détail terrestre par le détail aérien', () => {
    render(<FicheTraitementTableau traitement={aerien()} />)

    expect(screen.getByRole('heading', { name: 'Détail Aérien (complément)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Détail Terrestre/ })).toBeNull()
    expect(champ('Pilote')).toHaveTextContent('Pilote : Rabe')
    expect(champ('Mécanicien')).toHaveTextContent('Mécanicien : Soa')
    expect(champ('Base principale')).toHaveTextContent('Base principale : B-01')
    expect(champ('Stand')).toHaveTextContent('Stand : Stand Nord')
    expect(champ('Immatriculation aéronef')).toHaveTextContent('Immatriculation aéronef : 5R-ABC')
    expect(champ('Nb rotations')).toHaveTextContent('Nb rotations : 3')
    // Les conditions (3.4) sont saisies côté terrestre seulement.
    expect(champ('Début (heure)')).toHaveTextContent('non renseigné')
    expect(cochee('Comptages pré/post-traitement')).toBe(true)
  })
})
