/** Listes du référentiel (Figma « Pesticides · Liste/Filtres », « Stations fixes · Liste », « Codes stades · Liste »). */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import ReferentielCodesStadesScreen from '@/app/(app)/referentiel-codes-stades';
import ReferentielPesticidesScreen from '@/app/(app)/referentiel-pesticides';
import ReferentielStationsScreen from '@/app/(app)/referentiel-stations';
import {
  compterPesticides,
  compterStations,
  listerCodesStades,
  listerEspecesCodesStades,
  listerMatieresActives,
  listerPesticides,
  listerRegionsStations,
  listerStations,
  listerTypesPesticide,
} from '@/lib/referentiel-consultation';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-consultation', () => {
  const reel = jest.requireActual('@/lib/referentiel-consultation');
  return {
    ...reel,
    listerPesticides: jest.fn(),
    compterPesticides: jest.fn(),
    listerTypesPesticide: jest.fn(),
    listerMatieresActives: jest.fn(),
    listerStations: jest.fn(),
    compterStations: jest.fn(),
    listerRegionsStations: jest.fn(),
    listerCodesStades: jest.fn(),
    listerEspecesCodesStades: jest.fn(),
  };
});

const pesticide = (extra: object) => ({
  id: 'p1',
  code: 'PST-001',
  nom: 'Fenitrothion 96% ULV',
  matiere_active: 'Fénitrothion',
  dose_reference: '0,5 L/ha',
  type_produit: 'produit_choc',
  actif: true,
  updated_at: '2026-09-20T05:12:00.000Z',
  ...extra,
});

const station = (extra: object) => ({
  id: 's1',
  code: 'STF-014',
  nom: 'Ihosy centre',
  commune: 'Ihosy',
  district: 'Ihosy',
  region: 'Ihorombe',
  latitude: -22.4,
  longitude: 46.1,
  altitude: 712,
  actif: true,
  updated_at: '2026-09-22T05:12:00.000Z',
  poste_code: 'PA-07',
  poste_nom: 'PA Ihosy',
  ...extra,
});

const stade = (extra: object) => ({
  id: 'c1',
  code: 'A1',
  libelle: 'Immature clair',
  categorie: 'imago',
  sexe: 'F',
  espece: 'Nomadacris septemfasciata',
  ordre: 1,
  actif: true,
  updated_at: '2026-07-03T05:12:00.000Z',
  ...extra,
});

beforeEach(() => {
  mockPush.mockReset();
  jest.mocked(listerPesticides).mockReset().mockResolvedValue([pesticide({}), pesticide({ id: 'p4', code: 'PST-004', nom: 'Métarhizium', matiere_active: 'Biopesticide', dose_reference: '50 g/ha', actif: false })]);
  jest.mocked(compterPesticides).mockResolvedValue({ tous: 42, actifs: 38, inactifs: 4, majLe: '2026-09-20T05:12:00.000Z' });
  jest.mocked(listerTypesPesticide).mockResolvedValue(['produit_choc', 'produit_barriere']);
  jest.mocked(listerMatieresActives).mockResolvedValue(['Fipronil', 'Fénitrothion']);
  jest.mocked(listerStations).mockReset().mockResolvedValue([station({}), station({ id: 's5', nom: 'Toliara sud', code: 'STF-052', poste_nom: 'PA Toliara', commune: 'Toliara II', region: 'Atsimo-Andrefana', actif: false })]);
  jest.mocked(compterStations).mockResolvedValue({ tous: 214, actifs: 209, inactifs: 5, majLe: '2026-09-22T05:12:00.000Z' });
  jest.mocked(listerRegionsStations).mockResolvedValue(['Anosy', 'Ihorombe']);
  jest.mocked(listerCodesStades).mockReset().mockResolvedValue([
    stade({}),
    stade({ id: 'c2', code: 'A2', libelle: 'Immature rose', ordre: 2 }),
    stade({ id: 'l1', code: 'L1', libelle: 'Larve stade 1', categorie: 'larve', sexe: null, espece: null, ordre: 10 }),
  ]);
  jest.mocked(listerEspecesCodesStades).mockResolvedValue(['Locusta migratoria', 'Nomadacris septemfasciata']);
});

