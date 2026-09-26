import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Radius, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { FieldError } from './FieldError';

type Props = {
  label: string;
  /** Texte saisi — la virgule française est acceptée, le parent décide du parsing. */
  value: string;
  onChangeText: (text: string) => void;
  unit?: string;
  /** Message d'erreur affiché sous le champ (état erreur). */
  error?: string | null;
  onBlur?: () => void;
  testID?: string;
};

/** Champ numérique décimal avec unité — maquette `NumberField`. */
export function NumberField({ label, value, onChangeText, unit, error, onBlur, testID }: Props) {
  const c = useUiTheme();
  return (
    <View style={styles.root}>
      <Text style={[UiText.captionMedium, { color: c.fg3 }]}>{label}</Text>
      <View
        style={[
          styles.champ,
          { backgroundColor: c.surface, borderColor: error ? c.dangerText : c.borderField },
        ]}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="decimal-pad"
          accessibilityLabel={unit ? `${label} (${unit})` : label}
          placeholderTextColor={c.fgWeak}
          style={[UiText.bodyMedium, styles.input, { color: c.fg }]}
        />
        {unit ? <Text style={[UiText.captionMedium, { color: c.fgWeak }]}>{unit}</Text> : null}
      </View>
      <FieldError message={error} testID={testID ? `${testID}-erreur` : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  champ: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
  },
  input: { flex: 1, padding: 0 },
});
