import { boolean, number, object, string } from 'yup';

/** Les 6 strates du JSON `vegetation`. Sol nu n'en est pas une : c'est `solNu`, rangé dans le JSON `sol`. */
export const STRATE_KEYS = ['arboree', 'arbustive', 'buissonneuse', 'herbeuse', 'cultures_seches', 'cultures_hygro'] as const;
export type StrateKey = (typeof STRATE_KEYS)[number];

export interface StrateDetail {
  surfRel: number | null;
  hMoy: number | null;
  recouvrement: number;
  verdissement: number | null;
  repousse: boolean | null;
  orpad: string[];
  feuille: string[];
  fleur: string[];
  fruit: string[];
  sec: string[];
}

export type Strates = Record<StrateKey, StrateDetail>;

/** Niveaux d'un stade phénologique, tels qu'enregistrés (un seul élément dans le tableau, #686). */
export const NIVEAUX_PHENOLOGIE = ['Néant', 'Rare', 'Beaucoup'] as const;
export type NiveauPhenologie = (typeof NIVEAUX_PHENOLOGIE)[number];
/** Niveaux qu'on choisit sur un stade touché (Néant = stade non touché). */
export const NIVEAUX_CHOISIS = ['Rare', 'Beaucoup'] as const;

/** Stades du bloc « Qu'observez-vous ? » ; `orpad` (Germination) garde son nom historique dans le JSON. */
export const STADES_PHENOLOGIE = ['orpad', 'feuille', 'fleur', 'fruit', 'sec'] as const;
export type StadePhenologie = (typeof STADES_PHENOLOGIE)[number];
export type Phenologie = Record<StadePhenologie, NiveauPhenologie>;

export const phenologieVide = (): Phenologie => ({ orpad: 'Néant', feuille: 'Néant', fleur: 'Néant', fruit: 'Néant', sec: 'Néant' });

const tableauxDePhenologie = (p: Phenologie) => Object.fromEntries(STADES_PHENOLOGIE.map((st) => [st, [p[st]]]));

/** Niveau d'un stade relu du JSON : d'anciens brouillons ont plusieurs éléments, on garde le plus élevé (Beaucoup > Rare > Néant). */
const niveauDeTableau = (valeur: unknown): NiveauPhenologie =>
  Array.isArray(valeur) ? ([...NIVEAUX_CHOISIS].reverse().find((n) => valeur.includes(n)) ?? 'Néant') : 'Néant';

/** Valeurs d'une strate non ajoutée : enregistrée telle quelle pour garder les 6 clés. */
export function defaultStrateDetail(): StrateDetail {
  return { surfRel: null, hMoy: null, recouvrement: 0, verdissement: null, repousse: null, orpad: [], feuille: [], fleur: [], fruit: [], sec: [] };
}

export interface Repartition {
  total: number;
  reste: number;
  complete: boolean;
}

/** Sol nu + Σ recouvrement des strates : la station est répartie quand le total fait exactement 100 %. */
export function repartition({ solNu, strates }: { solNu: number | null; strates: Record<StrateKey, { recouvrement: number }> }): Repartition {
  const total = STRATE_KEYS.reduce((somme, k) => somme + strates[k].recouvrement, solNu ?? 0);
  return { total, reste: 100 - total, complete: total === 100 };
}

/**
 * Strates à afficher : la herbeuse (principale) toujours et en premier (maquette 02b), puis dans l'ordre des
 * clés celles déjà renseignées (réouverture d'une fiche) et celles ajoutées pendant la session, même à 0 %.
 */
export function stratesAffichees(strates: Record<StrateKey, { recouvrement: number }>, ajoutees: readonly StrateKey[] = []): StrateKey[] {
  const autres = STRATE_KEYS.filter((k) => k !== 'herbeuse' && (strates[k].recouvrement > 0 || ajoutees.includes(k)));
  return ['herbeuse', ...autres];
}

/** Valeurs du formulaire : H. moyenne et verdissement restent du texte (virgule française). */
export interface StrateValeurs {
  recouvrement: number;
  hMoy: string;
  verdissement: string;
  /** Détails de la feuille « Plus de détails » (#687). */
  surfRel: string;
  repousse: boolean | null;
  phenologie: Phenologie;
}

export interface VegetationValeurs {
  solNu: number;
  strates: Record<StrateKey, StrateValeurs>;
}

/** Valeurs d'une strate vide : recouvrement à 0 %, rien saisi, aucun stade touché. */
export const strateValeursVides = (): StrateValeurs => ({ recouvrement: 0, hMoy: '', verdissement: '', surfRel: '', repousse: null, phenologie: phenologieVide() });

