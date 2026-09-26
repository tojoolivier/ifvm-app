import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Chip } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { ReferenceForm } from '@/hooks/use-reference-form';
import { BIOTOPES } from '@/lib/prospection-reference-schema';

/** Biotope : choix multiple, au moins un. */
export function BiotopeCard({ form }: { form: ReferenceForm }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.biotope')}</Text>
      <form.Field name="biotope">
        {(field) => (
          <View style={styles.rangee}>
            {BIOTOPES.map((b) => (
              <View key={b} style={styles.puce}>
                <Chip
                  label={t(`prospection.reference.biotopes.${b}`)}
                  selected={field.state.value.includes(b)}
                  onPress={() =>
                    field.handleChange(
                      field.state.value.includes(b) ? field.state.value.filter((x) => x !== b) : [...field.state.value, b]
                    )
                  }
                />
              </View>
            ))}
          </View>
        )}
      </form.Field>
    </Card>
  );
}

const styles = StyleSheet.create({ rangee: { flexDirection: 'row', gap: UiSpace[8] }, puce: { flex: 1 } });
