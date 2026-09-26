import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReferenceStep } from '@/components/prospection/ReferenceStep';
import { enregistrerBrouillon } from '@/lib/prospection-db';
import { listStationsByPoste } from '@/lib/referentiel-db';
import type { ProspectionCreate } from '@/lib/prospection-db';
import * as Clipboard from 'expo-clipboard';

const mockPosition = jest.fn();
jest.mock('@/lib/location', () => ({ getCurrentPosition: (...a: unknown[]) => mockPosition(...a) }));

const mockStation = (id: string, code: string, nom: string, paId: string, latitude: number, longitude: number) => ({
  id, code, nom, paId, latitude, longitude, altitude: 0, commune: 'Beloha', district: 'Beloha', region: 'Toliara',
});
const mockStations = [
  mockStation('s-loin', 'BEL-020', 'Ambovombe', 'pa-2', -25.2, 45),
  mockStation('s-proche', 'BEL-014', 'Andranomanitsy', 'pa-1', -25.003, 45),
];
jest.mock('@/lib/referentiel-db', () => ({
  listPostesAcridiens: jest.fn().mockResolvedValue([
    { id: 'pa-1', code: 'PA-BELOHA', nom: 'PA Beloha', zaId: 'z' },
    { id: 'pa-2', code: 'PA-AMBO', nom: 'PA Ambovombe', zaId: 'z' },
  ]),
  listStationsByPoste: jest.fn(),
  getStationById: jest.fn(() => Promise.resolve(mockStations[1])),
  listCampagnesLocal: jest.fn().mockResolvedValue([{ id: 'camp-1', name: '2026', start_date: '2026-01-01', end_date: null }]),
  listStationsActives: jest.fn(() => Promise.resolve(mockStations)),
}));
jest.mock('@/lib/geo-administratif', () => ({
  resoudreZoneHorsLigne: jest.fn(() => ({ region: 'Toliara', district: 'Beloha', commune: 'Beloha' })),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/prospection-db', () => ({ enregistrerBrouillon: jest.fn() }));
jest.mock('@/lib/auth-store', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: 'u1', nom: 'Rakoto', prenom: 'Olivier' } }),
}));
jest.mock('@/lib/equipe-travail-store', () => ({
  useEquipeTravailStore: (sel: (s: unknown) => unknown) => sel({ equipeId: 'eq-1' }),
}));

beforeEach(() => {
  mockPosition.mockResolvedValue({ latitude: -25, longitude: 45, altitude: 0, accuracy: 5, timestamp: Date.now() });
});

describe('ReferenceStep — intensive', () => {
  it('pré-sélectionne le PA et la station les plus proches dès que la position est acquise', async () => {
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    expect(await screen.findByText('BEL-014 · Andranomanitsy')).toBeTruthy();
    expect(screen.getByText('PA Beloha')).toBeTruthy();
    expect(screen.getAllByText(/✓ Auto · le plus proche/).length).toBeGreaterThan(0);
  });
});

