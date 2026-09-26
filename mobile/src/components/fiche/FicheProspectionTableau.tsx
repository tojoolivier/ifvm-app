import { Text, View } from 'react-native';
import type { CaptureRead, InfestationRead, PopulationRead, ProspectionRead } from '@/lib/api-client';
import { dateFr, texte } from '@/lib/fiche-tableau';
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
  enListe,
  infestationParType,
  libelleEssaim,
  nomEspece,
  phasesLarve,
  phenologie,
  populationDe,
} from '@/lib/fiche-tableau-prospection';
import {
  Bandeau,
  Case,
  Cellule,
  FicheStyles,
  Grille,
  Info,
  Ligne,
  Option,
  Ref,
  SousTitre,
} from './tableau';

/**
 * Fiche de prospection en lecture, présentée en tableaux comme le PDF téléchargé : deux gabarits,
 * comme `prospection_pdf.py` — intensif (formulaire papier avec grilles de captures) et extensif
 * (une fiche « validation » suit le gabarit extensif). Même contenu que la fiche du web.
 */
export function FicheProspectionTableau({
  prospection,
  stationLabel,
}: {
  prospection: ProspectionRead;
  /** Nom de la station résolu par l'écran ; à défaut, la station saisie librement. */
  stationLabel?: string | null;
}) {
  const station = stationLabel ?? prospection.station_libre ?? prospection.station_id;
  return (
    <FicheStyles>
      <View accessibilityLabel={`Fiche de prospection ${prospection.n_fiche ?? ''}`.trim()}>
        {prospection.type_prospection === 'intensive' ? (
          <Intensive p={prospection} station={station} />
        ) : (
          <Extensive p={prospection} station={station} />
        )}
      </View>
    </FicheStyles>
  );
}

type P = ProspectionRead;

// ---------------------------------------------------------------------------
// Fiche extensive
// ---------------------------------------------------------------------------

function Extensive({ p, station }: { p: P; station: string | null | undefined }) {
  const biotope = p.biotope.length > 0 ? p.biotope.join(', ') : null;
  return (
    <>
      <Titre organisme="Ivotoerana Famongorana ny Valala eto Madagasikara" sousTitre={`Prospection extensive — validation — ${p.n_fiche ?? '—'}`} />

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
        <BlocImagoExtensif populations={p.populations} espece="LMC" />
        <BlocImagoExtensif populations={p.populations} espece="NSE" />
      </Bandeau>

      <Bandeau titre="C. Larves">
        <BlocLarveExtensif populations={p.populations} espece="LMC" stades={STADES_LARVE_LMC} />
        <BlocLarveExtensif populations={p.populations} espece="NSE" stades={STADES_LARVE_NSE_EXTENSIF} />
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
  );
}

/** Organisme et titre centrés, en tête de fiche. */
function Titre({ organisme, sousTitre }: { organisme: string; sousTitre: string }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 4 }}>
      <Text style={{ fontWeight: '700', textAlign: 'center' }}>{organisme}</Text>
      <Text accessibilityRole="header" style={{ fontWeight: '700', textAlign: 'center', marginTop: 2 }}>
        {sousTitre}
      </Text>
    </View>
  );
}

function BlocImagoExtensif({ populations, espece }: { populations: PopulationRead[]; espece: string }) {
  const pop = populationDe(populations, espece, 'imago');
  const stades = pop?.stades_imago ?? {};
  const essaim = pop?.type_cible?.[0];
  return (
    <Grille caption={`Imagos ${espece}`} colonnes={5}>
      <Ligne>
        <Cellule entete span={2}>Nbre de Captures : {texte(pop?.captures_nombre)}</Cellule>
        <Cellule entete span={3}>{espece}</Cellule>
      </Ligne>
      <Ligne>
        <Cellule>Nbre Sol : {texte(pop?.captures_sol)}</Cellule>
        <Cellule>Nbre Trans : {texte(pop?.captures_trans)}</Cellule>
        <Cellule span={3}>Nbre Greg : {texte(pop?.captures_greg)}</Cellule>
      </Ligne>
      <Ligne>
        {STADES_IMAGO_EXTENSIF.map((s) => (
          <Cellule key={s} entete>{s}</Cellule>
        ))}
      </Ligne>
      <Ligne>
        {STADES_IMAGO_EXTENSIF.map((s) => (
          <Cellule key={s}>{texte(stades[s])}</Cellule>
        ))}
      </Ligne>
      <Ligne>
        <Cellule span={2}>Nbre Acc : —</Cellule>
        <Cellule span={3}>Nbre Pnt : —</Cellule>
      </Ligne>
      <Ligne>
        <Cellule span={2}>Pop diff D/ha : {texte(pop?.densite_diffuse)}</Cellule>
        <Cellule span={3}>Pop group D/m² : {texte(pop?.densite_groupee)}</Cellule>
      </Ligne>
      <Ligne>
        <Cellule span={5}>
          Essaim : {texte(essaim ? libelleEssaim(essaim) : null)} · Dir de {texte(pop?.direction_de)} vers{' '}
          {texte(pop?.direction_vers)} · En vol <Case cochee={Boolean(pop?.essaim_en_vol)} label="En vol" /> Posé{' '}
          <Case cochee={Boolean(pop?.essaim_pose)} label="Posé" />
        </Cellule>
      </Ligne>
      <Ligne>
        <Cellule span={5}>Surf. Infestée (ha) : {texte(pop?.surface_contaminee_ha)}</Cellule>
      </Ligne>
    </Grille>
  );
}

