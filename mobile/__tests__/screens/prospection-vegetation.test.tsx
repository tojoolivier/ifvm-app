import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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

describe('VegetationStep — « Plus de détails » (#687)', () => {
  it('le lien de la strate herbeuse ouvre la feuille de la maquette 02c : surface relative, encadré pédagogique, Repousse', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    expect(screen.queryByText('Strate herbeuse · détails')).toBeNull();

    await fireEvent.press(screen.getByTestId('plus-de-details-herbeuse'));

    expect(screen.getByText('Strate herbeuse · détails')).toBeTruthy();
    expect(screen.getByTestId('bottom-sheet-pastille')).toHaveStyle({ backgroundColor: '#6aa84f' }); // strate/herbeuse
    // Libellé du champ + titre de l’encadré, comme dans la maquette.
    expect(screen.getAllByText('Surface relative')).toHaveLength(2);
    expect(screen.getByText('Part de la station où la strate est présente. Les strates peuvent se superposer : le total peut dépasser 100 %.')).toBeTruthy();
    expect(screen.getByText('Recouvrement (55 %)')).toBeTruthy();
    expect(screen.getByText('Réglé dans la liste. Avec le sol nu, le total fait exactement 100 %.')).toBeTruthy();
    expect(screen.getByText('Présence')).toBeTruthy();
    expect(screen.getByText('Absence')).toBeTruthy();
  });

  it('Valider ferme la feuille ; la saisie (virgule) et Présence sont enregistrées dans vegetation.strates.herbeuse, l’indicateur s’affiche', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockResolvedValue('b-1');
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    expect(screen.queryByTestId('details-renseignes-herbeuse')).toBeNull();

    await fireEvent.press(screen.getByTestId('plus-de-details-herbeuse'));
    await fireEvent.changeText(screen.getByTestId('herbeuse-surfRel'), '70,5');
    await fireEvent.press(screen.getByLabelText('Présence'));
    await fireEvent.press(screen.getByText('Valider'));
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText('Augmenter Sol nu')); // 85 → 100 %

    expect(screen.queryByText('Strate herbeuse · détails')).toBeNull();
    expect(screen.getByTestId('details-renseignes-herbeuse')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vegetation-continuer'));
    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    const { vegetation } = jest.mocked(enregistrerBrouillon).mock.calls.at(-1)![0];
    expect((vegetation as { strates: Record<string, unknown> }).strates.herbeuse).toMatchObject({ surfRel: 70.5, repousse: true });
  });

  it('une strate à 0 % n’ouvre pas la feuille ; dès qu’elle a du recouvrement, le lien s’ouvre', async () => {
    await render(<VegetationStep brouillon={fiche()} onContinuer={jest.fn()} />);
    expect(screen.getByTestId('plus-de-details-herbeuse')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('plus-de-details-herbeuse'));
    expect(screen.queryByText('Strate herbeuse · détails')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Augmenter Strate herbeuse'));
    expect(screen.getByTestId('plus-de-details-herbeuse')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('plus-de-details-herbeuse'));
    expect(screen.getByText('Strate herbeuse · détails')).toBeTruthy();
  });
});

