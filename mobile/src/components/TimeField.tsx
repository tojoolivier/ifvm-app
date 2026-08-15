import { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform, Modal, StyleProp, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';

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

const defaultStyles = StyleSheet.create({
  input: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e7e0cd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  value: { fontSize: 13, fontWeight: '600', color: '#16201a' },
  placeholder: { fontSize: 13, fontWeight: '600', color: '#6f6a59' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    overflow: 'hidden',
  },
});
