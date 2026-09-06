/**
 * Écran « Surface traitée » (#326) — aérien uniquement, dernière étape avant
 * Signatures. Lecture seule : affiche `surface_traitee_ha` (somme des rotations,
 * déjà calculée côté backend/mobile), sans aucune saisie.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SurfaceTraiteeScreen from '@/app/(traitement)/surface-traitee';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset();
});

describe('SurfaceTraiteeScreen — total non saisissable', () => {
  it('affiche la surface traitée totale (somme des rotations), sans champ de saisie', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      aerien: { surface_traitee_ha: 27.5 },
    } as any);

    await render(<SurfaceTraiteeScreen />);

    expect(await screen.findByText('27.5')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('« non renseigné » si aucune rotation n’a encore été saisie', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      aerien: { surface_traitee_ha: null },
    } as any);

    await render(<SurfaceTraiteeScreen />);

    expect(await screen.findByText('non renseigné')).toBeVisible();
  });

  it('poursuit vers Signatures', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      aerien: { surface_traitee_ha: 27.5 },
    } as any);

    await render(<SurfaceTraiteeScreen />);
    await screen.findByText('27.5');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/signatures' })
      )
    );
  });
});