function BlocLarveExtensif({
  populations,
  espece,
  stades,
}: {
  populations: PopulationRead[];
  espece: string;
  stades: string[];
}) {
  const pop = populationDe(populations, espece, 'larve');
  const densites = pop?.densites_larve ?? {};
  const reste = Math.max(stades.length - 2, 1);
  return (
    <Grille caption={`Larves ${espece}`} colonnes={stades.length}>
      <Ligne>
        <Cellule entete span={2}>Nbre de Captures : {texte(pop?.captures_nombre)}</Cellule>
        <Cellule entete span={reste}>{espece}</Cellule>
      </Ligne>
      <Ligne>
        <Cellule>Nbre Sol : {texte(pop?.captures_sol)}</Cellule>
        <Cellule>Nbre Trans : {texte(pop?.captures_trans)}</Cellule>
        <Cellule span={reste}>Nbre Greg : {texte(pop?.captures_greg)}</Cellule>
      </Ligne>
      <Ligne>
        {stades.map((s) => (
          <Cellule key={s} entete>{s}</Cellule>
        ))}
      </Ligne>
      <Ligne>
        {stades.map((s) => (
          <Cellule key={s}>{texte(densites[s])}</Cellule>
        ))}
      </Ligne>
      <Ligne>
        <Cellule span={stades.length}>
          Pop diff D/ha : {texte(pop?.densite_diffuse)} · Pop group D/m² : {texte(pop?.densite_groupee)}
        </Cellule>
      </Ligne>
      <Ligne>
        <Cellule span={stades.length}>
          TL <Case cochee={Boolean(pop?.tache_larvaire)} label="TL" /> / BL{' '}
          <Case cochee={Boolean(pop?.bande_larvaire)} label="BL" /> · Interdistance : {texte(pop?.interdistance)} m
        </Cellule>
      </Ligne>
      <Ligne>
        <Cellule span={stades.length}>
          Surf. Infestée (ha) : {texte(pop?.surface_contaminee_ha)} · Déplacement/Repos : {texte(pop?.deplacement)}
        </Cellule>
      </Ligne>
    </Grille>
  );
}

// ---------------------------------------------------------------------------
// Fiche intensive
// ---------------------------------------------------------------------------