describe('ReferenceStep — surfaces contrôlées en direct', () => {
  it('signale Prospectée > Station tout de suite et désactive « Continuer »', async () => {
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    await screen.findByText('BEL-014 · Andranomanitsy');
    await fireEvent.changeText(screen.getByTestId('surface-station'), '12');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '13');
    expect(await screen.findByText(/Prospectée ne peut pas dépasser la surface de la station/)).toBeTruthy();
    expect(screen.getByTestId('reference-continuer').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('ReferenceStep — « Continuer »', () => {
  it('enregistre le brouillon avec le rattachement détecté, les surfaces et le biotope, puis passe à la suite', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('brouillon-1');
    const onContinuer = jest.fn();
    await render(<ReferenceStep type="intensive" onContinuer={onContinuer} />);
    await screen.findByText('BEL-014 · Andranomanitsy');
    await fireEvent.changeText(screen.getByTestId('surface-station'), '12');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '8,5');
    await fireEvent.press(screen.getByText('Mésophyle'));
    await fireEvent.press(screen.getByTestId('reference-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalledWith('brouillon-1'));
    const [saisie, options] = jest.mocked(enregistrerBrouillon).mock.calls[0];
    expect(saisie).toMatchObject({
      type_prospection: 'intensive',
      campagne_id: 'camp-1',
      equipe_id: 'eq-1',
      station_id: 's-proche',
      pa_code: 'PA-BELOHA',
      surface_station: 12,
      surface_prospectee: 8.5,
      surface_infestee: 0,
      biotope: ['mesophyle'],
      latitude: -25,
      longitude: 45,
    });
    expect(saisie.n_fiche).toMatch(/^FI-\d{8}-[0-9A-F]{6}$/);
    expect(options).toEqual({ creation: true });
  });
});

describe('ReferenceStep — extensive', () => {
  it('pré-remplit la station libre (commune), sans PA ni station du référentiel, avec 2 surfaces et un N° message -TERR', async () => {
    await render(<ReferenceStep type="extensive" onContinuer={jest.fn()} />);
    expect(await screen.findByDisplayValue('Beloha')).toBeTruthy();
    expect(screen.queryByText('Poste acridien (PA)')).toBeNull();
    expect(screen.queryByTestId('surface-station')).toBeNull();
    expect(screen.getByTestId('surface-prospectee')).toBeTruthy();
    expect(screen.getByTestId('numero-message').props.value).toMatch(/^\d{8}-[0-9A-F]{4}-TERR$/);
  });

  it('n’affiche pas de N° message en validation', async () => {
    await render(<ReferenceStep type="validation" onContinuer={jest.fn()} />);
    await screen.findByDisplayValue('Beloha');
    expect(screen.queryByTestId('numero-message')).toBeNull();
  });

  it('n’écrase pas la station saisie quand le géocodage arrive après', async () => {
    let livrer: (p: unknown) => void = () => undefined;
    mockPosition.mockReturnValueOnce(new Promise((r) => (livrer = r)));
    await render(<ReferenceStep type="extensive" onContinuer={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('station-libre'), 'Ma station');
    await act(async () => livrer({ latitude: -25, longitude: 45, altitude: 0, accuracy: 5, timestamp: 0 }));
    expect(screen.getByTestId('station-libre').props.value).toBe('Ma station');
  });

  it('enregistre station libre, région/district/commune, N° message et Prospectée dans surface_station', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('brouillon-2');
    await render(<ReferenceStep type="extensive" onContinuer={jest.fn()} />);
    await screen.findByDisplayValue('Beloha');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '20');
    await fireEvent.changeText(screen.getByTestId('surface-infestee'), '5');
    await fireEvent.press(screen.getByText('Xérophyle'));
    await fireEvent.press(screen.getByTestId('reference-continuer'));

    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    const [saisie] = jest.mocked(enregistrerBrouillon).mock.calls.at(-1)!;
    expect(saisie).toMatchObject({
      type_prospection: 'extensive',
      station_id: null,
      station_libre: 'Beloha',
      region: 'Toliara',
      district: 'Beloha',
      commune: 'Beloha',
      surface_station: 20,
      surface_infestee: 5,
      type_station: ['xerophyle'],
      biotope: [],
    });
    expect(saisie.n_message).toMatch(/^\d{8}-[0-9A-F]{4}-TERR$/);
    expect(saisie.n_fiche).toMatch(/^FE-\d{8}-[0-9A-F]{6}$/);
  });
});

describe('ReferenceStep — « Changer » (choix manuel, référentiel local)', () => {
  it('propose les stations du PA avec recherche, garde le choix manuel et le signale', async () => {
    jest.mocked(listStationsByPoste).mockResolvedValue([
      mockStations[1],
      mockStation('s-autre', 'BEL-015', 'Tsihombe', 'pa-1', -25.05, 45),
    ]);
    jest.mocked(enregistrerBrouillon).mockResolvedValue('brouillon-3');
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    await screen.findByText('BEL-014 · Andranomanitsy');

    await fireEvent.press(screen.getByTestId('changer-station'));
    await fireEvent.changeText(await screen.findByTestId('recherche-liste'), 'tsih');
    expect(screen.queryByTestId('choix-s-proche')).toBeNull();
    await fireEvent.press(await screen.findByTestId('choix-s-autre'));

    expect(await screen.findByText('BEL-015 · Tsihombe')).toBeTruthy();
    expect(screen.getByText('✎ Choix manuel')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('surface-station'), '12');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '8');
    await fireEvent.press(screen.getByText('Mésophyle'));
    await fireEvent.press(screen.getByTestId('reference-continuer'));
    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    expect(jest.mocked(enregistrerBrouillon).mock.calls.at(-1)![0]).toMatchObject({ station_id: 's-autre', pa_code: 'PA-BELOHA' });
  });
});

describe('ReferenceStep — carte Fiche', () => {
  it('affiche le N° de fiche généré, le prospecteur connecté, et copie le N°', async () => {
    await render(<ReferenceStep type="extensive" onContinuer={jest.fn()} />);
    const numero = screen.getByTestId('numero-fiche').props.children as string;
    expect(numero).toMatch(/^FE-\d{8}-[0-9A-F]{6}$/);
    expect(screen.getByText('O. Rakoto (connecté)')).toBeTruthy();

    await fireEvent.press(screen.getByText('Copier'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(numero);
  });
});

describe('ReferenceStep — position GPS', () => {
  it('affiche la position acquise : coordonnées à la française et précision', async () => {
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    expect(await screen.findByText('-25,000000')).toBeTruthy();
    expect(screen.getByText('45,000000')).toBeTruthy();
    expect(screen.getByText('± 5 m')).toBeTruthy();
  });

  it('extensive : les coordonnées se saisissent à la main, refusées hors de Madagascar', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('brouillon-4');
    await render(<ReferenceStep type="extensive" onContinuer={jest.fn()} />);
    await screen.findByDisplayValue('Beloha');
    await fireEvent.press(screen.getByTestId('saisir-coordonnees'));

    await fireEvent.changeText(screen.getByTestId('latitude'), '0');
    await fireEvent.changeText(screen.getByTestId('longitude'), '0');
    expect(await screen.findByText('Ces coordonnées sont hors de Madagascar.')).toBeTruthy();
    expect(screen.getByTestId('reference-continuer').props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.changeText(screen.getByTestId('latitude'), '-24,5');
    await fireEvent.changeText(screen.getByTestId('longitude'), '45,2');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '20');
    await fireEvent.press(screen.getByText('Xérophyle'));
    await fireEvent.press(screen.getByTestId('reference-continuer'));
    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    expect(jest.mocked(enregistrerBrouillon).mock.calls.at(-1)![0]).toMatchObject({ latitude: -24.5, longitude: 45.2 });
  });
});

describe('ReferenceStep — reprise d’un brouillon', () => {
  const brouillon = {
    id: 'b9',
    type_prospection: 'intensive',
    campagne_id: 'camp-1',
    equipe_id: 'eq-1',
    date_prospection: '2026-09-01',
    n_fiche: 'FI-20260901-ZZZZZZ',
    n_message: 'MSG-MANUEL',
    station_id: 's-proche',
    pa_code: 'PA-BELOHA',
    surface_station: 12,
    surface_prospectee: 8,
    surface_infestee: 1,
    biotope: ['mesophyle'],
    type_station: [],
    latitude: -25,
    longitude: 45,
    avertissements: [],
    populations: [{ espece: 'CMI' }],
    captures: [],
    infestations: [],
    operations_aeriennes: [],
  } as unknown as ProspectionCreate & { id: string };

  it('rouvre les valeurs saisies et conserve N° de fiche, rattachement et listes à l’enregistrement', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('b9');
    await render(<ReferenceStep type="intensive" brouillon={brouillon} onContinuer={jest.fn()} />);

    expect(screen.getByTestId('numero-fiche').props.children).toBe('FI-20260901-ZZZZZZ');
    expect(await screen.findByText('BEL-014 · Andranomanitsy')).toBeTruthy();
    expect(screen.getByTestId('surface-station').props.value).toBe('12');
    expect(screen.getByTestId('surface-prospectee').props.value).toBe('8');
    expect(screen.getByTestId('surface-infestee').props.value).toBe('1');

    await fireEvent.press(screen.getByTestId('reference-continuer'));
    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    const [saisie, options] = jest.mocked(enregistrerBrouillon).mock.calls.at(-1)!;
    expect(saisie).toMatchObject({
      id: 'b9',
      n_fiche: 'FI-20260901-ZZZZZZ',
      station_id: 's-proche',
      pa_code: 'PA-BELOHA',
      populations: [{ espece: 'CMI' }],
      date_prospection: '2026-09-01',
    });
    expect(options).toEqual({});
  });

  it('extensive : garde le N° message tel que saisi', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('b9');
    const ext = { ...brouillon, type_prospection: 'extensive', station_id: null, pa_code: null, station_libre: 'Beloha', surface_station: 20, surface_prospectee: null, type_station: ['xerophyle'], biotope: [] };
    await render(<ReferenceStep type="extensive" brouillon={ext as never} onContinuer={jest.fn()} />);

    expect(screen.getByTestId('numero-message').props.value).toBe('MSG-MANUEL');
    expect(screen.getByTestId('surface-prospectee').props.value).toBe('20');
    await fireEvent.press(screen.getByTestId('reference-continuer'));
    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    expect(jest.mocked(enregistrerBrouillon).mock.calls.at(-1)![0]).toMatchObject({ n_message: 'MSG-MANUEL', station_libre: 'Beloha' });
  });
});

describe('ReferenceStep — barre et légende des surfaces', () => {
  it('résume l’imbrication Station ⊇ Prospectée ⊇ Infestée sous les champs', async () => {
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    await screen.findByText('BEL-014 · Andranomanitsy');
    await fireEvent.changeText(screen.getByTestId('surface-station'), '12');
    await fireEvent.changeText(screen.getByTestId('surface-prospectee'), '8');

    expect(await screen.findByText('Station 12')).toBeTruthy();
    expect(screen.getByText('Prospectée 8 (67 %)')).toBeTruthy();
    expect(screen.getByText('Infestée 0')).toBeTruthy();
  });
});

describe('ReferenceStep — date et heure du relevé', () => {
  it('affiche l’horodatage généré et le signale comme automatique', async () => {
    await render(<ReferenceStep type="intensive" onContinuer={jest.fn()} />);
    expect(screen.getByText('Date et heure du relevé')).toBeTruthy();
    expect(screen.getByTestId('date-releve').props.children).toMatch(/^\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}$/);
    expect(screen.getByText('Horodatage automatique')).toBeTruthy();
  });
});

describe('ReferenceStep — N° message d’un brouillon sans N° enregistré', () => {
  it('le régénère avec la date du brouillon, pas celle du jour', async () => {
    const ext = {
      id: 'b7b7b7b7-0000', type_prospection: 'extensive', campagne_id: 'c', equipe_id: 'e', date_prospection: '2026-09-01',
      n_fiche: 'FE-20260901-B7B7B7', n_message: null, station_libre: 'Beloha', surface_station: 20,
      surface_infestee: 0, biotope: [], type_station: ['xerophyle'], avertissements: [],
      populations: [], captures: [], infestations: [], operations_aeriennes: [],
    };
    await render(<ReferenceStep type="extensive" brouillon={ext as never} onContinuer={jest.fn()} />);
    expect(screen.getByTestId('numero-message').props.value).toBe('20260901-B7B7-TERR');
  });
});
