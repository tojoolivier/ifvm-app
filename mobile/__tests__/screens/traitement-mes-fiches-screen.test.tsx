/**
 * Écran « Mes fiches » (traitement, mes-fiches.tsx) — liste les brouillons
 * locaux (`listDraftTraitements`), reprise de l'ancienne liste dépliée sur
 * select.tsx (#liste-mes-fiches-melangee-boutons) : même comportement
 * fonctionnel exact (ouverture, suppression par swipe), déplacé sur son
 * propre écran.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementMesFichesScreen from '@/app/(traitement)/mes-fiches';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listDraftTraitements: jest.fn().mockResolvedValue([]),
  deleteDraftTraitement: jest.fn().mockResolvedValue(true),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  jest.mocked(traitementRepository.listDraftTraitements).mockReset().mockResolvedValue([]);
  jest.mocked(traitementRepository.deleteDraftTraitement).mockReset().mockResolvedValue(true);
});

describe('TraitementMesFichesScreen', () => {
  it('charge et affiche les brouillons locaux dès le montage, sans bouton à presser', async () => {
    jest.mocked(traitementRepository.listDraftTraitements).mockResolvedValue([
      { id: 'trait-1', numero_fiche: 'F-1', type_traitement: 'AERIEN', localite: 'Betioky', statut: 'brouillon' } as any,
    ]);

    await render(<TraitementMesFichesScreen />);

    await waitFor(() => expect(traitementRepository.listDraftTraitements).toHaveBeenCalled());
    expect(await screen.findByText('F-1')).toBeVisible();
  });

  it('sélectionner une fiche ouvre Références en lecture seule', async () => {
    jest.mocked(traitementRepository.listDraftTraitements).mockResolvedValue([
      { id: 'trait-1', numero_fiche: 'F-1', type_traitement: 'AERIEN', localite: 'Betioky', statut: 'brouillon' } as any,
    ]);

    await render(<TraitementMesFichesScreen />);
    fireEvent.press(await screen.findByText('F-1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(traitement)/references',
      params: { traitementId: 'trait-1', isValidationView: '1' },
    });
  });

  it('affiche un état vide quand aucun brouillon n’existe', async () => {
    jest.mocked(traitementRepository.listDraftTraitements).mockResolvedValue([]);

    await render(<TraitementMesFichesScreen />);

    await waitFor(() => expect(screen.getByText('Aucune fiche pour le moment.')).toBeVisible());
  });
});
