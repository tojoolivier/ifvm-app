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
 */
export function composerNumeroFiche(
  prenomChef: string,
  typeTraitement: TypeTraitement,
  dateTraitementIso: string,
  suffixe?: number | null
): string {
  const base = `${prenomChef}-${LIBELLE_TYPE[typeTraitement]}-${dateTraitementIso.slice(0, 10)}`;
  return suffixe ? `${base}-${suffixe}` : base;
}
