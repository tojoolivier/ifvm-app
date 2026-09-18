import { CaptureRow, DraftProspection, InfestationRow, PopulationRow } from './prospection-repository';
import { CibleInput } from './traitement-repository';
import { logger } from './logger';

/**
 * Reproduit `construire_cible()` (backend/app/domain/traitement.py) côté mobile : un
 * snapshot de la « cible », dérivé de la fiche de prospection liée et figé à la
 * création de la fiche de traitement (cf. « Snapshot figé à la création » dans
 * cibles.tsx — jamais recalculé après coup, comme côté backend).
 *
 * Recalculé ici pour que l'écran Cibles affiche l'info immédiatement, hors-ligne,
 * sans attendre un aller-retour serveur : le backend reconstruit exactement la même
 * chose à partir des mêmes lignes (populations/infestations) à la synchronisation.
 *
 * Divergence assumée avec le contrat API (CibleRead expose des libellés formatés,
 * ex. petites_larves="15", vols_clairs_essaims="oui") : le schéma local
 * (prospection-db.ts, table `cible`) déclare petites_larves/grandes_larves/
 * vols_clairs_essaims en colonnes REAL — on y stocke donc les valeurs numériques
 * brutes (1/0 pour vols_clairs_essaims), et c'est à l'écran de les présenter.
 */
export function construireCible(
  prospection: Pick<DraftProspection, 'surface_infestee'>,
  populations: PopulationRow[],
  infestations: InfestationRow[],
  captures: CaptureRow[] = []
): CibleInput {
  return {
    espece: deriveEspece(populations, infestations),
    ...deriveLarves(populations, captures),
    vols_clairs_essaims: deriveVolsClairsEssaims(populations),
    repartition_population: deriveRepartition(populations),
    surface_infestee_ha: prospection.surface_infestee ?? null,
    ...deriveLarvesParEspece(populations, captures),
    ...deriveDensitesParEspece(populations),
  };
}

function deriveEspece(populations: PopulationRow[], infestations: InfestationRow[]): string | null {
  const especes = new Set<string>();
  for (const p of populations) if (p.espece) especes.add(p.espece);
  for (const i of infestations) if (i.espece) especes.add(i.espece);
  if (especes.size === 0) return null;
  if (especes.size === 1) return [...especes][0];
  return 'MELANGE';
}

/** Petites larves = densités L1 à L3 cumulées ; grandes larves = le reste des
 * stades larvaires cumulés (L4-L5 pour LMC qui n'en compte que 5, L4-L7 pour
 * NSE qui en compte 7 — la règle « L1/L2/L3 vs le reste » couvre les deux
 * sans distinction explicite du plafond, chaque espèce n'ayant de toute
 * façon pas de stade au-delà du sien), même seuil que le backend. */
function deriveLarves(
  populations: PopulationRow[],
  captures: CaptureRow[]
): { petites_larves: number | null; grandes_larves: number | null } {
  let petites = 0;
  let grandes = 0;
  let renseignees = false;

  for (const p of populations) {
    if (p.categorie !== 'larve' || !p.densites_larve) continue;
    let densites: Record<string, number>;
    try {
      densites = JSON.parse(p.densites_larve);
    } catch (error) {
      // Snapshot best-effort (#189, même critère que parseEspeceSelection) : une
      // ligne corrompue ne doit pas faire échouer tout le calcul de la cible, au
      // pire elle est ignorée pour le décompte des petites/grandes larves.
      logger.ignore(error, 'densites_larve illisible pour la cible — ligne ignorée');
      continue;
    }
    for (const [stade, densite] of Object.entries(densites)) {
      renseignees = true;
      const valeur = Number(densite) || 0;
      if (['L1', 'L2', 'L3'].includes(stade.toUpperCase())) {
        petites += valeur;
      } else {
        grandes += valeur;
      }
    }
  }

  // Intensif (fusion des écrans B/C, cf. intensive-imagos.tsx/intensive-larves.tsx) :
  // les effectifs larvaires par stade ne sont plus posés sur densites_larve
  // (propre à l'Extensif) mais dans des lignes CaptureRow distinctes (categorie
  // "larve", stade, effectif), jamais lues ici jusqu'à ce correctif, d'où
  // "Cibles"/"Synthèse" affichant "non renseigné" pour toute fiche de
  // traitement dérivée d'une prospection Intensive. Les deux sources ne se
  // recouvrent jamais pour une même prospection (l'Extensif n'écrit jamais
  // dans prospection_capture, l'Intensif jamais dans densites_larve) : les
  // additionner est donc sans risque de doublon.
  for (const c of captures) {
    if (c.categorie !== 'larve' || !c.stade) continue;
    renseignees = true;
    if (['L1', 'L2', 'L3'].includes(c.stade.toUpperCase())) {
      petites += c.effectif;
    } else {
      grandes += c.effectif;
    }
  }

  return { petites_larves: renseignees ? petites : null, grandes_larves: renseignees ? grandes : null };
}

type EspeceCible = 'LMC' | 'NSE';

interface LarvesParEspece {
  petites_larves_lmc: number | null;
  petites_larves_nse: number | null;
  grandes_larves_lmc: number | null;
  grandes_larves_nse: number | null;
}

/** Même règle que `deriveLarves` (L1-L3 = petites, le reste = grandes), mais
 * détaillée par espèce plutôt qu'agrégée — écran Synthèse (Aérien). `null`
 * pour une espèce jamais rencontrée avec une densité larvaire renseignée. */
