/**
 * La localité de la fiche de traitement est générée automatiquement à partir
 * de la localité de la fiche de prospection extensive correspondante
 * (`station_libre`, « nom du lieu-dit / repère local ») — mais reste
 * modifiable ensuite (filet de sécurité, notamment sur une prospection
 * intensive qui n'a pas ce champ). N'écrase jamais une saisie déjà présente
 * (reprise d'un brouillon déjà localisé).
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn().mockResolvedValue(null),
  createDraftTraitementAerien: jest.fn(),
  createDraftTraitementTerrestre: jest.fn(),
  updateTraitementReference: jest.fn(),
  genererNumeroFicheDisponible: jest.fn().mockResolvedValue('Jean-AERIEN-2026-08-12'),
  saveCible: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn(),
  listAllProspectionPopulations: jest.fn().mockResolvedValue([]),
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue(null),
  reverseGeocode: jest.fn().mockResolvedValue(null),
}));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'AERIEN' as const,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

describe('ReferencesScreen (traitement) — localité pré-remplie depuis la prospection liée', () => {
  beforeEach(() => {
    mockRouteParams = { prospectionId: 'prosp-1' };
    jest.mocked(prospectionRepository.getProspection).mockReset();
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(null);
    useTraitementCaptureStore.setState(RESET_STATE);
  });

  it('pré-remplit la localité avec station_libre pour une nouvelle fiche', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: 'EXT-2026-00125',
      n_message: null,
      station_libre: 'Andasibe-Village',
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(useTraitementCaptureStore.getState().ref.localite).toBe('Andasibe-Village'));
    expect(screen.getByDisplayValue('Andasibe-Village')).toBeTruthy();
  });

  it('reste modifiable après pré-remplissage (le champ localité n\'est pas verrouillé)', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: 'EXT-2026-00125',
      n_message: null,
      station_libre: 'Andasibe-Village',
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Andasibe-Village')).toBeTruthy());
    expect(screen.getByDisplayValue('Andasibe-Village').props.editable).not.toBe(false);
  });

  it("n'écrase jamais la localité d'une fiche de traitement déjà existante (reprise d'un brouillon)", async () => {
    // Fiche déjà créée (routeTraitementId présent) : le pré-remplissage depuis
    // station_libre ne s'applique qu'aux nouvelles fiches — la localité déjà
    // enregistrée sur ce brouillon doit rester telle quelle, même si la
    // prospection liée a un station_libre différent.
    mockRouteParams = { prospectionId: 'prosp-1', traitementId: 'trait-1' };
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      prospection_id: 'prosp-1',
      numero_fiche: 'EXT-2026-00125',
      type_traitement: 'AERIEN',
      mode_traitement: null,
      date_traitement: '2026-08-11',
      date_validation: '2026-08-10',
      localite: 'Localité déjà enregistrée',
      region: null,
      district: null,
      commune: null,
      latitude: null,
      longitude: null,
      altitude: null,
    } as any);
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: 'EXT-2026-00125',
      n_message: null,
      station_libre: 'Andasibe-Village',
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(traitementRepository.getTraitement).toHaveBeenCalledWith('trait-1'));
    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Localité déjà enregistrée')).toBeTruthy();
    expect(screen.queryByDisplayValue('Andasibe-Village')).toBeNull();
  });

  it('laisse la localité vide (saisie manuelle requise) quand la prospection liée est intensive, sans station_libre', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: 'INT-2026-00087',
      n_message: null,
      station_libre: null,
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalled());
    expect(useTraitementCaptureStore.getState().ref.localite ?? '').toBe('');
  });
});
