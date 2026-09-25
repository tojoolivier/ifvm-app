/**
 * Écran « Mes fiches » global (fiches.tsx) — filtre CRT (#crt-fiches-creees-
 * absentes-de-mes-fiches) : la source des fiches de traitement était
 * `listMesTraitements(user.id)`, filtrée sur chef d'équipe/chef de base. Une
 * fiche en cours de saisie (écran Équipe pas encore atteint, donc pas encore
 * de chef assigné) ou créée par un agent qui n'est pas lui-même désigné chef
 * n'apparaissait alors jamais, alors que la fiche existe déjà localement —
 * contrairement aux prospections, jamais filtrées par ce rôle. Remplacée par
 * `listToutesTraitementsLocal()` (déjà utilisée par l'écran Synchronisation), sans
 * filtre de rôle.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  useFocusEffect: (effect: () => void) => effect(),
}));


jest.mock('@/lib/traitement-repository', () => ({
  listToutesTraitementsLocal: jest.fn().mockResolvedValue([]),
}));

describe('FichesScreen — filtre CRT inclut toute fiche de traitement créée localement', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        nom: 'Rakoto',
        prenom: 'Jean',
        email: 'jean@test.com',
        role: 'chef_equipe',
        actif: true,
        created_at: '2026-01-01T00:00:00Z',
      } as any,
      token: 'token-test',
    });
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([]);
  });

  it('affiche une fiche de traitement sans chef d’équipe/chef de base encore assigné', async () => {
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockResolvedValue([
      {
        id: 'trait-1',
        numero_fiche: null,
        type_traitement: 'TERRESTRE',
        localite: 'Ambovombe',
        date_traitement: '2026-09-17',
        statut: 'brouillon',
        statut_sync: 'local',
      } as any,
    ]);

    await render(<FichesScreen />);

    expect(await screen.findByText('Fiche sans numéro')).toBeVisible();
    expect(screen.getByText('Ambovombe · 2026-09-17')).toBeVisible();
    expect(traitementRepository.listToutesTraitementsLocal).toHaveBeenCalledWith();
  });

  it('n’appelle plus listMesTraitements (filtrée par chef assigné, remplacée)', async () => {
    await render(<FichesScreen />);

    await waitFor(() => expect(traitementRepository.listToutesTraitementsLocal).toHaveBeenCalled());
    expect((traitementRepository as any).listMesTraitements).toBeUndefined();
  });
});
