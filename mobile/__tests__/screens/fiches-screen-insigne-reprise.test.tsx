/**
 * #zone-a-reprendre-insigne : sur « Mes fiches » (fiches.tsx), une fiche de
 * traitement déjà validée dont la surface restante justifie une reprise
 * (mêmes critères que zones-a-reprendre.tsx, via `listReprenableTraitements`)
 * porte l'insigne « REPRISE POSSIBLE » — pour la repérer sans avoir besoin
 * d'ouvrir l'écran dédié.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import FichesScreen from '@/app/(app)/fiches';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionAccueil from '@/lib/prospection-accueil';
import * as traitementRepository from '@/lib/traitement-repository';

jest.mock('expo-router', () => ({
  ...require('../test-utils/mock-expo-router').expoRouterMock(),
  // `(effect) => effect()` (utilisé ailleurs dans ce dépôt) réexécute l'effet à
  // CHAQUE rendu — provoque ici une boucle infinie rendu → refresh → setState →
  // rendu (constaté : heap JS épuisé, cf. brouillons-screen.test.tsx pour le
  // même correctif). `React.useEffect` à dépendances vides reproduit fidèlement
  // le vrai `useFocusEffect` d'expo-router pour un montage unique en test.
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

const TRAITEMENT_AVEC_SURFACE_RESTANTE = {
  id: 'trait-1',
  numero_fiche: 'Jean-Terrestre-2026-09-17',
  type_traitement: 'TERRESTRE',
  localite: 'Ambovombe',
  date_traitement: '2026-09-17',
  statut: 'validee',
  statut_sync: 'synced',
} as any;

const TRAITEMENT_SANS_SURFACE_RESTANTE = {
  id: 'trait-2',
  numero_fiche: 'Jean-Terrestre-2026-09-10',
  type_traitement: 'TERRESTRE',
  localite: 'Betioky',
  date_traitement: '2026-09-10',
  statut: 'validee',
  statut_sync: 'synced',
} as any;

describe('FichesScreen — insigne « REPRISE POSSIBLE » (#zone-a-reprendre-insigne)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'user-1', nom: 'Rakoto', prenom: 'Jean', email: 'jean@test.com', role: 'chef_equipe', actif: true } as any,
      token: 'token-test',
    });
    jest.mocked(prospectionAccueil.loadAccueilData).mockClear();
    jest.mocked(prospectionAccueil.loadMesProspectionsServeur).mockClear();
    jest.mocked(traitementRepository.listToutesTraitementsLocal).mockReset().mockResolvedValue([
      TRAITEMENT_AVEC_SURFACE_RESTANTE,
      TRAITEMENT_SANS_SURFACE_RESTANTE,
    ]);
    jest.mocked(traitementRepository.listReprenableTraitements).mockReset().mockResolvedValue([]);
  });

  it('porte l’insigne sur la fiche dont la surface restante justifie une reprise', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([TRAITEMENT_AVEC_SURFACE_RESTANTE]);

    await render(<FichesScreen />);

    expect(await screen.findByText('↻ REPRISE POSSIBLE')).toBeVisible();
  });

  it('ne porte aucun insigne quand aucune fiche n’est reprenable', async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockResolvedValue([]);

    await render(<FichesScreen />);

    await waitFor(() => expect(screen.getByText('Jean-Terrestre-2026-09-17')).toBeVisible());
    expect(screen.queryByText('↻ REPRISE POSSIBLE')).toBeNull();
  });

  it("n'affiche jamais de fiche ni d'erreur si la lecture des fiches reprenables échoue (purement informatif, best-effort)", async () => {
    jest.mocked(traitementRepository.listReprenableTraitements).mockRejectedValue(new Error('offline'));

    await render(<FichesScreen />);

    expect(await screen.findByText('Jean-Terrestre-2026-09-17')).toBeVisible();
    expect(screen.queryByText('↻ REPRISE POSSIBLE')).toBeNull();
  });
});
