/**
 * « Mes fiches » (fiches.tsx) — l'équipe de travail est le contexte (#678) : par défaut la liste
 * ne montre que les fiches de l'équipe courante (et celles « Non renseignée », qui ne doivent
 * jamais disparaître), et « Toutes les équipes » lève le filtre.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));

jest.mock('@/lib/prospection-accueil', () => ({
  loadAccueilData: jest.fn().mockResolvedValue({
    unsyncedCount: 0,
    activeDraft: null,
    draftsCount: 0,
    recent: [],
    validated: [],
    pendingSync: [],
  }),
  loadMesProspectionsServeur: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn().mockResolvedValue([]),
}));

let mockCourante: { id: string; nom: string; type: 'terrestre' | 'aerien' } | null = null;
jest.mock('@/hooks/use-equipes-de-travail', () => ({
  useEquipesDeTravail: () => ({ equipes: [], courante: mockCourante, choisir: jest.fn(), recharger: jest.fn(), isLoaded: true }),
}));

const traitement = (id: string, localite: string, equipeId: string | null) =>
  ({
    id,
    numero_fiche: null,
    type_traitement: 'TERRESTRE',
    localite,
    date_traitement: '2026-09-17',
    statut: 'brouillon',
    statut_sync: 'local',
    equipe_id: equipeId,
  }) as any;

describe('FichesScreen — filtre par équipe de travail courante', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'user-1', role: 'chef_equipe' } as any, token: 'token-test' });
    mockCourante = { id: 'eq-nord', nom: 'Équipe Nord', type: 'aerien' };
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([
      traitement('t-nord', 'Ambovombe', 'eq-nord'),
      traitement('t-sud', 'Toliara', 'eq-sud'),
      traitement('t-libre', 'Morondava', null),
    ]);
  });

  it('ne montre que les fiches de l’équipe courante et celles sans équipe', async () => {
    await render(<FichesScreen />);

    expect(await screen.findByText('Ambovombe · 2026-09-17')).toBeVisible();
    expect(screen.getByText('Morondava · 2026-09-17')).toBeVisible();
    expect(screen.queryByText('Toliara · 2026-09-17')).toBeNull();
    expect(screen.getByTestId('bandeau-equipe')).toBeVisible();
    expect(screen.getByText('Équipe Nord')).toBeVisible();
  });

  it('« Toutes les équipes » lève le filtre', async () => {
    await render(<FichesScreen />);
    await screen.findByText('Ambovombe · 2026-09-17');

    fireEvent.press(screen.getByTestId('fiches-toutes-equipes'));

    expect(await screen.findByText('Toliara · 2026-09-17')).toBeVisible();
  });

  it('sans équipe de travail choisie : aucun filtre et pas de barre d’équipe', async () => {
    mockCourante = null;

    await render(<FichesScreen />);

    expect(await screen.findByText('Toliara · 2026-09-17')).toBeVisible();
    expect(screen.queryByTestId('fiches-toutes-equipes')).toBeNull();
    expect(screen.getByTestId('bandeau-equipe-vide')).toBeVisible();
  });
});
