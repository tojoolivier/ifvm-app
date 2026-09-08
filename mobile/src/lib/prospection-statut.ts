/**
 * Statut affiché d'une fiche de prospection sur les listes mobile (dashboard,
 * écran Prospection) — jusqu'ici réduit à deux états dérivés de `statut_sync`
 * seul (« À synchro » / « Synchro ✓ »), ignorant complètement `statut` :
 * une fiche vérifiée, validée ou rejetée s'affichait comme n'importe quelle
 * autre fiche déjà envoyée, sans que l'agent puisse le voir sur la liste.
 *
 * Les libellés/couleurs existent déjà pour ces cinq clés dans
 * `STATUT_BADGE_CONFIG` (components/fiches/tokens.ts) — jamais câblées à un
 * vrai calcul de statut. Cette fonction ne fait que ça : dériver la bonne
 * clé, réutilisée telle quelle comme `item.badge`.
 *
 * `statut_sync` prime : tant que le serveur n'a pas la fiche, son `statut`
 * réel n'a pas de sens pour l'agent (il ne peut rien avoir été vérifié côté
 * serveur). Au-delà, on lit `statut` tel quel.
 */
export type StatutFicheAffiche = 'a_synchro' | 'en_attente' | 'verifiee' | 'validee' | 'rejetee';

export function statutFicheAffiche(statut: string, statutSync: string): StatutFicheAffiche {
  if (statutSync !== 'synced') return 'a_synchro';
  switch (statut) {
    case 'verifiee':
      return 'verifiee';
    case 'validee':
      return 'validee';
    case 'rejetee':
      return 'rejetee';
    default:
      return 'en_attente';
  }
}
