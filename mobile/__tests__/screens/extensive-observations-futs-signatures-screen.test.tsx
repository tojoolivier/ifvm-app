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

// Consultant FAO/Pilote/Chef de Base : agents habilités proposés en chips
// (listUtilisateursByRole), même mécanisme que côté Traitement — cf. commentaire
// sur agentsPourRole dans l'écran.
jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn((role: string) => {
    if (role === 'pilote') return Promise.resolve([{ id: 'pilote-1', nom: 'Rakoto', prenom: 'Jean' }]);
    if (role === 'chef_de_base') return Promise.resolve([{ id: 'chef-1', nom: 'Rabe', prenom: 'Marie' }]);
    if (role === 'consultant_international') return Promise.resolve([{ id: 'consultant-1', nom: 'Smith', prenom: 'John' }]);
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

// SIGNATURE_ROLES = ['consultant_fao', 'pilote', 'chef_base'] dans l'écran —
// ordre de rendu des 3 blocs Signatures, donc des `getAllByText('VALIDER')[i]`
// ci-dessous.
const INDEX_CONSULTANT_FAO = 0;
const INDEX_PILOTE = 1;

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

describe('ExtensiveObservationsScreen — mode aérien : signatures numériques (Consultant FAO/Pilote/Chef de Base — agent habilité + tracé)', () => {
  it('sélectionner un agent affiche un pavé de signature ; VALIDER capture nom + tracé + horodatage et persiste immédiatement (pas seulement au clic sur Suivant)', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    // Chip issu de listUtilisateursByRole('pilote') (mocké en tête de fichier) —
    // choisir l'agent ne signe plus immédiatement : il désigne le signataire à
    // venir, le pavé de signature apparaît.
    const chipPilote = await screen.findByText('Jean Rakoto');
    fireEvent.press(chipPilote);

    const pad = await screen.findByTestId('signature-pad-pilote');
    fireEvent.press(pad);
    await settle();

    fireEvent.press(screen.getAllByText('VALIDER')[INDEX_PILOTE]);

    // Persisté dès VALIDER — avant même « Suivant : Récapitulatif ».
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signaturePiloteNom: 'Jean Rakoto',
          signaturePiloteHorodatage: expect.any(String),
          signaturePiloteImage: 'M0 0 L1 1',
        })
      )
    );
    expect(await screen.findByText(/^Signé à /)).toBeVisible();
    expect(screen.getAllByText('MODIFIER').length).toBeGreaterThan(0);
  });

  it('le bouton VALIDER reste désactivé tant qu’aucun tracé n’a été dessiné', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    const chipPilote = await screen.findByText('Jean Rakoto');
    fireEvent.press(chipPilote);
    await screen.findByTestId('signature-pad-pilote');

    const valider = screen.getAllByText('VALIDER')[INDEX_PILOTE];
    fireEvent.press(valider);
    await settle();

    // Le changement de personne invalide toute signature précédente tout de
    // suite ; le bouton désactivé ne crée toutefois aucun tracé numérique.
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signaturePiloteNom: 'Jean Rakoto',
          signaturePiloteImage: null,
          signaturePiloteHorodatage: null,
        })
      )
    );
  });

  it('restaure une signature déjà enregistrée (fiche rouverte) : affichage lecture seule + MODIFIER, pavé pré-rempli', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
        signature_pilote_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);

    expect(await screen.findByText('Jean Rakoto')).toBeVisible();
    expect(screen.getByTestId('signature-pad-pilote')).toHaveTextContent('trace:M9 9 L8 8');
    expect(screen.getByText(/^Signé à /)).toBeVisible();
    expect(screen.getAllByText('MODIFIER').length).toBeGreaterThan(0);
  });

  it('MODIFIER rouvre un pavé vierge puis VALIDER remplace correctement l’ancienne signature (jamais conservée par erreur)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
        signature_pilote_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Jean Rakoto');

    fireEvent.press(screen.getAllByText('MODIFIER')[0]);
    await settle();

    const pad = await screen.findByTestId('signature-pad-pilote');
    fireEvent.press(pad);
    await settle();
    fireEvent.press(screen.getAllByText('VALIDER')[INDEX_PILOTE]);

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signaturePiloteNom: 'Jean Rakoto',
          signaturePiloteImage: 'M0 0 L1 1',
        })
      )
    );
  });

  it('changer d’agent alors qu’une signature était déjà validée efface l’ancienne — jamais attribuée au nouveau signataire (§8)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
        signature_pilote_image: 'M9 9 L8 8',
      } as any,
      captures: [],
    });

    // Un second pilote habilité, distinct de celui déjà signé.
    const referentielDb = require('@/lib/referentiel-db');
    jest.mocked(referentielDb.listUtilisateursByRole).mockImplementation((role: string) => {
      if (role === 'pilote')
        return Promise.resolve([
          { id: 'pilote-1', nom: 'Rakoto', prenom: 'Jean' },
          { id: 'pilote-2', nom: 'Rabe', prenom: 'Paul' },
        ]);
      if (role === 'chef_de_base') return Promise.resolve([{ id: 'chef-1', nom: 'Rabe', prenom: 'Marie' }]);
      if (role === 'consultant_international') return Promise.resolve([{ id: 'consultant-1', nom: 'Smith', prenom: 'John' }]);
      return Promise.resolve([]);
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Jean Rakoto');
    // Signature initiale déjà là : mode lecture seule, pas de chip visible tant
    // que MODIFIER n'a pas été pressé.
    expect(screen.getByTestId('signature-pad-pilote')).toHaveTextContent('trace:M9 9 L8 8');
    expect(screen.queryByText('Paul Rabe')).toBeNull();

    fireEvent.press(screen.getAllByText('MODIFIER')[0]);
    await settle();

    const chipNouveauPilote = await screen.findByText('Paul Rabe');
    fireEvent.press(chipNouveauPilote);

    // L'ancienne signature (image + horodatage) est effacée immédiatement — le
    // pavé redevient éditable (vierge), plus de « Signé à » pour ce rôle.
    await waitFor(() => expect(screen.getByTestId('signature-pad-pilote')).toHaveTextContent('dessiner'));
    expect(screen.queryByText(/^Signé à /)).toBeNull();

    // Sans redessiner pour le nouveau signataire, « Suivant » ne doit jamais
    // envoyer l'ancien tracé sous le nouveau nom (§8).
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));
    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signaturePiloteNom: 'Paul Rabe',
          signaturePiloteImage: null,
          signaturePiloteHorodatage: null,
        })
      )
    );
  });

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

  it('le Consultant FAO utilise désormais le même référentiel (chip) que Pilote/Chef de Base — plus de saisie libre', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    expect(screen.queryByPlaceholderText('Nom du signataire')).toBeNull();
    const chipConsultant = await screen.findByText('John Smith');
    fireEvent.press(chipConsultant);
    await screen.findByTestId('signature-pad-consultant_fao');

    expect(screen.getAllByText('VALIDER')[INDEX_CONSULTANT_FAO]).toBeTruthy();
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
