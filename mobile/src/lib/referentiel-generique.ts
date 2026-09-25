import { getReferentielDb } from './referentiel-db';
import { formaterJourMois, type StatutFiltre } from './referentiel-consultation';

/**
 * Consultation des dix référentiels sans écran dédié (postes, cultures, campagnes, aéronefs, lieux et
 * sites aériens, équipes, membres, affectations, utilisateurs). Chacun est décrit par une
 * configuration — la requête, la recherche, les champs de la fiche — que lisent deux écrans communs :
 * une liste et une fiche en lecture seule, dans le style des trois écrans dessinés (pesticides,
 * stations, codes stades).
 *
 * Les configurations sont écrites en SQL : c'est le cache local qui est lu, jamais le réseau, et les
 * noms de table ne viennent que de ce catalogue (`configDe` refuse tout autre nom).
 */

export type FormatChamp = 'date' | 'role' | 'type_equipe' | 'litres' | 'metres' | 'nombre';

interface ChampConfig {
  libelle: string;
  /** Expression SQL de la valeur, avec `t` pour la table lue. */
  sql: string;
  format?: FormatChamp;
  /** Texte quand la valeur est absente (« En cours » pour la fin d'une campagne). */
  vide?: string;
}

export interface ConfigTable {
  /** Titre de l'écran de liste. */
  titre: string;
  /** Ce qu'est une fiche, pour son sous-titre : « Culture · CUL-01 ». */
  libelleFiche: string;
  from: string;
  cle: string;
  titreSql: string;
  codeSql: string | null;
  sousTitreSql: string | null;
  sousTitreFormat?: FormatChamp;
  actifSql: string | null;
  majSql: string | null;
  recherche: string[];
  tri: string;
  champs: ChampConfig[];
  /** La fiche montre-t-elle un identifiant serveur (les membres n'en ont pas, leur clé est composée) ? */
  avecIdentifiant: boolean;
  placeholderRecherche: string;
}

const EQUIPE_NOM = '(SELECT e.nom FROM equipe e WHERE e.id = t.equipe_id)';

/** `AAAA-MM-JJ` → `JJ/MM/AAAA`, en SQL, pour les sous-titres de liste. */
const dateSql = (colonne: string) =>
  `substr(${colonne},9,2) || '/' || substr(${colonne},6,2) || '/' || substr(${colonne},1,4)`;

