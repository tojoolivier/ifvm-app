import type { ReactNode } from 'react'
import type { CaptureBdd, InfestationBdd, PopulationBdd, ProspectionBdd } from '@/lib/prospection-fiche-bdd'
import { dateFr, texte } from '@/lib/fiche-tableau'
import {
  DEGATS,
  HUMIDITES,
  NIVEAUX_POPULATION,
  PHASES_IMAGO,
  STADES_IMAGO_EXTENSIF,
  STADES_IMAGO_INTENSIF,
  STADES_LARVE_LMC,
  STADES_LARVE_NSE,
  STADES_LARVE_NSE_EXTENSIF,
  STRATES,
  TEXTURES,
  TYPES_INFESTATION_INTENSIF,
  effectif,
  infestationParType,
  libelleEssaim,
  nomEspece,
  phasesLarve,
  phenologie,
  populationDe,
} from '@/lib/fiche-tableau-prospection'
import { Bandeau, Case, Entete, Feuille, Grille, Option, Td, Th } from './primitives'

/**
 * Fiche de prospection en lecture, présentée en tableaux comme le PDF téléchargé : deux
 * gabarits, comme `prospection_pdf.py` — intensif (formulaire papier avec grilles de captures)
 * et extensif (une fiche « validation » suit le gabarit extensif).
 */
export function FicheProspectionTableau({
  prospection,
  stationLabel,
}: {
  prospection: ProspectionBdd
  /** Nom de la station résolu par la page ; à défaut, la station saisie librement. */
  stationLabel?: string | null
}) {
  const station = stationLabel ?? prospection.station_libre ?? prospection.station_id
  return (
    <Feuille label={`Fiche de prospection ${prospection.n_fiche ?? ''}`.trim()}>
      {prospection.type_prospection === 'intensive' ? (
        <Intensive p={prospection} station={station} />
      ) : (
        <Extensive p={prospection} station={station} />
      )}
    </Feuille>
  )
}

type P = ProspectionBdd

/** Ligne de références : libellés en gras, valeurs en corps normal. */
function Ref({ children }: { children: ReactNode }) {
  return <p className="my-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]">{children}</p>
}

