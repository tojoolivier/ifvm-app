import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform, Modal, StyleProp, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

interface TimeFieldProps {
  /** Heure au format "HH:mm", ou null/vide si non renseignée. */
  value: string | null;
  onChange: (hhmm: string) => void;
  editable?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
}

function toHhmm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const HHMM_RE = /^\d{1,2}:\d{2}$/;

/** Anciens brouillons pré-datant ce composant : valeur mal formée -> heure courante plutôt que NaN. */
function fromHhmm(hhmm: string): Date {
  if (!HHMM_RE.test(hhmm)) return new Date();
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/**
 * Champ de saisie d'heure avec sélecteur natif (iOS inline / Android dialog).
 * Version générique (hors module traitement), en parité avec DateField.
 */
export function TimeField({
  value,
  onChange,
  editable = true,
  placeholder = 'hh:mm',
  style,
  textStyle,
  placeholderStyle,
}: TimeFieldProps) {
  const [show, setShow] = useState(false);
  const hhmmValue = value && value.trim().length > 0 ? value : null;
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const theme = useTheme();
  const defaultStyles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const onValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    setShow(false);
    onChange(toHhmm(selectedDate));
  };

  return (
    <View>
      <TouchableOpacity
        style={[defaultStyles.input, style]}
        onPress={() => editable && setShow(true)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={hhmmValue ?? placeholder}
      >
        <Text style={hhmmValue ? [defaultStyles.value, textStyle] : [defaultStyles.placeholder, placeholderStyle]}>
          {hhmmValue ?? placeholder}
        </Text>
      </TouchableOpacity>
      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity style={defaultStyles.backdrop} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableOpacity activeOpacity={1} style={defaultStyles.pickerCard} onPress={() => {}}>
              <DateTimePicker
                value={hhmmValue ? fromHhmm(hhmmValue) : new Date()}
                mode="time"
                display="spinner"
                onValueChange={onValueChange}
                onDismiss={() => setShow(false)}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={hhmmValue ? fromHhmm(hhmmValue) : new Date()}
            mode="time"
            display="clock"
            onValueChange={onValueChange}
            onDismiss={() => setShow(false)}
          />
        )
      )}
    </View>
  );
}

const BASE_TYPE_SIZES = {
  value: 13,
  placeholder: 13,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    input: {
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: theme.card,
    },
    value: { fontSize: typeSizes.value, fontWeight: '600', color: theme.text },
    placeholder: { fontSize: typeSizes.placeholder, fontWeight: '600', color: theme.muted },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerCard: {
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 8,
      overflow: 'hidden',
    },
  });
}
