/**
 * Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration backend
 * 0076, #moyens-humains-materiels) — sous-titres "Humains" (Nb agents
 * permanents/temporaires, Nb personnel local) et "Matériels" (Atomiseur,
 * Essence (litres), Disque rotatif, Nombre de piles, Ulvamast) sur l'écran
 * « Moyens & protection », avant le sous-titre "Kit de protection" (déjà
 * existant : Combinaison/Gants/Lunettes/Masques/Bottes). Communs à l'Aérien
 * et au Terrestre — comblent des cases du gabarit PDF jamais alimentées
 * jusqu'ici (issue #495). La sous-section « Matériels » a ensuite été retirée du
 * flux Aérien (décision produit) : « Humains » reste commune, « Matériels » ne
 * concerne plus que le Terrestre.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MoyensScreen from '@/app/(traitement)/moyens';
import * as traitementRepository from '@/lib/traitement-repository';
import * as prospectionRepository from '@/lib/prospection-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn().mockResolvedValue(null),
}));

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    type_traitement: 'TERRESTRE',
    kit_combinaison: 0,
    kit_gants: 0,
    kit_lunettes: 0,
    kit_masques: 0,
    kit_botte: 0,
    zones_exposees: null,
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
    nb_agents_permanents: null,
    nb_agents_temporaires: null,
    nb_personnel_local: null,
    moyens_atomiseur_nb: null,
    moyens_essence_litres: null,
    moyens_disque_rotatif_nb: null,
    moyens_piles_nb: null,
    moyens_ulvamast_nb: null,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draft());
  jest.mocked(traitementRepository.updateTraitementMoyens).mockClear().mockResolvedValue({} as any);
  jest.mocked(prospectionRepository.getProspection).mockReset().mockResolvedValue(null);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe.each([['TERRESTRE']])('MoyensScreen (%s) — Humains/Matériels', (type) => {
  it('affiche "Humains" et "Matériels" avant "Kit de protection"', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draft({ type_traitement: type }));

    await render(<MoyensScreen />);
    await screen.findByText('Humains');

    expect(screen.getByText('Nb agents permanents')).toBeVisible();
    expect(screen.getByText('Nb agents temporaires')).toBeVisible();
    expect(screen.getByText('Nb personnel local')).toBeVisible();
    expect(screen.getByText('Matériels')).toBeVisible();
    expect(screen.getByText('Atomiseur')).toBeVisible();
    expect(screen.getByText('Essence (litres)')).toBeVisible();
    expect(screen.getByText('Disque rotatif')).toBeVisible();
    expect(screen.getByText('Nombre de piles')).toBeVisible();
    expect(screen.getByText('Ulvamast')).toBeVisible();
    expect(screen.getByText('Kit de protection')).toBeVisible();

    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered.indexOf('Humains')).toBeLessThan(rendered.indexOf('Matériels'));
    expect(rendered.indexOf('Matériels')).toBeLessThan(rendered.indexOf('Kit de protection'));
  });

  it('saisit et enregistre les 8 champs', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draft({ type_traitement: type }));

    await render(<MoyensScreen />);
    await screen.findByText('Humains');

    fireEvent.changeText(screen.getByTestId('nb-agents-permanents-input'), '4');
    await settle();
    fireEvent.changeText(screen.getByTestId('nb-agents-temporaires-input'), '2');
    await settle();
    fireEvent.changeText(screen.getByTestId('nb-personnel-local-input'), '6');
    await settle();
    fireEvent.changeText(screen.getByTestId('moyens-atomiseur-input'), '3');
    await settle();
    fireEvent.changeText(screen.getByTestId('moyens-essence-litres-input'), '50,5');
    await settle();
    fireEvent.changeText(screen.getByTestId('moyens-disque-rotatif-input'), '1');
    await settle();
    fireEvent.changeText(screen.getByTestId('moyens-piles-input'), '12');
    await settle();
    fireEvent.changeText(screen.getByTestId('moyens-ulvamast-input'), '2');
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementMoyens).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({
          nb_agents_permanents: 4,
          nb_agents_temporaires: 2,
          nb_personnel_local: 6,
          moyens_atomiseur_nb: 3,
          moyens_essence_litres: 50.5,
          moyens_disque_rotatif_nb: 1,
          moyens_piles_nb: 12,
          moyens_ulvamast_nb: 2,
        })
      )
    );
  });

  it('restaure des valeurs déjà enregistrées', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        type_traitement: type,
        nb_agents_permanents: 4,
        nb_agents_temporaires: 7,
        nb_personnel_local: 6,
        moyens_atomiseur_nb: 3,
        moyens_essence_litres: 50.5,
        moyens_disque_rotatif_nb: 11,
        moyens_piles_nb: 12,
        moyens_ulvamast_nb: 9,
      })
    );

    await render(<MoyensScreen />);

    expect(await screen.findByDisplayValue('4')).toBeVisible();
    expect(screen.getByDisplayValue('7')).toBeVisible();
    expect(screen.getByDisplayValue('6')).toBeVisible();
    expect(screen.getByDisplayValue('3')).toBeVisible();
    expect(screen.getByDisplayValue('50,5')).toBeVisible();
    expect(screen.getByDisplayValue('11')).toBeVisible();
    expect(screen.getByDisplayValue('12')).toBeVisible();
    expect(screen.getByDisplayValue('9')).toBeVisible();
  });
});

describe('MoyensScreen (AERIEN) — Matériels retirés, Humains conservés', () => {
  it('affiche "Humains" et "Kit de protection" mais plus "Matériels"', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(draft({ type_traitement: 'AERIEN' }));

    await render(<MoyensScreen />);
    await screen.findByText('Humains');

    expect(screen.getByText('Nb agents permanents')).toBeVisible();
    expect(screen.getByText('Kit de protection')).toBeVisible();
    expect(screen.queryByText('Matériels')).toBeNull();
    expect(screen.queryByText('Atomiseur')).toBeNull();
    expect(screen.queryByText('Essence (litres)')).toBeNull();
    expect(screen.queryByText('Disque rotatif')).toBeNull();
    expect(screen.queryByText('Nombre de piles')).toBeNull();
    expect(screen.queryByText('Ulvamast')).toBeNull();
  });

  it("réécrit telles quelles les valeurs de matériels déjà enregistrées (rien n'est perdu)", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({ type_traitement: 'AERIEN', moyens_atomiseur_nb: 3, moyens_essence_litres: 50.5 })
    );

    await render(<MoyensScreen />);
    await screen.findByText('Humains');
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementMoyens).toHaveBeenCalledWith(
        'trait-1',
        expect.objectContaining({ moyens_atomiseur_nb: 3, moyens_essence_litres: 50.5 })
      )
    );
  });
});
