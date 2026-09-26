import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { STRATE_KEYS, valeursDeVegetation } from '@/lib/prospection-vegetation-schema';
import { JETON_COULEUR, type CleSegment } from '../vegetation/couleurs';

type Props = {
  brouillon: Parameters<typeof valeursDeVegetation>[0];
  onModifier: () => void;
};

/** Rappel compact de la répartition saisie à l'étape Végétation (maquette 03) : barre, légende et lien « Modifier ». */
export function RappelVegetation({ brouillon, onModifier }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const { solNu, strates } = valeursDeVegetation(brouillon);
  const tous: { cle: CleSegment; valeur: number }[] = [
    { cle: 'sol_nu', valeur: solNu },
    // La strate principale d'abord, comme sur l'étape Végétation (maquette 02b / 03).
    ...[...STRATE_KEYS].sort((a, b) => Number(b === 'herbeuse') - Number(a === 'herbeuse')).map((k) => ({ cle: k, valeur: strates[k].recouvrement })),
  ];
  const segments = tous.filter((s) => s.valeur > 0);
  const libelle = (cle: CleSegment) => (cle === 'sol_nu' ? t('prospection.vegetation.solNu') : t(`prospection.vegetation.courts.${cle}`));
  const resume = segments.map(({ cle, valeur }) => t('prospection.vegetation.legende', { nom: libelle(cle), valeur })).join(' · ');

  return (
    <View style={[styles.racine, { backgroundColor: c.greenBg }]} testID="sol-rappel-vegetation">
      <View style={styles.contenu}>
        <Text style={[UiText.captionMedium, { color: c.primary }]}>{t('prospection.sol.rappelTitre')}</Text>
        <View style={styles.barre} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {segments.map(({ cle, valeur }) => (
            <View key={cle} style={[styles.segment, { flex: valeur, backgroundColor: c[JETON_COULEUR[cle]] as string }]} />
          ))}
        </View>
        <Text style={[UiText.micro, { color: c.fg2 }]}>{resume}</Text>
      </View>
      <Pressable onPress={onModifier} accessibilityRole="button" hitSlop={UiSize.hitSlop} testID="sol-modifier">
        <Text style={[UiText.captionMedium, { color: c.primary }]}>{t('prospection.sol.modifier')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10], paddingHorizontal: UiSpace[14], paddingVertical: UiSpace[12], borderRadius: Radius.md },
  contenu: { flex: 1, gap: UiSpace[6] },
  barre: { flexDirection: 'row', gap: UiSpace[2], height: UiSize.pointLegende },
  segment: { height: '100%', borderRadius: Radius.segment },
});
