import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, UiOpacity, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconMoins, IconPlus } from './icons';

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Pas configurable (5 par défaut : Recouvrement, Sol nu). */
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  testID?: string;
};

/** Stepper de pourcentage par pas — maquette `Stepper`. */
export function Stepper({ value, onChange, step = 5, min = 0, max = 100, unit = '%', label, testID }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const peutBaisser = value - step >= min;
  const peutMonter = value + step <= max;
  return (
    <View
      testID={testID}
      style={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.stepper.diminuer', { label })}
        disabled={!peutBaisser}
        onPress={() => onChange(Math.max(min, value - step))}
        style={[styles.btn, { backgroundColor: c.surfaceMuted, opacity: peutBaisser ? 1 : UiOpacity.limit }]}
      >
        <IconMoins color={c.fg2} />
      </Pressable>
      <View
        style={styles.valeur}
        accessible
        accessibilityLabel={`${label} : ${value} ${unit}`}
        accessibilityValue={{ min, max, now: value }}
      >
        <Text style={[UiText.numeric, { color: c.fg }]}>
          {value} {unit}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.stepper.augmenter', { label })}
        disabled={!peutMonter}
        onPress={() => onChange(Math.min(max, value + step))}
        style={[styles.btn, { backgroundColor: c.primary, opacity: peutMonter ? 1 : UiOpacity.limit }]}
      >
        <IconPlus color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[4] },
  btn: { width: UiSize.stepperButton, height: UiSize.stepperButton, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  valeur: { minWidth: UiSize.stepperValueMin, height: UiSize.stepperButton, alignItems: 'center', justifyContent: 'center' },
});
