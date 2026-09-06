/**
 * Récapitulatif (traitement) — sections « Équipe » et « Pesticides & rotations »
 * distinctes (#equipe-slide-aerien, section renommée depuis « Traitement » par
 * #326) : personnes/aéronef/rattachement d'un côté, pesticides/rotations de
 * l'autre. Chef de base reste résolu depuis le référentiel (FK) ; pilote/
 * mécanicien/consultant sont redevenus du texte libre (migration backend 0048)
 * et s'affichent directement, sans jointure.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import RecapScreen from '@/app/(traitement)/recap';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  countUnsyncedTraitements: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/lib/traitement-sync', () => ({
  enregistrerEtSynchroniserTraitement: jest.fn(),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockImplementation((role: string) => {
    const parRole: Record<string, { id: string; nom: string; prenom: string }[]> = {
      chef_de_base: [{ id: 'chef-1', nom: 'Ravelo', prenom: 'Sarah' }],
    };
    return Promise.resolve(parRole[role] ?? []);
  }),
  listLieuxAeriens: jest.fn().mockResolvedValue([
    { id: 'lieu-1', type_lieu: 'principale', nom: 'Tuléar' },
    { id: 'lieu-2', type_lieu: 'stand', nom: 'Betioky' },
    { id: 'lieu-3', type_lieu: 'secondaire', nom: 'Ambovombe' },
  ]),
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

const DRAFT_AERIEN_COMPLET = {
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
  cible: null,
  terrestre: null,
  aerien: {
    traitement_id: 'trait-1',
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    chef_de_base_id: 'chef-1',
    consultant_international: 'John Smith',
    immatricule_aeronef: '5R-ABC',
    lieu_base_principale_id: 'lieu-1',
    lieu_stand_id: 'lieu-2',
    lieu_base_secondaire_id: 'lieu-3',
    nb_rotations: 2,
    total_pesticide_l: 90,
    total_pesticide_kg: null,
    surface_traitee_ha: 12.5,
    surface_restante_ha: 3,
    pesticide_recu_l: 100,
    pesticide_stock_restant_l: 10,
    rotations: [],
  },
};

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(DRAFT_AERIEN_COMPLET as any);
  jest.mocked(traitementRepository.countUnsyncedTraitements).mockReset().mockResolvedValue(0);
  useTraitementCaptureStore.setState(RESET_STATE);
  useAuthStore.setState({ user: { id: 'user-1' } as any, token: 'token-1' } as any);
});

describe('RecapScreen — sections Équipe et Pesticides & rotations (#equipe-slide-aerien)', () => {
  it('affiche les personnes/aéronef/bases sous « Équipe », séparément des pesticides/rotations sous « Pesticides & rotations »', async () => {
    await render(<RecapScreen />);

    // « Équipe » et « Pesticides & rotations » apparaissent chacun deux fois : une
    // fois dans le checklist de contrôle (libellé d'étape, #326), une fois comme
    // titre de la carte détaillée ci-dessous — jamais une seule occurrence exacte
    // à cibler.
    await waitFor(() => expect(screen.getAllByText('Équipe').length).toBeGreaterThanOrEqual(2));
    expect(screen.getByText('Sarah Ravelo')).toBeVisible();
    expect(screen.getByText('Jean Dupont')).toBeVisible();
    expect(screen.getByText('Marc Rabe')).toBeVisible();
    expect(screen.getByText('John Smith')).toBeVisible();
    expect(screen.getByText('5R-ABC')).toBeVisible();
    expect(screen.getByText('Tuléar')).toBeVisible();
    expect(screen.getByText('Betioky')).toBeVisible();
    expect(screen.getByText('Ambovombe')).toBeVisible();

    expect(screen.getAllByText('Pesticides & rotations').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2')).toBeVisible(); // Nb rotations
    expect(screen.getByText('90')).toBeVisible(); // Total pesticide (l)
    expect(screen.getByText('100')).toBeVisible(); // Pesticide reçu (l)
  });

  it('affiche « — » pour les champs facultatifs absents (stand/base secondaire/consultant), sans planter', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_AERIEN_COMPLET,
      aerien: {
        ...DRAFT_AERIEN_COMPLET.aerien,
        consultant_international: null,
        lieu_stand_id: null,
        lieu_base_secondaire_id: null,
      },
    } as any);

    await render(<RecapScreen />);
    await waitFor(() => expect(screen.getAllByText('Équipe').length).toBeGreaterThanOrEqual(2));

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it("bloque « Enregistrer » quand un champ obligatoire de l'équipe manque (ex. base principale)", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_AERIEN_COMPLET,
      aerien: { ...DRAFT_AERIEN_COMPLET.aerien, lieu_base_principale_id: null },
    } as any);

    await render(<RecapScreen />);

    expect(await screen.findByText(/point\(s\) à corriger/)).toBeVisible();
  });

  it('rendues, avec toutes les informations équipe complètes et toutes les signatures persistées, « Enregistrer » est disponible', async () => {
    // « Signé » se lit désormais dans les signatures persistées localement
    // (SQLite, via getTraitement), pas dans le state éphémère du store
    // (#signatures-auto-equipe §6).
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      ...DRAFT_AERIEN_COMPLET,
      signatures: [
        { id: 's1', traitement_id: 'trait-1', role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
        { id: 's2', traitement_id: 'trait-1', role: 'MECANICIEN', signataire_nom: 'Marc Rabe', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
        { id: 's3', traitement_id: 'trait-1', role: 'CHEF_DE_BASE', signataire_nom: 'Sarah Ravelo', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
        { id: 's4', traitement_id: 'trait-1', role: 'CONSULTANT_INTERNATIONAL', signataire_nom: 'John Smith', signature_image: 'M0 0 L1 1', horodatage: '2026-08-26T00:00:00Z' },
      ],
    } as any);

    await render(<RecapScreen />);

    await waitFor(async () => expect(await screen.findByText('Enregistrer')).toBeVisible());
  });
});