function Intensive({ p, station }: { p: P; station: string | null | undefined }) {
  const lmcImago = populationDe(p.populations, 'LMC', 'imago');
  const lmcLarve = populationDe(p.populations, 'LMC', 'larve');
  const nseImago = populationDe(p.populations, 'NSE', 'imago');
  const nseLarve = populationDe(p.populations, 'NSE', 'larve');
  const sol = (p.sol ?? {}) as { humidite?: unknown; texture?: unknown };
  const humidite = enListe(sol.humidite);
  const texture = enListe(sol.texture);

  return (
    <>
      <Titre organisme="IVOTOERANA FAMONGORANA NY VALALA ETO MADAGASIKARA" sousTitre={`FICHE DE PROSPECTION ANTIACRIDIENNE — IFVM — ${p.n_fiche ?? '—'}`} />

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
          <Info label="Altitude" valeur={p.altitude === null ? null : `${p.altitude} m`} />
        </Ref>
        <Ref>
          <Info label="Surf. Station" valeur={p.surface_station === null ? null : `${p.surface_station} ha`} />
          <Info label="Surf. prospect." valeur={p.surface_prospectee === null ? null : `${p.surface_prospectee} ha`} />
          <Info label="Surf. Infestée" valeur={p.surface_infestee === null ? null : `${p.surface_infestee} ha`} />
        </Ref>
      </Bandeau>

      <Bandeau titre={`B. ${nomEspece('LMC')} — Imagos`}>
        <Ref>
          <Info label="9. Densité population diffuse" valeur={`${texte(lmcImago?.densite_diffuse)}/ha`} />
          <Info label="10. Densité population groupée" valeur={`${texte(lmcImago?.densite_groupee)}/m²`} />
        </Ref>
        <SousTitre>Accouplement / Ponte</SousTitre>
        <TableNiveau titre1="11. Acclt" titre2="12. Ponte" population={lmcImago} avecDominant />
        <Ref>
          <Info label="13. Captures — Nombre d'imagos capturés" valeur={`${texte(lmcImago?.captures_nombre)} (50 max)`} />
          <Info label="Temps de capture" valeur={`${texte(lmcImago?.temps_capture)} minutes (30 min max)`} />
        </Ref>
        <GrilleImagos captures={p.captures} espece="LMC" />

        <SousTitre>Larves</SousTitre>
        <Ref>
          <Info label="14. Densité population diffuse" valeur={`${texte(lmcLarve?.densite_diffuse)}/ha`} />
          <Info label="15. Densité population groupée" valeur={`${texte(lmcLarve?.densite_groupee)}/m²`} />
        </Ref>
        <Ref>
          <Info label="16. Captures — Nombre" valeur={`${texte(lmcLarve?.captures_nombre)} (65 max)`} />
        </Ref>
        <GrilleLarves captures={p.captures} espece="LMC" stades={STADES_LARVE_LMC} />
      </Bandeau>

      <Bandeau titre={`C. ${nomEspece('NSE')} — Imagos`}>
        <Ref>
          <Info label="17. Densité population diffuse" valeur={`${texte(nseImago?.densite_diffuse)}/ha`} />
          <Info label="18. Densité population groupée" valeur={`${texte(nseImago?.densite_groupee)}/m²`} />
        </Ref>
        <SousTitre>Accouplement / ponte</SousTitre>
        <TableNiveau titre1="16. Accplt" titre2="17. Ponte" population={nseImago} />
        <Ref>
          <Info label="19. Capture — Nombre" valeur={`${texte(nseImago?.captures_nombre)} (30 max)`} />
        </Ref>
        <GrilleImagos captures={p.captures} espece="NSE" />

        <SousTitre>Larves</SousTitre>
        <Ref>
          <Info label="20. Densité population diffuse" valeur={`${texte(nseLarve?.densite_diffuse)}/ha`} />
          <Info label="21. Densité population groupée" valeur={`${texte(nseLarve?.densite_groupee)}/m²`} />
        </Ref>
        <Ref>
          <Info label="21. Captures — Nombre" valeur={`${texte(nseLarve?.captures_nombre)} (75 max)`} />
        </Ref>
        <GrilleLarves captures={p.captures} espece="NSE" stades={STADES_LARVE_NSE} />
      </Bandeau>

      <Bandeau titre="D. Infestation — Description">
        <DescriptionInfestation infestations={p.infestations} />
        <SousTitre>Comportement</SousTitre>
        <ComportementInfestation infestations={p.infestations} />
      </Bandeau>

      <Bandeau titre="E. Végétation">
        <Vegetation p={p} />
        <Ref>
          <Text style={{ fontWeight: '700' }}>43. Dégâts sur culture : </Text>
          {DEGATS.map((d) => (
            <Option key={d.valeur} label={d.label} cochee={p.degats_cultures === d.valeur} />
          ))}
        </Ref>
        <Ref>
          <Text style={{ fontWeight: '700' }}>Humidité du sol (S ou H) : </Text>
          {HUMIDITES.map((h) => (
            <Option key={h.valeur} label={h.label} cochee={humidite.includes(h.valeur)} />
          ))}
        </Ref>
        <Ref>
          <Text style={{ fontWeight: '700' }}>45. Texture au sol : </Text>
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
  );
}