describe('VegetationStep — phénologie « Qu’observez-vous ? » (#686)', () => {
  const stade = (cle: string, s: string) => screen.getByTestId(`stade-${cle}-${s}`);
  const niveau = (cle: string, s: string, n: string) => screen.queryByTestId(`niveau-${cle}-${s}-${n}`);

  it('affiche les 5 stades de la maquette, tous non touchés, sans ligne de niveau', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    expect(screen.getAllByText('Qu’observez-vous ?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Touchez uniquement ce qui est présent. Le reste compte comme « Néant ».')).toBeTruthy();
    for (const [s, libelle] of [['orpad', 'Germination'], ['feuille', 'Feuille'], ['fleur', 'Fleur'], ['fruit', 'Fruit'], ['sec', 'Sec']]) {
      expect(within(stade('herbeuse', s)).getByText(libelle)).toBeTruthy();
      expect(stade('herbeuse', s).props.accessibilityState).toMatchObject({ selected: false });
    }
    expect(niveau('herbeuse', 'feuille', 'Rare')).toBeNull();
  });

  it('toucher un stade le coche et présélectionne Rare ; Beaucoup remplace Rare (un seul niveau) ; retoucher le stade le remet à Néant', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    await fireEvent.press(stade('herbeuse', 'feuille'));
    expect(within(stade('herbeuse', 'feuille')).getByText('✓ Feuille')).toBeTruthy();
    expect(niveau('herbeuse', 'feuille', 'Rare')!.props.accessibilityState).toMatchObject({ selected: true });
    expect(niveau('herbeuse', 'feuille', 'Beaucoup')!.props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(niveau('herbeuse', 'feuille', 'Beaucoup')!);
    expect(niveau('herbeuse', 'feuille', 'Rare')!.props.accessibilityState).toMatchObject({ selected: false });
    expect(niveau('herbeuse', 'feuille', 'Beaucoup')!.props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(stade('herbeuse', 'feuille'));
    expect(niveau('herbeuse', 'feuille', 'Rare')).toBeNull();
    expect(stade('herbeuse', 'feuille').props.accessibilityState).toMatchObject({ selected: false });
  });
  it('« Continuer » enregistre un tableau à un élément par stade (orpad = Germination), Néant pour les stades non touchés', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockResolvedValue('b-1');
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText('Augmenter Sol nu'));
    await fireEvent.press(stade('herbeuse', 'orpad'));
    await fireEvent.press(stade('herbeuse', 'fruit'));
    await fireEvent.press(niveau('herbeuse', 'fruit', 'Beaucoup')!);
    await fireEvent.press(screen.getByTestId('vegetation-continuer'));

    await waitFor(() => expect(enregistrerBrouillon).toHaveBeenCalled());
    const strates = (jest.mocked(enregistrerBrouillon).mock.calls[0][0].vegetation as { strates: Record<string, unknown> }).strates;
    expect(strates.herbeuse).toMatchObject({ orpad: ['Rare'], feuille: ['Néant'], fleur: ['Néant'], fruit: ['Beaucoup'], sec: ['Néant'] });
    expect(strates.arboree).toMatchObject({ orpad: [], sec: [] });
  });

  it('rouvre une fiche avec les niveaux déjà choisis', async () => {
    const brouillon = fiche({
      vegetation: { strates: { herbeuse: { ...defaultStrateDetail(), recouvrement: 55, feuille: ['Beaucoup'], fleur: ['Rare'] } } },
      sol: { solNu: 45 },
    });
    await render(<VegetationStep brouillon={brouillon} onContinuer={jest.fn()} />);
    expect(niveau('herbeuse', 'feuille', 'Beaucoup')!.props.accessibilityState).toMatchObject({ selected: true });
    expect(niveau('herbeuse', 'fleur', 'Rare')!.props.accessibilityState).toMatchObject({ selected: true });
    expect(niveau('herbeuse', 'sec', 'Rare')).toBeNull();
  });

  it('« Retirer » une strate remet ses stades à Néant : en la rajoutant, rien n’est coché', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByText('+ Arborée'));
    await fireEvent.press(screen.getByLabelText('Augmenter Strate arborée'));
    await fireEvent.press(stade('arboree', 'sec'));
    expect(niveau('arboree', 'sec', 'Rare')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Retirer la Strate arborée'));
    await fireEvent.press(screen.getByText('+ Arborée'));
    expect(stade('arboree', 'sec').props.accessibilityState).toMatchObject({ selected: false });
    expect(niveau('arboree', 'sec', 'Rare')).toBeNull();
  });

  it('à 0 % la strate n’est pas présente : ses puces de stade sont désactivées, et s’activent dès qu’elle a un recouvrement', async () => {
    await render(<VegetationStep brouillon={ficheMaquette()} onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByText('+ Arborée'));
    expect(stade('arboree', 'feuille').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(stade('arboree', 'feuille'));
    expect(niveau('arboree', 'feuille', 'Rare')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Augmenter Strate arborée'));
    expect(stade('arboree', 'feuille').props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(stade('arboree', 'feuille'));
    expect(niveau('arboree', 'feuille', 'Rare')).toBeTruthy();
  });
});
