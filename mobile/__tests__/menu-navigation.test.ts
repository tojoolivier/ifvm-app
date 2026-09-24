import { entreesNavigation } from '../src/lib/menu-navigation';

describe('entreesNavigation — section NAVIGATION du tiroir', () => {
  const aller = jest.fn();
  beforeEach(() => aller.mockReset());

  it.each(['chef_de_base', 'pilote', 'mecanicien'] as const)(
    '%s voit « Sites » entre « Équipes » et « Référentiels »',
    (role) => {
      const entrees = entreesNavigation(role, aller);
      expect(entrees.map((e) => e.cle)).toEqual(['equipes', 'sites', 'referentiels']);
    }
  );

  it.each(['prospecteur', 'chef_equipe', 'agent_encadreur', 'admin', undefined, null] as const)(
    '%s ne voit pas « Sites » (réservé à l’équipe aérienne)',
    (role) => {
      expect(entreesNavigation(role, aller).map((e) => e.cle)).toEqual(['equipes', 'referentiels']);
    }
  );

  it('« Sites » ouvre l’écran des sites, pas l’ancienne liste des équipes aériennes', () => {
    const sites = entreesNavigation('chef_de_base', aller).find((e) => e.cle === 'sites');

    sites?.onPress();

    expect(aller).toHaveBeenCalledWith('/(app)/sites');
  });

  it('« Sites » porte l’icône et le libellé de la maquette', () => {
    const sites = entreesNavigation('pilote', aller).find((e) => e.cle === 'sites');
    expect(sites).toMatchObject({ libelle: 'Sites', icone: 'sites' });
  });

  it('« Équipes » et « Référentiels » gardent leur destination', () => {
    const entrees = entreesNavigation('chef_de_base', aller);
    entrees.find((e) => e.cle === 'equipes')?.onPress();
    entrees.find((e) => e.cle === 'referentiels')?.onPress();
    expect(aller.mock.calls).toEqual([['/(app)/equipes'], ['/(app)/sync']]);
  });
});