function TableNiveau({
  titre1,
  titre2,
  population,
  avecDominant = false,
}: {
  titre1: string;
  titre2: string;
  population: PopulationRead | undefined;
  /** LMC a une colonne « Dominant » ; NSE n'en a que quatre, jamais de Dominant. */
  avecDominant?: boolean;
}) {
  const niveaux = avecDominant ? NIVEAUX_POPULATION : NIVEAUX_POPULATION.slice(0, -1);
  const ligne = (label: string, valeur: string | null | undefined) => (
    <Ligne>
      <Cellule gauche poids={1.6}>{label}</Cellule>
      {niveaux.map((n) => (
        <Cellule key={n.valeur}>
          <Case cochee={valeur === n.valeur} label={`${label} — ${n.label}`} />
        </Cellule>
      ))}
    </Ligne>
  );
  return (
    <Grille caption={`${titre1} / ${titre2}`} colonnes={niveaux.length + 2}>
      <Ligne>
        <Cellule entete poids={1.6} />
        {niveaux.map((n) => (
          <Cellule key={n.valeur} entete>{n.label}</Cellule>
        ))}
      </Ligne>
      {ligne(titre1, population?.accouplement)}
      {ligne(titre2, population?.ponte)}
    </Grille>
  );
}

function GrilleImagos({ captures, espece }: { captures: CaptureRead[]; espece: string }) {
  const bloc = (sexe: string, groupe: string) => (
    <>
      {/* Pas de `rowSpan` en React Native : le groupe devient une ligne de sous-titre. */}
      <Ligne>
        <Cellule entete gauche span={STADES_IMAGO_INTENSIF.length + 2}>{groupe}</Cellule>
      </Ligne>
      {PHASES_IMAGO.map((phase) => (
        <Ligne key={`${sexe}-${phase.valeur}`}>
          <Cellule gauche span={2}>{phase.label}</Cellule>
          {STADES_IMAGO_INTENSIF.map((stade) => (
            <Cellule key={stade}>{effectif(captures, espece, 'imago', sexe, phase.valeur, stade) || ''}</Cellule>
          ))}
        </Ligne>
      ))}
    </>
  );
  return (
    <Grille caption={`Captures d'imagos ${espece}`} colonnes={STADES_IMAGO_INTENSIF.length + 2}>
      <Ligne>
        <Cellule entete gauche span={2}>Phase</Cellule>
        {STADES_IMAGO_INTENSIF.map((s) => (
          <Cellule key={s} entete>{s}</Cellule>
        ))}
      </Ligne>
      {bloc('F', 'Nbre de Femelles')}
      {bloc('M', 'Nbre de Mâles')}
    </Grille>
  );
}

function GrilleLarves({
  captures,
  espece,
  stades,
}: {
  captures: CaptureRead[];
  espece: string;
  stades: string[];
}) {
  return (
    <Grille caption={`Captures de larves ${espece}`} colonnes={stades.length + 2}>
      <Ligne>
        <Cellule entete gauche span={2}>Phase</Cellule>
        {stades.map((s) => (
          <Cellule key={s} entete>{s}</Cellule>
        ))}
      </Ligne>
      {phasesLarve(espece).map((phase) => (
        <Ligne key={phase.valeur}>
          <Cellule gauche span={2}>{phase.label}</Cellule>
          {stades.map((stade) => (
            <Cellule key={stade}>{effectif(captures, espece, 'larve', null, phase.valeur, stade) || ''}</Cellule>
          ))}
        </Ligne>
      ))}
    </Grille>
  );
}

function DescriptionInfestation({ infestations }: { infestations: InfestationRead[] }) {
  return (
    <Grille caption="Infestation — description" colonnes={10}>
      <Ligne>
        <Cellule entete />
        <Cellule entete>Espèce</Cellule>
        <Cellule entete span={3}>Taille</Cellule>
        <Cellule entete>Surf TOT ha</Cellule>
        <Cellule entete span={3}>Densité</Cellule>
        <Cellule entete>Interdistance</Cellule>
      </Ligne>
      <Ligne>
        <Cellule entete />
        <Cellule entete />
        <Cellule entete>min</Cellule>
        <Cellule entete>max</Cellule>
        <Cellule entete>moy</Cellule>
        <Cellule entete />
        <Cellule entete>min</Cellule>
        <Cellule entete>max</Cellule>
        <Cellule entete>moy</Cellule>
        <Cellule entete />
      </Ligne>
      {TYPES_INFESTATION_INTENSIF.map(({ valeur, label }) => {
        const i = infestationParType(infestations, valeur);
        return (
          <Ligne key={valeur}>
            <Cellule gauche>{label}</Cellule>
            <Cellule>{texte(i?.espece)}</Cellule>
            <Cellule>{texte(i?.taille_min)}</Cellule>
            <Cellule>{texte(i?.taille_max)}</Cellule>
            <Cellule>{texte(i?.taille_moy)}</Cellule>
            <Cellule>{texte(i?.surface_totale)}</Cellule>
            <Cellule>{texte(i?.densite_min)}</Cellule>
            <Cellule>{texte(i?.densite_max)}</Cellule>
            <Cellule>{texte(i?.densite_moy)}</Cellule>
            <Cellule>{texte(i?.interdistance)}</Cellule>
          </Ligne>
        );
      })}
    </Grille>
  );
}

