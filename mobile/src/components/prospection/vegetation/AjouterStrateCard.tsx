import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui';
import { IconPlus } from '@/components/ui/icons';
import { Radius, UiBorder, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { StrateKey } from '@/lib/prospection-vegetation-schema';

type Props = { ajoutables: StrateKey[]; onAjouter: (cle: StrateKey) => void };

/** « Ajouter une strate présente » (maquette 02b) : une puce par strate absente de la liste. */
export function AjouterStrateCard({ ajoutables, onAjouter }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  if (ajoutables.length === 0) return null;
  return (
    <View style={[styles.carte, { borderColor: c.borderField }]} testID="vegetation-ajouter">
      <View style={styles.titre}>
        <IconPlus color={c.primary} />
        <Text style={[UiText.subheading, { color: c.primary }]}>{t('prospection.vegetation.ajouterTitre')}</Text>
      </View>
      <Text style={[UiText.caption, { color: c.fg3 }]}>{t('prospection.vegetation.ajouterAide')}</Text>
      <View style={styles.puces}>
        {ajoutables.map((k) => (
          <Chip
            key={k}
            selected={false}
            label={t('prospection.vegetation.ajouterStrate', { strate: t(`prospection.vegetation.courts.${k}`) })}
            onPress={() => onAjouter(k)}
            testID={`ajouter-${k}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { padding: UiSpace[16], borderRadius: Radius.md, borderWidth: UiBorder.field, borderStyle: 'dashed', gap: UiSpace[12] },
  titre: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[8] },
  puces: { flexDirection: 'row', flexWrap: 'wrap', columnGap: UiSpace[6], rowGap: UiSpace[8] },
});
