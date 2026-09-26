import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VegetationStep } from '@/components/prospection/VegetationStep';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import { defaultStrateDetail, STRATE_KEYS } from '@/lib/prospection-vegetation-schema';

jest.mock('@/lib/prospection-db', () => ({ enregistrerBrouillon: jest.fn() }));

const fiche = (extra: Partial<ProspectionCreate> = {}) =>
  ({ id: 'b-1', type_prospection: 'intensive', campagne_id: 'camp-1', equipe_id: 'eq-1', date_prospection: '2026-09-25', ...extra }) as ProspectionCreate & { id: string };

/** Fiche de la maquette 02b : sol nu 15 + herbeuse 55 + arbustive 15 = 85. */
const ficheMaquette = () =>
  fiche({
    vegetation: {
      strates: {
        herbeuse: { ...defaultStrateDetail(), recouvrement: 55, hMoy: 0.4, verdissement: 60 },
        arbustive: { ...defaultStrateDetail(), recouvrement: 15, hMoy: 1.8 },
      },
    },
    sol: { humidite: 'surface', solNu: 15 },
  });

describe('VegetationStep — fiche vierge', () => {
  it('affiche Sol nu et la strate herbeuse, propose les autres strates en puces, et « Continuer » dit qu’il manque 100 %', async () => {
    await render(<VegetationStep brouillon={fiche()} onContinuer={jest.fn()} />);
    expect(screen.getByText('Sol nu')).toBeTruthy();
    expect(screen.getByText('Strate herbeuse')).toBeTruthy();
    expect(screen.queryByText('Strate arbustive')).toBeNull();
    for (const puce of ['+ Arborée', '+ Arbustive', '+ Buissonneuse', '+ Cultures sèches', '+ Cultures hygrophiles']) {
      expect(screen.getByText(puce)).toBeTruthy();
    }
    expect(screen.getByText('Il manque 100 % à répartir')).toBeTruthy();
    expect(screen.getByTestId('vegetation-continuer').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('VegetationStep — reprise et total en direct', () => {
  it('rouvre une fiche avec ses strates déjà affichées et le total de la maquette : 85 / 100 %, il reste 15 %', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    expect(screen.getByText('Strate arbustive')).toBeTruthy();
    expect(screen.queryByText('+ Arbustive')).toBeNull();
    expect(screen.getByText('85')).toBeTruthy();
    expect(screen.getByText(/Il reste 15 % : ajoutez-les au sol nu ou à une strate/)).toBeTruthy();
    expect(screen.getByText('Il manque 15 % à répartir')).toBeTruthy();
    expect(screen.getByDisplayValue('0,4')).toBeTruthy();
    expect(screen.getByDisplayValue('60')).toBeTruthy();
  });

  it('le total et le bouton suivent chaque pas du stepper ; à 100 % « Continuer » s’active', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    expect(screen.getByText('90')).toBeTruthy();
    expect(screen.getByText('Il manque 10 % à répartir')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('La station est entièrement répartie.')).toBeTruthy();
    const bouton = screen.getByTestId('vegetation-continuer');
    expect(bouton.props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.getByText('Continuer')).toBeTruthy();
  });

  it('au-delà de 100 % : « Il y a X % en trop » et bouton désactivé', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    expect(screen.getByText('Il y a 5 % en trop')).toBeTruthy();
    expect(screen.getByTestId('vegetation-continuer').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('VegetationStep — ajout et retrait de strates', () => {
  it('« + Arborée » ajoute la carte et retire la puce ; « Retirer » remet son recouvrement à 0 et le total suit', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByText('+ Arborée'));
    expect(screen.getByText('Strate arborée')).toBeTruthy();
    expect(screen.queryByText('+ Arborée')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Augmenter Strate arborée'));
    expect(screen.getByText('90')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Retirer la Strate arborée'));
    expect(screen.queryByText('Strate arborée')).toBeNull();
    expect(screen.getByText('+ Arborée')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();
  });

  it('la strate herbeuse (principale) ne se retire pas', async () => {
    await render(<VegetationStep brouillon={fiche()} onContinuer={jest.fn()} />);
    expect(screen.queryByTestId('retirer-herbeuse')).toBeNull();
    expect(screen.getByText('Recouvrement · strate principale')).toBeTruthy();
  });
});

describe('VegetationStep — recouvrement à 0 %', () => {
  it('une H. moyenne saisie sur une strate à 0 % affiche l’erreur et bloque « Continuer », même à 100 %', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    expect(screen.getByTestId('vegetation-continuer').props.accessibilityState).toMatchObject({ disabled: false });

    await fireEvent.press(screen.getByText('+ Arborée'));
    await fireEvent.changeText(screen.getByTestId('arboree-hMoy'), '4');

    expect(await screen.findByText(/Recouvrement à 0 % : cette valeur ne serait pas prise en compte/)).toBeTruthy();
    expect(screen.getByTestId('vegetation-continuer').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('VegetationStep — « Continuer »', () => {
  it('enregistre le JSON vegetation à 6 clés (strate non ajoutée = valeurs par défaut) et solNu dans sol, puis continue', async () => {
    jest.mocked(enregistrerBrouillon).mockResolvedValue('b-1');
    const onContinuer = jest.fn();
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={onContinuer} />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    await fireEvent.press(screen.getByTestId('vegetation-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalled());
    const [saisie, options] = jest.mocked(enregistrerBrouillon).mock.calls[0];
    expect(saisie.id).toBe('b-1');
    expect(saisie.sol).toEqual({ humidite: 'surface', solNu: 30 });
    const strates = (saisie.vegetation as { strates: Record<string, unknown> }).strates;
    expect(Object.keys(strates)).toEqual([...STRATE_KEYS]);
    expect(strates.herbeuse).toMatchObject({ recouvrement: 55, hMoy: 0.4, verdissement: 60 });
    expect(strates.arboree).toEqual(defaultStrateDetail());
    expect(options).toBeUndefined();
  });

  it('un échec d’enregistrement reste sur l’écran avec un message', async () => {
    jest.mocked(enregistrerBrouillon).mockRejectedValue(new Error('disque plein'));
    const onContinuer = jest.fn();
    await render(<VegetationStep brouillon={{ ...ficheMaquette(), sol: { solNu: 30 } }} onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('vegetation-continuer'));
    expect(await screen.findByText(/La végétation n’a pas pu être enregistrée/)).toBeTruthy();
    expect(onContinuer).not.toHaveBeenCalled();
  });
});
