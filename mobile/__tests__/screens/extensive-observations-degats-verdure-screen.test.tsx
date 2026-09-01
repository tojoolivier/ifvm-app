/**
 * Dégâts sur les cultures (choix Faible/Moyen/Forte) + Verdure strate herbeuse
 * (pourcentage 0-100) — Terrestre et Aérien, D — Observations.
 *
 * Fichier séparé des autres tests de cet écran pour la même raison déjà
 * documentée ailleurs (contention de ressources déterministe au-delà d'un
 * certain nombre de montages de cet écran dans un même fichier).
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveObservationsScreen from '@/app/(prospection)/extensive-observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveObservations: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  normalizeBoolean: (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return null;
  },
}));

beforeEach(() => {
  jest.mocked(prospectionRepository.updateProspectionExtensiveObservations).mockClear();
  useProspectionWizardStore.setState({ draft: null, captures: [] });
});

const DRAFT_TERRESTRE = { id: 'draft-123', type_prospection: 'extensive' } as any;
const DRAFT_AERIEN = { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any;

describe.each([
  ['Terrestre', DRAFT_TERRESTRE],
  ['Aérien', DRAFT_AERIEN],
])('ExtensiveObservationsScreen — Dégâts sur les cultures (%s)', (_label, draft) => {
  it.each([
    ['Faible', 'faibles'],
    ['Moyen', 'moyens'],
    ['Forte', 'forts'],
  ])('sélectionne %s et le sauvegarde (%s)', async (chipLabel, expectedValue) => {
    useProspectionWizardStore.setState({ draft, captures: [] });
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Dégâts sur les cultures');

    // « Faible »/« Forte » existent aussi parmi les chips Intensité (NIVEAU_OPTIONS) —
    // le chip Dégâts sur les cultures est toujours le premier de la fiche.
    fireEvent.press(screen.getAllByText(chipLabel)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(chipLabel)[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ degatsCultures: expectedValue })
      )
    );
  });
});

describe('ExtensiveObservationsScreen — Verdure strate herbeuse (pourcentage)', () => {
  it.each(['0', '50', '100'])('accepte %s %%', async (valeur) => {
    useProspectionWizardStore.setState({ draft: DRAFT_TERRESTRE, captures: [] });
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Verdure strate herbeuse');

    fireEvent.changeText(screen.getByTestId('verdissement-input'), valeur);
    expect(await screen.findByDisplayValue(valeur)).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ verdissementPourcent: Number(valeur) })
      )
    );
  });

  it('refuse une valeur négative avec un message clair, ne sauvegarde pas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useProspectionWizardStore.setState({ draft: DRAFT_TERRESTRE, captures: [] });
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Verdure strate herbeuse');

    fireEvent.changeText(screen.getByTestId('verdissement-input'), '-1');
    expect(await screen.findByDisplayValue('-1')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    expect(alertSpy).toHaveBeenCalledWith('Pourcentage invalide', expect.stringContaining('Verdure strate herbeuse'));
    expect(prospectionRepository.updateProspectionExtensiveObservations).not.toHaveBeenCalled();
  });

  it('refuse une valeur supérieure à 100 avec un message clair, ne sauvegarde pas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useProspectionWizardStore.setState({ draft: DRAFT_TERRESTRE, captures: [] });
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Verdure strate herbeuse');

    fireEvent.changeText(screen.getByTestId('verdissement-input'), '101');
    expect(await screen.findByDisplayValue('101')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Pourcentage invalide',
      expect.stringContaining('ne peut pas dépasser 100')
    );
    expect(prospectionRepository.updateProspectionExtensiveObservations).not.toHaveBeenCalled();
  });

  it('refuse une saisie non numérique avec un message clair, ne sauvegarde pas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useProspectionWizardStore.setState({ draft: DRAFT_AERIEN, captures: [] });
    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Verdure strate herbeuse');

    fireEvent.changeText(screen.getByTestId('verdissement-input'), 'abc');
    expect(await screen.findByDisplayValue('abc')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    expect(alertSpy).toHaveBeenCalledWith('Pourcentage invalide', expect.stringContaining('Verdure strate herbeuse'));
    expect(prospectionRepository.updateProspectionExtensiveObservations).not.toHaveBeenCalled();
  });
});
