import type { components } from '@/lib/api-schema.generated'
import {
  FAMILLES_COMPORTEMENT_PAPIER,
  FAMILLES_MORTALITE_PAPIER,
  casesFamilles,
  dateFr,
  jourFr,
  texte,
  viewBoxTrace,
} from '@/lib/fiche-tableau'
import { AXES_RISQUE } from '@/lib/traitement-fiche'
import { Champ, Entete, Feuille, Grille, Ligne, LigneOptions, Case, Section, Td, Th, ZoneTexte } from './primitives'

type Traitement = components['schemas']['TraitementRead']
type Cible = components['schemas']['CibleRead']

/**
 * Fiche de compte-rendu de traitement (CRT) en lecture, présentée comme le PDF téléchargé :
 * les 12 sections du formulaire papier, avec leurs sous-numéros, leurs cases à cocher et leurs
 * champs à remplir, puis les compléments (axes de risque, détail aérien ou terrestre,
 * signatures). Reproduit `traitement_pdf.py`.
 */
export function FicheTraitementTableau({
  traitement,
  chefEquipeNom,
}: {
  traitement: Traitement
  /**
   * Nom du chef d'équipe, résolu par la page depuis l'annuaire : la fiche ne porte que son
   * identifiant. Absent → champ à remplir, comme sur le PDF.
   */
  chefEquipeNom?: string | null
}) {
  return (
    <Feuille label={`Fiche de traitement ${traitement.numero_fiche}`}>
      <Entete
        organisme="IVOTOERANA FAMONGORANA NY VALALA ETO MADAGASIKARA"
        titre="FICHE DE COMPTE-RENDU ET ÉVALUATION RAPIDE DE TRAITEMENT"
        sigle={
          <>
            Sigle <span className="border-b border-[#111827] px-1">{traitement.numero_fiche}</span> /CRT
          </>
        }
      />
      <References traitement={traitement} chefEquipeNom={chefEquipeNom} />
      <Cibles cible={traitement.cible} />
      <TraitementSection traitement={traitement} />
      <Moyens traitement={traitement} />
      <Pesticides traitement={traitement} />
      <ZonesCibles traitement={traitement} />
      <Vegetation traitement={traitement} />
      <Empoisonnement traitement={traitement} />
      <EvaluationRisque traitement={traitement} />
      <NonCibles traitement={traitement} />
      <Mortalite traitement={traitement} />
      <Section titre="12. Observation générale">
        <ZoneTexte>{traitement.observations || ' '}</ZoneTexte>
      </Section>
      <AxesRisque traitement={traitement} />
      {traitement.type_traitement === 'AERIEN' ? (
        <DetailAerien traitement={traitement} />
      ) : (
        <DetailTerrestre traitement={traitement} />
      )}
      <Signatures traitement={traitement} />
    </Feuille>
  )
}

// ---------------------------------------------------------------------------

/** Évite qu'une somme de surfaces s'affiche `0.30000000000000004`. */
function arrondi(valeur: number): number {
  return Math.round(valeur * 1e6) / 1e6
}

function References({ traitement: t, chefEquipeNom }: { traitement: Traitement; chefEquipeNom?: string | null }) {
  const terrestre = t.terrestre
  const consultant = (t.aerien ?? t.terrestre)?.consultant_international
  const coordonnees = t.latitude === null ? null : `${t.latitude} / ${t.longitude} / ${t.altitude}`
  return (
    <Section titre="1. Références">
      <Ligne>
        <Champ label="1.1 N° CRT" valeur={t.numero_fiche} />
        <Champ label="1.2 Chef d'équipe" valeur={chefEquipeNom} />
        <Champ label="1.3 Agent encadreur" valeur={terrestre?.agent_encadreur} />
      </Ligne>
      <Ligne>
        <Champ label="Consultant international" valeur={consultant} />
      </Ligne>
      {/* La validation référencée ici est celle de la prospection liée, pas une validation du CRT. */}
      <Ligne>
        <Champ
          label="1.4 Date de validation"
          valeur={t.prospection_date_validation ? jourFr(t.prospection_date_validation) : null}
        />
        <Champ label="1.5 N° de validation" valeur={t.prospection_n_fiche} />
        <Champ label="1.6 Date de traitement" valeur={t.date_traitement ? dateFr(t.date_traitement) : null} />
      </Ligne>
      <Ligne>
        <Champ label="1.7 Localité" valeur={t.localite} />
        <Champ label="1.8 C/R" valeur={t.commune} />
        <Champ label="1.9 District" valeur={t.district} />
      </Ligne>
      <Ligne>
        <Champ label="1.10 PA" valeur={null} />
        <Champ label="1.11 ZA" valeur={null} />
        <Champ label="1.12 Région" valeur={t.region} />
      </Ligne>
      <Ligne>
        <Champ label="Coordonnées" valeur={coordonnees} />
        <Champ label="Coordonnées 1ère passe" valeur={null} />
      </Ligne>
    </Section>
  )
}