describe('Pesticides · liste', () => {
  it('montre le sous-titre, les puces de statut avec leur compte et les lignes', async () => {
    await render(<ReferentielPesticidesScreen />);

    expect(await screen.findByText('Fenitrothion 96% ULV')).toBeTruthy();
    expect(screen.getByText('42 entrées · màj 20/09')).toBeTruthy();
    expect(screen.getByText('Tous 42')).toBeTruthy();
    expect(screen.getByText('Actifs 38')).toBeTruthy();
    expect(screen.getByText('Inactifs 4')).toBeTruthy();
    expect(screen.getByText('ACTIF')).toBeTruthy();
    expect(screen.getByText('INACTIF')).toBeTruthy();
    expect(screen.getByText('PST-001')).toBeTruthy();
    expect(screen.getByText('Fénitrothion · 0,5 L/ha')).toBeTruthy();
    expect(screen.getByText('2 RÉSULTATS')).toBeTruthy();
  });

  it('la recherche relance la requête avec le texte saisi', async () => {
    await render(<ReferentielPesticidesScreen />);
    await screen.findByText('Fenitrothion 96% ULV');

    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'feni');

    await waitFor(() => expect(listerPesticides).toHaveBeenLastCalledWith(expect.objectContaining({ recherche: 'feni' })));
  });

  it('une puce de statut filtre et le bouton de filtres compte l’écart au défaut', async () => {
    await render(<ReferentielPesticidesScreen />);
    await screen.findByText('Fenitrothion 96% ULV');
    expect(screen.getByLabelText('Filtres')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pesticides-statut-actifs'));

    await waitFor(() => expect(listerPesticides).toHaveBeenLastCalledWith(expect.objectContaining({ statut: 'actifs' })));
    expect(screen.getByLabelText('Filtres, 1 actifs')).toBeTruthy();
  });

  it('ouvre la fiche d’un pesticide', async () => {
    await render(<ReferentielPesticidesScreen />);

    await fireEvent.press(await screen.findByTestId('pesticide-p1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/referentiel-pesticide', params: { id: 'p1' } });
  });

  it('la feuille de filtres propose type, matière active, tri et l’option des inactifs', async () => {
    await render(<ReferentielPesticidesScreen />);
    await screen.findByText('Fenitrothion 96% ULV');

    await fireEvent.press(screen.getByTestId('referentiel-filtres'));
    const feuille = within(screen.getByTestId('feuille-filtres'));

    expect(feuille.getByText('Produit de choc')).toBeTruthy();
    expect(feuille.getByText('Toutes les matières actives')).toBeTruthy();
    expect(feuille.getByText('Nom A→Z')).toBeTruthy();
    expect(feuille.getByText('Voir les 2 résultats')).toBeTruthy();

    await fireEvent.press(feuille.getByText('Produit de choc'));
    await waitFor(() => expect(listerPesticides).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'produit_choc' })));

    await fireEvent.press(feuille.getByTestId('interrupteur'));
    await waitFor(() => expect(listerPesticides).toHaveBeenLastCalledWith(expect.objectContaining({ inclureInactifs: false })));
  });

  it('« Tout effacer » revient aux filtres par défaut sans perdre la recherche', async () => {
    await render(<ReferentielPesticidesScreen />);
    await screen.findByText('Fenitrothion 96% ULV');
    await fireEvent.changeText(screen.getByTestId('referentiel-recherche'), 'feni');
    await fireEvent.press(screen.getByTestId('pesticides-statut-actifs'));

    await fireEvent.press(screen.getByTestId('referentiel-filtres'));
    await fireEvent.press(screen.getByText('Tout effacer'));

    await waitFor(() =>
      expect(listerPesticides).toHaveBeenLastCalledWith(expect.objectContaining({ statut: 'tous', inclureInactifs: true, recherche: 'feni' }))
    );
  });

  it('une liste vide le dit', async () => {
    jest.mocked(listerPesticides).mockResolvedValue([]);
    await render(<ReferentielPesticidesScreen />);
    expect(await screen.findByText('Aucun pesticide ne correspond à ces filtres.')).toBeTruthy();
  });
});

describe('Stations fixes · liste', () => {
  it('montre la station, son poste, sa commune et sa région', async () => {
    await render(<ReferentielStationsScreen />);

    expect(await screen.findByText('Ihosy centre')).toBeTruthy();
    expect(screen.getByText('214 entrées · màj 22/09')).toBeTruthy();
    expect(screen.getByText('STF-014')).toBeTruthy();
    expect(screen.getByText('PA Ihosy')).toBeTruthy();
    expect(screen.getByText('Ihosy · Ihorombe')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('INACTIVE')).toBeTruthy();
    expect(screen.getByText('Toutes 214')).toBeTruthy();
  });

  it('filtre par statut et par région (feuille)', async () => {
    await render(<ReferentielStationsScreen />);
    await screen.findByText('Ihosy centre');

    await fireEvent.press(screen.getByTestId('stations-statut-actifs'));
    await waitFor(() => expect(listerStations).toHaveBeenLastCalledWith(expect.objectContaining({ statut: 'actifs' })));

    await fireEvent.press(screen.getByTestId('referentiel-filtres'));
    const feuille = within(screen.getByTestId('feuille-filtres'));
    await fireEvent.press(feuille.getByText('Toutes les régions'));
    await fireEvent.press(feuille.getByText('Ihorombe'));
    await waitFor(() => expect(listerStations).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'Ihorombe' })));
  });

  it('ouvre la fiche d’une station', async () => {
    await render(<ReferentielStationsScreen />);
    await fireEvent.press(await screen.findByTestId('station-s1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/referentiel-station', params: { id: 's1' } });
  });
});

describe('Codes stades · liste', () => {
  it('range les stades par catégorie et sexe, avec le glyphe du sexe', async () => {
    await render(<ReferentielCodesStadesScreen />);

    expect(await screen.findByText('IMAGO · FEMELLE')).toBeTruthy();
    expect(screen.getByText('LARVE')).toBeTruthy();
    expect(screen.getByText('Immature clair')).toBeTruthy();
    expect(screen.getAllByText('♀')).toHaveLength(2);
    expect(screen.getAllByText('Nomadacris').length).toBeGreaterThan(0);
    // La puce de filtre et la ligne de la larve (valable pour toutes les espèces).
    expect(screen.getAllByText('Toutes espèces')).toHaveLength(2);
  });

  it('les puces de sexe et d’espèce relancent la requête', async () => {
    await render(<ReferentielCodesStadesScreen />);
    await screen.findByText('IMAGO · FEMELLE');

    await fireEvent.press(screen.getByTestId('stades-sexe-F'));
    await waitFor(() => expect(listerCodesStades).toHaveBeenLastCalledWith(expect.objectContaining({ sexe: 'F' })));

    await fireEvent.press(screen.getByTestId('stades-espece-Nomadacris'));
    await waitFor(() =>
      expect(listerCodesStades).toHaveBeenLastCalledWith(expect.objectContaining({ espece: 'Nomadacris septemfasciata' }))
    );
  });

  it('ouvre la fiche d’un stade', async () => {
    await render(<ReferentielCodesStadesScreen />);
    await fireEvent.press(await screen.findByTestId('stade-c1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/referentiel-code-stade', params: { id: 'c1' } });
  });
});
