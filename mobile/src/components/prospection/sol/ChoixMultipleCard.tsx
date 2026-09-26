import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Chip } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { SolForm } from '@/hooks/use-sol-form';

type Props = {
  champ: 'humidite' | 'texture';
  form: SolForm;
  titre: string;
  aide: string;
  /** Codes proposés, dans l'ordre de la maquette. */
  options: readonly string[];
  libelle: (code: string) => string;
  testIDPrefix: string;
};

/** Carte à choix multiple (humidité, texture) : une puce par code, cochée « ✓ » quand elle est choisie. */
export function ChoixMultipleCard({ champ, form, titre, aide, options, libelle, testIDPrefix }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card testID={`sol-${champ}`}>
      <View style={styles.titres}>
        <Text style={[UiText.subheading, { color: c.fg }]}>{titre}</Text>
        <Text style={[UiText.caption, { color: c.fg3 }]}>{aide}</Text>
      </View>
      <form.Field name={champ}>
        {(field) => (
          <View style={styles.choix}>
            {options.map((code) => {
              const choisi = (field.state.value as string[]).includes(code);
              return (
                <Chip
                  key={code}
                  label={choisi ? t('ui.choisi', { libelle: libelle(code) }) : libelle(code)}
                  selected={choisi}
                  onPress={() => field.handleChange((choisi ? (field.state.value as string[]).filter((v) => v !== code) : [...(field.state.value as string[]), code]) as never)}
                  testID={`${testIDPrefix}-${code}`}
                />
              );
            })}
          </View>
        )}
      </form.Field>
    </Card>
  );
}

const styles = StyleSheet.create({
  titres: { gap: UiSpace[2] },
  choix: { flexDirection: 'row', flexWrap: 'wrap', columnGap: UiSpace[6], rowGap: UiSpace[8] },
});
