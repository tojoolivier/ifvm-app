/**
 * Écran « Traitement » (migration 0046/0047, #Ticket 7, #equipe-slide-aerien) —
 * aérien uniquement. Chaque rotation porte désormais quantité + unité (L/kg), une
 * superficie traitée et des heures d'ouverture/fermeture de vanne ; le numéro de
 * cuve et les 3 durées ne sont jamais saisis, seulement affichés.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RotationsScreen from '@/app/(traitement)/rotations';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  addRotation: jest.fn().mockResolvedValue({}),
  deleteAllRotationsForTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienSurfaceRestante: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listPesticides: jest.fn().mockResolvedValue([
    { id: 'liquide', code: 'L1', nom: 'Fyfanon 440 ULV', matiere_active: null, dose_reference: '2 l/ha', type_produit: 'CHOC' },
    { id: 'poudre', code: 'P1', nom: 'Green Muscle', matiere_active: null, dose_reference: '200 g/ha', type_produit: 'CHOC' },
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

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
    id: 'trait-1',
    type_traitement: 'AERIEN',
    cible: { surface_infestee_ha: 100 },
    aerien: { surface_restante_abandonnee: false, rotations: [] },
  } as any);
  jest.mocked(traitementRepository.addRotation).mockClear().mockResolvedValue({} as any);
  jest.mocked(traitementRepository.deleteAllRotationsForTraitementAerien).mockClear().mockResolvedValue(undefined);
  jest.mocked(traitementRepository.updateTraitementAerienEfficacite).mockClear().mockResolvedValue({} as any);
  useTraitementCaptureStore.setState(RESET_STATE);
});

/** Laisse un vrai tick s'écouler entre une saisie et un `fireEvent.press` — un
 * `act(async () => {})` manuel imbriqué dans celui déjà posé par `fireEvent` casse
 * le suivi interne des scopes act() (leçon déjà tirée ailleurs dans ce dépôt). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('RotationsScreen — numéro de cuve et unité', () => {
  it('affiche un numéro de cuve non éditable (1, 2, …), incrémenté à l’ajout d’une rotation', async () => {
    await render(<RotationsScreen />);

    // Une rotation vide est amorcée automatiquement (fiche neuve, aucune rotation).
    // testID plutôt qu'un texte : "1" collide avec d'autres valeurs affichées (ex.
    // Nb rotations) dès qu'il n'y a qu'une rotation.
    expect(await screen.findByTestId('rotation-numero-cuve-0')).toHaveTextContent('1');
    expect(screen.queryByTestId('rotation-numero-cuve-1')).toBeNull();

    fireEvent.press(screen.getByText('+ Ajouter une rotation'));

    expect(await screen.findByTestId('rotation-numero-cuve-1')).toHaveTextContent('2');
    // Jamais un champ de saisie : ni placeholder, ni testID d'input pour ce champ.
    expect(screen.queryByPlaceholderText('Ex. 1')).toBeNull();
  });
});

describe('RotationsScreen — unité L/kg et cumuls séparés', () => {
  it('cumule les rotations en L et en kg dans deux totaux distincts', async () => {
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.changeText(screen.getByTestId('rotation-quantite-input-0'), '10');
    await waitFor(() => expect(screen.getByTestId('rotation-quantite-input-0').props.value).toBe('10'));

    expect(await screen.findByText('Total pesticide (l)')).toBeVisible();
    expect(screen.getByText('10')).toBeVisible();

    fireEvent.press(screen.getByText('Kilos (kg)'));
    await waitFor(() =>
      expect(screen.getByText('Kilos (kg)').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    // La quantité bascule du total L vers le total kg une fois l'unité changée.
    await waitFor(() => {
      const totalKg = screen.getAllByText('10');
      expect(totalKg.length).toBeGreaterThan(0);
    });
  });
});

describe('RotationsScreen — durées calculées (jamais saisies)', () => {
  it('affiche les 3 durées dérivées des heures déjà renseignées', async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: {
        rotations: [
          {
            localId: 'r1',
            produit_id: null,
            quantite: 10,
            unite: 'L',
            surface_ha: 5,
            heure_debut: '06:00',
            heure_fin: '06:30',
            heure_ouverture_vanne: '06:05',
            heure_fermeture_vanne: '06:15',
          },
        ],
      },
    });

    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    expect(await screen.findByText('00:10')).toBeVisible(); // application (06:05 -> 06:15)
    expect(screen.getByText('00:30')).toBeVisible(); // totale (06:00 -> 06:30)
    expect(screen.getByText('00:20')).toBeVisible(); // mise en place (30 - 10)
  });
});

describe('RotationsScreen — validation des heures de vanne', () => {
  it('bloque « Continuer » si la fermeture de vanne précède l’ouverture, sans enregistrer', async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: {
        rotations: [
          {
            localId: 'r1',
            produit_id: 'p1',
            quantite: 10,
            unite: 'L',
            surface_ha: 5,
            heure_debut: '06:00',
            heure_fin: '06:30',
            heure_ouverture_vanne: '06:20',
            heure_fermeture_vanne: '06:10',
          },
        ],
      },
    });

    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText(/fermeture de vanne/)).toBeVisible();
    expect(traitementRepository.addRotation).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('enregistre chaque rotation puis poursuit vers Moyens quand les heures sont valides', async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: {
        rotations: [
          {
            localId: 'r1',
            produit_id: 'p1',
            quantite: 10,
            unite: 'L',
            surface_ha: 5,
            heure_debut: '06:00',
            heure_fin: '06:30',
            heure_ouverture_vanne: '06:05',
            heure_fermeture_vanne: '06:20',
          },
        ],
      },
    });

    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.addRotation).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ produit_id: 'p1', quantite: 10, unite: 'L', surface_ha: 5 })
      )
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(traitement)/moyens' })
      )
    );
  });

  it('purge les rotations déjà enregistrées avant de repousser la liste actuelle, pour ne pas les dupliquer à un nouveau passage sur cet écran (#persistance-fiches-traitement)', async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: {
        rotations: [
          {
            localId: 'r1',
            produit_id: 'p1',
            quantite: 10,
            unite: 'L',
            surface_ha: 5,
            heure_debut: '06:00',
            heure_fin: '06:30',
            heure_ouverture_vanne: '06:05',
            heure_fermeture_vanne: '06:20',
          },
        ],
      },
    });
    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.deleteAllRotationsForTraitementAerien).toHaveBeenCalledWith('trait-1')
    );
    const ordrePurge = jest.mocked(traitementRepository.deleteAllRotationsForTraitementAerien).mock
      .invocationCallOrder[0];
    const ordreAjout = jest.mocked(traitementRepository.addRotation).mock.invocationCallOrder[0];
    expect(ordrePurge).toBeLessThan(ordreAjout);
  });
});

describe('RotationsScreen — unité automatique selon le produit', () => {
  it("pose « Kilos (kg) » pour un produit en poudre", async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: { rotations: [{ localId: 'r1', produit_id: 'poudre', quantite: 10, unite: 'L', surface_ha: 5 }] },
    });

    await render(<RotationsScreen />);

    expect(await screen.findByTestId('rotation-unite-auto-0')).toHaveTextContent('Kilos (kg)');
    expect(useTraitementCaptureStore.getState().aerien.rotations[0].unite).toBe('kg');
  });

  it("garde « Litres (L) » pour un produit liquide", async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: { rotations: [{ localId: 'r1', produit_id: 'liquide', quantite: 10, unite: 'L', surface_ha: 5 }] },
    });

    await render(<RotationsScreen />);

    expect(await screen.findByTestId('rotation-unite-auto-0')).toHaveTextContent('Litres (L)');
  });
});

describe('RotationsScreen — surface restante abandonnée ? (comme le Terrestre)', () => {
  const rotationsRestante = {
    ...RESET_STATE,
    aerien: { rotations: [{ localId: 'r1', produit_id: 'liquide', quantite: 10, unite: 'L' as const, surface_ha: 5 }] },
  };

  beforeEach(() => {
    jest.mocked(traitementRepository.updateTraitementAerienSurfaceRestante).mockClear();
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: { rotations: [] },
    } as any);
  });

  it("bloque « Continuer » tant que la surface restante n'est pas tranchée", async () => {
    useTraitementCaptureStore.setState(rotationsRestante);
    await render(<RotationsScreen />);
    await screen.findByText('Surface restante abandonnée ?');
    await settle(); // laisse l'hydratation asynchrone de la fiche finir avant toute saisie

    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText('Vous devez indiquer si la surface restante est abandonnée')).toBeVisible();
    expect(traitementRepository.updateTraitementAerienSurfaceRestante).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("exige un motif quand la surface restante est abandonnée", async () => {
    useTraitementCaptureStore.setState(rotationsRestante);
    await render(<RotationsScreen />);
    await screen.findByText('Surface restante abandonnée ?');
    await settle(); // laisse l'hydratation asynchrone de la fiche finir avant toute saisie

    fireEvent.press(screen.getByText('Oui'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText("Le motif d'abandon est obligatoire")).toBeVisible();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("enregistre la décision (abandon + motif) puis poursuit", async () => {
    useTraitementCaptureStore.setState(rotationsRestante);
    await render(<RotationsScreen />);
    await screen.findByText('Surface restante abandonnée ?');
    await settle(); // laisse l'hydratation asynchrone de la fiche finir avant toute saisie

    fireEvent.press(screen.getByText('Oui'));
    await settle();
    fireEvent.changeText(screen.getByTestId('motif-abandon-input'), 'Zone inaccessible');
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerienSurfaceRestante).toHaveBeenCalledWith('trait-1', {
        abandonnee: true,
        motif: 'Zone inaccessible',
      })
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });

  it("n'affiche pas le choix quand il ne reste aucune surface à traiter", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 5 },
      aerien: { rotations: [] },
    } as any);
    useTraitementCaptureStore.setState(rotationsRestante);

    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');

    expect(screen.queryByText('Surface restante abandonnée ?')).toBeNull();
  });
});
