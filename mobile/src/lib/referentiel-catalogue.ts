import type { AppIconName } from '@/components/ui/AppIcon';

/**
 * Les 13 tables du cache du référentiel, telles que l'accueil « Référentiels » les range
 * (Figma « Référentiels · Accueil »). Seules les listes dessinées dans la maquette — pesticides,
 * stations fixes, codes stades — ont un écran ; les autres lignes montrent leur compte et leur
 * date de mise à jour sans s'ouvrir.
 */
export interface EntreeCatalogue {
  /** Table SQLite locale. */
  table: string;
  /** Clé de l'entité dans la réponse du pull (`ReferentielPullResponse`). */
  entite: string;
  libelle: string;
  /** Nom court, en minuscules, pour la phrase « N tables restantes : … » de la réinitialisation. */
  court: string;
  icone: AppIconName;
  route: string | null;
}

export interface SectionCatalogue {
  titre: string;
  entrees: EntreeCatalogue[];
}

export const CATALOGUE: SectionCatalogue[] = [
  {
    titre: 'TERRAIN',
    entrees: [
      { table: 'poste_acridien', entite: 'postes_acridiens', libelle: 'Postes acridiens', court: 'postes acridiens', icone: 'criquet', route: null },
      { table: 'station_fixe', entite: 'stations_fixes', libelle: 'Stations fixes', court: 'stations fixes', icone: 'localisation', route: '/(app)/referentiel-stations' },
    ],
  },
  {
    titre: 'PRODUITS',
    entrees: [
      { table: 'pesticide', entite: 'pesticides', libelle: 'Pesticides', court: 'pesticides', icone: 'pluie', route: '/(app)/referentiel-pesticides' },
      { table: 'culture', entite: 'cultures', libelle: 'Cultures', court: 'cultures', icone: 'tracteur', route: null },
    ],
  },
  {
    titre: 'STADES & CAMPAGNES',
    entrees: [
      { table: 'code_stade', entite: 'codes_stades', libelle: 'Codes stades', court: 'codes stades', icone: 'rapport-fiche', route: '/(app)/referentiel-codes-stades' },
      { table: 'campagne', entite: 'campagnes', libelle: 'Campagnes', court: 'campagnes', icone: 'calendrier', route: null },
    ],
  },
  {
    titre: 'AÉRIEN',
    entrees: [
      { table: 'aeronef', entite: 'aeronefs', libelle: 'Aéronefs', court: 'aéronefs', icone: 'aeronef-avion', route: null },
      { table: 'lieu_aerien', entite: 'lieux_aeriens', libelle: 'Lieux aériens', court: 'lieux aériens', icone: 'carte-infestation', route: null },
      { table: 'site_aerien', entite: 'sites_aeriens', libelle: 'Sites aériens', court: 'sites aériens', icone: 'accueil', route: null },
    ],
  },
  {
    titre: 'ÉQUIPES',
    entrees: [
      { table: 'equipe', entite: 'equipes', libelle: 'Équipes', court: 'équipes', icone: 'utilisateurs', route: null },
      { table: 'equipe_membre', entite: 'equipe_membres', libelle: 'Membres d’équipe', court: 'membres', icone: 'utilisateur', route: null },
      { table: 'equipe_aeronef', entite: 'equipe_aeronefs', libelle: 'Affectations aéronef', court: 'affectations', icone: 'heures-de-vol', route: null },
      { table: 'utilisateur_equipe', entite: 'utilisateurs_equipe', libelle: 'Utilisateurs', court: 'utilisateurs', icone: 'utilisateur', route: null },
    ],
  },
];

export function entreesCatalogue(): EntreeCatalogue[] {
  return CATALOGUE.flatMap((section) => section.entrees);
}

const sansAccents = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Filtre les lignes de l'accueil par libellé ; une section vidée disparaît. Sans recherche : le catalogue tel quel. */
export function filtrerCatalogue(recherche: string): SectionCatalogue[] {
  const terme = sansAccents(recherche.trim());
  if (!terme) return CATALOGUE;
  return CATALOGUE.map((section) => ({
    ...section,
    entrees: section.entrees.filter((e) => sansAccents(e.libelle).includes(terme)),
  })).filter((section) => section.entrees.length > 0);
}

export function libelleEntite(entite: string): string {
  return entreesCatalogue().find((e) => e.entite === entite)?.libelle ?? entite;
}

export function libelleCourtEntite(entite: string): string {
  return entreesCatalogue().find((e) => e.entite === entite)?.court ?? entite;
}
