/**
 * Mode aérien — Nombre de fûts (validation) + Signatures. Voir
 * `extensive-observations-pesticides-signatures-screen.test.tsx` pour le bloc
 * OUI/NON et l'affichage dynamique ; ces tests-ci vivent dans un fichier séparé
 * pour la même raison (contention de ressources déjà documentée pour d'autres
 * suites d'écran de ce dépôt — chaque test passe seul, mais s'accumuler dans un
 * même fichier provoquait des timeouts `findByText` à partir d'un certain nombre
 * de montages de cet écran).
 *
 * Ordre des tests délibéré : un test qui enchaîne ≥ 2 `fireEvent.changeText`
 * sur des champs contrôlés distincts dans le même test laisse l'environnement
 * de test dans un état qui fait échouer le rendu du test suivant (reproduit de
 * façon déterministe, indépendant du contenu de ce test suivant) — le seul test
 * de ce fichier qui saisit 4 champs (« accepte 10/6/4/5 ») est donc placé en
 * dernier, après tous les tests à 0 ou 1 saisie.
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveObservationsScreen from '@/app/(prospection)/extensive-observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveObservations: jest.fn().mockResolvedValue({ id: 'draft-123', mode_extensif: 'aerien' }),
  // Vraie implémentation (pas de mock utile ici) : l'écran en dépend pour
  // normaliser `pesticides_embarques` (0/1/null en SQLite).
  normalizeBoolean: (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return null;
  },
}));

// Chef de Base seul reste sur les agents habilités proposés en chips
// (listUtilisateursByRole), même mécanisme que côté Traitement. Consultant FAO
// (saisie libre) n'en a pas besoin (#consultant-fao-pilote-auto) ; Pilote n'est
// plus un rôle de ce slide du tout.
jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn((role: string) => {
    if (role === 'chef_de_base') return Promise.resolve([{ id: 'chef-1', nom: 'Rabe', prenom: 'Marie' }]);
    return Promise.resolve([]);
  }),
}));

/**
 * `SignaturePad` s'appuie sur `PanResponder` (gestes tactiles bruts) — hors de
 * portée d'une simulation RNTL fidèle. Même remplacement que
 * traitement-signatures-screen.test.tsx : un bouton pressable simule un tracé
 * complet en un geste, en respectant le contrat réel (`value`/`onChange`/
 * `readOnly`/`testID`).
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

beforeEach(() => {
  // `mode_extensif: 'aerien'` conservé dans la valeur simulée : la vraie fonction
  // relit la ligne complète (`SELECT *`) après l'UPDATE, qui ne touche pas cette
  // colonne — un mock qui l'omettrait ferait passer `isAerien` à `false` juste
  // après l'enregistrement et démonterait le bloc aérien en plein test.
  jest.mocked(prospectionRepository.updateProspectionExtensiveObservations).mockClear().mockResolvedValue({
    id: 'draft-123',
    mode_extensif: 'aerien',
  } as any);
  useProspectionWizardStore.setState({ draft: null, captures: [] });
});

describe('ExtensiveObservationsScreen — mode aérien : nombre de fûts (validation)', () => {
  it('une saisie invalide (négative/non entière) bloque avec un message clair, ne sauvegarde pas', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Pesticides Embarqués');
    fireEvent.press(screen.getByText('Oui'));
    await screen.findByText('Nombre de fûts');

    fireEvent.changeText(screen.getByTestId('futs-disponible-input'), '-1');
    expect(await screen.findByDisplayValue('-1')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    expect(alertSpy).toHaveBeenCalledWith('Nombre de fûts invalide', expect.stringContaining('Fûts disponibles'));
    expect(prospectionRepository.updateProspectionExtensiveObservations).not.toHaveBeenCalled();
  });
});

// SIGNATURE_ROLES = ['consultant_fao', 'chef_base'] dans l'écran — ordre de
// rendu des 2 blocs Signatures (Pilote retiré), donc des
// `getAllByText('VALIDER')[i]` ci-dessous.
const INDEX_CONSULTANT_FAO = 0;

describe('ExtensiveObservationsScreen — VISA retiré', () => {
  it('n’affiche plus VISA nulle part sur cet écran', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    expect(screen.queryByText('VISA')).toBeNull();
  });
});

/**
 * Pilote est retiré du slide Signatures (même principe que VISA ci-dessus) —
 * son nom continue d'être saisi sur Référence (`draft.pilote`), sans lien avec
 * une signature ici. Les colonnes `signature_pilote_*` restent en base pour
 * l'historique déjà enregistré (cf. `buildPayload`, qui les renvoie telles
 * quelles) mais ne sont plus lues/écrites depuis cet écran.
 */
describe('ExtensiveObservationsScreen — Pilote retiré des Signatures', () => {
  it('n’affiche plus aucune ligne Pilote parmi les Signatures', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien', pilote: 'Jean Rakoto' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    expect(screen.queryByText('Pilote')).toBeNull();
    expect(screen.queryByTestId('signature-pad-pilote')).toBeNull();
  });

  it('« Suivant » renvoie les colonnes signature_pilote_* telles qu’enregistrées, sans y toucher', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        pilote: 'Jean Rakoto',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
        signature_pilote_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signaturePiloteNom: 'Jean Rakoto',
          signaturePiloteHorodatage: '2026-09-01T09:10:00.000Z',
          signaturePiloteImage: 'M9 9 L8 8',
        })
      )
    );
  });
});

