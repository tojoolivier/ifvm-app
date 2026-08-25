/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée, les
 * espèces/stades déjà cochés sur « Qu'avez-vous observé ? » doivent réapparaître
 * sélectionnés — sinon l'agent croit que rien ne se sélectionne.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SpeciesScreen from '@/app/(prospection)/species';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn(),
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

  it('met le brouillon en mémoire à jour avec la sélection enregistrée (#201)', async () => {
    // Sans cela, l'écran de capture lit l'ancienne valeur d'`especes` — vide sur une
    // fiche neuve — et annonce « aucune grille à saisir ».
    const enregistre = {
      id: 'draft-123',
      type_prospection: 'intensive',
      especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
    };
    jest.mocked(prospectionRepository.updateProspectionEspeces).mockResolvedValue(enregistre as any);

    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);
    // Deux cartes portent « Larves » (Locusta, Nomadacris) : on coche celle de Locusta.
    fireEvent.press((await screen.findAllByText('Larves'))[0]);
    // Le compteur confirme que la case a bien basculé avant de continuer.
    expect(await screen.findByText('1 grille(s)')).toBeVisible();
    fireEvent.press(screen.getByText('Captures  ›'));

    await waitFor(() =>
      expect(useProspectionWizardStore.getState().draft?.especes).toBe(enregistre.especes)
    );
  });
});