/** Densité (ind./ha, §2.2) : dérivée de la paire (espèce, répartition) parmi les colonnes par espèce. */
function densiteInfestation(cible: Cible | null): string | number | null {
  if (!cible || !cible.espece || !cible.repartition_population) return null
  const diffuse = cible.repartition_population === 'DIFFUSE'
  if (cible.espece === 'LMC') return diffuse ? cible.densite_diffuse_lmc : cible.densite_groupee_lmc
  if (cible.espece === 'NSE') return diffuse ? cible.densite_diffuse_nse : cible.densite_groupee_nse
  return null
}

function Cibles({ cible }: { cible: Cible | null }) {
  const espece = cible?.espece
  const repartition = cible?.repartition_population
  return (
    <Section titre="2. Cibles">
      <LigneOptions
        options={[
          { label: '2.1 Espèces — LMC', cochee: espece === 'LMC' },
          { label: 'NSE', cochee: espece === 'NSE' },
          { label: 'Mélange', cochee: espece === 'MELANGE' },
        ]}
      />
      <Ligne>
        <Champ label="Petites larves" valeur={cible?.petites_larves} />
        <Champ label="Grandes larves" valeur={cible?.grandes_larves} />
        <Champ label="Vols clairs / essaims" valeur={cible?.vols_clairs_essaims} />
      </Ligne>
      <Ligne>
        <Champ label="2.2 Surface infestée (ha)" valeur={cible?.surface_infestee_ha} />
        <Champ label="Densité (ind./ha)" valeur={densiteInfestation(cible ?? null)} />
      </Ligne>
      <LigneOptions
        options={[
          { label: 'Population — Diffuse', cochee: repartition === 'DIFFUSE' },
          { label: 'groupée', cochee: repartition === 'GROUPEE' },
        ]}
      />
    </Section>
  )
}

function TraitementSection({ traitement: t }: { traitement: Traitement }) {
  const { aerien, terrestre } = t
  const fait = aerien ?? terrestre
  const mode = t.mode_traitement
  const methode = fait?.methode_evaluation_efficacite
  return (
    <Section titre="3. Traitement">
      <LigneOptions
        options={[
          { label: '3.1 Mode de traitement — Couverture Total', cochee: mode === 'TOTAL' },
          { label: 'Barrière', cochee: mode === 'BARRIERE' },
          { label: 'Traitement irrégulier', cochee: mode === 'IRREGULIER' },
        ]}
      />
      <Ligne>
        <Champ label="3.2 Surface traitée par atomiseur à dos (ha)" valeur={terrestre?.surface_atomiseur_ha} />
        <Champ label="par disque rotatif (ha)" valeur={terrestre?.surface_disque_rotatif_ha} />
        <Champ label="par ulvamast (ha)" valeur={null} />
        {/* Surface couverte par l'aéronef, traitée ou protégée : la case « Barrière » de 3.1 dit laquelle. */}
        <Champ
          label="par aéronef (ha)"
          valeur={aerien ? arrondi(aerien.surface_traitee_ha + aerien.surface_protegee_ha) : null}
        />
      </Ligne>
      <Ligne>
        <Champ label="3.3 Surface reste à traiter (ha)" valeur={fait?.surface_restante_ha} />
      </Ligne>
      <Ligne>3.4 Condition de traitement</Ligne>
      <Ligne>
        <Champ label="Début (heure)" valeur={terrestre?.heure_debut} />
        <Champ label="Fin (heure)" valeur={terrestre?.heure_fin} />
        <Champ label="Vent — Vitesse (m/s)" valeur={terrestre?.vitesse_vent_ms} />
        <Champ label="Direction" valeur={terrestre?.direction_vent} />
        <Champ label="Température (°C)" valeur={terrestre?.temperature_c} />
      </Ligne>
      <Ligne>
        <Champ label="3.5 Efficacité — Taux de mortalité (%)" valeur={fait?.taux_mortalite_pourcent} />
        <Champ label="Évalué après traitement (h)" valeur={fait?.evaluation_efficacite_heures_apres} />
      </Ligne>
      <LigneOptions
        options={[
          {
            label: "Méthode d'évaluation — Estimation visuelle",
            cochee: methode === 'ESTIMATION_VISUELLE',
          },
          { label: 'Comptages pré/post-traitement', cochee: methode === 'COMPTAGES_PRE_POST' },
        ]}
      />
    </Section>
  )
}