describe('ExtensiveObservationsScreen — régression fiche terrestre', () => {
  it('une ancienne fiche terrestre déjà enregistrée continue de s’ouvrir sans erreur (colonnes NULL)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: null,
        pesticides_embarques: null,
      } as any,
      captures: [],
    });

    await expect(render(<ExtensiveObservationsScreen />)).resolves.toBeTruthy();
    expect(await screen.findByText('Verdure strate herbeuse')).toBeVisible();
  });
});

describe('ExtensiveObservationsScreen — mode aérien : Consultant FAO en saisie libre (#consultant-fao-pilote-auto)', () => {
  it('permet de saisir librement le nom du Consultant FAO, sans chip à choisir', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    fireEvent.changeText(screen.getByTestId('signature-consultant-fao-nom-input'), 'John Smith');
    await settle();

    expect(await screen.findByTestId('signature-pad-consultant_fao')).toBeTruthy();
    expect(screen.getAllByText('VALIDER')[INDEX_CONSULTANT_FAO]).toBeTruthy();
  });

  it('Consultant FAO facultatif : « Suivant » fonctionne sans qu’aucune signature ne soit exigée pour ce rôle', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    // Aucune interaction avec la ligne Consultant FAO — seul « Suivant » est pressé.
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureConsultantFaoNom: null,
          signatureConsultantFaoImage: null,
          signatureConsultantFaoHorodatage: null,
        })
      )
    );
  });

  it('signer capture le nom saisi + le tracé + l’horodatage, et persiste immédiatement', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    fireEvent.changeText(screen.getByTestId('signature-consultant-fao-nom-input'), 'John Smith');
    await settle();
    const pad = await screen.findByTestId('signature-pad-consultant_fao');
    fireEvent.press(pad);
    await settle();
    fireEvent.press(screen.getAllByText('VALIDER')[INDEX_CONSULTANT_FAO]);

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureConsultantFaoNom: 'John Smith',
          signatureConsultantFaoHorodatage: expect.any(String),
          signatureConsultantFaoImage: 'M0 0 L1 1',
        })
      )
    );
    expect(await screen.findByText(/^Signé à /)).toBeVisible();
  });

  it('restaure le nom et la signature déjà enregistrés (fiche rouverte)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_consultant_fao_nom: 'John Smith',
        signature_consultant_fao_horodatage: '2026-09-01T09:10:00.000Z',
        signature_consultant_fao_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);

    expect(await screen.findByText('John Smith')).toBeVisible();
    expect(screen.getByTestId('signature-pad-consultant_fao')).toHaveTextContent('trace:M9 9 L8 8');
    expect(screen.getByText(/^Signé à /)).toBeVisible();
  });

  it('changer le nom du Consultant FAO alors qu’une signature était déjà validée efface l’ancienne — jamais attribuée à quelqu’un d’autre (§1)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_consultant_fao_nom: 'John Smith',
        signature_consultant_fao_horodatage: '2026-09-01T09:10:00.000Z',
        signature_consultant_fao_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('John Smith');
    expect(screen.getByTestId('signature-pad-consultant_fao')).toHaveTextContent('trace:M9 9 L8 8');

    fireEvent.press(screen.getAllByText('MODIFIER')[0]);
    await settle();

    const input = await screen.findByTestId('signature-consultant-fao-nom-input');
    fireEvent.changeText(input, 'Alice Dupont');
    await settle();

    // L'ancienne signature (image + horodatage) est effacée immédiatement.
    await waitFor(() => expect(screen.getByTestId('signature-pad-consultant_fao')).toHaveTextContent('dessiner'));
    expect(screen.queryByText(/^Signé à /)).toBeNull();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureConsultantFaoNom: 'Alice Dupont',
          signatureConsultantFaoImage: null,
          signatureConsultantFaoHorodatage: null,
        })
      )
    );
  });
});

describe('ExtensiveObservationsScreen — mode aérien : nombre de fûts (valeurs)', () => {
  /**
   * Valeurs de test explicitement demandées : Disponible=10, Pleins=6, Vides=4,
   * Reçues=5. Dernier test du fichier — cf. commentaire d'en-tête.
   */
  it('accepte 10/6/4/5 (entiers non-négatifs) et les sauvegarde tels quels', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Pesticides Embarqués');
    fireEvent.press(screen.getByText('Oui'));
    await screen.findByText('Nombre de fûts');

    fireEvent.changeText(screen.getByTestId('futs-disponible-input'), '10');
    fireEvent.changeText(screen.getByTestId('futs-pleins-input'), '6');
    fireEvent.changeText(screen.getByTestId('futs-vides-input'), '4');
    fireEvent.changeText(screen.getByTestId('futs-recues-input'), '5');
    expect(await screen.findByDisplayValue('5')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          futsDisponible: 10,
          futsPleins: 6,
          futsVides: 4,
          futsRecues: 5,
        })
      )
    );
  });
});