/** Vrai si la feuille « Plus de détails » renseigne quelque chose (indicateur sur la carte). */
export const aDesDetails = ({ surfRel, repousse }: Pick<StrateValeurs, 'surfRel' | 'repousse'>) => surfRel.trim() !== '' || repousse !== null;

type Json = Record<string, unknown> | null | undefined;
type Brouillon = { vegetation?: Json; sol?: Json };

export const versTexte = (n: unknown) => (typeof n === 'number' ? String(n).replace('.', ',') : '');
export const versNombre = (texte: string) => {
  const n = Number(texte.trim().replace(',', '.'));
  return texte.trim() === '' || !Number.isFinite(n) ? null : n;
};

function stratesDuJson(vegetation: Json): Partial<Record<StrateKey, Partial<StrateDetail>>> {
  const strates = vegetation?.strates;
  return strates && typeof strates === 'object' ? (strates as Record<string, Partial<StrateDetail>>) : {};
}

/** Reprise d'un brouillon : recouvrement et détails des strates dans `vegetation`, sol nu dans `sol`. */
export function valeursDeVegetation({ vegetation, sol }: Brouillon): VegetationValeurs {
  const enregistrees = stratesDuJson(vegetation);
  const strates = Object.fromEntries(
    STRATE_KEYS.map((k) => {
      const s = enregistrees[k];
      return [
        k,
        {
          recouvrement: s?.recouvrement ?? 0,
          hMoy: versTexte(s?.hMoy),
          verdissement: versTexte(s?.verdissement),
          surfRel: versTexte(s?.surfRel),
          repousse: typeof s?.repousse === 'boolean' ? s.repousse : null,
          phenologie: Object.fromEntries(STADES_PHENOLOGIE.map((st) => [st, niveauDeTableau(s?.[st])])) as Phenologie,
        },
      ];
    })
  ) as Record<StrateKey, StrateValeurs>;
  return { solNu: typeof sol?.solNu === 'number' ? sol.solNu : 0, strates };
}

/**
 * Champs à enregistrer dans le brouillon : `vegetation` garde ses 6 clés (une strate non ajoutée a ses
 * valeurs par défaut) et ce que l'écran ne gère pas (ORPAD, repousse…) ; `sol` garde le reste de son JSON.
 */
export function champsDeVegetation({ vegetation, sol }: Brouillon, valeurs: VegetationValeurs) {
  const enregistrees = stratesDuJson(vegetation);
  const strates = Object.fromEntries(
    STRATE_KEYS.map((k) => {
      const v = valeurs.strates[k];
      // Strate retirée ou jamais renseignée : valeurs par défaut, sans rien hériter du brouillon.
      const vide = v.recouvrement === 0 && v.hMoy.trim() === '' && v.verdissement.trim() === '' && !aDesDetails(v);
      if (vide) return [k, defaultStrateDetail()];
      return [k, { ...defaultStrateDetail(), ...enregistrees[k], recouvrement: v.recouvrement, hMoy: versNombre(v.hMoy), verdissement: versNombre(v.verdissement), surfRel: versNombre(v.surfRel), repousse: v.repousse, ...tableauxDePhenologie(v.phenologie) }];
    })
  );
  return { vegetation: { ...vegetation, strates }, sol: { ...sol, solNu: valeurs.solNu } };
}

/**
 * Schéma du formulaire : H. moyenne (≥ 0) et verdissement (0–100 %) sont facultatifs mais, s'ils sont saisis,
 * numériques. Le total de 100 % se lit dans `repartition` (il pilote le bouton et le message « Il manque X % »).
 */
export function creerVegetationSchema(t: (cle: string) => string) {
  const nombre = (min: number, max: number | null, cle: string) =>
    string()
      .default('')
      .test('nombre', t(cle), (v) => {
        if (!v || v.trim() === '') return true;
        const n = versNombre(v);
        return n !== null && n >= min && (max === null || n <= max);
      })
      // Une strate à 0 % n'est pas présente : ses autres valeurs ne seraient pas prises en compte.
      .test('recouvrement-nul', t('prospection.vegetation.erreurs.recouvrementNul'), function (v) {
        return !v || v.trim() === '' || this.parent.recouvrement > 0;
      });
  const strate = object({
    recouvrement: number().default(0).min(0).max(100),
    hMoy: nombre(0, null, 'prospection.vegetation.erreurs.hMoy'),
    verdissement: nombre(0, 100, 'prospection.vegetation.erreurs.verdissement'),
    surfRel: nombre(0, 100, 'prospection.vegetation.erreurs.surfRel'),
    repousse: boolean().nullable().default(null),
  });
  return object({
    solNu: number().default(0).min(0).max(100),
    strates: object(Object.fromEntries(STRATE_KEYS.map((k) => [k, strate]))),
  });
}
