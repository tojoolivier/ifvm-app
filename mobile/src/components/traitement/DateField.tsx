import { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from './tokens';

interface DateFieldProps {
  /** Date au format ISO "AAAA-MM-JJ", ou null si non renseignée. */
  value: string | null;
  onChange: (iso: string) => void;
  editable?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateFr(iso: string): string {
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/** Champ de saisie de date avec sélecteur calendrier natif (iOS inline / Android dialog). */
export function DateField({ value, onChange, editable = true, placeholder = 'JJ/MM/AAAA', minimumDate, maximumDate }: DateFieldProps) {
  const [show, setShow] = useState(false);

  const onValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    setShow(false);
    onChange(toIsoDate(selectedDate));
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.input}
        onPress={() => editable && setShow(true)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={value ? formatDateFr(value) : placeholder}
      >
        <Text style={value ? styles.value : styles.placeholder}>{value ? formatDateFr(value) : placeholder}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ? fromIsoDate(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={onValueChange}
          onDismiss={() => setShow(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  value: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  placeholder: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteLabel },
});
