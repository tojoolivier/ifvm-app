// Logique pure des fiches de lecture en tableaux (prospection et traitement), qui reprennent les
// gabarits PDF du backend (`prospection_pdf.py`, `traitement_pdf.py`) : mêmes libellés, mêmes
// cases, mêmes règles de valeur vide. Même logique que `frontend/src/lib/fiche-tableau.ts` — le
// mobile ne peut pas importer le code du web, d'où la copie.

export const TIRET = '—';

/**
 * Valeur affichée dans une cellule ou un champ, comme `_texte` des gabarits PDF : vide → « — »,
 * booléen → « Oui » / « Non », le reste tel quel (jamais reformaté).
 */
export function texte(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === '') return TIRET;
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  return String(valeur);
}

/** Comme `texte`, mais `null` pour une valeur vide : distingue un champ à remplir d'un zéro. */
export function texteOuNull(valeur: unknown): string | null {
  const t = texte(valeur);
  return t === TIRET ? null : t;
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

/**
 * Date au format français `jj/mm/aaaa`. Une date seule (`2026-09-24`) est lue telle quelle, sans
 * passer par `Date` : sinon le fuseau de l'appareil pourrait la décaler d'un jour. Un horodatage
 * complet devient `jj/mm/aaaa hh:mm`.
 */
export function dateFr(valeur: string | null | undefined): string {
  if (!valeur) return TIRET;
  const jour = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur);
  if (jour) return `${jour[3]}/${jour[2]}/${jour[1]}`;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return valeur;
  return (
    `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}` +
    ` ${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`
  );
}
