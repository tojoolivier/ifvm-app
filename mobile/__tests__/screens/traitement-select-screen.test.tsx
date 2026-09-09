/**
 * Écran « Fiches de traitement » (select.tsx) — #boutons-fiches-de-traitement.
 *
 * L'ancien bouton « Consulter une fiche validée » de CET écran (qui bascule la
 * liste locale des brouillons via `listDraftTraitements` — à ne pas confondre
 * avec le slide `prospection-picker.tsx`, qui porte le même titre mais est un
 * écran totalement différent, atteint depuis « Nouvelle fiche de traitement »,
 * et reste inchangé) est renommé « Mes fiches », avec exactement le même
 * comportement fonctionnel. L'ancien bouton « Mes fiches » (qui pointait vers
 * l'écran séparé /(traitement)/mes-fiches) est supprimé : il ne doit plus en
 * rester qu'un seul sur cette page.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
import TraitementSelectScreen from '@/app/(traitement)/select';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  listDraftTraitements: jest.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockRouteParams = {};
  jest.mocked(traitementRepository.listDraftTraitements).mockReset().mockResolvedValue([]);
});

describe('TraitementSelectScreen — boutons de la page « Fiches de traitement »', () => {
  it('affiche exactement 3 boutons : Nouvelle fiche de traitement, Mes fiches, Zones à reprendre', async () => {
    await render(<TraitementSelectScreen />);

    expect(screen.getByText('Nouvelle fiche de traitement')).toBeVisible();
    expect(screen.getByText('Zones à reprendre')).toBeVisible();
    // Un seul « Mes fiches » : ni doublon, ni ancien libellé « Consulter une
    // fiche validée » (qui reste réservé au slide prospection-picker.tsx).
    expect(screen.getAllByText('Mes fiches')).toHaveLength(1);
    expect(screen.queryByText('Consulter une fiche validée')).toBeNull();
  });

  it('« Nouvelle fiche de traitement » fonctionne toujours (sans prospectionId, ouvre le sélecteur de prospection)', async () => {
    await render(<TraitementSelectScreen />);

    fireEvent.press(screen.getByText('Nouvelle fiche de traitement'));

    expect(mockPush).toHaveBeenCalledWith('/(traitement)/prospection-picker');
  });

  it('« Zones à reprendre » fonctionne toujours', async () => {
    await render(<TraitementSelectScreen />);

    fireEvent.press(screen.getByText('Zones à reprendre'));

    expect(mockPush).toHaveBeenCalledWith('/(traitement)/zones-a-reprendre');
  });

  it('« Mes fiches » (ex-« Consulter une fiche validée ») conserve le même comportement : bascule la liste locale des brouillons', async () => {
    jest.mocked(traitementRepository.listDraftTraitements).mockResolvedValue([
      { id: 'trait-1', numero_fiche: 'F-1', type_traitement: 'AERIEN', localite: 'Betioky' } as any,
    ]);

    await render(<TraitementSelectScreen />);
    expect(traitementRepository.listDraftTraitements).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Mes fiches'));

    await waitFor(() => expect(traitementRepository.listDraftTraitements).toHaveBeenCalled());
    expect(await screen.findByText('F-1')).toBeVisible();
    await settle();

    // Re-presser referme la liste (bascule), sans nouvel appel réseau/local.
    jest.mocked(traitementRepository.listDraftTraitements).mockClear();
    fireEvent.press(screen.getByText('Mes fiches'));
    await settle();
    expect(screen.queryByText('F-1')).toBeNull();
    expect(traitementRepository.listDraftTraitements).not.toHaveBeenCalled();
  });

  it('sélectionner une fiche dans la liste ouvre Références en lecture seule (comportement inchangé)', async () => {
    jest.mocked(traitementRepository.listDraftTraitements).mockResolvedValue([
      { id: 'trait-1', numero_fiche: 'F-1', type_traitement: 'AERIEN', localite: 'Betioky' } as any,
    ]);

    await render(<TraitementSelectScreen />);
    fireEvent.press(screen.getByText('Mes fiches'));
    fireEvent.press(await screen.findByText('F-1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(traitement)/references',
      params: { traitementId: 'trait-1', isValidationView: '1' },
    });
  });
});
