/**
 * Fiche de Vol — A. Références (#fiche-vol). Le brouillon local est déjà créé
 * (par la tuile Accès rapide) avant d'arriver ici : cet écran restaure/
 * renseigne, jamais ne crée. Localisation : capturée une seule fois — jamais
 * relancée sur une fiche déjà géolocalisée — et alimente directement
 * base_latitude/longitude/altitude (décision produit du 2026-09-14).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheVolReferenceScreen from '@/app/(fiche-vol)/reference';
import * as ficheVolRepository from '@/lib/fiche-vol-repository';
import * as location from '@/lib/location';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ draftId: 'draft-123' }),
}));

jest.mock('@/lib/fiche-vol-repository', () => ({
  getFicheVol: jest.fn(),
  updateFicheVolReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1280,
    accuracy: 5,
    timestamp: Date.now(),
  }),
}));

const DRAFT_SANS_POSITION = {
  id: 'draft-123',
  numero_fiche: null,
  date_vol: '2026-09-14',
  compagnie: null,
  immatriculation: null,
  base_latitude: null,
  base_longitude: null,
  base_altitude: null,
};

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  jest.mocked(ficheVolRepository.updateFicheVolReference).mockClear().mockResolvedValue({ id: 'draft-123' } as any);
  jest.mocked(location.getCurrentPosition).mockClear().mockResolvedValue({
    latitude: -18.9,
    longitude: 47.5,
    altitude: 1280,
    accuracy: 5,
    timestamp: Date.now(),
  });
});

describe('FicheVolReferenceScreen — capture GPS et saisie', () => {
  it('capture la position GPS quand la fiche n’en a pas encore, et affiche la date déjà fixée', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue(DRAFT_SANS_POSITION as any);

    await render(<FicheVolReferenceScreen />);

    expect(await screen.findByText('-18.9')).toBeVisible();
    expect(screen.getByText('47.5')).toBeVisible();
    expect(screen.getByText('2026-09-14')).toBeVisible();
  });

  it('ne relance pas d’acquisition GPS quand la fiche a déjà une position (base_latitude/longitude)', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue({
      ...DRAFT_SANS_POSITION,
      base_latitude: -20.1,
      base_longitude: 48.2,
      base_altitude: 900,
    } as any);

    await render(<FicheVolReferenceScreen />);

    expect(await screen.findByText('-20.1')).toBeVisible();
    expect(screen.getByText('48.2')).toBeVisible();
    expect(location.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('enregistre Société/Immatricule Aéronef et la position captée, puis navigue vers Équipe', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue(DRAFT_SANS_POSITION as any);

    await render(<FicheVolReferenceScreen />);
    await screen.findByText('-18.9');

    fireEvent.changeText(screen.getByPlaceholderText('Ex. Aviation Malgache'), 'Aviation Malgache');
    expect(await screen.findByDisplayValue('Aviation Malgache')).toBeVisible();
    fireEvent.changeText(screen.getByPlaceholderText('Ex. 5R-ABC'), '5R-ABC');
    expect(await screen.findByDisplayValue('5R-ABC')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Équipe ›'));

    await waitFor(() =>
      expect(ficheVolRepository.updateFicheVolReference).toHaveBeenCalledWith('draft-123', {
        compagnie: 'Aviation Malgache',
        immatriculation: '5R-ABC',
        baseLatitude: -18.9,
        baseLongitude: 47.5,
        baseAltitude: 1280,
      })
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(fiche-vol)/equipe',
        params: { draftId: 'draft-123' },
      })
    );
  });
});
