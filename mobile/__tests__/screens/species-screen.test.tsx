/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée, les
 * espèces/stades déjà cochés sur « Qu'avez-vous observé ? » doivent réapparaître
 * sélectionnés — sinon l'agent croit que rien ne se sélectionne.
 */
import { render, screen } from '@testing-library/react-native';
import SpeciesScreen from '@/app/(prospection)/species';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

describe('SpeciesScreen', () => {
  it('restaure la sélection d’espèces déjà enregistrée (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: false, nseLarve: true }),
      } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);

    expect(await screen.findByText('2 grille(s)')).toBeVisible();
  });

  it('part d’une sélection vide sur une fiche neuve', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-neuf', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);

    expect(await screen.findByText('0 grille(s)')).toBeVisible();
  });
});
