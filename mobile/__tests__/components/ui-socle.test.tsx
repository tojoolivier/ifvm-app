/**
 * Socle UI de la réécriture (#721) — comportement et accessibilité des composants
 * de `components/ui/` : rôles, états sélectionné/désactivé, erreurs annoncées.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  AppHeader,
  Banner,
  BottomSheet,
  Card,
  Chip,
  FieldError,
  NumberField,
  PrimaryButton,
  StatTile,
  Stepper,
  TimelineItem,
  WizardHeader,
} from '@/components/ui';

describe('Chip', () => {
  it('expose l’état sélectionné et réagit à l’appui', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Dense" selected onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Dense' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('est non sélectionnée à l’état Off', async () => {
    await render(<Chip label="Dense" selected={false} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Dense' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });
});

describe('Stepper', () => {
  it('avance et recule du pas configuré', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Recouvrement" value={15} step={5} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Recouvrement' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Recouvrement' }));
    expect(onChange).toHaveBeenNthCalledWith(1, 20);
    expect(onChange).toHaveBeenNthCalledWith(2, 10);
    expect(screen.getByText('15 %')).toBeTruthy();
  });

  it('désactive les boutons aux bornes', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Sol nu" value={0} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuer Sol nu' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respecte un pas non standard', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Pas 10" value={10} step={10} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Augmenter Pas 10' }));
    expect(onChange).toHaveBeenCalledWith(20);
  });
});

describe('NumberField', () => {
  it('transmet la saisie (virgule française comprise)', async () => {
    const onChangeText = jest.fn();
    await render(<NumberField label="Largeur" unit="m" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Largeur (m)'), '1,5');
    expect(onChangeText).toHaveBeenCalledWith('1,5');
  });

  it('annonce le message d’erreur sous le champ', async () => {
    await render(<NumberField label="Largeur" value="" onChangeText={jest.fn()} error="Valeur requise" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Valeur requise');
  });

  it('n’affiche aucune alerte sans erreur', async () => {
    await render(<NumberField label="Largeur" value="2" onChangeText={jest.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PrimaryButton', () => {
  it('appelle onPress à l’état Enabled', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Continuer" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('est désactivé et affiche « Il manque : … » quand des champs manquent', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Continuer" onPress={onPress} manques={['Recouvrement', 'Sol nu']} />);
    const bouton = screen.getByRole('button', { name: 'Il manque : Recouvrement, Sol nu' });
    expect(bouton.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(bouton);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('garde son libellé quand disabled sans champs manquants', async () => {
    await render(<PrimaryButton label="Continuer" onPress={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Continuer' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('gère la variante Secondary', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Retour" variant="secondary" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('WizardHeader', () => {
  it('affiche titre, badge, étape N sur M et la progression', async () => {
    await render(
      <WizardHeader
        titre="Nouvelle prospection"
        sousTitre="Intensive · FI-1"
        badge="Intensive"
        etape={3}
        total={5}
        libelleEtape="Sol"
        testID="wh"
      />
    );
    expect(screen.getByText('Nouvelle prospection')).toBeTruthy();
    expect(screen.getByText('Intensive')).toBeTruthy();
    expect(screen.getByText('Étape 3 sur 5')).toBeTruthy();
    expect(screen.getByText('Sol')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ min: 1, max: 5, now: 3 });
    expect(screen.getAllByTestId(/^wh-seg-/)).toHaveLength(5);
  });

  it('déclenche le retour', async () => {
    const onBack = jest.fn();
    await render(<WizardHeader titre="T" etape={1} total={5} libelleEtape="Référence" onBack={onBack} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('AppHeader', () => {
  it('affiche titre/sous-titre et n’a pas de retour sans onBack', async () => {
    await render(<AppHeader titre="Journal" sousTitre="Aujourd’hui" />);
    expect(screen.getByRole('header')).toHaveTextContent('Journal');
    expect(screen.getByText('Aujourd’hui')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
  });
});

describe('TimelineItem', () => {
  it.each(['Vol', 'Poser', 'Base'] as const)('décrit l’étape %s pour les lecteurs d’écran', async (type) => {
    await render(<TimelineItem type={type} titre="Décollage" detail="Ivato" heure="08:15" />);
    expect(screen.getByLabelText(`${type} 08:15 : Décollage, Ivato`)).toBeTruthy();
  });
});

describe('StatTile', () => {
  it('lit le libellé et la valeur ensemble', async () => {
    await render(<StatTile libelle="Temps de vol" valeur="1 h 38" />);
    expect(screen.getByLabelText('Temps de vol : 1 h 38')).toBeTruthy();
  });
});

describe('Banner', () => {
  it.each(['warning', 'error'] as const)('le ton %s est annoncé comme alerte', async (tone) => {
    await render(<Banner tone={tone} message="Attention" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Attention');
  });

  it('le ton info n’est pas une alerte', async () => {
    await render(<Banner tone="info" message="Info" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('liste les erreurs du récapitulatif', async () => {
    await render(<Banner tone="error" message="À corriger" items={['Largeur', 'Sol nu']} />);
    expect(screen.getByText('• Largeur')).toBeTruthy();
    expect(screen.getByText('• Sol nu')).toBeTruthy();
  });
});

describe('BottomSheet', () => {
  it('affiche son contenu et se ferme depuis le fond', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible titre="Équipe" onClose={onClose}>
        <StatTile libelle="a" valeur="b" />
      </BottomSheet>
    );
    expect(screen.getByRole('header')).toHaveTextContent('Équipe');
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ne rend rien quand masquée', async () => {
    await render(
      <BottomSheet visible={false} titre="Équipe" onClose={jest.fn()}>
        <StatTile libelle="a" valeur="b" />
      </BottomSheet>
    );
    expect(screen.queryByText('Équipe')).toBeNull();
  });
});

describe('FieldError', () => {
  it('annonce le message', async () => {
    await render(<FieldError message="Valeur requise" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Valeur requise');
  });

  it('ne rend rien sans message', async () => {
    await render(<FieldError message={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Card', () => {
  it('rend ses enfants', async () => {
    await render(
      <Card testID="carte">
        <StatTile libelle="a" valeur="b" />
      </Card>
    );
    expect(screen.getByTestId('carte')).toBeTruthy();
    expect(screen.getByLabelText('a : b')).toBeTruthy();
  });
});
