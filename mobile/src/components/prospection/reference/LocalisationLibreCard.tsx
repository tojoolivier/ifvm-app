import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Card, NumberField } from '@/components/ui';
import { AppIcon } from '@/components/ui/AppIcon';
import { UiSize, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { ErreursReference, ReferenceForm } from '@/hooks/use-reference-form';
import { formaterDateHeure } from '@/lib/prospection-reference';
import { LigneDetectee, Separateur } from './LigneDetectee';

type Props = { form: ReferenceForm; erreurs: ErreursReference; horodatage: Date };

/** Extensive / validation : pas de station du référentiel — station en saisie libre, puis date du relevé. */
export function LocalisationLibreCard({ form, erreurs, horodatage }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.localisation')}</Text>
      <form.Field name="station_libre">
        {(field) => (
          <>
            <NumberField
              label={t('prospection.reference.stationLibre')}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              clavier="default"
              error={erreurs.erreurChamp('station_libre')}
              testID="station-libre"
            />
            <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.stationLibreNote')}</Text>
          </>
        )}
      </form.Field>
      <Separateur />
      <LigneDetectee
        icone={<AppIcon name="heures-de-vol" boite={UiSize.iconeLigne} color={c.primary} />}
        libelle={t('prospection.reference.dateReleve')}
        valeur={formaterDateHeure(horodatage)}
        valeurTestID="date-releve"
        note={t('prospection.reference.horodatageAuto')}
      />
    </Card>
  );
}
