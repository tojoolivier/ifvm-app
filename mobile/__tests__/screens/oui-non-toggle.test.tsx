/**
 * `OuiNonToggle` — bascule Non/Oui pleine largeur en un seul pavé, remplace
 * les deux `Chip` séparées par un espace sur les binaires Non/Oui de l'écran
 * Impacts & risque (maquette fournie explicitement).
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OuiNonToggle } from '@/components/traitement/OuiNonToggle';

describe('OuiNonToggle', () => {
  it('affiche les deux labels et déclenche onPress du segment pressé', async () => {
    const onPressNon = jest.fn();
    const onPressOui = jest.fn();
    await render(
      <OuiNonToggle
        options={[
          { label: 'Non', selected: true, onPress: onPressNon },
          { label: 'Oui', selected: false, onPress: onPressOui },
        ]}
      />
    );

    expect(screen.getByText('Non')).toBeVisible();
    expect(screen.getByText('Oui')).toBeVisible();

    fireEvent.press(screen.getByText('Oui'));
    expect(onPressOui).toHaveBeenCalledTimes(1);
    expect(onPressNon).not.toHaveBeenCalled();
  });

  it("aucun segment sélectionné n'est un état valide (tri-état, ex. AXES_RISQUE non renseigné)", async () => {
    await render(
      <OuiNonToggle
        options={[
          { label: 'Non', selected: false, onPress: () => {} },
          { label: 'Oui', selected: false, onPress: () => {} },
        ]}
      />
    );

    const non = screen.getByText('Non');
    const oui = screen.getByText('Oui');
    expect(non.parent?.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
    expect(oui.parent?.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  });

  it('applique le style sélectionné (fond vert, texte blanc) au segment actif seulement', async () => {
    await render(
      <OuiNonToggle
        options={[
          { label: 'Non', selected: true, onPress: () => {} },
          { label: 'Oui', selected: false, onPress: () => {} },
        ]}
      />
    );

    const non = screen.getByText('Non');
    const oui = screen.getByText('Oui');
    expect(non.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]));
    expect(oui.props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]));
  });
});
