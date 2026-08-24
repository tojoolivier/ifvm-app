/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée (brouillon
 * en attente de synchro ou déjà synchronisée), les observations précédemment saisies
 * (pluie, dégâts, ennemis naturels, observation libre) ne doivent pas disparaître.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ObservationsScreen from '@/app/(prospection)/observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionObservations: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

describe('ObservationsScreen', () => {
  it('recharge et réenregistre les observations déjà enregistrées lors de la réouverture d’une fiche (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        derniere_pluie: '2026-08-10',
        intensite_pluie: 'forte',
        degats_cultures: 'moyens',
        ennemis_naturels: 'Oiseaux, chacals errants',
        observations: 'Vol observé au lever du jour.',
      } as any,
      captures: [],
    });

    await render(<ObservationsScreen />);

    expect(await screen.findByDisplayValue('Vol observé au lever du jour.')).toBeVisible();
    // « Autre » ennemi non listé dans les presets : le champ libre doit s'afficher pré-rempli.
    expect(await screen.findByDisplayValue('chacals errants')).toBeVisible();

    fireEvent.press(screen.getByText('Vérifier & enregistrer ✓'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          degatsCultures: 'moyens',
          ennemisNaturels: 'Oiseaux, chacals errants',
          observations: 'Vol observé au lever du jour.',
          dernierePluie: '2026-08-10',
          intensitePluie: 'forte',
        })
      )
    );
  });
});
