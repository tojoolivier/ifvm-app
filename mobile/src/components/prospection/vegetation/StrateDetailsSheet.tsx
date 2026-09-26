import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet, Chip, NumberField, PrimaryButton } from '@/components/ui';
import { Radius, UiSpace, UiText } from '@/constants/theme';
import type { ErreursVegetation, VegetationForm } from '@/hooks/use-vegetation-form';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { StrateKey } from '@/lib/prospection-vegetation-schema';

type Props = {
  cle: StrateKey;
  form: VegetationForm;
  erreurs: ErreursVegetation;
  visible: boolean;
  onClose: () => void;
};

/** Feuille « Plus de détails » d'une strate (maquette 02c) : Surface relative, encadré pédagogique, Repousse. */
export function StrateDetailsSheet({ cle, form, erreurs, visible, onClose }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const nom = t(`prospection.vegetation.strates.${cle}`);
  const chemin = `strates.${cle}.surfRel` as const;
  return (
    <BottomSheet visible={visible} onClose={onClose} titre={t('prospection.vegetation.detailsTitre', { strate: nom })} testID={`details-${cle}`}>
      <form.Field name={chemin}>
        {(field) => (
          <NumberField
            label={t('prospection.vegetation.surfRel')}
            unit={t('prospection.vegetation.pourcent')}
            value={field.state.value}
            onChangeText={field.handleChange}
            onBlur={field.handleBlur}
            error={field.state.value !== '' ? erreurs.parChamp[chemin] : undefined}
            testID={`${cle}-surfRel`}
          />
        )}
      </form.Field>
      <View style={[styles.explication, { backgroundColor: c.blueBg }]}>
        <View style={styles.bloc}>
          <Text style={[UiText.captionMedium, { color: c.blueText }]}>{t('prospection.vegetation.surfRel')}</Text>
          <Text style={[UiText.caption, { color: c.blueText }]}>{t('prospection.vegetation.surfRelExplication')}</Text>
        </View>
        <View style={styles.bloc}>
          <form.Subscribe selector={(s) => s.values.strates[cle].recouvrement}>
            {(recouvrement) => (
              <Text style={[UiText.captionMedium, { color: c.blueText }]}>
                {t('prospection.vegetation.recouvrementTitre', { valeur: recouvrement })}
              </Text>
            )}
          </form.Subscribe>
          <Text style={[UiText.caption, { color: c.blueText }]}>{t('prospection.vegetation.recouvrementExplication')}</Text>
        </View>
      </View>
      <View style={styles.bloc}>
        <Text style={[UiText.captionMedium, { color: c.fg3 }]}>{t('prospection.vegetation.repousse')}</Text>
        <form.Field name={`strates.${cle}.repousse`}>
          {(field) => (
            <View style={styles.choix}>
              {([true, false] as const).map((valeur) => (
                <View key={String(valeur)} style={styles.flex}>
                  <Chip
                    label={t(valeur ? 'prospection.vegetation.presence' : 'prospection.vegetation.absence')}
                    selected={field.state.value === valeur}
                    onPress={() => field.handleChange(field.state.value === valeur ? null : valeur)}
                  />
                </View>
              ))}
            </View>
          )}
        </form.Field>
      </View>
      <PrimaryButton label={t('prospection.vegetation.valider')} onPress={onClose} testID={`details-valider-${cle}`} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  explication: { gap: UiSpace[10], padding: UiSpace[12], borderRadius: Radius.sm },
  bloc: { gap: UiSpace[2] },
  choix: { flexDirection: 'row', gap: UiSpace[8] },
});
