import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { formaterDateHeure } from '@/lib/prospection-reference';

/** Horodatage généré du relevé (affichage seul). */
export function DateReleveCard({ horodatage }: { horodatage: Date }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card>
      <View style={styles.texte}>
        <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.dateReleve')}</Text>
        <Text testID="date-releve" style={[UiText.bodyMedium, { color: c.fg }]}>
          {formaterDateHeure(horodatage)}
        </Text>
        <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.horodatageAuto')}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ texte: { gap: UiSpace[4] } });
