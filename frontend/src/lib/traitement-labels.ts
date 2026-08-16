/**
 * Libellés partagés entre TraitementsPage et TraitementDetailPage —
 * docs/design_handoff_web/README.md §7 Traitements.
 */
export const TYPE_LABELS: Record<string, string> = {
  AERIEN: 'Aérien',
  TERRESTRE: 'Terrestre',
}

export const MODE_LABELS: Record<string, string> = {
  TOTAL: 'Total',
  BARRIERE: 'Barrière',
  IRREGULIER: 'Irrégulier',
}

export const ROLE_LABELS: Record<string, string> = {
  PILOTE: 'Pilote',
  MECANICIEN: 'Mécanicien',
  CHEF_DE_BASE: 'Chef de base',
  CHEF_EQUIPE: "Chef d'équipe",
  CONSULTANT_INTERNATIONAL: 'Consultant international',
}

/**
 * Matrice de signatures : le backend expose 5 rôles fixes (RoleSignature,
 * traitement_schemas.py) — un rôle n'apparaît signataire que si son champ est
 * renseigné, les autres affichent « ne signe pas ». Sert de dénominateur au
 * compteur « n/5 » de la liste comme au détail.
 */
export const SIGNATURE_ROLES = Object.keys(ROLE_LABELS)

export const STATUS_LABELS: Record<number, string> = {
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit',
  422: 'Données invalides',
}