function Info({ label, valeur }: { label: string; valeur: unknown }) {
  return (
    <span>
      <b>{label} :</b> {texte(valeur)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Fiche extensive
// ---------------------------------------------------------------------------

function Extensive({ p, station }: { p: P; station: string | null | undefined }) {
  const biotope = p.biotope.length > 0 ? p.biotope.join(', ') : null
  return (
    <>
      <Entete
        organisme="Ivotoerana Famongorana ny Valala eto Madagasikara"
        sousTitre={`Prospection extensive — validation — ${p.n_fiche ?? '—'}`}
      />

      <Bandeau titre="A. Références">
        <Ref>
          <Info label="Prospecteur" valeur={p.prospecteur_nom} />
          <Info label="PA" valeur={p.pa_code} />
          <Info label="Date" valeur={dateFr(p.date_prospection)} />
          <Info label="N° message" valeur={p.n_message} />
        </Ref>
        <Ref>
          <Info label="Station" valeur={station} />
          <Info label="Latitude S" valeur={p.latitude} />
          <Info label="Longitude E" valeur={p.longitude} />
        </Ref>
        <Ref>
          <Info label="Type de station (biotope)" valeur={biotope} />
          <Info label="Surf." valeur={p.surface_station} />
        </Ref>
      </Bandeau>

      <Bandeau titre="B. Imagos">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BlocImagoExtensif populations={p.populations} espece="LMC" />
          <BlocImagoExtensif populations={p.populations} espece="NSE" />
        </div>
      </Bandeau>

      <Bandeau titre="C. Larves">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BlocLarveExtensif populations={p.populations} espece="LMC" stades={STADES_LARVE_LMC} />
          <BlocLarveExtensif populations={p.populations} espece="NSE" stades={STADES_LARVE_NSE_EXTENSIF} />
        </div>
      </Bandeau>

      <Bandeau titre="D. Observations">
        <Ref>
          <Info label="Dégâts sur les cultures" valeur={p.degats_cultures} />
          <Info label="% Verd strate herbeuse" valeur={p.verdissement_pourcent} />
          <Info label="H Str Herb" valeur={p.hauteur_herbe_cm} />
        </Ref>
        <Ref>
          <Info label="Dernière pluie le" valeur={dateFr(p.derniere_pluie)} />
          <Info label="Intensité" valeur={p.intensite_pluie} />
        </Ref>
      </Bandeau>
    </>
  )
}

function BlocImagoExtensif({ populations, espece }: { populations: PopulationBdd[]; espece: string }) {
  const pop = populationDe(populations, espece, 'imago')
  const stades = pop?.stades_imago ?? {}
  const essaim = pop?.type_cible?.[0]
  return (
    <Grille caption={`Imagos ${espece}`}>
      <tr>
        <Th colSpan={2}>Nbre de Captures : {texte(pop?.captures_nombre)}</Th>
        <Th colSpan={3}>{espece}</Th>
      </tr>
      <tr>
        <Td>Nbre Sol : {texte(pop?.captures_sol)}</Td>
        <Td>Nbre Trans : {texte(pop?.captures_trans)}</Td>
        <Td colSpan={3}>Nbre Greg : {texte(pop?.captures_greg)}</Td>
      </tr>
      <tr>
        {STADES_IMAGO_EXTENSIF.map((s) => (
          <Th key={s}>{s}</Th>
        ))}
      </tr>
      <tr>
        {STADES_IMAGO_EXTENSIF.map((s) => (
          <Td key={s}>{texte(stades[s])}</Td>
        ))}
      </tr>
      <tr>
        <Td colSpan={2}>Nbre Acc : —</Td>
        <Td colSpan={3}>Nbre Pnt : —</Td>
      </tr>
      <tr>
        <Td colSpan={2}>Pop diff D/ha : {texte(pop?.densite_diffuse)}</Td>
        <Td colSpan={3}>Pop group D/m² : {texte(pop?.densite_groupee)}</Td>
      </tr>
      <tr>
        <Td colSpan={5}>
          Essaim : {texte(essaim ? libelleEssaim(essaim) : null)} · Dir de {texte(pop?.direction_de)} vers{' '}
          {texte(pop?.direction_vers)} · En vol <Case cochee={Boolean(pop?.essaim_en_vol)} label="En vol" /> Posé{' '}
          <Case cochee={Boolean(pop?.essaim_pose)} label="Posé" />
        </Td>
      </tr>
      <tr>
        <Td colSpan={5}>Surf. Infestée (ha) : {texte(pop?.surface_contaminee_ha)}</Td>
      </tr>
    </Grille>
  )
}

function BlocLarveExtensif({
  populations,
  espece,
  stades,
}: {
  populations: PopulationBdd[]
  espece: string
  stades: string[]
}) {
  const pop = populationDe(populations, espece, 'larve')
  const densites = pop?.densites_larve ?? {}
  const colspan = Math.max(stades.length - 2, 1)
  return (
    <Grille caption={`Larves ${espece}`}>
      <tr>
        <Th colSpan={2}>Nbre de Captures : {texte(pop?.captures_nombre)}</Th>
        <Th colSpan={colspan}>{espece}</Th>
      </tr>
      <tr>
        <Td>Nbre Sol : {texte(pop?.captures_sol)}</Td>
        <Td>Nbre Trans : {texte(pop?.captures_trans)}</Td>
        <Td colSpan={colspan}>Nbre Greg : {texte(pop?.captures_greg)}</Td>
      </tr>
      <tr>
        {stades.map((s) => (
          <Th key={s}>{s}</Th>
        ))}
      </tr>
      <tr>
        {stades.map((s) => (
          <Td key={s}>{texte(densites[s])}</Td>
        ))}
      </tr>
      <tr>
        <Td colSpan={stades.length}>
          Pop diff D/ha : {texte(pop?.densite_diffuse)} · Pop group D/m² : {texte(pop?.densite_groupee)}
        </Td>
      </tr>
      <tr>
        <Td colSpan={stades.length}>
          TL <Case cochee={Boolean(pop?.tache_larvaire)} label="TL" /> / BL{' '}
          <Case cochee={Boolean(pop?.bande_larvaire)} label="BL" /> · Interdistance : {texte(pop?.interdistance)} m
        </Td>
      </tr>
      <tr>
        <Td colSpan={stades.length}>
          Surf. Infestée (ha) : {texte(pop?.surface_contaminee_ha)} · Déplacement/Repos : {texte(pop?.deplacement)}
        </Td>
      </tr>
    </Grille>
  )
}

// ---------------------------------------------------------------------------
// Fiche intensive
// ---------------------------------------------------------------------------

function Intensive({ p, station }: { p: P; station: string | null | undefined }) {
  const lmcImago = populationDe(p.populations, 'LMC', 'imago')
  const lmcLarve = populationDe(p.populations, 'LMC', 'larve')
  const nseImago = populationDe(p.populations, 'NSE', 'imago')
  const nseLarve = populationDe(p.populations, 'NSE', 'larve')
  const sol = (p.sol ?? {}) as { humidite?: unknown; texture?: unknown }
  const humidite = enListe(sol.humidite)
  const texture = enListe(sol.texture)

  return (
    <>
      <Entete
        organisme="IVOTOERANA FAMONGORANA NY VALALA ETO MADAGASIKARA"
        sousTitre={`FICHE DE PROSPECTION ANTIACRIDIENNE — IFVM — ${p.n_fiche ?? '—'}`}
      />

      <Bandeau titre="A. Référence">
        <Ref>
          <Info label="Prospecteur" valeur={p.prospecteur_nom} />
          <Info label="N° relevé" valeur={p.n_message} />
          <Info label="Date" valeur={dateFr(p.date_prospection)} />
          <Info label="N° Fiche" valeur={p.n_fiche} />
        </Ref>
        <Ref>
          <Info label="PA" valeur={p.pa_code} />
          <Info label="Région" valeur={p.region} />
          <Info label="District" valeur={p.district} />
          <Info label="Commune" valeur={p.commune} />
        </Ref>
        <Ref>
          <Info label="Station" valeur={station} />
          <Info label="Latitude" valeur={p.latitude} />
          <Info label="Longitude" valeur={p.longitude === null ? null : `${p.longitude}E`} />
          <span>
            <b>Altitude :</b> {texte(p.altitude)} m
          </span>
        </Ref>
        <Ref>
          <span>
            <b>Surf. Station :</b> {texte(p.surface_station)} ha
          </span>
          <span>
            <b>Surf. prospect. :</b> {texte(p.surface_prospectee)} ha
          </span>
          <span>
            <b>Surf. Infestée :</b> {texte(p.surface_infestee)} ha
          </span>
        </Ref>
      </Bandeau>

      <Bandeau titre={`B. ${nomEspece('LMC')} — Imagos`}>
        <Ref>
          <span>9. Densité population diffuse : {texte(lmcImago?.densite_diffuse)}/ha</span>
          <span>10. Densité population groupée : {texte(lmcImago?.densite_groupee)}/m²</span>
        </Ref>
        <Ref>
          <b>Accouplement / Ponte</b>
        </Ref>
        <TableNiveau titre1="11. Acclt" titre2="12. Ponte" population={lmcImago} avecDominant />
        <Ref>
          <span>
            13. Captures — Nombre d'imagos capturés : {texte(lmcImago?.captures_nombre)} (50 max)
          </span>
          <span>Temps de capture : {texte(lmcImago?.temps_capture)} minutes (30 min max)</span>
        </Ref>
        <GrilleImagos captures={p.captures} espece="LMC" />

        <Ref>
          <b>Larves</b>
        </Ref>
        <Ref>
          <span>14. Densité population diffuse : {texte(lmcLarve?.densite_diffuse)}/ha</span>
          <span>15. Densité population groupée : {texte(lmcLarve?.densite_groupee)}/m²</span>
        </Ref>
        <Ref>16. Captures — Nombre : {texte(lmcLarve?.captures_nombre)} (65 max)</Ref>
        <GrilleLarves captures={p.captures} espece="LMC" stades={STADES_LARVE_LMC} />
      </Bandeau>

      <Bandeau titre={`C. ${nomEspece('NSE')} — Imagos`}>
        <Ref>
          <span>17. Densité population diffuse : {texte(nseImago?.densite_diffuse)}/ha</span>
          <span>18. Densité population groupée : {texte(nseImago?.densite_groupee)}/m²</span>
        </Ref>
        <Ref>
          <b>Accouplement / ponte</b>
        </Ref>
        <TableNiveau titre1="16. Accplt" titre2="17. Ponte" population={nseImago} />
        <Ref>19. Capture — Nombre : {texte(nseImago?.captures_nombre)} (30 max)</Ref>
        <GrilleImagos captures={p.captures} espece="NSE" />

        <Ref>
          <b>Larves</b>
        </Ref>
        <Ref>
          <span>20. Densité population diffuse : {texte(nseLarve?.densite_diffuse)}/ha</span>
          <span>21. Densité population groupée : {texte(nseLarve?.densite_groupee)}/m²</span>
        </Ref>
        <Ref>21. Captures — Nombre : {texte(nseLarve?.captures_nombre)} (75 max)</Ref>
        <GrilleLarves captures={p.captures} espece="NSE" stades={STADES_LARVE_NSE} />
      </Bandeau>

      <Bandeau titre="D. Infestation — Description">
        <DescriptionInfestation infestations={p.infestations} />
        <Ref>
          <b>Comportement</b>
        </Ref>
        <ComportementInfestation infestations={p.infestations} />
      </Bandeau>

      <Bandeau titre="E. Végétation">
        <Vegetation p={p} />
        <Ref>
          <b>43. Dégâts sur culture :</b>
          {DEGATS.map((d) => (
            <Option key={d.valeur} label={d.label} cochee={p.degats_cultures === d.valeur} />
          ))}
        </Ref>
        <Ref>
          <b>Humidité du sol (S ou H) :</b>
          {HUMIDITES.map((h) => (
            <Option key={h.valeur} label={h.label} cochee={humidite.includes(h.valeur)} />
          ))}
        </Ref>
        <Ref>
          <b>45. Texture au sol :</b>
          {TEXTURES.map((t) => (
            <Option key={t.valeur} label={t.label} cochee={texture.includes(t.valeur)} />
          ))}
        </Ref>
        <Ref>
          <Info label="46. Ennemis naturels observés" valeur={p.ennemis_naturels} />
        </Ref>
        <Ref>
          <Info label="Observation" valeur={p.observations} />
        </Ref>
      </Bandeau>
    </>
  )
}

/** `sol.humidite` / `sol.texture` : liste, ou simple chaîne pour un ancien brouillon. */
function enListe(valeur: unknown): string[] {
  if (Array.isArray(valeur)) return valeur.map(String)
  return valeur ? [String(valeur)] : []
}

function TableNiveau({
  titre1,
  titre2,
  population,
  avecDominant = false,
}: {
  titre1: string
  titre2: string
  population: PopulationBdd | undefined
  /** LMC a une colonne « Dominant » ; NSE n'en a que quatre, jamais de Dominant. */
  avecDominant?: boolean
}) {
  const niveaux = avecDominant ? NIVEAUX_POPULATION : NIVEAUX_POPULATION.slice(0, -1)
  const ligne = (label: string, valeur: string | null | undefined) => (
    <tr>
      <Td gauche>{label}</Td>
      {niveaux.map((n) => (
        <Td key={n.valeur}>
          <Case cochee={valeur === n.valeur} label={`${label} — ${n.label}`} />
        </Td>
      ))}
    </tr>
  )
  return (
    <Grille caption={`${titre1} / ${titre2}`}>
      <tr>
        <Th gauche />
        {niveaux.map((n) => (
          <Th key={n.valeur}>{n.label}</Th>
        ))}
      </tr>
      {ligne(titre1, population?.accouplement)}
      {ligne(titre2, population?.ponte)}
    </Grille>
  )
}

function GrilleImagos({ captures, espece }: { captures: CaptureBdd[]; espece: string }) {
  const lignes = (sexe: string, groupe: string) =>
    PHASES_IMAGO.map((phase, i) => (
      <tr key={`${sexe}-${phase.valeur}`}>
        {i === 0 && (
          <Td gauche rowSpan={PHASES_IMAGO.length}>
            {groupe}
          </Td>
        )}
        <Td gauche>{phase.label}</Td>
        {STADES_IMAGO_INTENSIF.map((stade) => (
          <Td key={stade}>{effectif(captures, espece, 'imago', sexe, phase.valeur, stade) || ''}</Td>
        ))}
      </tr>
    ))
  return (
    <Grille caption={`Captures d'imagos ${espece}`}>
      <tr>
        <Th gauche>Sexe</Th>
        <Th gauche>Phase</Th>
        {STADES_IMAGO_INTENSIF.map((s) => (
          <Th key={s}>{s}</Th>
        ))}
      </tr>
      {lignes('F', 'Nbre de Femelles')}
      {lignes('M', 'Nbre de Mâles')}
    </Grille>
  )
}

function GrilleLarves({
  captures,
  espece,
  stades,
}: {
  captures: CaptureBdd[]
  espece: string
  stades: string[]
}) {
  return (
    <Grille caption={`Captures de larves ${espece}`}>
      <tr>
        <Th gauche>Phase</Th>
        {stades.map((s) => (
          <Th key={s}>{s}</Th>
        ))}
      </tr>
      {phasesLarve(espece).map((phase) => (
        <tr key={phase.valeur}>
          <Td gauche>{phase.label}</Td>
          {stades.map((stade) => (
            <Td key={stade}>{effectif(captures, espece, 'larve', null, phase.valeur, stade) || ''}</Td>
          ))}
        </tr>
      ))}
    </Grille>
  )
}

function DescriptionInfestation({ infestations }: { infestations: InfestationBdd[] }) {
  return (
    <Grille caption="Infestation — description">
      <tr>
        <Th />
        <Th>Espèce</Th>
        <Th colSpan={3}>Taille</Th>
        <Th>Surf TOT ha</Th>
        <Th colSpan={3}>Densité</Th>
        <Th>Interdistance</Th>
      </tr>
      <tr>
        <Th />
        <Th />
        <Th>min</Th>
        <Th>max</Th>
        <Th>moy</Th>
        <Th />
        <Th>min</Th>
        <Th>max</Th>
        <Th>moy</Th>
        <Th />
      </tr>
      {TYPES_INFESTATION_INTENSIF.map(({ valeur, label }) => {
        const i = infestationParType(infestations, valeur)
        return (
          <tr key={valeur}>
            <Td gauche>{label}</Td>
            <Td>{texte(i?.espece)}</Td>
            <Td>{texte(i?.taille_min)}</Td>
            <Td>{texte(i?.taille_max)}</Td>
            <Td>{texte(i?.taille_moy)}</Td>
            <Td>{texte(i?.surface_totale)}</Td>
            <Td>{texte(i?.densite_min)}</Td>
            <Td>{texte(i?.densite_max)}</Td>
            <Td>{texte(i?.densite_moy)}</Td>
            <Td>{texte(i?.interdistance)}</Td>
          </tr>
        )
      })}
    </Grille>
  )
}

function ComportementInfestation({ infestations }: { infestations: InfestationBdd[] }) {
  return (
    <Grille caption="Infestation — comportement">
      <tr>
        <Th />
        <Th>Espèce</Th>
        <Th>Repos</Th>
        <Th>Déplac</Th>
        <Th colSpan={2}>Direction</Th>
        <Th colSpan={2}>Vent</Th>
      </tr>
      <tr>
        <Th />
        <Th />
        <Th />
        <Th />
        <Th>de</Th>
        <Th>vers</Th>
        <Th>de</Th>
        <Th>vitesse</Th>
      </tr>
      {TYPES_INFESTATION_INTENSIF.map(({ valeur, label }) => {
        const i = infestationParType(infestations, valeur)
        const comportement = i?.comportement ?? null
        return (
          <tr key={valeur}>
            <Td gauche>{label}</Td>
            <Td>{texte(i?.espece)}</Td>
            <Td>
              <Case cochee={comportement === 'repos'} label={`${label} — repos`} />
            </Td>
            <Td>
              <Case cochee={comportement === 'deplacement'} label={`${label} — déplacement`} />
            </Td>
            <Td>{texte(i?.direction_de)}</Td>
            <Td>{texte(i?.direction_vers)}</Td>
            <Td>{texte(i?.vent_de)}</Td>
            <Td>{texte(i?.vent_vitesse)}</Td>
          </tr>
        )
      })}
    </Grille>
  )
}

function Vegetation({ p }: { p: P }) {
  const strates = ((p.vegetation ?? {}) as { strates?: Record<string, Record<string, unknown>> }).strates ?? {}
  const solNu = ((p.sol ?? {}) as { solNu?: unknown }).solNu
  return (
    <Grille caption="Végétation">
      <tr>
        <Th gauche />
        <Th>a Surf. Rel.</Th>
        <Th>b H.Moy.(m)</Th>
        <Th>c Rec%</Th>
        <Th>d %Verdiss.</Th>
        <Th>e Repous.</Th>
        <Th>f Germ.</Th>
        <Th>g Feuille</Th>
        <Th>h Fleur</Th>
        <Th>i Fruit</Th>
        <Th>j Sec</Th>
      </tr>
      <tr>
        <Td gauche>Sol nu</Td>
        <Td colSpan={10}>{texte(solNu)}%</Td>
      </tr>
      {STRATES.map(({ cle, label }) => {
        const s = strates[cle] ?? {}
        return (
          <tr key={cle}>
            <Td gauche>{label}</Td>
            <Td>{texte(s.surfRel)}</Td>
            <Td>{texte(s.hMoy)}</Td>
            <Td>{texte(s.recouvrement)}</Td>
            <Td>{texte(s.verdissement)}</Td>
            <Td>{s.repousse == null ? '—' : s.repousse ? 'Oui' : 'Non'}</Td>
            <Td>{phenologie(s.orpad)}</Td>
            <Td>{phenologie(s.feuille)}</Td>
            <Td>{phenologie(s.fleur)}</Td>
            <Td>{phenologie(s.fruit)}</Td>
            <Td>{phenologie(s.sec)}</Td>
          </tr>
        )
      })}
    </Grille>
  )
}
