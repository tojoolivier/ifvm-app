import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform, Modal, StyleProp, ViewStyle, TextStyle } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

interface DateFieldProps {
  /** Date au format ISO "AAAA-MM-JJ", ou null/vide si non renseignée. */
  value: string | null;
  onChange: (iso: string) => void;
  editable?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderStyle?: StyleProp<TextStyle>;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}($|T)/;

function fromIsoDate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) return new Date();
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}

/** Anciens brouillons pré-datant ce composant : valeur non-ISO affichée telle quelle plutôt que corrompue. */
function formatDateFr(iso: string): string {
  if (!ISO_DATE_RE.test(iso)) return iso;
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Champ de saisie de date avec sélecteur calendrier natif (iOS inline / Android dialog).
 * Version générique (hors module traitement) — accepte des styles pour s'intégrer aux
 * écrans de prospection, qui n'ont pas de tokens de design centralisés.
 */
export function DateField({
  value,
  onChange,
  editable = true,
  placeholder = 'JJ/MM/AAAA',
  minimumDate,
  maximumDate,
  style,
  textStyle,
  placeholderStyle,
}: DateFieldProps) {
  const [show, setShow] = useState(false);
  const isoValue = value && value.trim().length > 0 ? value : null;
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const defaultStyles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  const onValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    setShow(false);
    onChange(toIsoDate(selectedDate));
  };

  return (
    <View>
      <TouchableOpacity
        style={[defaultStyles.input, style]}
        onPress={() => editable && setShow(true)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={isoValue ? formatDateFr(isoValue) : placeholder}
      >
        <Text style={isoValue ? [defaultStyles.value, textStyle] : [defaultStyles.placeholder, placeholderStyle]}>
          {isoValue ? formatDateFr(isoValue) : placeholder}
        </Text>
      </TouchableOpacity>
      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity style={defaultStyles.backdrop} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableOpacity activeOpacity={1} style={defaultStyles.calendarCard} onPress={() => {}}>
              <DateTimePicker
                value={isoValue ? fromIsoDate(isoValue) : new Date()}
                mode="date"
                display="inline"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onValueChange={onValueChange}
                onDismiss={() => setShow(false)}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={isoValue ? fromIsoDate(isoValue) : new Date()}
            mode="date"
            display="calendar"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
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

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>) {
  return StyleSheet.create({
    input: {
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#e7e0cd',
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: '#fff',
    },
    value: { fontSize: typeSizes.value, fontWeight: '600', color: '#16201a' },
    placeholder: { fontSize: typeSizes.placeholder, fontWeight: '600', color: '#6f6a59' },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarCard: {
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 8,
      overflow: 'hidden',
    },
  });
}
