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

// Pilote/Chef de Base : agents habilités proposés en chips (listUtilisateursByRole),
// même mécanisme que côté Traitement — cf. commentaire sur agentsPourRole dans l'écran.
jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn((role: string) => {
    if (role === 'pilote') return Promise.resolve([{ id: 'pilote-1', nom: 'Rakoto', prenom: 'Jean' }]);
    if (role === 'chef_de_base') return Promise.resolve([{ id: 'chef-1', nom: 'Rabe', prenom: 'Marie' }]);
    return Promise.resolve([]);
  }),
}));

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

describe('ExtensiveObservationsScreen — mode aérien : signatures (VISA/Consultant FAO — texte libre)', () => {
  it('« Signer » capture le nom et un horodatage, verrouille le champ', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    // VISA et Consultant FAO (seuls rôles sans agent habilité référencé — cf.
    // agentsPourRole) partagent le même placeholder tant qu'aucun n'est signé ;
    // VISA est le premier (index 0).
    fireEvent.changeText(screen.getAllByPlaceholderText('Nom du signataire')[0], 'Rakoto V.');
    // Flush explicite avant Signer : sans lui, le bouton lirait une fermeture
    // (closure) où `signatureDraftNoms` n'a pas encore la saisie (même classe de
    // piège que les autres champs de cet écran — cf. commentaires plus haut).
    expect(await screen.findByDisplayValue('Rakoto V.')).toBeVisible();
    fireEvent.press(screen.getAllByText('Signer')[0]);

    expect(await screen.findByText('Rakoto V.')).toBeVisible();
    expect(screen.getAllByText('✓ Signé').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ signatureVisaNom: 'Rakoto V.', signatureVisaHorodatage: expect.any(String) })
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
        signature_visa_nom: null,
      } as any,
      captures: [],
    });

    await expect(render(<ExtensiveObservationsScreen />)).resolves.toBeTruthy();
    expect(await screen.findByText('Verdure strate herbeuse')).toBeVisible();
  });
});

describe('ExtensiveObservationsScreen — mode aérien : signatures (Pilote/Chef de Base — agent habilité)', () => {
  it('sélectionner un agent dans la liste signe immédiatement (nom + horodatage), sans bouton « Signer »', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Signatures');

    // Chip issu de listUtilisateursByRole('pilote') (mocké en tête de fichier) —
    // aucun champ texte ni bouton « Signer » pour ce rôle.
    const chipPilote = await screen.findByText('Jean Rakoto');
    fireEvent.press(chipPilote);

    await waitFor(() =>
      expect(chipPilote.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]))
    );
    expect(await screen.findByText(/^Signé à /)).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ signaturePiloteNom: 'Jean Rakoto', signaturePiloteHorodatage: expect.any(String) })
      )
    );
  });

  it('restaure une signature déjà enregistrée (fiche rouverte) : le chip de l’agent est actif', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        mode_extensif: 'aerien',
        signature_pilote_nom: 'Jean Rakoto',
        signature_pilote_horodatage: '2026-09-01T09:10:00.000Z',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);

    const chipPilote = await screen.findByText('Jean Rakoto');
    expect(chipPilote).toBeVisible();
    expect(chipPilote.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]));
    expect(screen.getByText(/^Signé à /)).toBeVisible();
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
