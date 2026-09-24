import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from './tokens';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}($|T)/;

function fromIsoDate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) return new Date();
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Anciens brouillons pré-datant ce composant : valeur non-ISO affichée telle quelle plutôt que corrompue. */
function formatDateFr(iso: string): string {
  if (!ISO_DATE_RE.test(iso)) return iso;
  const [year, month, day] = iso.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/** Champ de saisie de date avec sélecteur calendrier natif (iOS inline / Android dialog). */
export function DateField({ value, onChange, editable = true, placeholder = 'JJ/MM/AAAA', minimumDate, maximumDate }: DateFieldProps) {
  const [show, setShow] = useState(false);
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

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
      {show && Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.calendarCard} onPress={() => {}}>
              <DateTimePicker
                value={value ? fromIsoDate(value) : new Date()}
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
            value={value ? fromIsoDate(value) : new Date()}
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
    calendarCard: {
      backgroundColor: theme.card,
      borderRadius: traitementRadii.chip,
      padding: 8,
      overflow: 'hidden',
    },
  });
}
