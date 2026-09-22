/**
 * Écran « Zones à reprendre » (zones-a-reprendre.tsx) — liste les fiches
 * (terrestres et aériennes) dont la surface restante est encore à traiter, et
 * affiche cette surface comme « surface disponible à traiter » pour la
 * reprise (c'est la surface restante de l'ANCIEN traitement, pas une
 * nouvelle saisie).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementZonesAReprendreScreen from '@/app/(traitement)/zones-a-reprendre';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listReprenableTraitements: jest.fn(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  jest.mocked(traitementRepository.listReprenableTraitements).mockReset();
});

describe('TraitementZonesAReprendreScreen', () => {
  it('affiche la surface disponible à traiter (= surface restante de la fiche précédente)', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([
      {
        id: 'trait-1',
        prospection_id: 'prosp-1',
        numero_fiche: 'F-1',
        type_traitement: 'TERRESTRE',
        localite: 'Betioky',
        surface_restante_ha: 3.5,
      } as any,
    ]);

    await render(<TraitementZonesAReprendreScreen />);

    expect(await screen.findByText('F-1')).toBeVisible();
    expect(screen.getByText('Surface disponible à traiter : 3.5 ha')).toBeVisible();
  });

  it('affiche « non communiquée » quand la surface restante n’a pas encore été synchronisée (null)', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([
      {
        id: 'trait-2',
        prospection_id: 'prosp-2',
        numero_fiche: 'F-2',
        type_traitement: 'AERIEN',
        localite: null,
        surface_restante_ha: null,
      } as any,
    ]);

    await render(<TraitementZonesAReprendreScreen />);

    expect(await screen.findByText('F-2')).toBeVisible();
    expect(screen.getByText('Surface disponible à traiter : non communiquée')).toBeVisible();
  });

  it('ouvre l’écran Références avec la fiche présélectionnée comme origine de la reprise', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([
      {
        id: 'trait-3',
        prospection_id: 'prosp-3',
        numero_fiche: 'F-3',
        type_traitement: 'TERRESTRE',
        localite: 'Ambovombe',
        surface_restante_ha: 1.2,
      } as any,
    ]);

    await render(<TraitementZonesAReprendreScreen />);

    fireEvent.press(await screen.findByText('F-3'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(traitement)/references',
      params: { prospectionId: 'prosp-3', origineId: 'trait-3' },
    });
  });

  // #zone-a-reprendre-insigne
  it('affiche l’insigne « REPRISE POSSIBLE » sur chaque fiche listée', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([
      {
        id: 'trait-1',
        prospection_id: 'prosp-1',
        numero_fiche: 'F-1',
        type_traitement: 'TERRESTRE',
        localite: 'Betioky',
        surface_restante_ha: 3.5,
      } as any,
    ]);

    await render(<TraitementZonesAReprendreScreen />);

    expect(await screen.findByText('↻ REPRISE POSSIBLE')).toBeVisible();
  });

  it('affiche un état vide quand aucune fiche n’est reprenable', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([]);

    await render(<TraitementZonesAReprendreScreen />);

    await waitFor(() =>
      expect(screen.getByText('Aucune zone à reprendre pour le moment.')).toBeVisible()
    );
  });
});
