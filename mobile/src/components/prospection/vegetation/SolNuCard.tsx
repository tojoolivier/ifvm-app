import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Stepper } from '@/components/ui';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import type { VegetationForm } from '@/hooks/use-vegetation-form';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { JETON_COULEUR } from './couleurs';

/** Sol nu : surface de la station sans végétation, réglée par pas de 5 % (rangée dans le JSON `sol`). */
export function SolNuCard({ form }: { form: VegetationForm }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card testID="strate-sol-nu">
      <View style={styles.entete}>
        <View style={[styles.pastille, { backgroundColor: c[JETON_COULEUR.sol_nu] as string }]} />
        <View style={styles.flex}>
          <Text style={[UiText.subheading, { color: c.fg }]}>{t('prospection.vegetation.solNu')}</Text>
          <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.vegetation.solNuDetail')}</Text>
        </View>
        <form.Field name="solNu">
          {(field) => (
            <Stepper value={field.state.value} onChange={field.handleChange} label={t('prospection.vegetation.solNu')} testID="recouvrement-sol-nu" />
          )}
        </form.Field>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10] },
  pastille: { width: UiSize.pastilleStrate, height: UiSize.pastilleStrate, borderRadius: Radius.full },
});