export const CONFIGS_GENERIQUES: Record<string, ConfigTable> = {
  poste_acridien: {
    titre: 'Postes acridiens',
    libelleFiche: 'Poste acridien',
    from: 'poste_acridien t',
    cle: 't.id',
    titreSql: 't.nom',
    codeSql: 't.code',
    sousTitreSql: null,
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.nom', 't.code'],
    tri: 't.nom COLLATE NOCASE',
    champs: [
      { libelle: 'Code', sql: 't.code' },
      { libelle: 'Nom', sql: 't.nom' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher un poste, un code…',
  },
  culture: {
    titre: 'Cultures',
    libelleFiche: 'Culture',
    from: 'culture t',
    cle: 't.id',
    titreSql: 't.nom',
    codeSql: 't.code',
    sousTitreSql: null,
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.nom', 't.code'],
    tri: 't.nom COLLATE NOCASE',
    champs: [
      { libelle: 'Code', sql: 't.code' },
      { libelle: 'Nom', sql: 't.nom' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher une culture, un code…',
  },
  campagne: {
    titre: 'Campagnes',
    libelleFiche: 'Campagne',
    from: 'campagne t',
    cle: 't.id',
    titreSql: 't.name',
    codeSql: null,
    sousTitreSql: `${dateSql('t.start_date')} || ' → ' || COALESCE(${dateSql('t.end_date')}, 'en cours')`,
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.name'],
    tri: 't.start_date DESC',
    champs: [
      { libelle: 'Nom', sql: 't.name' },
      { libelle: 'Début', sql: 't.start_date', format: 'date' },
      { libelle: 'Fin', sql: 't.end_date', format: 'date', vide: 'En cours' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher une campagne…',
  },
  aeronef: {
    titre: 'Aéronefs',
    libelleFiche: 'Aéronef',
    from: 'aeronef t',
    cle: 't.id',
    titreSql: 't.immatriculation',
    codeSql: null,
    sousTitreSql: 't.societe',
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.immatriculation', 't.societe'],
    tri: 't.immatriculation COLLATE NOCASE',
    champs: [
      { libelle: 'Immatriculation', sql: 't.immatriculation' },
      { libelle: 'Société', sql: 't.societe' },
      { libelle: 'Volume de cuve', sql: 't.volume_cuve_l', format: 'litres' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher une immatriculation, une société…',
  },
  lieu_aerien: {
    titre: 'Lieux aériens',
    libelleFiche: 'Lieu aérien',
    from: 'lieu_aerien t',
    cle: 't.id',
    titreSql: 't.nom',
    codeSql: null,
    sousTitreSql: 't.type_lieu',
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.nom', 't.type_lieu'],
    tri: 't.nom COLLATE NOCASE',
    champs: [
      { libelle: 'Nom', sql: 't.nom' },
      { libelle: 'Type de lieu', sql: 't.type_lieu' },
      { libelle: 'Équipe aérienne', sql: '(SELECT e.nom FROM equipe e WHERE e.id = t.equipe_aerienne_id)' },
      { libelle: 'Latitude', sql: 't.latitude' },
      { libelle: 'Longitude', sql: 't.longitude' },
      { libelle: 'Altitude', sql: 't.altitude', format: 'metres' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher un lieu…',
  },
  site_aerien: {
    titre: 'Sites aériens',
    libelleFiche: 'Site aérien',
    from: 'site_aerien t',
    cle: 't.id',
    titreSql: 't.localite',
    codeSql: 't.numero',
    sousTitreSql: EQUIPE_NOM,
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.localite', 't.numero', EQUIPE_NOM],
    tri: 't.localite COLLATE NOCASE',
    champs: [
      { libelle: 'Numéro', sql: 't.numero' },
      { libelle: 'Localité', sql: 't.localite' },
      { libelle: 'Équipe', sql: EQUIPE_NOM },
      { libelle: 'Latitude', sql: 't.latitude' },
      { libelle: 'Longitude', sql: 't.longitude' },
      { libelle: 'Altitude', sql: 't.altitude', format: 'metres' },
      { libelle: 'Début de position', sql: 't.date_debut_position', format: 'date' },
      { libelle: 'Envoi', sql: "CASE WHEN t.statut_sync = 'synced' THEN 'Synchronisé' ELSE 'En attente d’envoi' END" },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher un site, une localité…',
  },
  equipe: {
    titre: 'Équipes',
    libelleFiche: 'Équipe',
    from: 'equipe t',
    cle: 't.id',
    titreSql: 't.nom',
    codeSql: null,
    sousTitreSql: 't.type',
    sousTitreFormat: 'type_equipe',
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.nom'],
    tri: 't.nom COLLATE NOCASE',
    champs: [
      { libelle: 'Nom', sql: 't.nom' },
      { libelle: 'Type', sql: 't.type', format: 'type_equipe' },
      { libelle: 'Membres', sql: '(SELECT count(*) FROM equipe_membre m WHERE m.equipe_id = t.id)', format: 'nombre' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher une équipe…',
  },
  equipe_membre: {
    titre: 'Membres d’équipe',
    libelleFiche: 'Membre d’équipe',
    from: 'equipe_membre t',
    cle: "t.equipe_id || '|' || t.user_id",
    titreSql: "COALESCE(NULLIF(TRIM(COALESCE(t.prenom, '') || ' ' || COALESCE(t.nom, '')), ''), t.user_id)",
    codeSql: null,
    sousTitreSql: `t.fonction || COALESCE(' · ' || ${EQUIPE_NOM}, '')`,
    actifSql: null,
    majSql: null,
    recherche: ['t.nom', 't.prenom', 't.fonction', EQUIPE_NOM],
    tri: 't.nom COLLATE NOCASE, t.prenom COLLATE NOCASE',
    champs: [
      { libelle: 'Nom', sql: 't.nom' },
      { libelle: 'Prénom', sql: 't.prenom' },
      { libelle: 'Fonction', sql: 't.fonction' },
      { libelle: 'Équipe', sql: EQUIPE_NOM },
    ],
    avecIdentifiant: false,
    placeholderRecherche: 'Rechercher un membre, une équipe…',
  },
  equipe_aeronef: {
    titre: 'Affectations aéronef',
    libelleFiche: 'Affectation aéronef',
    from: 'equipe_aeronef t',
    cle: 't.id',
    titreSql: 'COALESCE((SELECT a.immatriculation FROM aeronef a WHERE a.id = t.aeronef_id), t.aeronef_id)',
    codeSql: null,
    sousTitreSql: `COALESCE(${EQUIPE_NOM}, '')`,
    actifSql: null,
    majSql: 't.updated_at',
    recherche: ['(SELECT a.immatriculation FROM aeronef a WHERE a.id = t.aeronef_id)', EQUIPE_NOM],
    tri: 't.date_debut DESC',
    champs: [
      { libelle: 'Aéronef', sql: '(SELECT a.immatriculation FROM aeronef a WHERE a.id = t.aeronef_id)' },
      { libelle: 'Équipe', sql: EQUIPE_NOM },
      { libelle: 'Début', sql: 't.date_debut', format: 'date' },
      { libelle: 'Fin', sql: 't.date_fin', format: 'date', vide: 'En cours' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher un aéronef, une équipe…',
  },
  utilisateur_equipe: {
    titre: 'Utilisateurs',
    libelleFiche: 'Utilisateur',
    from: 'utilisateur_equipe t',
    cle: 't.id',
    titreSql: "t.prenom || ' ' || t.nom",
    codeSql: null,
    sousTitreSql: 't.role',
    sousTitreFormat: 'role',
    actifSql: 't.actif',
    majSql: 't.updated_at',
    recherche: ['t.nom', 't.prenom', 't.role'],
    tri: 't.nom COLLATE NOCASE, t.prenom COLLATE NOCASE',
    champs: [
      { libelle: 'Nom', sql: 't.nom' },
      { libelle: 'Prénom', sql: 't.prenom' },
      { libelle: 'Rôle', sql: 't.role', format: 'role' },
      { libelle: 'Poste acridien', sql: '(SELECT p.nom FROM poste_acridien p WHERE p.id = t.pa_id)' },
    ],
    avecIdentifiant: true,
    placeholderRecherche: 'Rechercher un nom, un rôle…',
  },
};

function configDe(table: string): ConfigTable {
  const config = CONFIGS_GENERIQUES[table];
  if (!config) throw new Error(`Table de référentiel inconnue : ${table}`);
  return config;
}

/** Vrai si une table a une consultation générique. */
export function estGenerique(table: string): boolean {
  return table in CONFIGS_GENERIQUES;
}

export function configGenerique(table: string): ConfigTable {
  return configDe(table);
}

// --- Formatage -------------------------------------------------------------------------------

const ROLES: Record<string, string> = {
  chef_de_base: 'Chef de base',
  chef_equipe: 'Chef d’équipe',
  agent_encadreur: 'Agent encadreur',
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  consultant_international: 'Consultant international',
};

function versTexteLisible(brut: string): string {
  const texte = brut.replace(/_/g, ' ');
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Met une valeur du cache en forme pour la fiche ; l'absence s'écrit « — » (ou le texte `vide` du champ). */
export function formaterValeur(valeur: unknown, format?: FormatChamp, vide = '—'): string {
  if (valeur === null || valeur === undefined || valeur === '') return vide;
  switch (format) {
    case 'date': {
      const texte = String(valeur);
      const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
      return morceaux ? `${morceaux[3]}/${morceaux[2]}/${morceaux[1]}` : texte;
    }
    case 'role':
      return ROLES[String(valeur)] ?? versTexteLisible(String(valeur));
    case 'type_equipe':
      return valeur === 'aerien' ? 'Aérienne' : valeur === 'terrestre' ? 'Terrestre' : versTexteLisible(String(valeur));
    case 'litres':
      return `${valeur} L`;
    case 'metres':
      return `${valeur} m`;
    default:
      return String(valeur);
  }
}

// --- Lecture ---------------------------------------------------------------------------------

export interface LigneGenerique {
  cle: string;
  titre: string;
  code: string | null;
  sousTitre: string | null;
  /** `null` : cette table n'a pas de statut actif/inactif, pas de badge. */
  actif: boolean | null;
  majLe: string | null;
}

export interface FicheGenerique extends LigneGenerique {
  champs: { libelle: string; valeur: string }[];
}

export interface FiltreGenerique {
  recherche: string;
  statut: StatutFiltre;
}

type Brut = Record<string, unknown> & {
  cle: string;
  titre: string;
  code: string | null;
  sous_titre: string | null;
  actif: number | null;
  maj: string | null;
};

function colonnesDe(config: ConfigTable): string {
  const communes = [
    `${config.cle} AS cle`,
    `${config.titreSql} AS titre`,
    `${config.codeSql ?? 'NULL'} AS code`,
    `${config.sousTitreSql ?? 'NULL'} AS sous_titre`,
    `${config.actifSql ?? 'NULL'} AS actif`,
    `${config.majSql ?? 'NULL'} AS maj`,
  ];
  return [...communes, ...config.champs.map((c, i) => `${c.sql} AS c${i}`)].join(', ');
}

function versLigne(brut: Brut, config: ConfigTable): LigneGenerique {
  return {
    cle: brut.cle,
    titre: brut.titre,
    code: brut.code,
    sousTitre: brut.sous_titre === null ? null : formaterValeur(brut.sous_titre, config.sousTitreFormat),
    actif: brut.actif === null || brut.actif === undefined ? null : brut.actif === 1,
    majLe: brut.maj ?? null,
  };
}

export async function listerGenerique(table: string, filtre: FiltreGenerique): Promise<LigneGenerique[]> {
  const config = configDe(table);
  const db = await getReferentielDb();
  const conditions: string[] = [];
  const params: string[] = [];

  const terme = filtre.recherche.trim();
  if (terme) {
    // `%` et `_` saisis par l'agent sont des caractères, pas des jokers.
    const litteral = terme.replace(/[\\%_]/g, '\\$&');
    conditions.push(`(${config.recherche.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    for (let i = 0; i < config.recherche.length; i++) params.push(`%${litteral}%`);
  }
  if (config.actifSql && filtre.statut !== 'tous') {
    conditions.push(`${config.actifSql} = ${filtre.statut === 'actifs' ? 1 : 0}`);
  }

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const lignes = await db.getAllAsync<Brut>(
    `SELECT ${colonnesDe(config)} FROM ${config.from}${where} ORDER BY ${config.tri}`,
    params
  );
  return lignes.map((l) => versLigne(l, config));
}

export async function getLigneGenerique(table: string, cle: string): Promise<FicheGenerique | null> {
  const config = configDe(table);
  const db = await getReferentielDb();
  const brut = await db.getFirstAsync<Brut>(
    `SELECT ${colonnesDe(config)} FROM ${config.from} WHERE ${config.cle} = ?`,
    [cle]
  );
  if (!brut) return null;
  return {
    ...versLigne(brut, config),
    champs: config.champs.map((champ, i) => ({
      libelle: champ.libelle,
      valeur: formaterValeur(brut[`c${i}`], champ.format, champ.vide),
    })),
  };
}

export interface CompteGenerique {
  tous: number;
  actifs: number;
  inactifs: number;
  majLe: string | null;
}

export async function compterGenerique(table: string): Promise<CompteGenerique> {
  const config = configDe(table);
  const db = await getReferentielDb();

  if (!config.actifSql) {
    const ligne = await db.getFirstAsync<{ n: number; maj: string | null }>(
      `SELECT count(*) AS n, ${config.majSql ? `max(${config.majSql})` : 'NULL'} AS maj FROM ${config.from}`
    );
    const n = ligne?.n ?? 0;
    return { tous: n, actifs: n, inactifs: 0, majLe: ligne?.maj ?? null };
  }

  const lignes = await db.getAllAsync<{ actif: number; n: number; maj: string | null }>(
    `SELECT ${config.actifSql} AS actif, count(*) AS n, max(${config.majSql}) AS maj FROM ${config.from} GROUP BY ${config.actifSql}`
  );
  const actifs = lignes.find((l) => l.actif === 1)?.n ?? 0;
  const inactifs = lignes.find((l) => l.actif === 0)?.n ?? 0;
  const majLe = lignes.reduce<string | null>((max, l) => (l.maj && (!max || l.maj > max) ? l.maj : max), null);
  return { tous: actifs + inactifs, actifs, inactifs, majLe };
}

/** « 22/09 » de la dernière mise à jour d'une table, pour les sous-titres. */
export function majJourMois(majLe: string | null): string {
  return majLe ? ` · màj ${formaterJourMois(majLe)}` : '';
}
