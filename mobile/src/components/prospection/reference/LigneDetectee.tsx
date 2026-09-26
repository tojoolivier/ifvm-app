import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  icone: AppIconName;
  libelle: string;
  valeur: string;
  /** Détail vert sous la valeur (« ✓ Auto · … », « Horodatage automatique »). */
  note: string;
  /** Sans action, la ligne n'a pas de lien. */
  action?: { libelle?: string; onPress: () => void; testID: string };
  valeurTestID?: string;
};

/** Ligne de la maquette : pastille ronde à icône, libellé, valeur, détail, lien « Changer ». */
export function LigneDetectee({ icone, libelle, valeur, note, action, valeurTestID }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const lien = action?.libelle ?? t('prospection.reference.changer');
  return (
    <View style={styles.ligne}>
      <View style={[styles.pastille, { backgroundColor: c.greenBg }]}>
        <AppIcon name={icone} boite={UiSize.iconeLigne} color={c.primary} />
      </View>
      <View style={styles.texte}>
        <Text style={[UiText.micro, { color: c.fg3 }]}>{libelle}</Text>
        <Text testID={valeurTestID} style={[UiText.bodyMedium, { color: c.fg }]}>
          {valeur}
        </Text>
        <Text style={[UiText.micro, { color: c.primary }]}>{note}</Text>
      </View>
      {action && (
        <Pressable onPress={action.onPress} testID={action.testID} accessibilityRole="button" accessibilityLabel={`${lien} ${libelle}`}>
          <Text style={[UiText.captionMedium, { color: c.primary }]}>{lien}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Filet entre deux lignes d'une carte. */
export function Separateur() {
  const c = useUiTheme();
  return <View style={[styles.separateur, { backgroundColor: c.border }]} />;
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[12] },
  pastille: { width: UiSize.pastilleLigne, height: UiSize.pastilleLigne, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: 1 },
  separateur: { height: 1, alignSelf: 'stretch' },
});
