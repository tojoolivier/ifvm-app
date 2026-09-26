/**
 * #traitement-brouillon-distinct-fiche-creee : sur « Mes fiches », une fiche de
 * traitement dont le parcours n'est pas terminé (jamais « Enregistrer ») porte
 * l'étiquette « Brouillon » et n'a aucun bouton de synchronisation ; « À SYNCHRO »
 * est réservé à la fiche bien créée (enregistrée), pas encore envoyée.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as traitementRepository from '@/lib/traitement-repository';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  // Un montage unique : `(effect) => effect()` réexécuterait l'effet à chaque rendu
  // (boucle infinie avec le setState de `refresh`, cf. fiches-screen-insigne-reprise).
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    React.useEffect(() => {
      effect();
    }, []);
  },
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
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

const traitement = (over: Record<string, unknown>) =>
  ({
    id: 'trait-1',
    numero_fiche: 'Jean-Terrestre-2026-09-17',
    type_traitement: 'TERRESTRE',
    localite: 'Ambovombe',
    date_traitement: '2026-09-17',
    statut: 'brouillon',
    statut_sync: 'local',
    ...over,
  }) as any;

describe('FichesScreen — traitement : Brouillon (parcours non terminé) vs À SYNCHRO (fiche créée)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'user-1', nom: 'Rakoto', prenom: 'Jean', email: 'j@t.com', role: 'chef_equipe', actif: true } as any,
      token: 'token-test',
    });
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset();
    jest.mocked(traitementRepository.listReprenableTraitements).mockReset().mockResolvedValue([]);
  });

  it('étiquette « Brouillon » (et jamais « À SYNCHRO ») une fiche jamais enregistrée', async () => {
    jest
      .mocked(traitementRepository.listToutesTraitementsLocal)
      .mockResolvedValue([traitement({ statut_sync: 'brouillon' })]);

    await render(<FichesScreen />);

    expect(await screen.findByText('Jean-Terrestre-2026-09-17')).toBeVisible();
    expect(screen.getByText('Brouillon')).toBeVisible();
    // Aucun bouton de synchronisation sur un brouillon.
    expect(screen.queryByText(/À SYNCHRO/)).toBeNull();
    expect(screen.queryByLabelText(/Synchroniser cette fiche/)).toBeNull();
  });

  it('étiquette « À SYNCHRO » une fiche enregistrée, pas encore envoyée', async () => {
    jest
      .mocked(traitementRepository.listToutesTraitementsLocal)
      .mockResolvedValue([traitement({ statut_sync: 'local' })]);

    await render(<FichesScreen />);

    await waitFor(() => expect(screen.getByText('Jean-Terrestre-2026-09-17')).toBeVisible());
    // Une fiche à synchro porte son bouton de synchro : le badge « À SYNCHRO » devient ce bouton.
    expect(screen.getByText('À SYNCHRO')).toBeVisible();
    expect(screen.queryByText('Brouillon')).toBeNull();
  });
});
