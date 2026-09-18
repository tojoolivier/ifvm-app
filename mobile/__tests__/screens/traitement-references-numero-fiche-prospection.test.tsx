/**
 * #numero-fiche-prospection-liee : le champ « Fiche de prospection liée » de
 * l'écran Type & références (traitement Aérien/Terrestre) affichait l'UUID
 * technique brut (`prospectionId`), pas le numéro métier de la fiche de
 * prospection sélectionnée — l'utilisateur n'a aucun moyen de le lire tel
 * quel. Verrouille l'affichage du numéro métier (n_fiche, avec le même
 * ordre de repli que « Consulter une fiche validée » : n_message), jamais
 * l'UUID, et jamais un champ saisissable.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';

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
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
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

describe('ReferencesScreen (traitement) — N° fiche de prospection liée', () => {
  beforeEach(() => {
    mockRouteParams = { prospectionId: 'prosp-1' };
    jest.mocked(prospectionRepository.getProspection).mockReset();
    useTraitementCaptureStore.setState(RESET_STATE);
  });

  it('affiche le n_fiche de la prospection liée, jamais son UUID technique', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: 'EXT-2026-00125',
      n_message: null,
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(screen.getByText('EXT-2026-00125')).toBeTruthy());
    expect(screen.queryByText('prosp-1')).toBeNull();
  });

  it('reprend n_message pour une fiche de Validation/Signalisation (n_fiche absent)', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      statut: 'validee',
      updated_at: '2026-08-10T00:00:00.000Z',
      date_prospection: '2026-08-10',
      n_fiche: null,
      n_message: 'SIG-2026-00045',
    } as any);

    render(<ReferencesScreen />);

    await waitFor(() => expect(screen.getByText('SIG-2026-00045')).toBeTruthy());
  });
});
