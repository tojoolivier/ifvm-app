import { peutCreerEquipe, peutGererParcAeronefs } from '../src/lib/equipe-aerienne-access';

describe('peutCreerEquipe', () => {
  it.each(['chef_de_base', 'chef_equipe', 'admin'] as const)('autorise %s', (role) => {
    expect(peutCreerEquipe(role)).toBe(true);
  });

  it.each(['pilote', 'mecanicien', 'agent_encadreur'] as const)('refuse %s', (role) => {
    expect(peutCreerEquipe(role)).toBe(false);
  });

  it('refuse un utilisateur sans rôle', () => {
    expect(peutCreerEquipe(null)).toBe(false);
    expect(peutCreerEquipe(undefined)).toBe(false);
  });
});

describe('peutGererParcAeronefs', () => {
  it('réserve la gestion du parc à l’administrateur', () => {
    expect(peutGererParcAeronefs('admin')).toBe(true);
  });

  it.each(['chef_de_base', 'chef_equipe', 'pilote', 'mecanicien', 'agent_encadreur'] as const)('masque %s', (role) => {
    expect(peutGererParcAeronefs(role)).toBe(false);
  });

  it('refuse un utilisateur sans rôle', () => {
    expect(peutGererParcAeronefs(null)).toBe(false);
  });
});
