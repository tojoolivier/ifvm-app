import { useEquipeTravailStore } from './equipe-travail-store';
import { PreconditionError } from './errors';
import { getEquipeLocale } from './referentiel-db';

export type TypeEquipe = 'terrestre' | 'aerien';

/**
 * L'équipe de travail à rattacher à une nouvelle saisie (#641), ou `null` si l'agent n'en a pas
 * choisi : la saisie hors-ligne reste possible, la fiche est « Non renseignée » et la synchro
 * réclamera une équipe.
 *
 * Le type de l'équipe doit correspondre à celui de la saisie (même règle que la FK composite
 * `(equipe_id, equipe_type)` du backend) : mieux vaut bloquer ici, avec un renvoi vers Paramètres,
 * que laisser la synchro échouer en 422 plus tard. Une équipe absente du référentiel local n'est
 * pas bloquante — le serveur tranchera.
 */
export async function equipeDeTravailPour(typeAttendu: TypeEquipe): Promise<string | null> {
  const equipeId = useEquipeTravailStore.getState().equipeId;
  if (!equipeId) return null;

  const equipe = await getEquipeLocale(equipeId);
  if (equipe && equipe.type !== typeAttendu) {
    throw new PreconditionError(
      typeAttendu === 'terrestre'
        ? `Cette saisie se mène avec une équipe terrestre, or l'équipe de travail « ${equipe.nom} » est aérienne. Changez d'équipe de travail dans Paramètres.`
        : `Cette saisie se mène avec une équipe aérienne, or l'équipe de travail « ${equipe.nom} » est terrestre. Changez d'équipe de travail dans Paramètres.`
    );
  }
  return equipeId;
}

/**
 * Pourquoi une saisie exigeant une équipe `requis` n'est pas possible avec l'équipe de travail
 * courante, ou `null` si elle l'est. Sans équipe choisie rien n'est bloqué (saisie hors-ligne, #641).
 * Sert aux écrans qui grisent l'action au lieu de laisser `equipeDeTravailPour` lever une erreur :
 * la phrase invite à changer d'équipe (`useEquipeSheetStore.ouvrir`).
 */
export function motifEquipeIncompatible(
  requis: TypeEquipe,
  courante: { nom: string; type: TypeEquipe } | null
): string | null {
  if (!courante || courante.type === requis) return null;
  const attendue = requis === 'terrestre' ? 'terrestre' : 'aérienne';
  const actuelle = courante.type === 'terrestre' ? 'terrestre' : 'aérienne';
  return `Demande une équipe ${attendue} — « ${courante.nom} » est ${actuelle}. Touchez pour changer d'équipe.`;
}
