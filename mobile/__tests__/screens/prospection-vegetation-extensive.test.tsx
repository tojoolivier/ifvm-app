import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VegetationExtensiveStep } from '@/components/prospection/VegetationExtensiveStep';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';

jest.mock('@/lib/prospection-db', () => ({ enregistrerBrouillon: jest.fn() }));

const fiche = (extra: Partial<ProspectionCreate> = {}) =>
  ({ id: 'b-2', type_prospection: 'extensive', campagne_id: 'camp-1', equipe_id: 'eq-1', date_prospection: '2026-09-25', ...extra }) as ProspectionCreate & { id: string };

const choisi = (testID: string) => screen.getByTestId(testID).props.accessibilityState.selected;

describe('VegetationExtensiveStep — contenu (maquette 02a)', () => {
  it('bandeau info, strate herbeuse seule (hauteur en cm + verdissement) et dégâts ; ni autres strates, ni phénologie, ni répartition', async () => {
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={jest.fn()} />);
    expect(screen.getByText(/Relevé extensif : seule la strate herbeuse est demandée/)).toBeTruthy();
    expect(screen.getByText('Strate herbeuse')).toBeTruthy();
    expect(screen.getByText('Nourriture et site de ponte des criquets')).toBeTruthy();
    expect(screen.getByText('Hauteur moyenne')).toBeTruthy();
    expect(screen.getByText('cm')).toBeTruthy();
    expect(screen.getByText('Verdissement rapide')).toBeTruthy();
    expect(screen.getByText('Dégâts sur les cultures')).toBeTruthy();
    for (const absent of ['Répartition de la station', 'Sol nu', 'Qu’observez-vous ?', 'Ajouter une strate présente', '+ Arborée']) {
      expect(screen.queryByText(absent)).toBeNull();
    }
  });

  it('rouvre une fiche avec ses valeurs : hauteur 40,5 cm, verdissement 60, dégâts faibles', async () => {
    await render(
      <VegetationExtensiveStep brouillon={fiche({ hauteur_herbe_cm: 40.5, verdissement_pourcent: 60, degats_cultures: 'faibles' })} onContinuer={jest.fn()} />
    );
    expect(screen.getByDisplayValue('40,5')).toBeTruthy();
    expect(screen.getByDisplayValue('60')).toBeTruthy();
    expect(choisi('degats-faibles')).toBe(true);
  });
});

describe('VegetationExtensiveStep — raccourcis et dégâts', () => {
  it('un raccourci remplit le verdissement ; le champ libre reste modifiable', async () => {
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={jest.fn()} />);
    for (const l of ['0 %', '25 %', '50 %', '75 %', '100 %']) expect(screen.getByText(l)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('raccourci-75'));
    expect(screen.getByTestId('extensive-verdissement').props.value).toBe('75');
    expect(choisi('raccourci-75')).toBe(true);
    await fireEvent.changeText(screen.getByTestId('extensive-verdissement'), '62');
    expect(choisi('raccourci-75')).toBe(false);
  });

  it('dégâts : un seul choix ; Moyens remplace Faibles ; retoucher le choix le désélectionne', async () => {
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('degats-faibles'));
    await fireEvent.press(screen.getByTestId('degats-moyens'));
    expect(choisi('degats-faibles')).toBe(false);
    expect(choisi('degats-moyens')).toBe(true);
    await fireEvent.press(screen.getByTestId('degats-moyens'));
    expect(choisi('degats-moyens')).toBe(false);
  });
});

describe('VegetationExtensiveStep — « Continuer »', () => {
  it('enregistre les colonnes hauteur_herbe_cm, verdissement_pourcent, degats_cultures (pas de JSON vegetation), puis continue', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockResolvedValue('b-2');
    const onContinuer = jest.fn();
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={onContinuer} />);
    await fireEvent.changeText(screen.getByTestId('extensive-hauteur'), '40,5');
    await fireEvent.press(screen.getByTestId('raccourci-50'));
    await fireEvent.press(screen.getByTestId('degats-forts'));
    await fireEvent.press(screen.getByTestId('vegetation-extensive-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalled());
    const saisie = jest.mocked(enregistrerBrouillon).mock.calls[0][0];
    expect(saisie).toMatchObject({ id: 'b-2', hauteur_herbe_cm: 40.5, verdissement_pourcent: 50, degats_cultures: 'forts' });
    expect(saisie.vegetation).toBeNull();
  });

  it('une fiche extensive rouverte avec un JSON vegetation hérité ne le garde pas : « pas de vegetation JSON en extensif »', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockResolvedValue('b-2');
    const onContinuer = jest.fn();
    await render(<VegetationExtensiveStep brouillon={fiche({ vegetation: { strates: { herbeuse: { recouvrement: 50 } } } })} onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('vegetation-extensive-continuer'));

    await waitFor(() => expect(onContinuer).toHaveBeenCalled());
    expect(jest.mocked(enregistrerBrouillon).mock.calls[0][0].vegetation).toBeNull();
  });

  it('un verdissement hors 0–100 affiche l’erreur et bloque « Continuer »', async () => {
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('extensive-verdissement'), '101');
    expect(await screen.findByText('Saisissez un pourcentage entre 0 et 100.')).toBeTruthy();
    expect(screen.getByTestId('vegetation-extensive-continuer').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('un échec d’enregistrement reste sur l’écran avec un message', async () => {
    jest.mocked(enregistrerBrouillon).mockReset().mockRejectedValue(new Error('disque plein'));
    const onContinuer = jest.fn();
    await render(<VegetationExtensiveStep brouillon={fiche()} onContinuer={onContinuer} />);
    await fireEvent.press(screen.getByTestId('vegetation-extensive-continuer'));
    expect(await screen.findByText(/La végétation n’a pas pu être enregistrée/)).toBeTruthy();
    expect(onContinuer).not.toHaveBeenCalled();
  });
});
