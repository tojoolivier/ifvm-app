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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

// surfRel (94.5) + solNu (5.5) = 100% : répartition valide (#278), sans quoi
// "Continuer" serait bloqué dans les tests de réenregistrement ci-dessous.
const EXISTING_VEGETATION = JSON.stringify({
  strates: {
    herbeuse: { surfRel: 94.5, hMoy: 2.75, recouvrement: 70, verdissement: 33.5, repousse: 12.25, orpad: ['Fleur'] },
  },
});
// Sol nu (%) est un champ station, pas par strate (#278) : il vit dans `sol`, pas
// `vegetation.strates`.
const EXISTING_SOL = JSON.stringify({ humidite: '0_5cm', texture: ['limoneuse', 'argileuse', 'cailloux'], solNu: 5.5 });

describe('VegetationScreen — restauration des données déjà enregistrées', () => {
  afterEach(cleanup);
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
    expect(vegetation.strates.herbeuse).toMatchObject({ recouvrement: 70, verdissement: 33.5, hMoy: 2.75 });

    const sol = JSON.parse(payload.sol);
    expect(sol.humidite).toBe('0_5cm');
    expect(sol.texture).toEqual(expect.arrayContaining(['limoneuse', 'argileuse', 'cailloux']));
    expect(sol.texture).toHaveLength(3);
    expect(sol.solNu).toBe(5.5);
  });

  it('recharge et réenregistre les strates, l’humidité et la texture déjà enregistrées lors de la réouverture d’une fiche (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({
          strates: {
            // surfRel (90) + solNu (10) = 100% : répartition valide (#278), sans quoi
            // "Continuer" serait bloqué et ce test n'atteindrait jamais l'enregistrement.
            arboree: { surfRel: 90, hMoy: 8, recouvrement: 40, verdissement: 60, repousse: null, orpad: ['Fleur'] },
          },
        }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'], solNu: 10 }),
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
          sol: JSON.stringify({ humidite: 'surface', texture: ['argileuse'], solNu: 10 }),
        })
      )
    );
  });

  it('accepte une saisie décimale libre (virgule) pour H. moy/Verdissement/Repousse/Sol nu, sans arrondi au pas de 5', async () => {
    // Régression : ces 4 champs étaient arrondis au multiple de 5 le plus proche
    // (clampTo5), comme le stepper Recouvrement — qui, lui, garde ce comportement.
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', vegetation: null, sol: null } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    await waitFor(() => expect(screen.getByText('Recouvrement')).toBeVisible());

    // Une seule strate dépliée : 5 champs décimaux vides à l'écran — Sol nu % (champ
    // station, en haut, indépendant des strates) puis Surf. rel. %, H. moy,
    // % Verdissement, % Repousse de la strate. Peu importe lequel des 4 champs de la
    // strate reçoit quelle valeur ci-dessous : seule compte la non-régression testée
    // (aucun n'est arrondi à un multiple de 5, contrairement au stepper Recouvrement) —
    // on retape après chaque frappe, l'index des champs encore vides se décalant à
    // mesure qu'ils se remplissent.
    fireEvent.changeText(screen.getAllByDisplayValue('')[1], '2,75');
    expect(await screen.findByDisplayValue('2,75')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '33,5');
    expect(await screen.findByDisplayValue('33,5')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '12,25');
    expect(await screen.findByDisplayValue('12,25')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '5,5');
    // Aucun de ces 4 champs n'est arrondi à un multiple de 5 (contrairement à
    // Recouvrement) : les quatre valeurs décimales saisies restent visibles telles quelles.
    expect(await screen.findByDisplayValue('5,5')).toBeVisible();
    expect(screen.getByDisplayValue('2,75')).toBeVisible();
    expect(screen.getByDisplayValue('33,5')).toBeVisible();
    expect(screen.getByDisplayValue('12,25')).toBeVisible();
  });
});

describe('VegetationScreen — répartition sol nu + strates = 100% (#278)', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionVegetation).mockClear();
  });

  it('bloque "Continuer" tant que sol nu + surface relative des 6 strates ne totalise pas 100%', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        // herbeuse.surfRel (40) + solNu (10) = 50% : loin des 100% attendus.
        vegetation: JSON.stringify({ strates: { herbeuse: { surfRel: 40, recouvrement: 0 } } }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['limoneuse'], solNu: 10 }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    fireEvent.press(screen.getByText('Continuer  ›'));

    expect(await screen.findByText(/doit égaler 100%/)).toBeVisible();
    expect(prospectionRepository.updateProspectionVegetation).not.toHaveBeenCalled();
  });

  it('laisse passer "Continuer" une fois la répartition à 100%', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({ strates: { herbeuse: { surfRel: 90, recouvrement: 0 } } }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['limoneuse'], solNu: 10 }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    await waitFor(() => expect(screen.getByText('Continuer  ›')).toBeVisible());

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalled());
    expect(screen.queryByText(/doit égaler 100%/)).toBeNull();
  });
});
