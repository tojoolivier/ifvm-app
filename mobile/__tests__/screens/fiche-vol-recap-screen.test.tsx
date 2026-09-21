/**
 * Écran des vols d'une fiche de vol (#fiche-vol-vols-du-jour) — chaque vol choisit son
 * type puis son rattachement du jour : une fiche de prospection pour un vol PROSPECTION,
 * un traitement aérien puis sa cuve (rotation) pour un vol MEP/APPLICATION. Une même fiche
 * mêle librement les deux (journée de prospection ET de traitement aérien).
 *
 * `ProspectionValideeField` et `TraitementAerienDuJourField` sont rendus pour de vrai (seul
 * `apiClient` est simulé) : le test vérifie le câblage écran ↔ champs, pas seulement l'écran.
 * `TimeField` (sélecteur natif) et `SignaturePad` (canvas) sont simulés.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheVolRecapScreen from '@/app/(fiche-vol)/recap';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

// `useFocusEffect` exige un vrai NavigationContainer : `useEffect(effect, [])` en tient lieu
// (cf. base-aerienne-field.test.tsx).
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'fiche-1' }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    getFicheVol: jest.fn(),
    listTraitements: jest.fn(),
    listProspections: jest.fn(),
    addVolFicheVol: jest.fn(),
  },
}));

// Chaque appui sur un champ d'heure dépile la valeur suivante (début, puis fin).
let mockHeures: string[] = [];
jest.mock('@/components/TimeField', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    TimeField: ({ value, onChange }: { value: string | null; onChange: (hhmm: string) => void }) => (
      <TouchableOpacity onPress={() => onChange(mockHeures.shift() as string)}>
        <Text>{`[mock] heure ${value ?? 'vide'}`}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/traitement/SignaturePad', () => ({ SignaturePad: () => null }));

const PROSPECTION = {
  id: 'p-1',
  n_fiche: 'F-001',
  n_message: null,
  date_prospection: '2026-09-21',
  validated_at: null,
  region: 'Atsimo-Andrefana',
  district: 'Betioky',
  commune: 'Ankazomanga',
};

const TRAITEMENT = {
  id: 't-1',
  numero_fiche: 'CRT-042',
  localite: 'Betioky',
  type_traitement: 'AERIEN',
  date_traitement: '2026-09-21',
  cible: null,
  aerien: {
    rotations: [
      {
        id: 'r-1',
        numero: 1,
        numero_cuve: '1',
        nom_commercial: 'Fyfanon',
        quantite: 100,
        unite: 'L',
        heure_debut: '06:30:00',
        heure_fin: '06:45:00',
        temperature_debut_c: 22,
        temperature_fin_c: 24,
        vent_debut_ms: 2,
        vent_fin_ms: 3,
      },
    ],
    blocs: [],
  },
};

const FICHE_VIDE = {
  id: 'fiche-1',
  numero_fiche: 'FV-001',
  statut: 'brouillon',
  date_vol: '2026-09-21',
  prospection_id: null,
  chef_de_base_id: 'chef-1',
  pilote: 'Jean Rakoto',
  mecanicien: 'Paul Andria',
  consultant_international: null,
  vols: [],
  signatures: [],
};

/** `addVolFicheVol` renvoie la fiche mise à jour : on accumule les vols envoyés. */
function simulerAjoutsDeVols(fiche: Record<string, any>) {
  let courante = fiche;
  jest.mocked(apiClient.addVolFicheVol).mockImplementation(async (_token, _id, payload: any) => {
    courante = {
      ...courante,
      vols: [
        ...courante.vols,
        {
          id: `vol-${payload.numero}`,
          numero: payload.numero,
          type_vol: payload.type_vol,
          heure_debut: `${payload.heure_debut}:00`,
          heure_fin: `${payload.heure_fin}:00`,
          duree_minutes: 60,
          rotation_id: payload.rotation_id,
          numero_cuve: payload.rotation_id ? '1' : null,
          produit_nom: payload.rotation_id ? 'Fyfanon' : null,
        },
      ],
    };
    return courante as any;
  });
}

async function saisirHeures() {
  mockHeures = ['08:00', '09:00'];
  await fireEvent.press(screen.getAllByText(/^\[mock\] heure/)[0]);
  await fireEvent.press(screen.getAllByText(/^\[mock\] heure/)[1]);
}

// Les libellés de type existent deux fois (puce du formulaire, puis récap des durées) :
// la puce vient d'abord dans l'arbre.
const puceType = (label: string) => screen.getAllByText(label)[0];

