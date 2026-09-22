import { TypeTraitement } from './traitement-repository';

const LIBELLE_TYPE: Record<TypeTraitement, string> = {
  AERIEN: 'Aerien',
  TERRESTRE: 'Terrestre',
};

/**
 * Reproduit `generer_numero_fiche()` (backend/app/domain/traitement.py) côté mobile :
 * numéro de fiche lisible « [Prénom du chef]-[Aerien|Terrestre]-[Date ISO] », suffixe
 * si collision. Le mobile doit pouvoir l'afficher et le persister hors-ligne, avant
 * toute synchronisation — recalculé ici plutôt qu'attendu du serveur.
 *
 * #sigle-utilisateur-numero-fiche : le sigle de l'utilisateur connecté (celui
 * qui saisit la fiche, pas forcément le chef ci-dessus) s'insère juste avant
 * le suffixe de collision quand il est renseigné — jamais une chaîne vide.
 * Absent du générateur de secours côté backend (`generer_numero_fiche`), qui
 * ne connaît pas l'identité de l'appelant : ne s'applique qu'au numéro
 * généré ici, au moment normal de la création — pas au rare cas de collision
 * retentée par le serveur.
 *
 * #zone-a-reprendre-numero-annexe : « -ANNEXE » distingue au premier coup
 * d'œil une fiche née de « Zones à reprendre » (même prospection/cible que
 * l'origine, mais un nouveau traitement à part entière) — placé avant le
 * suffixe de collision, jamais après (un « -2 » final reste la marque d'une
 * collision, pas de la reprise elle-même).
 */
export function composerNumeroFiche(
  prenomChef: string,
  typeTraitement: TypeTraitement,
  dateTraitementIso: string,
  suffixe?: number | null,
  sigle?: string | null,
  estReprise?: boolean
): string {
  const sigleParts = sigle ? `-${sigle}` : '';
  const annexe = estReprise ? '-ANNEXE' : '';
  const base = `${prenomChef}-${LIBELLE_TYPE[typeTraitement]}-${dateTraitementIso.slice(0, 10)}${sigleParts}${annexe}`;
  return suffixe ? `${base}-${suffixe}` : base;
}