function Moyens({ traitement: t }: { traitement: Traitement }) {
  return (
    <Section titre="4. Moyens">
      <Ligne>
        <Champ label="4.1 Humains — Nb agents permanents" valeur={t.nb_agents_permanents} />
        <Champ label="Nb agents temporaires" valeur={t.nb_agents_temporaires} />
        <Champ label="Nb personnel local" valeur={t.nb_personnel_local} />
      </Ligne>
      <Ligne>
        <Champ label="4.2 Matériels — Atomiseur" valeur={t.moyens_atomiseur_nb} />
        <Champ label="Essence (litres)" valeur={t.moyens_essence_litres} />
        <Champ label="Disque rotatif" valeur={t.moyens_disque_rotatif_nb} />
        <Champ label="Piles (nb)" valeur={t.moyens_piles_nb} />
      </Ligne>
      <Ligne>
        <Champ label="Ulvamast (nb)" valeur={t.moyens_ulvamast_nb} />
      </Ligne>
      <Ligne>4.3 Kit protection :</Ligne>
      <Ligne>
        <Champ label="Combinaison" valeur={t.kit_combinaison} />
        <Champ label="Gants" valeur={t.kit_gants} />
        <Champ label="Lunettes" valeur={t.kit_lunettes} />
        <Champ label="Masques" valeur={t.kit_masques} />
        <Champ label="Botte" valeur={t.kit_botte} />
      </Ligne>
    </Section>
  )
}

function Pesticides({ traitement: t }: { traitement: Traitement }) {
  const { aerien, terrestre } = t
  // Le stock (initial, reçu, final) n'existe que côté terrestre ; l'aérien vit dans les
  // mouvements de pesticide, hors de cette fiche.
  let unite: string = terrestre?.pesticide_unite ?? 'L'
  let consomme = (aerien ?? terrestre)?.total_pesticide_l
  // Aérien : produit en poudre — quantité en kg quand aucun litre n'a été épandu.
  if (aerien && aerien.total_pesticide_l === 0 && aerien.total_pesticide_kg > 0) {
    unite = 'kg'
    consomme = aerien.total_pesticide_kg
  }
  return (
    <Section titre="5. Pesticides">
      <Ligne>
        <Champ label="5.1 Nom commercial" valeur={null} />
        <Champ label="5.2 Matières actives" valeur={null} />
      </Ligne>
      <Ligne>
        <Champ label="5.3 Stock initial" valeur={terrestre?.stock_initial_l} />
        <Champ label={`5.4 Approvisionnement (${unite})`} valeur={terrestre?.pesticide_recu_l} />
      </Ligne>
      <Ligne>
        <Champ label={`5.5 Produit consommé (${unite})`} valeur={consomme} />
        <Champ label={`5.6 Stock final (${unite})`} valeur={terrestre?.pesticide_stock_restant_l} />
      </Ligne>
    </Section>
  )
}

function ZonesCibles({ traitement: t }: { traitement: Traitement }) {
  // Seules Cultures et Pâturages sont saisissables ; les autres postes du formulaire papier
  // restent des cases non cochées et des champs vides, conservés pour la fidélité de la mise en page.
  const zones = (t.zones_exposees ?? {}) as Record<string, unknown>
  return (
    <Section titre="6. Zones cibles">
      <LigneOptions options={[{ label: '6.1 Culture', cochee: Boolean(zones.cultures) }]} />
      <Ligne>
        <Champ label="Maïs (ha)" valeur={null} />
        <Champ label="Riz (ha)" valeur={null} />
        <Champ label="Canne à sucre (ha)" valeur={null} />
      </Ligne>
      <Ligne>
        <Champ label="Banane (ha)" valeur={null} />
        <Champ label="Manioc (ha)" valeur={null} />
        <Champ label="Sorgho (ha)" valeur={null} />
      </Ligne>
      <LigneOptions
        options={[
          { label: '6.2 Pâturage', cochee: Boolean(zones.paturages) },
          { label: '6.3 Apiculture', cochee: false },
          { label: '6.4 Aquaculture', cochee: false },
          { label: '6.5 Production organique', cochee: false },
          { label: 'Zone forestier', cochee: false },
        ]}
      />
    </Section>
  )
}

function Vegetation({ traitement: t }: { traitement: Traitement }) {
  return (
    <Section titre="7. Type de végétation">
      <Ligne>
        <Champ label="7.1 Hauteur strate herbeuse (m)" valeur={t.hauteur_strate_herbeuse_m} />
        <Champ label="7.2 Hauteur strate arborée (m)" valeur={t.hauteur_strate_arboree_m} />
        <Champ label="7.3 Recouvrement (%)" valeur={t.recouvrement_percent} />
      </Ligne>
    </Section>
  )
}

