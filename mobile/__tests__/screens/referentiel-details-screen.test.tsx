/** Fiches en lecture seule (Figma « Pesticide · Détail », « Station · Détail », « Code stade · Détail »). */
import { render, screen } from '@testing-library/react-native';
import ReferentielCodeStadeScreen from '@/app/(app)/referentiel-code-stade';
import ReferentielPesticideScreen from '@/app/(app)/referentiel-pesticide';
import ReferentielStationScreen from '@/app/(app)/referentiel-station';
import { getCodeStade, getPesticide, getStation } from '@/lib/referentiel-consultation';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: '8f2c1d3e-0000-4000-8000-00000000a91d' }),
}));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-consultation', () => ({
  ...jest.requireActual('@/lib/referentiel-consultation'),
  getPesticide: jest.fn(),
  getStation: jest.fn(),
  getCodeStade: jest.fn(),
}));

describe('Pesticide · détail', () => {
  const pesticide = {
    id: '8f2c1d3e-0000-4000-8000-00000000a91d',
    code: 'PST-001',
    nom: 'Fenitrothion 96% ULV',
    matiere_active: 'Fénitrothion',
    dose_reference: '0,5 L/ha',
    type_produit: 'produit_choc',
    actif: true,
    updated_at: new Date(2026, 8, 20, 8, 12).toISOString(),
  };

  it('affiche les champs, les informations de synchronisation et la mention « Lecture seule »', async () => {
    jest.mocked(getPesticide).mockResolvedValue(pesticide);
    await render(<ReferentielPesticideScreen />);

    expect(await screen.findByText('Pesticide · PST-001')).toBeTruthy();
    expect(screen.getByText('Lecture seule')).toBeTruthy();
    expect(screen.getByText('Fénitrothion')).toBeTruthy();
    expect(screen.getByText('0,5 L/ha')).toBeTruthy();
    expect(screen.getByText('Produit de choc')).toBeTruthy();
    expect(screen.getByText('8f2c…a91d')).toBeTruthy();
    expect(screen.getByText('20/09/2026 · 08:12')).toBeTruthy();
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/ne peut pas être modifiée ici/)).toBeTruthy();
  });

  it('une donnée absente s’écrit « — », pas « null »', async () => {
    jest.mocked(getPesticide).mockResolvedValue({ ...pesticide, matiere_active: null, dose_reference: null, type_produit: null });
    await render(<ReferentielPesticideScreen />);

    await screen.findByText('Pesticide · PST-001');
    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('un pesticide disparu du cache le dit', async () => {
    jest.mocked(getPesticide).mockResolvedValue(null);
    await render(<ReferentielPesticideScreen />);
    expect(await screen.findByText('Ce pesticide n’est plus dans le référentiel de ce téléphone.')).toBeTruthy();
  });

  it('un pesticide inactif porte le badge neutre et le statut serveur « Inactif »', async () => {
    jest.mocked(getPesticide).mockResolvedValue({ ...pesticide, actif: false });
    await render(<ReferentielPesticideScreen />);

    expect(await screen.findByText('INACTIF')).toBeTruthy();
    expect(screen.getByText('Inactif')).toBeTruthy();
  });
});

describe('Station · détail', () => {
  const station = {
    id: 's1',
    code: 'STF-014',
    nom: 'Ihosy centre',
    commune: 'Ihosy',
    district: 'Ihosy',
    region: 'Ihorombe',
    latitude: -22.4012,
    longitude: 46.1234,
    altitude: 712,
    actif: true,
    updated_at: '2026-09-22T05:12:00.000Z',
    poste_code: 'PA-07',
    poste_nom: 'PA Ihosy',
  };

  it('affiche le poste, la localisation administrative et la position GPS', async () => {
    jest.mocked(getStation).mockResolvedValue(station);
    await render(<ReferentielStationScreen />);

    expect(await screen.findByText('Station fixe · STF-014')).toBeTruthy();
    expect(screen.getByText('PA Ihosy · PA-07')).toBeTruthy();
    for (const region of ['Commune', 'District', 'Région']) expect(screen.getByText(region)).toBeTruthy();
    expect(screen.getByText('Ihorombe')).toBeTruthy();
    expect(screen.getByText('-22.4012')).toBeTruthy();
    expect(screen.getByText('46.1234')).toBeTruthy();
    expect(screen.getByText('712 m')).toBeTruthy();
  });

  it('une altitude inconnue s’écrit « — »', async () => {
    jest.mocked(getStation).mockResolvedValue({ ...station, altitude: null });
    await render(<ReferentielStationScreen />);

    await screen.findByText('Station fixe · STF-014');
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('une station sans poste connu n’invente pas de poste', async () => {
    jest.mocked(getStation).mockResolvedValue({ ...station, poste_nom: null, poste_code: null });
    await render(<ReferentielStationScreen />);

    await screen.findByText('Station fixe · STF-014');
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('Code stade · détail', () => {
  const stade = {
    id: 'c1',
    code: 'A1',
    libelle: 'Immature clair',
    categorie: 'imago',
    sexe: 'F',
    espece: 'Nomadacris septemfasciata',
    ordre: 1,
    actif: true,
    updated_at: '2026-07-03T05:12:00.000Z',
  };

  it('affiche le titre « code · libellé », catégorie, sexe, espèce et position de saisie', async () => {
    jest.mocked(getCodeStade).mockResolvedValue(stade);
    await render(<ReferentielCodeStadeScreen />);

    expect(await screen.findByText('A1 · Immature clair')).toBeTruthy();
    expect(screen.getByText('Code stade · Imago femelle')).toBeTruthy();
    expect(screen.getByText('Femelle ♀')).toBeTruthy();
    expect(screen.getByText('Nomadacris septemfasciata')).toBeTruthy();
    expect(screen.getByText('Position de saisie')).toBeTruthy();
    expect(screen.getByText(/Un même code peut figurer plusieurs fois/)).toBeTruthy();
  });

  it('sexe et espèce vides valent « Non sexé » et « Toutes espèces »', async () => {
    jest.mocked(getCodeStade).mockResolvedValue({ ...stade, code: 'L1', libelle: 'Larve stade 1', categorie: 'larve', sexe: null, espece: null });
    await render(<ReferentielCodeStadeScreen />);

    expect(await screen.findByText('Code stade · Larve')).toBeTruthy();
    expect(screen.getByText('Non sexé')).toBeTruthy();
    expect(screen.getByText('Toutes espèces')).toBeTruthy();
  });
});
