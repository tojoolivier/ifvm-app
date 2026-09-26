/**
 * Écran de lecture d'une fiche de prospection : la fiche s'affiche en tableaux (comme le PDF),
 * et le bouton « Télécharger le PDF » est dans l'en-tête — visible sans défiler — pour une fiche
 * validée seulement (le backend refuse le PDF des autres en 403).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheLectureScreen from '@/app/(prospection)/fiche-lecture';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { getStationById } from '@/lib/referentiel-db';
import { telechargerEtPartagerPdf } from '@/lib/pdf-partage';
import { routerMock } from '../test-utils/mock-expo-router';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { id: 'p1' } })
);

jest.mock('@/lib/api-client', () => ({
  apiClient: { getProspection: jest.fn() },
}));

jest.mock('@/lib/referentiel-db', () => ({
  getStationById: jest.fn(),
}));

jest.mock('@/lib/pdf-partage', () => ({
  telechargerEtPartagerPdf: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/pdf-partage-natif', () => ({
  depsPdfPartage: jest.fn(() => ({})),
}));

const mockedGetProspection = apiClient.getProspection as jest.Mock;
const mockedGetStation = getStationById as jest.Mock;
const mockedPdf = telechargerEtPartagerPdf as jest.Mock;

function fiche(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    type_prospection: 'extensive',
    n_fiche: '20260924-SAB-76D9',
    n_message: '20260924-SAB-76D9',
    prospecteur_nom: 'Ma Sambalahy',
    date_prospection: '2026-09-24',
    station_id: 's1',
    station_libre: null,
    latitude: null,
    longitude: null,
    biotope: [],
    statut: 'validee',
    populations: [],
    captures: [],
    infestations: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ token: 'tok' } as never);
  mockedGetStation.mockResolvedValue(null);
});

describe('FicheLectureScreen', () => {
  it('affiche la fiche en tableaux, avec le titre du gabarit du PDF', async () => {
    mockedGetProspection.mockResolvedValue(fiche());
    await render(<FicheLectureScreen />);

    expect(
      await screen.findByRole('header', { name: 'Prospection extensive — validation — 20260924-SAB-76D9' })
    ).toBeOnTheScreen();
    expect(screen.getByText('Prospecteur : Ma Sambalahy')).toBeOnTheScreen();
    expect(screen.getByLabelText('Imagos LMC')).toBeOnTheScreen();
    expect(mockedGetProspection).toHaveBeenCalledWith('tok', 'p1');
  });

  it("propose « Télécharger le PDF » dans l'en-tête d'une fiche validée et lance l'export", async () => {
    mockedGetProspection.mockResolvedValue(fiche({ statut: 'validee' }));
    await render(<FicheLectureScreen />);

    const bouton = await screen.findByRole('button', { name: 'Télécharger le PDF' });
    await act(async () => {
      fireEvent.press(bouton);
    });

    await waitFor(() =>
      expect(mockedPdf).toHaveBeenCalledWith(
        expect.anything(),
        '/prospections/p1/pdf',
        'fiche-prospection-20260924-SAB-76D9.pdf'
      )
    );
    // L'export terminé, le bouton retrouve son libellé (évite une mise à jour d'état hors du test).
    await waitFor(() => expect(screen.queryByText('Export…')).toBeNull());
  });

  it.each(['en_attente', 'verifiee', 'rejetee'])(
    "n'affiche pas le bouton PDF pour une fiche %s, mais la fiche reste lisible",
    async (statut) => {
      mockedGetProspection.mockResolvedValue(fiche({ statut }));
      await render(<FicheLectureScreen />);

      expect(await screen.findByText('Prospecteur : Ma Sambalahy')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Télécharger le PDF' })).toBeNull();
    }
  );

  it('nomme la station par son code et son nom, lus dans le référentiel local', async () => {
    mockedGetProspection.mockResolvedValue(fiche());
    mockedGetStation.mockResolvedValue({ id: 's1', code: 'ST-014', nom: 'Ankazoabo' });
    await render(<FicheLectureScreen />);

    expect(await screen.findByText('Station : ST-014 Ankazoabo')).toBeOnTheScreen();
    expect(mockedGetStation).toHaveBeenCalledWith('s1');
  });

  it("reste lisible quand le référentiel local est indisponible : station affichée par son identifiant", async () => {
    mockedGetProspection.mockResolvedValue(fiche());
    mockedGetStation.mockRejectedValue(new Error('base non prête'));
    await render(<FicheLectureScreen />);

    expect(await screen.findByText('Station : s1')).toBeOnTheScreen();
  });

  it('préfère la station saisie librement et ne consulte pas le référentiel sans identifiant', async () => {
    mockedGetProspection.mockResolvedValue(fiche({ station_id: null, station_libre: 'Geba' }));
    await render(<FicheLectureScreen />);

    expect(await screen.findByText('Station : Geba')).toBeOnTheScreen();
    expect(mockedGetStation).not.toHaveBeenCalled();
  });

  it('revient à la liste avec « Retour »', async () => {
    mockedGetProspection.mockResolvedValue(fiche());
    await render(<FicheLectureScreen />);

    fireEvent.press(await screen.findByText('‹ Retour'));
    expect(routerMock.push).toHaveBeenCalledWith('/(app)/prospection');
  });

  it("garde l'écran d'attente tant que la fiche n'est pas chargée", async () => {
    mockedGetProspection.mockReturnValue(new Promise(() => {}));
    await render(<FicheLectureScreen />);

    expect(screen.getByText('Fiche de lecture')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Imagos LMC')).toBeNull();
  });
});
