import { statutFicheAffiche } from '../src/lib/prospection-statut';
import { STATUT_BADGE_CONFIG } from '../src/components/fiches/tokens';

describe('statutFicheAffiche', () => {
  it('affiche « à synchroniser » tant que la fiche est locale, quel que soit son statut serveur', () => {
    expect(statutFicheAffiche('en_attente', 'local')).toBe('a_synchro');
    expect(statutFicheAffiche('verifiee', 'local')).toBe('a_synchro');
  });

  it('distingue « échec d’envoi » (le serveur a refusé) de « à synchro » (attend juste le réseau) — sinon une fiche définitivement bloquée est indiscernable d’une fiche qui partira au prochain passage réseau', () => {
    expect(statutFicheAffiche('en_attente', 'echec')).toBe('echec_synchro');
    expect(statutFicheAffiche('brouillon', 'echec')).toBe('echec_synchro');
  });

  it('affiche « en attente » pour une fiche synchronisée en attente de vérification', () => {
    expect(statutFicheAffiche('en_attente', 'synced')).toBe('en_attente');
  });

  it('reflète vérifiée / validée / rejetée une fois synchronisée', () => {
    expect(statutFicheAffiche('verifiee', 'synced')).toBe('verifiee');
    expect(statutFicheAffiche('validee', 'synced')).toBe('validee');
    expect(statutFicheAffiche('rejetee', 'synced')).toBe('rejetee');
  });

  it('chaque état rendu a bien une entrée dans STATUT_BADGE_CONFIG', () => {
    for (const [statut, sync] of [
      ['x', 'local'],
      ['en_attente', 'synced'],
      ['verifiee', 'synced'],
      ['validee', 'synced'],
      ['rejetee', 'synced'],
    ] as const) {
      const badge = statutFicheAffiche(statut, sync);
      expect(STATUT_BADGE_CONFIG[badge]).toBeTruthy();
    }
  });
});