function Empoisonnement({ traitement: t }: { traitement: Traitement }) {
  return (
    <Section titre="8. Empoisonnement">
      <LigneOptions
        options={[
          { label: "8.1 Cas d'empoisonnement — Oui", cochee: t.empoisonnement === true },
          { label: 'Non', cochee: t.empoisonnement === false, nom: "8.1 Cas d'empoisonnement — Non" },
        ]}
      />
      <LigneOptions
        options={[
          { label: 'Si oui, Agent', cochee: t.empoisonnement_type === 'AGENT' },
          { label: 'Population', cochee: t.empoisonnement_type === 'POPULATION' },
        ]}
      />
      <LigneOptions
        options={[
          { label: '8.2 Comment ? — Ingestion', cochee: t.empoisonnement_mode === 'INGESTION' },
          { label: 'Inhalation', cochee: t.empoisonnement_mode === 'INHALATION' },
          { label: 'Contact', cochee: t.empoisonnement_mode === 'CONTACT' },
          { label: 'Autres', cochee: t.empoisonnement_mode === 'AUTRE' },
        ]}
      />
      <Ligne>
        <Champ label="Autres à préciser" valeur={t.empoisonnement_autre} />
      </Ligne>
    </Section>
  )
}

function EvaluationRisque({ traitement: t }: { traitement: Traitement }) {
  const evaluations = t.evaluations_risque_population
  return (
    <Section titre="9. Évaluation du risque pour la population">
      {evaluations.length === 0 ? (
        <Grille caption="Évaluation du risque pour la population">
          <tr>
            <Td>—</Td>
          </tr>
        </Grille>
      ) : (
        <Grille caption="Évaluation du risque pour la population">
          <tr>
            <Th gauche />
            {evaluations.map((_, i) => (
              <Th key={i}>{i + 1}</Th>
            ))}
          </tr>
          <tr>
            <Th gauche scope="row">
              Habitat le plus proche
            </Th>
            {evaluations.map((e) => (
              <Td key={e.id} gauche>
                {texte(e.habitat_proche)}
              </Td>
            ))}
          </tr>
          <tr>
            <Th gauche scope="row">
              9.2 Distance (km)
            </Th>
            {evaluations.map((e) => (
              <Td key={e.id} gauche>
                {texte(e.distance_km)}
              </Td>
            ))}
          </tr>
          <tr>
            <Th gauche scope="row">
              9.3 Sensibilisation
            </Th>
            {evaluations.map((e, i) => (
              <Td key={e.id} gauche>
                <Case cochee={e.sensibilisation === true} label={`Évaluation ${i + 1} — sensibilisation Oui`} /> Oui{' '}
                <Case cochee={e.sensibilisation === false} label={`Évaluation ${i + 1} — sensibilisation Non`} /> Non
              </Td>
            ))}
          </tr>
        </Grille>
      )}
    </Section>
  )
}

function NonCibles({ traitement: t }: { traitement: Traitement }) {
  const { cases, nonRapprochees } = casesFamilles(
    t.comportement_non_cibles as Record<string, unknown> | null,
    FAMILLES_COMPORTEMENT_PAPIER,
  )
  return (
    <Section titre="10. Observation sur non cibles">
      <LigneOptions
        options={[
          { label: '10.1 Comportement anormal — Oui', cochee: t.comportement_anormal === true },
          { label: 'Non', cochee: t.comportement_anormal === false, nom: '10.1 Comportement anormal — Non' },
        ]}
      />
      <LigneOptions
        options={cases.map((c, i) => ({
          ...c,
          label: i === 0 ? `10.2 ${c.label}` : c.label,
          nom: `10.2 ${c.label}`,
        }))}
      />
      {nonRapprochees.length > 0 && (
        <Ligne>
          <Champ label="Autres familles concernées" valeur={nonRapprochees.join(', ')} />
        </Ligne>
      )}
    </Section>
  )
}

