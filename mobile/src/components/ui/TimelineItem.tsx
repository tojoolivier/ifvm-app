import { StyleSheet, Text, View } from 'react-native';
import { InterFonts, Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconBase, IconPoser, IconVol } from './icons';

export type TimelineType = 'Vol' | 'Poser' | 'Base';

type Props = {
  type: TimelineType;
  titre: string;
  detail?: string;
  heure: string;
  /** Trait de liaison vers l'étape suivante (absent sur la dernière). */
  trait?: boolean;
  testID?: string;
};

/** Étape de la chronologie d'une sortie aérienne — maquette `TimelineItem` (Vol / Poser / Base). */
export function TimelineItem({ type, titre, detail, heure, trait = true, testID }: Props) {
  const c = useUiTheme();
  const fond = type === 'Vol' ? c.primary : type === 'Poser' ? c.amber : c.fg2;
  const Icone = type === 'Vol' ? IconVol : type === 'Poser' ? IconPoser : IconBase;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${type} ${heure} : ${titre}${detail ? `, ${detail}` : ''}`}
      style={styles.root}
    >
      <View style={styles.rail}>
        <View style={[styles.pastille, { backgroundColor: fond }]}>
          <Icone color={c.onPrimary} />
        </View>
        {trait ? <View style={[styles.trait, { backgroundColor: c.borderField }]} /> : null}
      </View>
      <View style={styles.contenu}>
        <View style={styles.ligne}>
          <Text style={[UiText.bodyMedium, styles.titre, { color: c.fg, fontFamily: InterFonts.medium }]}>{titre}</Text>
          <Text style={[UiText.captionMedium, { color: c.fg3 }]}>{heure}</Text>
        </View>
        {detail ? <Text style={[UiText.caption, { color: c.fg3 }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: UiSpace[12] },
  rail: { alignItems: 'center' },
  pastille: { width: UiSize.pastille, height: UiSize.pastille, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  trait: { flex: 1, width: UiSize.timelineTrait },
  contenu: { flex: 1, gap: UiSpace[2], paddingBottom: UiSpace[16] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[8] },
  titre: { flex: 1 },
});
