import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform, Modal, StyleProp, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from './tokens';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

interface TimeFieldProps {
  /** Heure au format "HH:mm", ou null si non renseignée. */
  value: string | null;
  onChange: (hhmm: string) => void;
  editable?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
}

const HHMM_RE = /^\d{1,2}:\d{2}$/;

function toHhmm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Anciens brouillons pré-datant ce composant : valeur mal formée -> heure courante plutôt que NaN. */
function fromHhmm(hhmm: string): Date {
  if (!HHMM_RE.test(hhmm)) return new Date();
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/** Champ de saisie d'heure avec sélecteur natif (iOS inline / Android dialog), en parité avec DateField. */
export function TimeField({ value, onChange, editable = true, placeholder = 'hh:mm', style, textStyle, placeholderStyle }: TimeFieldProps) {
  const [show, setShow] = useState(false);
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const onValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    setShow(false);
    onChange(toHhmm(selectedDate));
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.input, style]}
        onPress={() => editable && setShow(true)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={value ?? placeholder}
      >
        <Text style={value ? [styles.value, textStyle] : [styles.placeholder, placeholderStyle]}>{value ?? placeholder}</Text>
      </TouchableOpacity>
      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.pickerCard} onPress={() => {}}>
              <DateTimePicker
                value={value ? fromHhmm(value) : new Date()}
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
            value={value ? fromHhmm(value) : new Date()}
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

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    input: {
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.chip,
      paddingHorizontal: 10,
      backgroundColor: theme.card,
    },
    value: { fontFamily: traitementFonts.ui, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    placeholder: { fontFamily: traitementFonts.ui, fontSize: typeSizes.corps, color: traitementColors.texteLabel },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerCard: {
      backgroundColor: theme.card,
      borderRadius: traitementRadii.chip,
      padding: 8,
      overflow: 'hidden',
    },
  });
}
