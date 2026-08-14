/**
 * Prouve que `expo-router` est mockable/simulable dans un test d'écran
 * (voir #108) : monte un écran réel qui utilise `useRouter` et
 * `useLocalSearchParams`, sans crash au montage.
 *
 * NB: `expo-router/testing-library` (`renderRouter`) n'est pas utilisé ici —
 * son helper interne appelle `render` de manière synchrone alors que
 * `@testing-library/react-native@14` (requis par React 19 / `test-renderer`)
 * est asynchrone, ce qui casse le montage (voir expo-router@56.2.18). Mocker
 * directement les hooks `expo-router` évite l'incompatibilité et suffit pour
 * un test d'écran isolé.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InfestationScreen from '@/app/(prospection)/infestation';
import { ErrorBanner } from '@/components/error-banner';
import { useErrorStore } from '@/lib/error-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  saveProspectionInfestation: jest.fn().mockResolvedValue(undefined),
}));

describe('InfestationScreen', () => {
  beforeEach(() => {
    useErrorStore.setState({ current: null });
  });

  it('monte sans crash avec expo-router mocké', async () => {
    await render(<InfestationScreen />);

    expect(await screen.findByText('Infestation')).toBeVisible();
  });

  it('affiche une bannière d’erreur, sans navigation, quand la sauvegarde échoue', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      { type_cible: 'tache_larvaire', surface_totale: 12, interdistance_moy: 250 } as any,
    ]);
    jest.mocked(prospectionRepository.saveProspectionInfestation).mockRejectedValueOnce(new Error('boom'));

    await render(
      <>
        <ErrorBanner />
        <InfestationScreen />
      </>
    );

    // La ligne mockée pré-remplit "Tache larvaire" comme cible déjà sélectionnée.
    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    expect(await screen.findByText('Réessayer')).toBeVisible();
  });

  it('bascule automatiquement "Tache larvaire" vers "Bande larvaire" dès que la taille du groupe atteint 1000 m² (#103)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      { type_cible: 'tache_larvaire', surface_totale: 12, taille_groupe_m2: 1500 } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));

    expect(await screen.findByText('Comportement · Bande larvaire')).toBeVisible();
  });

  it('conserve "nb_taches_bandes" à la sauvegarde d’une bande larvaire (#103)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      {
        type_cible: 'bande_larvaire',
        surface_totale: 12,
        nb_taches_bandes: 3,
        interdistance_moy: 250,
        comportement: 'deplacement',
        vent_de: 'N',
        direction_vers: 'S',
      } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionInfestation).toHaveBeenCalledWith(
        'draft-123',
        'bande_larvaire',
        expect.objectContaining({ nb_taches_bandes: 3 })
      )
    );
  });

  it('conserve le comportement "en vol" à la sauvegarde d’un vol clair (#104)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      {
        type_cible: 'vol_clair',
        surface_totale: 12,
        essaim_en_vol: 1,
        essaim_pose: 0,
        vent_de: 'N',
        direction_vers: 'S',
      } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionInfestation).toHaveBeenCalledWith(
        'draft-123',
        'vol_clair',
        expect.objectContaining({ essaim_en_vol: 1, essaim_pose: 0 })
      )
    );
  });

  it('conserve la surface contaminée et la part infestée à la sauvegarde d’un essaim (#104)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      {
        type_cible: 'essaim',
        surface_totale: 12,
        surface_contaminee_ha: 40,
        surface_infestee_pourcent: 25,
        vent_de: 'N',
        direction_vers: 'S',
      } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionInfestation).toHaveBeenCalledWith(
        'draft-123',
        'essaim',
        expect.objectContaining({ surface_contaminee_ha: 40, surface_infestee_pourcent: 25 })
      )
    );
  });

  it('classe "vol clair" via le questionnaire séquentiel et bloque la densité en saisie libre (#104)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValueOnce([
      { type_cible: 'vol_clair', surface_totale: 12, vent_de: 'N', direction_vers: 'S' } as any,
    ]);

    await render(<InfestationScreen />);

    expect(screen.queryByText('Densité (/m²)')).toBeNull();

    fireEvent.press(await screen.findByText('Oui')); // Q1 : vol spontané non provoqué
    await screen.findByText('Visible seulement de près ?');

    fireEvent.press((await screen.findAllByText('Oui'))[1]); // Q2 : visible seulement de près

    expect(await screen.findByText('Classification : Vol clair')).toBeVisible();

    fireEvent.press(await screen.findByText('Comportement  ›'));
    fireEvent.press(await screen.findByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionInfestation).toHaveBeenCalledWith(
        'draft-123',
        'vol_clair',
        expect.objectContaining({ type_essaim: 'vol_clair' })
      )
    );
  });
});
