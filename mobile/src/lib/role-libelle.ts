/** Libellé lisible d'un rôle utilisateur (badge du tiroir de menu). */
const LIBELLES_ROLE: Record<string, string> = {
  prospecteur: 'Prospecteur',
  chef_de_base: 'Chef de base',
  chef_equipe: "Chef d'équipe",
  pilote: 'Pilote',
  mecanicien: 'Mécanicien',
  admin: 'Administrateur',
};

export function libelleRole(role: string): string {
  return LIBELLES_ROLE[role] ?? role;
}
