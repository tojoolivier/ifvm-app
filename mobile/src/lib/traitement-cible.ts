import { DraftProspection, InfestationRow, PopulationRow } from './prospection-repository';
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
  infestations: InfestationRow[]
): CibleInput {
  return {
    espece: deriveEspece(populations, infestations),
    ...deriveLarves(populations),
    vols_clairs_essaims: deriveVolsClairsEssaims(populations),
    repartition_population: deriveRepartition(populations),
    surface_infestee_ha: prospection.surface_infestee ?? null,
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

/** Petites larves = densités L1/L2 cumulées ; grandes larves = le reste des stades
 * larvaires cumulés — même seuil que le backend (`stade.upper() in ("L1", "L2")`),
 * indépendamment de l'espèce (LMC va jusqu'à L5, NSE jusqu'à L7). */
function deriveLarves(populations: PopulationRow[]): { petites_larves: number | null; grandes_larves: number | null } {
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
      if (stade.toUpperCase() === 'L1' || stade.toUpperCase() === 'L2') {
        petites += valeur;
      } else {
        grandes += valeur;
      }
    }
  }

  return { petites_larves: renseignees ? petites : null, grandes_larves: renseignees ? grandes : null };
}

/** 1 = oui (au moins une population avec essaim_observe=true), 0 = non (au moins une
 * population renseignée, mais aucune à true), null = jamais renseigné. */
function deriveVolsClairsEssaims(populations: PopulationRow[]): number | null {
  const essaims = populations
    .map((p) => p.essaim_observe)
    .filter((v): v is boolean => v !== null && v !== undefined);
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