function ComportementInfestation({ infestations }: { infestations: InfestationRead[] }) {
  return (
    <Grille caption="Infestation — comportement" colonnes={8}>
      <Ligne>
        <Cellule entete />
        <Cellule entete>Espèce</Cellule>
        <Cellule entete>Repos</Cellule>
        <Cellule entete>Déplac</Cellule>
        <Cellule entete span={2}>Direction</Cellule>
        <Cellule entete span={2}>Vent</Cellule>
      </Ligne>
      <Ligne>
        <Cellule entete />
        <Cellule entete />
        <Cellule entete />
        <Cellule entete />
        <Cellule entete>de</Cellule>
        <Cellule entete>vers</Cellule>
        <Cellule entete>de</Cellule>
        <Cellule entete>vitesse</Cellule>
      </Ligne>
      {TYPES_INFESTATION_INTENSIF.map(({ valeur, label }) => {
        const i = infestationParType(infestations, valeur);
        const comportement = i?.comportement ?? null;
        return (
          <Ligne key={valeur}>
            <Cellule gauche>{label}</Cellule>
            <Cellule>{texte(i?.espece)}</Cellule>
            <Cellule>
              <Case cochee={comportement === 'repos'} label={`${label} — repos`} />
            </Cellule>
            <Cellule>
              <Case cochee={comportement === 'deplacement'} label={`${label} — déplacement`} />
            </Cellule>
            <Cellule>{texte(i?.direction_de)}</Cellule>
            <Cellule>{texte(i?.direction_vers)}</Cellule>
            <Cellule>{texte(i?.vent_de)}</Cellule>
            <Cellule>{texte(i?.vent_vitesse)}</Cellule>
          </Ligne>
        );
      })}
    </Grille>
  );
}

function Vegetation({ p }: { p: P }) {
  const strates = ((p.vegetation ?? {}) as { strates?: Record<string, Record<string, unknown>> }).strates ?? {};
  const solNu = ((p.sol ?? {}) as { solNu?: unknown }).solNu;
  return (
    <Grille caption="Végétation" colonnes={11}>
      <Ligne>
        <Cellule entete gauche poids={2} />
        <Cellule entete>a Surf. Rel.</Cellule>
        <Cellule entete>b H.Moy.(m)</Cellule>
        <Cellule entete>c Rec%</Cellule>
        <Cellule entete>d %Verdiss.</Cellule>
        <Cellule entete>e Repous.</Cellule>
        <Cellule entete>f Germ.</Cellule>
        <Cellule entete>g Feuille</Cellule>
        <Cellule entete>h Fleur</Cellule>
        <Cellule entete>i Fruit</Cellule>
        <Cellule entete>j Sec</Cellule>
      </Ligne>
      <Ligne>
        <Cellule gauche poids={2}>Sol nu</Cellule>
        <Cellule span={10}>{texte(solNu)}%</Cellule>
      </Ligne>
      {STRATES.map(({ cle, label }) => {
        const s = strates[cle] ?? {};
        return (
          <Ligne key={cle}>
            <Cellule gauche poids={2}>{label}</Cellule>
            <Cellule>{texte(s.surfRel)}</Cellule>
            <Cellule>{texte(s.hMoy)}</Cellule>
            <Cellule>{texte(s.recouvrement)}</Cellule>
            <Cellule>{texte(s.verdissement)}</Cellule>
            <Cellule>{s.repousse == null ? '—' : s.repousse ? 'Oui' : 'Non'}</Cellule>
            <Cellule>{phenologie(s.orpad)}</Cellule>
            <Cellule>{phenologie(s.feuille)}</Cellule>
            <Cellule>{phenologie(s.fleur)}</Cellule>
            <Cellule>{phenologie(s.fruit)}</Cellule>
            <Cellule>{phenologie(s.sec)}</Cellule>
          </Ligne>
        );
      })}
    </Grille>
  );
}
