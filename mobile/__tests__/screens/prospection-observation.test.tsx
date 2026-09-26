import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ObservationStep } from '@/components/prospection/ObservationStep';
import { ReferentialError } from '@/lib/errors';
import { enregistrerFiltreObservation } from '@/lib/prospection-db';
import { listStadesGrille } from '@/lib/referentiel-db';

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));
jest.mock('@/lib/prospection-db', () => ({ enregistrerFiltreObservation: jest.fn() }));

const stade = (code: string) => ({ code, libelle: code });
/** Référentiel réel : imagos par sexe (♀ avec quarts de A3, ♂ groupé A234), larves sans sexe (LMC L1–L5, NSE jusqu'à L7). */
const referentiel = async (espece: string, categorie: 'imago' | 'larve', sexe: 'F' | 'M' | null) => {
  if (categorie === 'larve') return (espece === 'NSE' ? ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] : ['L1', 'L2', 'L3', 'L4', 'L5']).map(stade);
  const codes = sexe === 'F' ? ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5'] : ['A1', 'A234', 'A5'];
  return codes.map(stade);
};

beforeEach(() => {
  (listStadesGrille as jest.Mock).mockImplementation(referentiel);
});

describe('ObservationStep — jeux de puces par type et par espèce', () => {
  it('intensif : un jeu ♀ avec les quarts de A3 et un jeu ♂ (A1, A234, A5)', async () => {
    await render(<ObservationStep brouillonId="b-1" type="intensive" onContinuer={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    for (const code of ['A1', 'A2', 'A3', 'A3-1/4', 'A3-1/2', 'A3-3/4', 'A3-4/4', 'A4', 'A5']) {
      expect(await screen.findByTestId(`stade-LMC-imago-F-${code}`)).toBeTruthy();
    }
    for (const code of ['A1', 'A234', 'A5']) {
      expect(await screen.findByTestId(`stade-LMC-imago-M-${code}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('stade-LMC-imago-F-A234')).toBeNull();
  });

  it('NSE larves : pas de Solitaro-trans., stades L1 à L7', async () => {
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('grille-NSE-larve'));

    expect(screen.queryByTestId('phase-NSE-larve-solitaro_trans')).toBeNull();
    expect(screen.getByTestId('phase-NSE-larve-transiens')).toBeTruthy();
    expect(await screen.findByTestId('stade-NSE-larve-sans_sexe-L7')).toBeTruthy();
  });
});

describe('ObservationStep — validation, aucun criquet (maquette K5)', () => {
  it('explique que les grilles sont sautées et que la conclusion vient à l\'étape suivante', async () => {
    await render(<ObservationStep brouillonId="b-1" type="validation" onContinuer={jest.fn()} />);
    expect(screen.queryByText(/Les grilles de capture sont sautées/)).toBeNull();

    await fireEvent.press(screen.getByTestId('aucun-criquet'));

    expect(
      screen.getByText(
        'Les grilles de capture sont sautées : aucune saisie de total, de densité ni de comportement. Vous indiquerez la conclusion de la vérification à l’étape suivante.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Continuer sans capture ›')).toBeTruthy();
  });
});

describe('ObservationStep — validation du filtre', () => {
  it('ne continue pas tant qu\'une grille cochée n\'a ni phase ni stade, et le dit sur le bouton', async () => {
    const onContinuer = jest.fn();
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    expect(screen.getByText(/Il manque/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('observation-continuer'));
    expect(onContinuer).not.toHaveBeenCalled();
  });

  it('continue avec le filtre complet', async () => {
    const onContinuer = jest.fn();
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));
    await fireEvent.press(screen.getByTestId('phase-LMC-imago-solitaire'));
    await fireEvent.press(await screen.findByTestId('stade-LMC-imago-F-A4'));

    await fireEvent.press(screen.getByTestId('observation-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalledTimes(1));
    expect(enregistrerFiltreObservation).toHaveBeenCalledWith('b-1', {
      aucunCriquet: false,
      grilles: { 'LMC:imago': { phases: ['solitaire'], stades: { F: ['A4'], M: [], sans_sexe: [] } } },
    });
  });

  it('reste sur l\'écran et affiche une erreur quand l\'enregistrement échoue', async () => {
    (enregistrerFiltreObservation as jest.Mock).mockRejectedValueOnce(new Error('disque plein'));
    const onContinuer = jest.fn();
    await render(<ObservationStep brouillonId="b-1" type="validation" onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('aucun-criquet'));

    await fireEvent.press(screen.getByTestId('observation-continuer'));

    expect(await screen.findByText('Ce que vous avez observé n’a pas pu être enregistré sur cet appareil. Réessayez.')).toBeTruthy();
    expect(onContinuer).not.toHaveBeenCalled();
  });

  it('continue sans capture quand « Aucun criquet » est choisi', async () => {
    const onContinuer = jest.fn();
    await render(<ObservationStep brouillonId="b-1" type="validation" onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('aucun-criquet'));

    await fireEvent.press(screen.getByTestId('observation-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalledTimes(1));
    expect(enregistrerFiltreObservation).toHaveBeenCalledWith('b-1', { aucunCriquet: true, grilles: {} });
  });
});

describe('ObservationStep — reprise d\'un brouillon', () => {
  it('réaffiche le filtre enregistré : grille, phases et stades cochés', async () => {
    const filtreInitial = { aucunCriquet: false, grilles: { 'NSE:larve': { phases: ['transiens', 'gregaire'], stades: { F: [], M: [], sans_sexe: ['L3', 'L4'] } } } };
    await render(<ObservationStep brouillonId="b-1" type="extensive" filtreInitial={filtreInitial} onContinuer={jest.fn()} />);

    expect(screen.getByTestId('grille-NSE-larve').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('✓ Transiens')).toBeTruthy();
    expect(screen.getByText('✓ Grégaires')).toBeTruthy();
    expect(await screen.findByText('✓ L3')).toBeTruthy();
    expect(screen.getByText('Captures · 1 grille ›')).toBeTruthy();
  });

  it('réaffiche « Aucun criquet observé » quand il avait été choisi', async () => {
    await render(<ObservationStep brouillonId="b-1" type="validation" filtreInitial={{ aucunCriquet: true, grilles: {} }} onContinuer={jest.fn()} />);

    expect(screen.getByText('✓ Aucun criquet observé')).toBeTruthy();
  });
});

describe('ObservationStep — référentiel des stades absent', () => {
  it('affiche « Stades indisponibles hors ligne » au lieu de puces vides', async () => {
    (listStadesGrille as jest.Mock).mockRejectedValue(new ReferentialError('Aucun stade imago connu pour LMC sur cet appareil.'));
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    expect(await screen.findByText(/Stades indisponibles hors ligne/)).toBeTruthy();
    expect(screen.queryByTestId('stade-LMC-imago-F-A1')).toBeNull();
  });

  it('une autre erreur de lecture (base illisible) n\'est pas présentée comme un problème hors ligne', async () => {
    (listStadesGrille as jest.Mock).mockRejectedValue(new Error('SQLite'));
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    expect(await screen.findByText('Les stades n’ont pas pu être lus sur cet appareil. Réessayez.')).toBeTruthy();
    expect(screen.queryByText(/Stades indisponibles hors ligne/)).toBeNull();
  });
});

describe('ObservationStep — extensif (maquette K1)', () => {
  it('cocher LMC · Imagos affiche 4 phases et les stades du référentiel, le bouton compte la grille', async () => {
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    for (const phase of ['Solitaires', 'Solitaro-trans.', 'Transiens', 'Grégaires']) {
      expect(await screen.findByText(phase)).toBeTruthy();
    }
    for (const code of ['A1', 'A2', 'A3', 'A4', 'A5']) {
      expect(await screen.findByTestId(`stade-LMC-imago-F-${code}`)).toBeTruthy();
    }
    for (const code of ['A1', 'A234', 'A5']) {
      expect(await screen.findByTestId(`stade-LMC-imago-M-${code}`)).toBeTruthy();
    }
    expect(screen.getByText('♀ Femelles')).toBeTruthy();
    expect(screen.getByText('♂ Mâles')).toBeTruthy();
    expect(screen.queryByTestId('stade-LMC-imago-F-A3-1/4')).toBeNull();

    await fireEvent.press(screen.getByTestId('phase-LMC-imago-solitaire'));
    await fireEvent.press(screen.getByTestId('stade-LMC-imago-F-A4'));
    expect(screen.getByText('Captures · 1 grille ›')).toBeTruthy();
  });

  it('« Aucun criquet observé » décoche les grilles, et cocher une grille l\'annule', async () => {
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));
    await fireEvent.press(screen.getByTestId('grille-NSE-larve'));

    await fireEvent.press(screen.getByTestId('aucun-criquet'));

    expect(screen.getByText('✓ Aucun criquet observé')).toBeTruthy();
    expect(screen.queryByTestId('phase-LMC-imago-solitaire')).toBeNull();
    expect(screen.getByTestId('grille-LMC-imago').props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('Continuer sans capture ›')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('grille-LMC-larve'));
    expect(screen.queryByText('✓ Aucun criquet observé')).toBeNull();
    expect(screen.getByTestId('grille-LMC-larve').props.accessibilityState.selected).toBe(true);
  });

  it('une phase et un stade cochés s\'affichent avec « ✓ », retoucher décoche', async () => {
    await render(<ObservationStep brouillonId="b-1" type="extensive" onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('grille-LMC-imago'));

    await fireEvent.press(screen.getByTestId('phase-LMC-imago-solitaire'));
    await fireEvent.press(await screen.findByTestId('stade-LMC-imago-F-A4'));

    expect(screen.getByText('✓ Solitaires')).toBeTruthy();
    expect(screen.getByText('✓ A4')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stade-LMC-imago-F-A4'));
    expect(screen.queryByText('✓ A4')).toBeNull();
  });
});
