import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { InterFonts, Radius, UiSize, UiSpace, UiText, type UiPalette } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconBase, IconPoser, IconVol } from './icons';

/** Une seule table par type : couleur de la pastille et icône (ajouter un type = une ligne ici + sa clé dans `locales/fr.ts`). */
const TYPES = {
  Vol: { couleur: (c: UiPalette) => c.primary, Icone: IconVol },
  Poser: { couleur: (c: UiPalette) => c.amber, Icone: IconPoser },
  Base: { couleur: (c: UiPalette) => c.fg2, Icone: IconBase },
} as const;

export type TimelineType = keyof typeof TYPES;

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
  const { t } = useTranslation();
  const nom = t(`ui.timeline.type.${type}`);
  const { couleur, Icone } = TYPES[type];
  const fond = couleur(c);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={detail
          ? t('ui.timeline.resumeDetail', { type: nom, heure, titre, detail })
          : t('ui.timeline.resume', { type: nom, heure, titre })}
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
