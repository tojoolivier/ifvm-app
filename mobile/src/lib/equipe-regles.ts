/**
 * Règles métier de la création d'équipe et de l'ajout de membre (#641). Vérifiées côté mobile
 * pour donner à l'agent une liste d'erreurs lisible avant l'appel ; le serveur reste juge.
 */

export type TypeEquipe = 'terrestre' | 'aerien';

/** Fonctions qu'un compte « à la volée » (sans accès, `peut_se_connecter=false`) peut porter. */
export const ROLES_A_LA_VOLEE = ['pilote', 'mecanicien', 'consultant_international', 'membre'] as const;

const LIBELLES: Record<string, string> = {
  chef: 'Chef',
  chef_equipe: 'Chef d’équipe',
  chef_de_base: 'Chef de base',
  agent_encadreur: 'Agent encadreur',
  prospecteur: 'Prospecteur',
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  consultant_international: 'Consultant',
  membre: 'Membre',
};

export function libelleFonction(fonction: string): string {
  return LIBELLES[fonction] ?? fonction;
}

export interface NouvelleEquipe {
  nom: string;
  type: TypeEquipe;
  aeronefId: string | null;
  chefId: string | null;
}

export function validerNouvelleEquipe(equipe: NouvelleEquipe): string[] {
  const erreurs: string[] = [];
  if (!equipe.nom.trim()) erreurs.push('Le nom de l’équipe est obligatoire.');
  if (equipe.type === 'aerien' && !equipe.aeronefId) {
    erreurs.push('Un aéronef est obligatoire pour une équipe aérienne.');
  }
  if (equipe.type === 'terrestre' && equipe.aeronefId) {
    erreurs.push('Une équipe terrestre n’a pas d’aéronef.');
  }
  if (!equipe.chefId) erreurs.push('Un chef d’équipe est obligatoire (un compte existant).');
  return erreurs;
}

export type AjoutMembre =
  | { mode: 'existant'; userId: string | null; fonction: string }
  | { mode: 'nouveau'; nom: string; prenom: string; fonction: string };

export interface ContexteAjoutMembre {
  equipeADejaUnChef: boolean;
  /** Utilisateurs déjà chefs d'une autre équipe (`uq_equipe_membre_chef_par_utilisateur`). */
  chefsDAutresEquipes: ReadonlySet<string>;
}

export function validerAjoutMembre(ajout: AjoutMembre, contexte: ContexteAjoutMembre): string[] {
  const erreurs: string[] = [];

  if (ajout.mode === 'existant') {
    if (!ajout.userId) erreurs.push('Choisissez un utilisateur dans la liste.');
  } else {
    if (!ajout.nom.trim()) erreurs.push('Le nom est obligatoire.');
    if (!ajout.prenom.trim()) erreurs.push('Le prénom est obligatoire.');
    if (!(ROLES_A_LA_VOLEE as readonly string[]).includes(ajout.fonction)) {
      erreurs.push(
        `Un compte sans accès ne peut être que pilote, mécanicien, consultant international ou membre. Choisissez un compte existant pour « ${libelleFonction(ajout.fonction)} ».`
      );
    }
  }

  if (ajout.fonction === 'chef') {
    if (contexte.equipeADejaUnChef) {
      erreurs.push('Cette équipe a déjà un chef. Désignez un autre chef avant d’en ajouter un second.');
    } else if (ajout.mode === 'existant' && ajout.userId && contexte.chefsDAutresEquipes.has(ajout.userId)) {
      erreurs.push('Cet utilisateur est déjà chef d’une autre équipe.');
    }
  }
  return erreurs;
}

/** « 2026-09-20 » → « 20/09 » : le format des maquettes, sans l'année. */
export function jourMois(dateIso: string): string {
  const [, mois, jour] = dateIso.slice(0, 10).split('-');
  return `${jour}/${mois}`;
}

/** « Isoanala · n°03 » — l'intitulé d'un site dans les maquettes. */
export function libelleSite(site: { localite: string; numero: string }): string {
  return `${site.localite} · ${site.numero}`;
}

export interface MembrePourPrefill {
  user_id: string;
  fonction: string;
  nom: string | null;
  prenom: string | null;
}

/**
 * Pré-remplissage d'un traitement aérien depuis les membres de l'équipe de travail (#641,
 * décision : pilote / mécanicien / chef de base / consultant restent saisis — présents ce jour-là —
 * mais s'auto-complètent quand l'équipe les porte ; sinon l'agent les saisit).
 */
export function prefillTraitementAerien(membres: MembrePourPrefill[]) {
  const nomDe = (fonction: string) => {
    const membre = membres.find((m) => m.fonction === fonction);
    return membre ? [membre.prenom, membre.nom].filter(Boolean).join(' ') : '';
  };
  return {
    pilote: nomDe('pilote'),
    mecanicien: nomDe('mecanicien'),
    chefDeBaseId: membres.find((m) => m.fonction === 'chef')?.user_id ?? '',
    consultantInternational: nomDe('consultant_international') || null,
  };
}
