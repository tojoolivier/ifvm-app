import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SolStep } from '@/components/prospection/SolStep';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import { defaultStrateDetail } from '@/lib/prospection-vegetation-schema';

jest.mock('@/lib/prospection-db', () => ({ enregistrerBrouillon: jest.fn() }));

/** Fiche de la maquette 03 : sol nu 20 + herbeuse 50 + arbustive 30. */
const fiche = (extra: Partial<ProspectionCreate> = {}) =>
  ({
    id: 'b-3',
    type_prospection: 'intensive',
    campagne_id: 'camp-1',
    equipe_id: 'eq-1',
    date_prospection: '2026-09-25',
    vegetation: {
      strates: {
        herbeuse: { ...defaultStrateDetail(), recouvrement: 50 },
        arbustive: { ...defaultStrateDetail(), recouvrement: 30 },
      },
    },
    sol: { solNu: 20 },
    ...extra,
  }) as ProspectionCreate & { id: string };

const choisi = (testID: string) => screen.getByTestId(testID).props.accessibilityState.selected;
const bouton = () => screen.getByTestId('sol-continuer');

describe('SolStep — contenu (maquette 03)', () => {
  it('rappel de la répartition avec « Modifier » vers l’étape Végétation', async () => {
    const onModifier = jest.fn();
    await render(<SolStep brouillon={fiche()} onContinuer={jest.fn()} onModifier={onModifier} />);
    expect(screen.getByText('Végétation enregistrée')).toBeTruthy();
    expect(screen.getByText('Sol nu 20 · Herbeuse 50 · Arbustive 30')).toBeTruthy();
    await fireEvent.press(screen.getByText('Modifier'));
    expect(onModifier).toHaveBeenCalledTimes(1);
  });

  it('humidité (5 profondeurs), texture (7) et dégâts (4), avec leurs consignes', async () => {
    await render(<SolStep brouillon={fiche()} onContinuer={jest.fn()} onModifier={jest.fn()} />);
    expect(screen.getByText('Profondeurs où le sol est humide — plusieurs choix possibles.')).toBeTruthy();
    for (const l of ['Surface', '0,5 cm', '5–12 cm', '12–30 cm', '> 30 cm', 'Argileuse', 'Limoneuse', 'Sable fin', 'Sable grossier', 'Gravier', 'Cailloux', 'Bloc', 'Nuls', 'Faibles', 'Moyens', 'Forts']) {
      expect(screen.getByText(l)).toBeTruthy();
    }
    expect(screen.getByText('Un seul choix.')).toBeTruthy();
  });
});

describe('SolStep — sélections', () => {
  it('humidité et texture : plusieurs choix, coché « ✓ », retoucher décoche', async () => {
    await render(<SolStep brouillon={fiche()} onContinuer={jest.fn()} onModifier={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('humidite-5_12cm'));
    await fireEvent.press(screen.getByTestId('humidite-12_30cm'));
    expect(choisi('humidite-5_12cm')).toBe(true);
    expect(choisi('humidite-12_30cm')).toBe(true);
    expect(screen.getByText('✓ 5–12 cm')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('humidite-5_12cm'));
    expect(choisi('humidite-5_12cm')).toBe(false);
    expect(choisi('humidite-12_30cm')).toBe(true);
  });

  it('dégâts : un seul choix, Moyens remplace Faibles, retoucher désélectionne', async () => {
    await render(<SolStep brouillon={fiche()} onContinuer={jest.fn()} onModifier={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('degats-faibles'));
    await fireEvent.press(screen.getByTestId('degats-moyens'));
    expect(choisi('degats-faibles')).toBe(false);
    expect(choisi('degats-moyens')).toBe(true);
    await fireEvent.press(screen.getByTestId('degats-moyens'));
    expect(choisi('degats-moyens')).toBe(false);
  });
});

describe('SolStep — « Continuer »', () => {
  it('humidité et texture obligatoires : le bouton dit ce qu’il manque, puis s’active', async () => {
    await render(<SolStep brouillon={fiche()} onContinuer={jest.fn()} onModifier={jest.fn()} />);
    expect(screen.getByText('Il manque : Humidité du sol, Texture du sol')).toBeTruthy();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('humidite-surface'));
    expect(screen.getByText('Il manque : Texture du sol')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('texture-bloc'));
    expect(screen.getByText('Continuer')).toBeTruthy();
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('enregistre humidite[] et texture[] dans sol (solNu gardé) et degats_cultures, puis continue', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockResolvedValue('b-3');
    const onContinuer = jest.fn();
    await render(<SolStep brouillon={fiche()} onContinuer={onContinuer} onModifier={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('humidite-5_12cm'));
    await fireEvent.press(screen.getByTestId('texture-argileuse'));
    await fireEvent.press(screen.getByTestId('texture-sable_grossier'));
    await fireEvent.press(screen.getByTestId('degats-nuls'));
    await fireEvent.press(bouton());

    await waitFor(() => expect(onContinuer).toHaveBeenCalled());
    const saisie = jest.mocked(enregistrerBrouillon).mock.calls[0][0];
    expect(saisie).toMatchObject({
      id: 'b-3',
      sol: { solNu: 20, humidite: ['5_12cm'], texture: ['argileuse', 'sable_grossier'] },
      degats_cultures: 'nuls',
    });
    expect((saisie.vegetation as { strates: { herbeuse: { recouvrement: number } } }).strates.herbeuse.recouvrement).toBe(50);
  });

  it('rouvre une fiche avec ses choix déjà cochés', async () => {
    await render(
      <SolStep
        brouillon={fiche({ sol: { solNu: 20, humidite: ['surface'], texture: ['gravier'] }, degats_cultures: 'forts' })}
        onContinuer={jest.fn()}
        onModifier={jest.fn()}
      />
    );
    expect(choisi('humidite-surface')).toBe(true);
    expect(choisi('texture-gravier')).toBe(true);
    expect(choisi('degats-forts')).toBe(true);
    expect(bouton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('un échec d’enregistrement reste sur l’écran avec un message', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockRejectedValue(new Error('disque plein'));
    const onContinuer = jest.fn();
    await render(<SolStep brouillon={fiche({ sol: { solNu: 20, humidite: ['surface'], texture: ['bloc'] } })} onContinuer={onContinuer} onModifier={jest.fn()} />);
    await fireEvent.press(bouton());
    expect(await screen.findByText(/Le sol n’a pas pu être enregistré/)).toBeTruthy();
    expect(onContinuer).not.toHaveBeenCalled();
  });
});