function deriveLarvesParEspece(populations: PopulationRow[], captures: CaptureRow[]): LarvesParEspece {
  const petites: Record<EspeceCible, number> = { LMC: 0, NSE: 0 };
  const grandes: Record<EspeceCible, number> = { LMC: 0, NSE: 0 };
  const renseignees: Record<EspeceCible, boolean> = { LMC: false, NSE: false };

  for (const p of populations) {
    if (p.categorie !== 'larve' || !p.densites_larve) continue;
    if (p.espece !== 'LMC' && p.espece !== 'NSE') continue;
    let densites: Record<string, number>;
    try {
      densites = JSON.parse(p.densites_larve);
    } catch (error) {
      logger.ignore(error, 'densites_larve illisible pour la cible par espèce — ligne ignorée');
      continue;
    }
    for (const [stade, densite] of Object.entries(densites)) {
      renseignees[p.espece] = true;
      const valeur = Number(densite) || 0;
      if (['L1', 'L2', 'L3'].includes(stade.toUpperCase())) {
        petites[p.espece] += valeur;
      } else {
        grandes[p.espece] += valeur;
      }
    }
  }

  // Intensif : même bascule que `deriveLarves` ci-dessus, cf. son commentaire.
  for (const c of captures) {
    if (c.categorie !== 'larve' || !c.stade) continue;
    if (c.espece !== 'LMC' && c.espece !== 'NSE') continue;
    renseignees[c.espece] = true;
    if (['L1', 'L2', 'L3'].includes(c.stade.toUpperCase())) {
      petites[c.espece] += c.effectif;
    } else {
      grandes[c.espece] += c.effectif;
    }
  }

  return {
    petites_larves_lmc: renseignees.LMC ? petites.LMC : null,
    petites_larves_nse: renseignees.NSE ? petites.NSE : null,
    grandes_larves_lmc: renseignees.LMC ? grandes.LMC : null,
    grandes_larves_nse: renseignees.NSE ? grandes.NSE : null,
  };
}

interface DensitesParEspece {
  densite_diffuse_lmc: number | null;
  densite_groupee_lmc: number | null;
  densite_diffuse_nse: number | null;
  densite_groupee_nse: number | null;
}

/** Cumule densite_diffuse/densite_groupee sur toutes les lignes (imago +
 * larve) d'une même espèce — une espèce peut avoir une densité saisie sur sa
 * ligne imago ET sa ligne larve, même logique additive que les larves
 * ci-dessus. `null` si aucune ligne de cette espèce ne porte cette densité. */
function deriveDensitesParEspece(populations: PopulationRow[]): DensitesParEspece {
  const diffuse: Record<EspeceCible, number | null> = { LMC: null, NSE: null };
  const groupee: Record<EspeceCible, number | null> = { LMC: null, NSE: null };

  for (const p of populations) {
    if (p.espece !== 'LMC' && p.espece !== 'NSE') continue;
    if (p.densite_diffuse != null) {
      diffuse[p.espece] = (diffuse[p.espece] ?? 0) + p.densite_diffuse;
    }
    if (p.densite_groupee != null) {
      groupee[p.espece] = (groupee[p.espece] ?? 0) + p.densite_groupee;
    }
  }

  return {
    densite_diffuse_lmc: diffuse.LMC,
    densite_groupee_lmc: groupee.LMC,
    densite_diffuse_nse: diffuse.NSE,
    densite_groupee_nse: groupee.NSE,
  };
}

/**
 * 1 = oui (au moins une population avec essaim observé), 0 = non (au moins une
 * population renseignée, mais aucune à true), null = jamais renseigné.
 *
 * `essaim_observe` (booléen à 2 états) reste lu pour les prospections
 * antérieures à la migration backend 0033 ; pour l'Extensif Imagos (0033+), il
 * a été remplacé par essaim_en_vol/essaim_pose (cf. le commentaire sur
 * PopulationRow) — jamais renseigné pour ces fiches-là, d'où "Vols/essaims"
 * toujours "non renseigné" en Synthèse de traitement avant ce correctif, alors
 * même que l'essaim était bien saisi (État Repos/Déplacement, cf.
 * extensive-recap.tsx). Pas de "non" explicite dans le nouveau modèle (aucun
 * bouton ne le permet) : une ligne sans essaim_observe ni essaim_en_vol/pose
 * reste exclue, comme avant.
 */
function deriveVolsClairsEssaims(populations: PopulationRow[]): number | null {
  const essaims: boolean[] = [];
  for (const p of populations) {
    if (p.essaim_observe !== null && p.essaim_observe !== undefined) {
      essaims.push(p.essaim_observe);
    } else if (p.essaim_en_vol || p.essaim_pose) {
      essaims.push(true);
    }
  }
  if (essaims.length === 0) return null;
  return essaims.some(Boolean) ? 1 : 0;
}

/** Groupée prioritaire sur diffuse dès qu'une seule population porte une densité
 * groupée, même si d'autres n'ont que du diffus — même règle que le backend. */
function deriveRepartition(populations: PopulationRow[]): 'GROUPEE' | 'DIFFUSE' | null {
  if (populations.some((p) => p.densite_groupee != null)) return 'GROUPEE';
  if (populations.some((p) => p.densite_diffuse != null)) return 'DIFFUSE';
  return null;
}
