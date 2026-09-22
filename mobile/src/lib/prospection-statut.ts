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
 *
 * `'echec'` (le serveur a refusé la fiche, cf. sync-lot.ts `sortDeLEchec`) est
 * distingué de `'local'`/`'conflict'` (simplement en attente de réseau) : les
 * deux tombaient sur le même badge « À SYNCHRO », rendant une fiche
 * définitivement bloquée indiscernable d'une fiche qui partira au prochain
 * passage réseau — l'agent n'avait alors aucun signal, sur cette liste, qu'une
 * fiche ne partirait jamais sans action de sa part (cf. l'écran
 * Synchronisation, qui lit `statut_sync` séparément).
 */
export type StatutFicheAffiche =
  | 'brouillon'
  | 'a_synchro'
  | 'echec_synchro'
  | 'en_attente'
  | 'verifiee'
  | 'validee'
  | 'rejetee';

/**
 * `'brouillon'` (#dossier-brouillons) prime sur tout le reste : une fiche
 * encore en cours de saisie n'a jamais été soumise à l'envoi, donc
 * `statut_sync` n'a par construction rien à en dire — la confondre avec
 * « à synchro » (avant ce correctif) laissait croire à l'agent qu'elle
 * partirait au prochain passage réseau, alors qu'elle ne partira jamais tant
 * qu'il ne l'a pas terminée (`completeProspection`, seul point de sortie du
 * statut `brouillon`). `statut_sync = 'echec'` sur une fiche `brouillon` n'est
 * d'ailleurs pas un état atteignable : `markProspectionEchec` ne peut être
 * appelée que sur une fiche déjà tentée à l'envoi (`listUnsyncedProspections`
 * ne sélectionne jamais `statut = 'brouillon'`).
 */
export function statutFicheAffiche(statut: string, statutSync: string): StatutFicheAffiche {
  if (statut === 'brouillon') return 'brouillon';
  if (statutSync === 'echec') return 'echec_synchro';
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
