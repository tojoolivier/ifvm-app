/**
 * Écran « Signatures » (#signatures-auto-equipe) — les noms des signataires
 * sont résolus automatiquement depuis « Équipe » (pilote/mécanicien/consultant
 * en texte libre, chef de base via le référentiel), plus de saisie manuelle.
 * Chaque signature tracée est persistée localement (SQLite) dès « VALIDER »,
 * pas seulement dans le state de l'écran.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignaturesScreen from '@/app/(traitement)/signatures';
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
  saveSignatureLocal: jest.fn().mockResolvedValue(undefined),
  clearSignatureLocal: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockImplementation((role: string) => {
    if (role === 'chef_de_base') return Promise.resolve([{ id: 'chef-1', nom: 'Ravelo', prenom: 'Sarah' }]);
    return Promise.resolve([]);
  }),
}));

/**
 * `SignaturePad` s'appuie sur `PanResponder` (gestes tactiles bruts) — hors de
 * portée d'une simulation RNTL fidèle. Remplacement qui respecte le contrat du
 * vrai composant (`value`/`onChange`/`readOnly`/`testID`) : un bouton pressable
 * simule un tracé complet en un geste, comme le Picker mocké ailleurs dans ce
 * dépôt (extensive-reference.tsx, traitement-equipe-screen.test.tsx).
 */
jest.mock('@/components/traitement/SignaturePad', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  function SignaturePad({ value, onChange, readOnly, testID }: any) {
    if (readOnly) {
      return <Text testID={testID}>{`trace:${value}`}</Text>;
    }
    return (
      <TouchableOpacity testID={testID} onPress={() => onChange('M0 0 L1 1')}>
        <Text>dessiner</Text>
      </TouchableOpacity>
    );
  }
  return { SignaturePad };
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const RESET_STATE = {
  screen: 'reference' as const,
  isValidationView: false,
  typeTraitement: 'AERIEN' as const,
  ref: {},
  aerien: {
    rotations: [],
    pilote: 'Jean Dupont',
    mecanicien: 'Marc Rabe',
    chefDeBaseId: 'chef-1',
    consultantInternational: 'John Smith',
  },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

function draftAerien(signatures: any[] = []) {
  return {
    id: 'trait-1',
    type_traitement: 'AERIEN',
    aerien: { rotations: [] },
    terrestre: null,
    signatures,
  } as any;
}

beforeEach(() => {
  mockPush.mockClear();
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draftAerien());
  jest.mocked(traitementRepository.saveSignatureLocal).mockClear().mockResolvedValue(undefined);
  jest.mocked(traitementRepository.clearSignatureLocal).mockClear().mockResolvedValue(undefined);
  useTraitementCaptureStore.setState(RESET_STATE);
});

describe('SignaturesScreen — noms résolus automatiquement depuis Équipe', () => {
  it('affiche pilote/mécanicien/consultant (texte libre) et chef de base (référentiel), sans aucune saisie manuelle de nom', async () => {
    await render(<SignaturesScreen />);

    expect(await screen.findByText('Jean Dupont')).toBeVisible();
    expect(screen.getByText('Marc Rabe')).toBeVisible();
    expect(screen.getByText('Sarah Ravelo')).toBeVisible();
    expect(screen.getByText('John Smith')).toBeVisible();

    // Plus de champ de saisie libre pour le nom du signataire (ancien comportement).
    expect(screen.queryByPlaceholderText('Nom du signataire')).toBeNull();
  });

  it("n'affiche pas de signature à fournir pour le consultant s'il est absent de Équipe", async () => {
    useTraitementCaptureStore.setState({
      ...RESET_STATE,
      aerien: { ...RESET_STATE.aerien, consultantInternational: null },
    });

    await render(<SignaturesScreen />);
    await screen.findByText('Jean Dupont');

    expect(screen.queryByText('Consultant international')).toBeNull();
  });
});

describe('SignaturesScreen — VALIDER persiste réellement la signature (pas un state React local)', () => {
  it('dessine puis VALIDER appelle saveSignatureLocal avec le nom résolu et le tracé', async () => {
    await render(<SignaturesScreen />);
    await screen.findByText('Jean Dupont');

    fireEvent.press(screen.getByTestId('signature-pad-PILOTE'));
    await settle();
    fireEvent.press(screen.getAllByText('VALIDER')[0]);

    await waitFor(() =>
      expect(traitementRepository.saveSignatureLocal).toHaveBeenCalledWith(
        'trait-1',
        'PILOTE',
        'Jean Dupont',
        'M0 0 L1 1'
      )
    );
  });

  it('le bouton VALIDER reste désactivé tant que rien n’a été tracé', async () => {
    await render(<SignaturesScreen />);
    await screen.findByText('Jean Dupont');

    fireEvent.press(screen.getAllByText('VALIDER')[0]);
    await settle();

    expect(traitementRepository.saveSignatureLocal).not.toHaveBeenCalled();
  });
});

describe('SignaturesScreen — signature déjà enregistrée : MODIFIER plutôt que ressaisir', () => {
  it('affiche « Signature enregistrée » et un bouton MODIFIER pour un rôle déjà signé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAerien([
        { id: 's1', traitement_id: 'trait-1', role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M9 9 L8 8', horodatage: '2026-08-26T00:00:00Z' },
      ])
    );

    await render(<SignaturesScreen />);

    expect(await screen.findByText('Signature enregistrée')).toBeVisible();
    expect(screen.getByText('MODIFIER')).toBeVisible();
    expect(screen.getByTestId('signature-pad-PILOTE')).toHaveTextContent('trace:M9 9 L8 8');
  });

  it('MODIFIER rouvre un pavé vierge, puis VALIDER réenregistre la nouvelle signature', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAerien([
        { id: 's1', traitement_id: 'trait-1', role: 'PILOTE', signataire_nom: 'Jean Dupont', signature_image: 'M9 9 L8 8', horodatage: '2026-08-26T00:00:00Z' },
      ])
    );

    await render(<SignaturesScreen />);
    await screen.findByText('MODIFIER');

    fireEvent.press(screen.getByText('MODIFIER'));
    await settle();

    fireEvent.press(screen.getByTestId('signature-pad-PILOTE'));
    await settle();
    fireEvent.press(screen.getAllByText('VALIDER')[0]);

    await waitFor(() =>
      expect(traitementRepository.saveSignatureLocal).toHaveBeenCalledWith(
        'trait-1',
        'PILOTE',
        'Jean Dupont',
        'M0 0 L1 1'
      )
    );
  });
});

describe('SignaturesScreen — invalidation automatique (#signatures-auto-equipe §8)', () => {
  it('efface une signature devenue caduque quand le nom résolu depuis Équipe a changé', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draftAerien([
        { id: 's1', traitement_id: 'trait-1', role: 'PILOTE', signataire_nom: 'Ancien Nom', signature_image: 'M9 9 L8 8', horodatage: '2026-08-26T00:00:00Z' },
      ])
    );

    await render(<SignaturesScreen />);
    await screen.findByText('Jean Dupont');

    await waitFor(() =>
      expect(traitementRepository.clearSignatureLocal).toHaveBeenCalledWith('trait-1', 'PILOTE')
    );
    // Le rôle redevient « à signer », plus de bouton MODIFIER pour ce pilote caduc.
    expect(screen.queryByText('Signature enregistrée')).toBeNull();
  });
});
