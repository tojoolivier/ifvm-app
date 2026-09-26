import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, NumberField, Stepper } from '@/components/ui';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import type { ErreursVegetation, VegetationForm } from '@/hooks/use-vegetation-form';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { StrateKey } from '@/lib/prospection-vegetation-schema';
import { JETON_COULEUR } from './couleurs';

type Props = {
  cle: StrateKey;
  form: VegetationForm;
  erreurs: ErreursVegetation;
  /** La strate principale (herbeuse) ne se retire pas ; les strates ajoutées, si. */
  onRetirer?: () => void;
};

/** Carte à plat d'une strate (maquette 02b) : Recouvrement dans l'en-tête, puis H. moyenne et Verdissement. */
export function StrateCard({ cle, form, erreurs, onRetirer }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const nom = t(`prospection.vegetation.strates.${cle}`);
  const champ = (sous: 'hMoy' | 'verdissement', label: string, unite: string) => {
    const chemin = `strates.${cle}.${sous}` as const;
    return (
      <View style={styles.flex}>
        <form.Field name={chemin}>
          {(field) => (
            <NumberField
              label={label}
              unit={unite}
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.value !== '' ? erreurs.parChamp[chemin] : undefined}
              testID={`${cle}-${sous}`}
            />
          )}
        </form.Field>
      </View>
    );
  };

  return (
    <Card testID={`strate-${cle}`}>
      <View style={styles.entete}>
        <View style={[styles.pastille, { backgroundColor: c[JETON_COULEUR[cle]] as string }]} />
        <View style={styles.flex}>
          <Text style={[UiText.subheading, { color: c.fg }]}>{nom}</Text>
          {onRetirer ? (
            <Pressable
              onPress={onRetirer}
              accessibilityRole="button"
              accessibilityLabel={t('prospection.vegetation.retirerStrate', { strate: nom })}
              hitSlop={UiSize.hitSlop}
              testID={`retirer-${cle}`}
            >
              <Text style={[UiText.micro, { color: c.danger }]}>{t('prospection.vegetation.retirer')}</Text>
            </Pressable>
          ) : (
            <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.vegetation.recouvrementPrincipale')}</Text>
          )}
        </View>
        <form.Field name={`strates.${cle}.recouvrement`}>
          {(field) => <Stepper value={field.state.value} onChange={field.handleChange} label={nom} testID={`recouvrement-${cle}`} />}
        </form.Field>
      </View>
      <View style={styles.champs}>
        {champ('hMoy', t('prospection.vegetation.hMoy'), t('prospection.vegetation.metre'))}
        {champ('verdissement', t('prospection.vegetation.verdissement'), t('prospection.vegetation.pourcent'))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10] },
  pastille: { width: UiSize.pastilleStrate, height: UiSize.pastilleStrate, borderRadius: Radius.full },
  champs: { flexDirection: 'row', gap: UiSpace[10] },
});
