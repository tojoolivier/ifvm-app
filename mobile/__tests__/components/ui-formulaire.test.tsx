/**
 * Intégration TanStack Form + Yup + socle UI (#721) : les erreurs du schéma
 * alimentent le message sous le champ, le bandeau et le bouton « Il manque : … ».
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useForm } from '@tanstack/react-form';
import * as yup from 'yup';
import { Banner, NumberField, PrimaryButton } from '@/components/ui';
import { useErreursFormulaire } from '@/hooks/use-erreurs-formulaire';
import { premierMessage } from '@/lib/form-errors';

const schema = yup.object({ largeur: yup.string().required('Largeur requise') });
const libelles = { largeur: 'Largeur' };

function Formulaire({ onSubmit }: { onSubmit: () => void }) {
  const form = useForm({
    defaultValues: { largeur: '' },
    validators: { onChangeAsync: schema },
    onSubmit,
  });
  const { manques, resume, erreurChamp, aTenteDeSoumettre } = useErreursFormulaire(form, schema, libelles);
  return (
    <>
      {aTenteDeSoumettre && resume.length > 0 ? <Banner tone="error" message="À corriger" items={resume} /> : null}
      <form.Field name="largeur">
        {(field) => (
          <NumberField
            label="Largeur"
            value={field.state.value}
            onChangeText={field.handleChange}
            onBlur={field.handleBlur}
            error={erreurChamp('largeur') ?? premierMessage(field.state.meta.errors)}
          />
        )}
      </form.Field>
      <PrimaryButton label="Continuer" manques={manques} onPress={() => void form.handleSubmit()} />
    </>
  );
}

describe('formulaire TanStack + Yup', () => {
  it('désactive le bouton avec « Il manque : Largeur » sans afficher d’erreur sur un formulaire vierge', async () => {
    await render(<Formulaire onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Il manque : Largeur' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('active le bouton et soumet une fois le champ rempli', async () => {
    const onSubmit = jest.fn();
    await render(<Formulaire onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByLabelText('Largeur'), '2');
    const bouton = screen.getByRole('button', { name: 'Continuer' });
    expect(bouton.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(bouton);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('affiche l’erreur sous le champ quand on vide un champ touché', async () => {
    await render(<Formulaire onSubmit={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Largeur'), '2');
    await fireEvent.changeText(screen.getByLabelText('Largeur'), '');
    await fireEvent(screen.getByLabelText('Largeur'), 'blur');
    expect(screen.getByRole('alert')).toHaveTextContent('Largeur requise');
  });
});
