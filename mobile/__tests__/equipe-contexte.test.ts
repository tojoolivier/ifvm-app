/**
 * L'équipe de travail comme contexte (#678) : la règle qui grise une action selon son type, et
 * l'ouverture de la feuille de choix depuis n'importe quel écran.
 */
// `equipe-travail.ts` importe le stockage natif et le référentiel local : inutiles ici, la règle est pure.
jest.mock('@/lib/equipe-travail-store', () => ({ useEquipeTravailStore: { getState: jest.fn() } }));
jest.mock('@/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn() }));

import { motifEquipeIncompatible } from '@/lib/equipe-travail';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';

describe('motifEquipeIncompatible', () => {
  const nord = { nom: 'Équipe Nord', type: 'aerien' as const };
  const sol = { nom: 'EMT Toliara', type: 'terrestre' as const };

  it('ne bloque rien sans équipe choisie (saisie hors-ligne)', () => {
    expect(motifEquipeIncompatible('terrestre', null)).toBeNull();
    expect(motifEquipeIncompatible('aerien', null)).toBeNull();
  });

  it('ne bloque rien quand le type correspond', () => {
    expect(motifEquipeIncompatible('aerien', nord)).toBeNull();
    expect(motifEquipeIncompatible('terrestre', sol)).toBeNull();
  });

  it('nomme l’équipe et invite à en changer quand le type ne correspond pas', () => {
    expect(motifEquipeIncompatible('terrestre', nord)).toBe(
      "Demande une équipe terrestre — « Équipe Nord » est aérienne. Touchez pour changer d'équipe."
    );
    expect(motifEquipeIncompatible('aerien', sol)).toBe(
      "Demande une équipe aérienne — « EMT Toliara » est terrestre. Touchez pour changer d'équipe."
    );
  });
});

describe('useEquipeSheetStore', () => {
  it('ouvre et ferme la feuille de choix de l’équipe', () => {
    useEquipeSheetStore.getState().ouvrir();
    expect(useEquipeSheetStore.getState().visible).toBe(true);

    useEquipeSheetStore.getState().fermer();
    expect(useEquipeSheetStore.getState().visible).toBe(false);
  });
});
