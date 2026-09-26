import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Radius, UiBorder, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { repartition, STRATE_KEYS, type StrateKey } from '@/lib/prospection-vegetation-schema';
import { JETON_COULEUR, type CleSegment } from './couleurs';

type Props = {
  solNu: number;
  strates: Record<StrateKey, { recouvrement: number }>;
};

/** Carte « Répartition de la station » (maquette 02b) : total, barre empilée par strate, légende et message. */
export function RepartitionCard({ solNu, strates }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const { total, reste, complete } = repartition({ solNu, strates });
  const tous: { cle: CleSegment; valeur: number }[] = [
    { cle: 'sol_nu', valeur: solNu },
    ...STRATE_KEYS.map((k) => ({ cle: k, valeur: strates[k].recouvrement })),
  ];
  const segments = tous.filter((s) => s.valeur > 0);
  const libelle = (cle: CleSegment) => (cle === 'sol_nu' ? t('prospection.vegetation.solNu') : t(`prospection.vegetation.courts.${cle}`));
  const couleurTexte = complete ? c.infoText : c.warnText;
  const message = complete
    ? t('prospection.vegetation.completMessage')
    : reste > 0
      ? t('prospection.vegetation.soldeMessage', { reste })
      : t('prospection.vegetation.depasseMessage', { exces: -reste });

  return (
    <View style={[styles.carte, { backgroundColor: c.surface, borderColor: complete ? c.greenBorder : c.warnBorder }]} testID="vegetation-repartition">
      <View style={styles.titre}>
        <Text style={[UiText.subheading, styles.flex, { color: c.fg }]}>{t('prospection.vegetation.repartition')}</Text>
        <View style={styles.total}>
          <Text style={[UiText.numeric, { color: couleurTexte }]}>{total}</Text>
          <Text style={[UiText.captionMedium, { color: c.fg3 }]}>{t('prospection.vegetation.surCent')}</Text>
        </View>
      </View>
      <View style={styles.barre} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {segments.map(({ cle, valeur }) => (
          <View key={cle} style={[styles.segment, { flex: valeur, backgroundColor: c[JETON_COULEUR[cle]] as string }]} />
        ))}
        {reste > 0 && (
          <View style={[styles.segment, styles.reste, { flex: reste, backgroundColor: c.warnBg, borderColor: c.amber }]} />
        )}
      </View>
      <View style={styles.legende}>
        {segments.map(({ cle, valeur }) => (
          <View key={cle} style={styles.legendeItem}>
            <View style={[styles.point, { backgroundColor: c[JETON_COULEUR[cle]] as string }]} />
            <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.vegetation.legende', { nom: libelle(cle), valeur })}</Text>
          </View>
        ))}
        {reste > 0 && (
          <View style={styles.legendeItem}>
            <View style={[styles.point, styles.reste, { backgroundColor: c.warnBg, borderColor: c.amber }]} />
            <Text style={[UiText.micro, { color: c.fg3 }]}>
              {t('prospection.vegetation.legende', { nom: t('prospection.vegetation.aRepartir'), valeur: reste })}
            </Text>
          </View>
        )}
      </View>
      <Text style={[UiText.caption, { color: couleurTexte }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { padding: UiSpace[16], borderRadius: Radius.md, borderWidth: UiBorder.field, gap: UiSpace[14] },
  flex: { flex: 1 },
  titre: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[8] },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: UiSpace[2] },
  barre: { flexDirection: 'row', gap: UiSpace[2], height: UiSize.barreRepartition },
  segment: { height: '100%', borderRadius: Radius.sm },
  reste: { borderWidth: UiBorder.field, borderStyle: 'dashed' },
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: UiSpace[12], rowGap: UiSpace[6] },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[6] },
  point: { width: UiSize.pointLegende, height: UiSize.pointLegende, borderRadius: Radius.full },
});
