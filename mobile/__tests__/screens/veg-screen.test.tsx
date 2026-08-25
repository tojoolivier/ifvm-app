/**
 * Non-régression : cet écran ne lisait jamais `draft.vegetation`/`draft.sol` au montage
 * (strates, humidité, texture repartaient de zéro à chaque remontage). Un simple retour
 * en arrière puis "Continuer" écrasait alors les données déjà enregistrées par des
 * valeurs vides — cf. la demande "PERTE ou OUBLI de données après modification,
 * navigation, vérification ou nouvel enregistrement".
 *
 * Même exigence côté #201 : en réouvrant une fiche intensive déjà enregistrée
 * (brouillon en attente de synchro ou déjà synchronisée), les strates ainsi que
 * l'humidité/texture du sol précédemment saisies ne doivent pas disparaître.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import VegetationScreen from '@/app/(prospection)/veg';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionVegetation: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn().mockResolvedValue(null),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

const EXISTING_VEGETATION = JSON.stringify({
  strates: {
    herbeuse: { surfRel: 25.5, hMoy: 2.75, recouvrement: 70, verdissement: 33.5, repousse: 12.25, orpad: ['Fleur'], solNu: 5.5 },
  },
});
const EXISTING_SOL = JSON.stringify({ humidite: '0_5cm', texture: ['limoneuse', 'argileuse', 'cailloux'] });

describe('VegetationScreen — restauration des données déjà enregistrées', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionVegetation).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: EXISTING_VEGETATION,
        sol: EXISTING_SOL,
        degats_cultures: null,
      } as any,
      captures: [],
    });
  });

  it('affiche le recouvrement, l’humidité et les 3 textures déjà enregistrés dès le montage', async () => {
    await render(<VegetationScreen />);

    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    // Recouvrement de la strate herbeuse (70%), affiché en tête de carte avant même
    // d'ouvrir le détail — preuve que `strates` n'est plus vide au montage.
    expect(screen.getAllByText('70%').length).toBeGreaterThan(0);

    // Humidité et les 3 textures apparaissent sélectionnées (fond vert = `chipActive`).
    expect(screen.getByText('0,5 cm').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
    for (const label of ['Limoneuse', 'Argileuse', 'Cailloux']) {
      // Le libellé actif porte un suffixe " ✓" (cf. veg.tsx) : correspondance par préfixe.
      expect(screen.getByText(new RegExp(`^${label}`)).props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      );
    }
  });

  it('ne remplace pas les strates/humidité/texture déjà enregistrées par du vide en ré-enregistrant sans y toucher', async () => {
    await render(<VegetationScreen />);
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    // L'utilisateur ne modifie rien et enregistre à nouveau (ex. il revient juste vérifier).
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalled());
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionVegetation).mock.calls[0];

    const vegetation = JSON.parse(payload.vegetation);
    expect(vegetation.strates.herbeuse).toMatchObject({ recouvrement: 70, verdissement: 33.5, hMoy: 2.75, solNu: 5.5 });

    const sol = JSON.parse(payload.sol);
    expect(sol.humidite).toBe('0_5cm');
    expect(sol.texture).toEqual(expect.arrayContaining(['limoneuse', 'argileuse', 'cailloux']));
    expect(sol.texture).toHaveLength(3);
  });

  it('recharge et réenregistre les strates, l’humidité et la texture déjà enregistrées lors de la réouverture d’une fiche (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({
          strates: {
            arboree: { surfRel: 50, hMoy: 8, recouvrement: 40, verdissement: 60, repousse: null, orpad: ['Fleur'], solNu: 10 },
          },
        }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'] }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);

    expect(await screen.findByText('Strate arborée')).toBeVisible();
    // Le recouvrement restauré (40%) doit s'afficher, pas 0%.
    expect(await screen.findByText('40%')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          vegetation: expect.stringContaining('"recouvrement":40'),
          sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'] }),
        })
      )
    );
  });
});