describe('FicheVolRecapScreen — vols du jour', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test', user: { role: 'chef_de_base' } as any });
    jest.mocked(apiClient.getFicheVol).mockReset().mockResolvedValue(FICHE_VIDE as any);
    jest.mocked(apiClient.listTraitements).mockReset().mockResolvedValue([TRAITEMENT] as any);
    jest.mocked(apiClient.listProspections).mockReset().mockResolvedValue([PROSPECTION] as any);
    jest.mocked(apiClient.addVolFicheVol).mockReset();
  });

  it('une même fiche reçoit un vol de prospection puis un vol de traitement (journée mixte)', async () => {
    simulerAjoutsDeVols(FICHE_VIDE);
    await render(<FicheVolRecapScreen />);
    await screen.findByText('Vols de la journée');

    // 1) vol PROSPECTION : la fiche de prospection de la date du vol
    await fireEvent.press(puceType('Prospection'));
    await saisirHeures();
    await fireEvent.press(await screen.findByText(/F-001/));
    expect(apiClient.listProspections).toHaveBeenCalledWith('token-test', { date_prospection: '2026-09-21' });
    await fireEvent.press(screen.getByText('+ Ajouter le vol'));

    await waitFor(() =>
      expect(apiClient.addVolFicheVol).toHaveBeenNthCalledWith(1, 'token-test', 'fiche-1', {
        numero: 1,
        type_vol: 'PROSPECTION',
        heure_debut: '08:00',
        heure_fin: '09:00',
        rotation_id: null,
        prospection_id: 'p-1',
      })
    );
    await screen.findByText('V1 · Prospection');

    // 2) vol MEP : le traitement aérien de la même date, puis sa cuve
    await fireEvent.press(puceType('Mise en place'));
    await saisirHeures();
    await fireEvent.press(await screen.findByText('CRT-042 · Betioky'));
    expect(apiClient.listTraitements).toHaveBeenCalledWith('token-test', {
      type_traitement: 'AERIEN',
      date_traitement: '2026-09-21',
    });
    await fireEvent.press(await screen.findByText('Cuve 1 · Fyfanon'));
    await fireEvent.press(screen.getByText('+ Ajouter le vol'));

    await waitFor(() =>
      expect(apiClient.addVolFicheVol).toHaveBeenNthCalledWith(2, 'token-test', 'fiche-1', {
        numero: 2,
        type_vol: 'MEP',
        heure_debut: '08:00',
        heure_fin: '09:00',
        rotation_id: 'r-1',
        prospection_id: null,
      })
    );

    // Les deux types coexistent sur la fiche, la cuve du vol de traitement est affichée.
    expect(await screen.findByText('V2 · Mise en place')).toBeTruthy();
    expect(screen.getByText('V1 · Prospection')).toBeTruthy();
    expect(screen.getByText(/09:00 · 01:00 · Cuve 1 · Fyfanon/)).toBeTruthy();
  });

  it("grise la cuve déjà prise par un vol du même type, mais la propose pour l'autre type", async () => {
    const ficheAvecMep = {
      ...FICHE_VIDE,
      vols: [
        {
          id: 'vol-1',
          numero: 1,
          type_vol: 'MEP',
          heure_debut: '06:00:00',
          heure_fin: '07:00:00',
          duree_minutes: 60,
          rotation_id: 'r-1',
          numero_cuve: '1',
          produit_nom: 'Fyfanon',
        },
      ],
    };
    jest.mocked(apiClient.getFicheVol).mockResolvedValue(ficheAvecMep as any);
    simulerAjoutsDeVols(ficheAvecMep);
    await render(<FicheVolRecapScreen />);
    await screen.findByText('Vols de la journée');

    // MEP : la cuve 1 a déjà sa mise en place → non sélectionnable
    await fireEvent.press(puceType('Mise en place'));
    await fireEvent.press(await screen.findByText('CRT-042 · Betioky'));
    await fireEvent.press(await screen.findByText('Cuve 1 · Fyfanon (déjà prise)'));
    await saisirHeures();
    await fireEvent.press(screen.getByText('+ Ajouter le vol'));
    await waitFor(() =>
      expect(apiClient.addVolFicheVol).toHaveBeenCalledWith(
        'token-test',
        'fiche-1',
        expect.objectContaining({ type_vol: 'MEP', rotation_id: null })
      )
    );

    // APPLICATION : une rotation = une MEP + une application → la cuve 1 est libre
    await fireEvent.press(puceType('Application'));
    expect(await screen.findByText('Cuve 1 · Fyfanon')).toBeTruthy();
    expect(screen.queryByText('Cuve 1 · Fyfanon (déjà prise)')).toBeNull();
  });
});
