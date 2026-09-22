/**
 * #zone-a-reprendre-numero-annexe / #zone-a-reprendre-surface-reste-a-traiter :
 * une fiche démarrée depuis « Zones à reprendre » (zones-a-reprendre.tsx,
 * qui transmet `origineId` = id de l'ancien traitement) doit :
 * - recevoir un numéro de fiche suffixé « -ANNEXE » ;
 * - hériter, dans sa cible, de la surface restante de l'ANCIEN traitement
 *   (pas sa propre surface_infestee_ha, qui reste par ailleurs inchangée).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReferencesScreen from '@/app/(traitement)/references';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
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
  genererNumeroFicheDisponible: jest.fn().mockResolvedValue('Jean-AERIEN-2026-08-12-ANNEXE'),
  saveCible: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue(null),
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
  ref: { dateTraitement: '2026-08-11' },
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

describe('ReferencesScreen (traitement) — reprise depuis « Zones à reprendre »', () => {
  beforeEach(() => {
    mockRouteParams = { prospectionId: 'prosp-1' };
    jest.mocked(traitementRepository.genererNumeroFicheDisponible).mockClear().mockResolvedValue('Jean-AERIEN-2026-08-12-ANNEXE');
    jest.mocked(prospectionRepository.getProspection).mockReset().mockResolvedValue(null);
    useTraitementCaptureStore.setState(RESET_STATE);
    useAuthStore.setState({
      user: { id: 'u1', nom: 'Rakoto', prenom: 'Jean', email: 'j@x.mg', role: 'chef_equipe', actif: true } as any,
      token: 'token-test',
    });
  });

  it('génère un numéro suffixé « -ANNEXE » quand origineId est présent (fiche née de « Zones à reprendre »)', async () => {
    mockRouteParams = { prospectionId: 'prosp-1', origineId: 'trait-origine' };

    render(<ReferencesScreen />);

    await waitFor(() =>
      expect(traitementRepository.genererNumeroFicheDisponible).toHaveBeenCalledWith(
        'Jean',
        'AERIEN',
        '2026-08-11',
        null,
        undefined,
        true
      )
    );
  });

  it("ne demande pas de numéro « -ANNEXE » pour un traitement neuf (pas d'origineId)", async () => {
    mockRouteParams = { prospectionId: 'prosp-1' };

    render(<ReferencesScreen />);

    await waitFor(() => expect(traitementRepository.genererNumeroFicheDisponible).toHaveBeenCalled());
    const [, , , , , estReprise] = jest.mocked(traitementRepository.genererNumeroFicheDisponible).mock.calls[0];
    expect(estReprise).toBeFalsy();
  });

  /**
   * #zone-a-reprendre-surface-reste-a-traiter : la cible de la NOUVELLE fiche
   * hérite du reste à traiter de l'ANCIEN traitement (`origineId`), jamais de
   * sa propre `surface_infestee_ha` (qui reste, elle, dérivée normalement de
   * la prospection liée — vérifié ici en s'assurant qu'elle diffère bien du
   * reste à traiter injecté).
   */
  it("hérite de la surface reste à traiter de l'ANCIEN traitement dans la cible de la nouvelle fiche", async () => {
    mockRouteParams = { prospectionId: 'prosp-1', origineId: 'trait-origine' };
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      type_prospection: 'extensive',
      statut: 'validee',
      date_prospection: '2026-08-10',
      surface_infestee: 12,
      station_nom: null,
      station_libre: 'Ambovombe',
    } as any);
    jest.mocked(traitementRepository.createDraftTraitementAerien).mockResolvedValue({ id: 'trait-nouveau' } as any);
    jest.mocked(traitementRepository.getTraitement).mockImplementation((id: string) =>
      id === 'trait-origine'
        ? Promise.resolve({ terrestre: null, aerien: { surface_restante_ha: 2.5 } } as any)
        : Promise.resolve(null)
    );

    await render(<ReferencesScreen />);
    // Le montage (fiche neuve, pas de `traitementId`) réinitialise le store —
    // le type de traitement se choisit donc interactivement sur cet écran,
    // comme le ferait réellement l'agent, plutôt que présupposé au montage.
    fireEvent.press(await screen.findByText('Aérien'));
    fireEvent.press(await screen.findByText('Continuer — Synthèse ›'));

    await waitFor(() => expect(traitementRepository.saveCible).toHaveBeenCalled());
    const [, cible] = jest.mocked(traitementRepository.saveCible).mock.calls[0];
    expect(cible.surface_restante_origine_ha).toBe(2.5);
    expect(cible.surface_infestee_ha).toBe(12);
    expect(cible.surface_restante_origine_ha).not.toBe(cible.surface_infestee_ha);
  });
});