function Mortalite({ traitement: t }: { traitement: Traitement }) {
  const { cases, nonRapprochees } = casesFamilles(
    t.mortalite_familles as Record<string, unknown> | null,
    FAMILLES_MORTALITE_PAPIER,
  )
  return (
    <Section titre="11. Mortalité">
      <LigneOptions
        options={[
          { label: 'Oui', cochee: t.mortalite === true, nom: '11. Mortalité — Oui' },
          { label: 'Non', cochee: t.mortalite === false, nom: '11. Mortalité — Non' },
        ]}
      />
      <LigneOptions
        options={cases.map((c, i) => ({
          ...c,
          label: i === 0 ? `Si oui, Famille — ${c.label}` : c.label,
          nom: `11. Famille — ${c.label}`,
        }))}
      />
      {nonRapprochees.length > 0 && (
        <Ligne>
          <Champ label="Autres familles concernées" valeur={nonRapprochees.join(', ')} />
        </Ligne>
      )}
    </Section>
  )
}

/** Axes de risque environnemental — hors des 12 sections papier, omis quand rien n'est saisi. */
function AxesRisque({ traitement: t }: { traitement: Traitement }) {
  const axes = Object.entries((t.evaluation_risque ?? {}) as Record<string, unknown>)
  if (axes.length === 0) return null
  const libelle = (cle: string) => AXES_RISQUE.find((a) => a.key === cle)?.label ?? cle
  return (
    <Section titre="Axes de risque environnemental (complément)">
      <Ligne>
        {axes.map(([cle, valeur]) => (
          <Champ key={cle} label={libelle(cle)} valeur={valeur} />
        ))}
      </Ligne>
    </Section>
  )
}

function DetailAerien({ traitement: t }: { traitement: Traitement }) {
  const a = t.aerien
  if (!a) return null
  return (
    <Section titre="Détail Aérien (complément)">
      <Ligne>
        <Champ label="Pilote" valeur={a.pilote} />
        <Champ label="Mécanicien" valeur={a.mecanicien} />
      </Ligne>
      <Ligne>
        <Champ label="Base principale" valeur={a.base_principale} />
        <Champ label="Stand" valeur={a.stand} />
        <Champ label="Base secondaire" valeur={a.base_secondaire} />
      </Ligne>
      <Ligne>
        <Champ label="Immatriculation aéronef" valeur={a.immatricule_aeronef} />
        <Champ label="Nb rotations" valeur={a.nb_rotations} />
      </Ligne>
    </Section>
  )
}

function DetailTerrestre({ traitement: t }: { traitement: Traitement }) {
  const terrestre = t.terrestre
  if (!terrestre || (terrestre.essence_litres == null && terrestre.nb_piles == null)) return null
  return (
    <Section titre="Détail Terrestre (complément)">
      <Ligne>
        <Champ label="Essence (litres)" valeur={terrestre.essence_litres} />
        <Champ label="Nb piles" valeur={terrestre.nb_piles} />
      </Ligne>
    </Section>
  )
}

function Signatures({ traitement: t }: { traitement: Traitement }) {
  const signatures = t.signatures
  const consultant = (t.aerien ?? t.terrestre)?.consultant_international
  const aDejaSigne = signatures.some((s) => s.role === 'CONSULTANT_INTERNATIONAL')
  // Le consultant nommé en §1 doit signer comme les autres : une ligne « à signer » le rend
  // visible plutôt que de l'omettre en silence.
  const consultantASigner = Boolean(consultant) && !aDejaSigne
  if (signatures.length === 0 && !consultantASigner) return null
  return (
    <Section titre="Signatures (complément)">
      <Grille caption="Signatures">
        <tr>
          <Th gauche>Rôle</Th>
          <Th gauche>Nom</Th>
          <Th gauche>Date / heure</Th>
          <Th gauche>Signature</Th>
        </tr>
        {signatures.map((s) => {
          const viewBox = viewBoxTrace(s.signature_image)
          return (
            <tr key={s.id}>
              <Th gauche scope="row">
                {s.role}
              </Th>
              <Td gauche>{s.signataire_nom}</Td>
              <Td gauche>{texte(s.horodatage ? dateFr(s.horodatage) : null)}</Td>
              <Td>
                {viewBox && s.signature_image ? (
                  <svg
                    role="img"
                    aria-label={`Signature de ${s.signataire_nom}`}
                    viewBox={viewBox}
                    preserveAspectRatio="xMidYMid meet"
                    className="mx-auto h-[1.8cm] max-w-[4.2cm]"
                  >
                    <path d={s.signature_image} stroke="black" strokeWidth="2" fill="none" />
                  </svg>
                ) : (
                  '—'
                )}
              </Td>
            </tr>
          )
        })}
        {consultantASigner && (
          <tr>
            <Th gauche scope="row">
              CONSULTANT_INTERNATIONAL
            </Th>
            <Td gauche>{consultant}</Td>
            <Td gauche>—</Td>
            <Td>
              <span className="italic text-[#6b7280]">à signer</span>
            </Td>
          </tr>
        )}
      </Grille>
    </Section>
  )
}
