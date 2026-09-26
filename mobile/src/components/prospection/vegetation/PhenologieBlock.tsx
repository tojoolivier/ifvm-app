import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui';
import { Radius, UiBorder, UiSize, UiSpace, UiText } from '@/constants/theme';
import type { VegetationForm } from '@/hooks/use-vegetation-form';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { STADES_PHENOLOGIE, type StrateKey } from '@/lib/prospection-vegetation-schema';

type Props = {
  cle: StrateKey;
  form: VegetationForm;
  /** La phrase d'aide n'est affichée que sous la strate principale (maquette 02b). */
  avecAide?: boolean;
};

/**
 * Bloc « Qu'observez-vous ? » d'une strate : on touche seulement les stades présents (Rare présélectionné),
 * puis un seul niveau Rare / Beaucoup par stade touché. Tout stade non touché vaut Néant.
 */
export function PhenologieBlock({ cle, form, avecAide }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.bloc}>
      <View style={[styles.filet, { backgroundColor: c.border }]} />
      <View style={styles.titres}>
        <Text style={[UiText.subheading, { color: c.fg }]}>{t('prospection.vegetation.phenologie.titre')}</Text>
        {avecAide ? <Text style={[UiText.caption, { color: c.fg3 }]}>{t('prospection.vegetation.phenologie.aide')}</Text> : null}
      </View>
      <View style={styles.stades}>
        {STADES_PHENOLOGIE.map((stade) => (
          <form.Field key={stade} name={`strates.${cle}.phenologie.${stade}`}>
            {(field) => {
              const nom = t(`prospection.vegetation.phenologie.${stade}`);
              const touche = field.state.value !== 'Néant';
              return (
                <Chip
                  label={touche ? t('prospection.vegetation.phenologie.stadePresent', { stade: nom }) : nom}
                  selected={touche}
                  onPress={() => field.handleChange(touche ? 'Néant' : 'Rare')}
                  testID={`stade-${cle}-${stade}`}
                />
              );
            }}
          </form.Field>
        ))}
      </View>
      <form.Subscribe selector={(s) => STADES_PHENOLOGIE.filter((stade) => s.values.strates[cle].phenologie[stade] !== 'Néant')}>
        {(touches) =>
          touches.length > 0 ? (
            <View style={[styles.niveaux, { backgroundColor: c.greenBg }]}>
              {touches.map((stade) => (
                <form.Field key={stade} name={`strates.${cle}.phenologie.${stade}`}>
                  {(field) => (
                    <View style={styles.niveau}>
                      <Text style={[UiText.bodyMedium, styles.flex, { color: c.fg2 }]}>{t(`prospection.vegetation.phenologie.${stade}`)}</Text>
                      {(['Rare', 'Beaucoup'] as const).map((n) => (
                        <View key={n} style={styles.chipNiveau}>
                          <Chip
                            label={t(`prospection.vegetation.phenologie.${n}`)}
                            selected={field.state.value === n}
                            onPress={() => field.handleChange(n)}
                            testID={`niveau-${cle}-${stade}-${n}`}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </form.Field>
              ))}
            </View>
          ) : null
        }
      </form.Subscribe>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bloc: { gap: UiSpace[14] },
  filet: { height: UiBorder.hairline },
  titres: { gap: UiSpace[2] },
  stades: { flexDirection: 'row', flexWrap: 'wrap', columnGap: UiSpace[6], rowGap: UiSpace[8] },
  niveaux: { padding: UiSpace[12], borderRadius: Radius.sm, gap: UiSpace[8] },
  niveau: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[6] },
  chipNiveau: { width: UiSize.chipNiveau },
});
