/**
 * Récapitulatif — dernier verrou (CDG §9) : « Enregistrer » doit non seulement
 * synchroniser la fiche (POST /traitements/sync, déjà existant) mais aussi
 * appeler POST /traitements/{id}/valider avec les signatures accumulées
 * localement — le maillon manquant qui faisait que les signatures n'étaient
 * jamais réellement persistées côté serveur (#signatures-auto-equipe §6).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RecapScreen from '@/app/(traitement)/recap';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';
import * as traitementSync from '@/lib/traitement-sync';
import { apiClient } from '@/lib/api-client';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: (...args: any[]) => mockReplace(...args), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  countUnsyncedTraitements: jest.fn().mockResolvedValue(0),
  markTraitementValidee: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/traitement-sync', () => ({
  enregistrerEtSynchroniserTraitement: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    validerTraitement: jest.fn(),
  },
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([{ id: 'chef-1', nom: 'Ravelo', prenom: 'Sarah' }]),
}));

const DRAFT_PRET_A_ENREGISTRER = {
  id: 'trait-1',
  type_traitement: 'AERIEN' as const,
  numero_fiche: 'TR-0001',
  mode_traitement: 'BARRIERE',
  localite: 'Andasibe',
  date_traitement: '2026-08-26',
  date_validation: '2026-08-25',
  prospection_id: 'presp-1',
  recouvrement_percent: 50,
  empoisonnement: false,
  empoisonnement_type: null,
  empoisonnement_mode: null,
  empoisonnement_autre: null,
  statut: 'brouillon',
  cible: null,
  terrestre: null,
  aerien: {
    traitement_id: 'trait-1',
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    chef_de_base_id: 'chef-1',
    consultant_international: null,
    immatricule_aeronef: '5R-ABC',
    base_principale: 'Tuléar',
    stand: null,
    base_secondaire: null,
    nb_rotations: 1,
    total_pesticide_l: 10,
    total_pesticide_kg: null,
    surface_traitee_ha: 5,
    surface_restante_ha: 0,
    pesticide_recu_l: 20,
    pesticide_stock_restant_l: 10,
    rotations: [],
  },
  signatures: [
    { id: 's1', traitement_id: 'trait-1', role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
    { id: 's2', traitement_id: 'trait-1', role: 'MECANICIEN', signataire_nom: 'Marc Rabe', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
    { id: 's3', traitement_id: 'trait-1', role: 'CHEF_DE_BASE', signataire_nom: 'Sarah Ravelo', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
  ],
};

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  mockReplace.mockClear();
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_PRET_A_ENREGISTRER as any);
  jest.mocked(traitementRepository.countUnsyncedTraitements).mockReset().mockResolvedValue(0);
  jest.mocked(traitementRepository.markTraitementValidee).mockClear().mockResolvedValue({} as any);
  jest.mocked(traitementSync.enregistrerEtSynchroniserTraitement).mockReset().mockResolvedValue({
    reussies: ['trait-1'],
    echouees: [],
    conflits: [],
  });
  jest.mocked(apiClient.validerTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    date_validation: '2026-08-26',
    signatures: [
      { id: 'srv-1', role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T01:00:00Z' },
      { id: 'srv-2', role: 'MECANICIEN', signataire_nom: 'Marc Rabe', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T01:00:00Z' },
      { id: 'srv-3', role: 'CHEF_DE_BASE', signataire_nom: 'Sarah Ravelo', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T01:00:00Z' },
    ],
  } as any);
  useAuthStore.setState({ user: { id: 'user-1' } as any, token: 'token-1' } as any);
});

describe('RecapScreen — Enregistrer appelle réellement /valider (dernier verrou serveur)', () => {
  it('envoie les signatures persistées localement à validerTraitement puis réécrit la fiche avec la réponse serveur', async () => {
    await render(<RecapScreen />);
    fireEvent.press(await screen.findByText('Enregistrer'));

    await waitFor(() =>
      expect(apiClient.validerTraitement).toHaveBeenCalledWith(
        'token-1',
        'trait-1',
        expect.objectContaining({
          date_validation: '2026-08-25',
          signatures: expect.arrayContaining([
            expect.objectContaining({ role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M0 0 L1 1' }),
          ]),
        })
      )
    );
    await waitFor(() =>
      expect(traitementRepository.markTraitementValidee).toHaveBeenCalledWith(
        'trait-1',
        '2026-08-26',
        expect.arrayContaining([expect.objectContaining({ role: 'PILOTE', id: 'srv-1' })])
      )
    );
  });

  it('n’appelle pas /valider quand la synchronisation n’a pas atteint le serveur (hors ligne)', async () => {
    jest.mocked(traitementSync.enregistrerEtSynchroniserTraitement).mockResolvedValue({
      reussies: [],
      echouees: [{ id: 'trait-1', sort: 'file' } as any],
      conflits: [],
    });

    await render(<RecapScreen />);
    fireEvent.press(await screen.findByText('Enregistrer'));

    expect(await screen.findByText(/Fiche enregistrée sur l.appareil/)).toBeVisible();
    expect(apiClient.validerTraitement).not.toHaveBeenCalled();
  });

  it('une erreur de /valider n’empêche pas la fiche d’être annoncée comme enregistrée', async () => {
    jest.mocked(apiClient.validerTraitement).mockRejectedValue(new Error('500'));

    await render(<RecapScreen />);
    fireEvent.press(await screen.findByText('Enregistrer'));

    expect(await screen.findByText('Fiche enregistrée et synchronisée')).toBeVisible();
  });
});
