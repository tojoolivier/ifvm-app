import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, NumberField } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { SaisieCoordonnees } from '@/hooks/use-position-reference';

type Props = {
  /** `null` : le lien « Saisir à la main » est proposé ; sinon, les deux champs. */
  saisie: SaisieCoordonnees | null;
  onChange: (saisie: SaisieCoordonnees) => void;
  invalide: boolean;
};

/** Extensive : coordonnées saisies à la main quand le GPS est indisponible ou faux. */
export function CoordonneesManuelles({ saisie, onChange, invalide }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  if (!saisie) {
    return (
      <Pressable testID="saisir-coordonnees" accessibilityRole="button" onPress={() => onChange({ latitude: '', longitude: '' })}>
        <Text style={[UiText.captionMedium, styles.lien, { color: c.primary }]}>{t('prospection.reference.saisirCoordonnees')}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.racine}>
      <View style={styles.rangee}>
        <View style={styles.flex}>
          <NumberField
            label={t('prospection.reference.latitude')}
            value={saisie.latitude}
            onChangeText={(latitude) => onChange({ ...saisie, latitude })}
            clavier="numbers-and-punctuation"
            testID="latitude"
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label={t('prospection.reference.longitude')}
            value={saisie.longitude}
            onChangeText={(longitude) => onChange({ ...saisie, longitude })}
            clavier="numbers-and-punctuation"
            testID="longitude"
          />
        </View>
      </View>
      {invalide && <Banner tone="error" message={t('prospection.reference.coordonneesHorsMadagascar')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { gap: UiSpace[12] },
  rangee: { flexDirection: 'row', gap: UiSpace[8] },
  flex: { flex: 1 },
  lien: { textDecorationLine: 'underline' },
});
