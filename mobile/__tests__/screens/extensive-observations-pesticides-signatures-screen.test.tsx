/**
 * Mode aérien — Pesticides embarqués (bloc OUI/NON + affichage dynamique). Le bloc
 * n'apparaît qu'en mode aérien ; en mode terrestre, aucun des nouveaux champs ne
 * doit être visible ni réclamé (#pesticides-embarques-signatures).
 *
 * Fichier séparé de `extensive-observations-screen-restore.test.tsx` (et de
 * `extensive-observations-futs-signatures-screen.test.tsx`) : accumuler trop de
 * montages de cet écran dans un même fichier provoquait des timeouts `findByText`
 * (contention de ressources déjà documentée pour d'autres suites d'écran de ce
 * dépôt), alors que chaque test passe seul.
 */
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

// Non exercé par ces tests (pesticides embarqués), mais listUtilisateursByRole est
// appelée au montage en mode aérien pour les chips Pilote/Chef de Base — mocké pour
// ne pas dépendre d'expo-sqlite.
jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
}));

describe('ExtensiveObservationsScreen — mode aérien : pesticides embarqués', () => {
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

  it("n'affiche aucun champ Pesticides/Signatures pour une fiche terrestre (mode_extensif absent)", async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Verdure strate herbeuse');

    expect(screen.queryByText('Pesticides Embarqués')).toBeNull();
    expect(screen.queryByText('Signatures')).toBeNull();
  });

  it('Pesticides = NON : reste compact (Nom Commercial/Quantités/Fûts masqués), Signatures toujours visibles', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Pesticides Embarqués');

    fireEvent.press(screen.getByText('Non'));

    // Attend que le state ait réellement basculé (le chip « Non » devient actif)
    // avant d'enchaîner sur Continuer — deux `fireEvent` synchrones sans flush
    // intermédiaire liraient sinon une fermeture (closure) non encore à jour.
    await waitFor(() =>
      expect(screen.getByText('Non').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]))
    );

    expect(screen.queryByText('Nom Commercial')).toBeNull();
    expect(screen.queryByText('Nombre de fûts')).toBeNull();
    // Signatures indépendantes du choix Pesticides — toujours affichées en aérien.
    expect(screen.getByText('Signatures')).toBeVisible();
    expect(screen.getByText('VISA')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          pesticidesEmbarques: false,
          pesticideNomCommercial: null,
          futsDisponible: null,
        })
      )
    );
  });

  it('Pesticides = OUI : Nom Commercial/Quantités/Fûts apparaissent dynamiquement et sont sauvegardés', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', mode_extensif: 'aerien' } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('Pesticides Embarqués');

    fireEvent.press(screen.getByText('Oui'));

    expect(await screen.findByText('Nom Commercial')).toBeVisible();
    expect(screen.getByText('Nombre de fûts')).toBeVisible();

    fireEvent.changeText(screen.getByTestId('pesticide-nom-commercial-input'), 'Fyfanon ULV');
    fireEvent.changeText(screen.getByTestId('pesticide-quantite-disponible-input'), '500');
    expect(await screen.findByDisplayValue('Fyfanon ULV')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          pesticidesEmbarques: true,
          pesticideNomCommercial: 'Fyfanon ULV',
        })
      )
    );
  });
});
