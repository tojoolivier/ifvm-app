/**
 * Récapitulatif CRT (#495) — le bouton « Télécharger le PDF » n'apparaît que
 * pour une fiche verrouillée ET validée côté serveur (même règle que le
 * backend, cf. GET /traitements/{id}/pdf), et délègue à
 * `telechargerEtPartagerPdf`/`depsPdfPartage` (#533) plutôt que de réinventer
 * son propre fetch/partage.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RecapScreen from '@/app/(traitement)/recap';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import { telechargerEtPartagerPdf } from '@/lib/pdf-partage';
import { depsPdfPartage } from '@/lib/pdf-partage-natif';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1', isValidationView: '1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  countUnsyncedTraitements: jest.fn().mockResolvedValue(0),
  markTraitementValidee: jest.fn(),
}));

jest.mock('@/lib/traitement-sync', () => ({
  enregistrerEtSynchroniserTraitement: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: { validerTraitement: jest.fn() },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/pdf-partage', () => ({
  telechargerEtPartagerPdf: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/pdf-partage-natif', () => ({
  depsPdfPartage: jest.fn().mockReturnValue({ marker: 'deps-pdf-partage' }),
}));

const DRAFT_VALIDEE = {
  id: 'trait-1',
  numero_fiche: 'CRT-2026-00042',
  type_traitement: 'AERIEN',
  statut: 'validee',
  cible: null,
  terrestre: null,
  aerien: {
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    chef_de_base_id: 'chef-1',
    immatricule_aeronef: '5R-ABC',
    base_principale: 'Base Betioky',
    nb_rotations: 1,
    total_pesticide_l: 10,
    surface_traitee_ha: 5,
    rotations: [],
  },
  signatures: [],
  evaluations_risque_population: [],
} as any;

describe('RecapScreen — téléchargement du PDF (#495)', () => {
  beforeEach(() => {
    mockRouteParams = { traitementId: 'trait-1', isValidationView: '1' };
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_VALIDEE);
    jest.mocked(traitementRepository.countUnsyncedTraitements).mockReset().mockResolvedValue(0);
    jest.mocked(telechargerEtPartagerPdf).mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ token: 'token-test', user: { id: 'user-1' } as any });
  });

  it('affiche le bouton pour une fiche verrouillée et validée', async () => {
    await render(<RecapScreen />);

    expect(await screen.findByText('Télécharger le PDF')).toBeVisible();
  });

  it("n'affiche pas le bouton pour une fiche verrouillée mais non validée", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_VALIDEE,
      statut: 'brouillon',
    });

    await render(<RecapScreen />);

    await screen.findByText('🔒 Fiche verrouillée (lecture seule)');
    expect(screen.queryByText('Télécharger le PDF')).toBeNull();
  });

  it("n'affiche pas le bouton hors du mode verrouillé", async () => {
    mockRouteParams = { traitementId: 'trait-1' };

    await render(<RecapScreen />);

    await screen.findByText('CRT-2026-00042');
    expect(screen.queryByText('Télécharger le PDF')).toBeNull();
  });

  it('délègue à telechargerEtPartagerPdf avec le bon endpoint et le bon nom de fichier', async () => {
    await render(<RecapScreen />);
    fireEvent.press(await screen.findByText('Télécharger le PDF'));

    await waitFor(() =>
      expect(telechargerEtPartagerPdf).toHaveBeenCalledWith(
        { marker: 'deps-pdf-partage' },
        '/traitements/trait-1/pdf',
        'fiche-crt-CRT-2026-00042.pdf'
      )
    );
    expect(depsPdfPartage).toHaveBeenCalled();
  });
});
