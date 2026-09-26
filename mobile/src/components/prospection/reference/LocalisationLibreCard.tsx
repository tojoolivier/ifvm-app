import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Card, NumberField } from '@/components/ui';
import { UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { ErreursReference, ReferenceForm } from '@/hooks/use-reference-form';

/** Extensive / validation : pas de station du référentiel, la station est une saisie libre. */
export function LocalisationLibreCard({ form, erreurs }: { form: ReferenceForm; erreurs: ErreursReference }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.localisation')}</Text>
      <form.Field name="station_libre">
        {(field) => (
          <NumberField
            label={t('prospection.reference.stationLibre')}
            value={field.state.value}
            onChangeText={field.handleChange}
            onBlur={field.handleBlur}
            clavier="default"
            error={erreurs.erreurChamp('station_libre')}
            testID="station-libre"
          />
        )}
      </form.Field>
    </Card>
  );
}
