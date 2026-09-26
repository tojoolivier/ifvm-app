import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InterFonts, Radius, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconRetour } from './icons';

type Props = {
  titre: string;
  sousTitre?: string;
  /** Badge du type de fiche (ex. « Intensive »). */
  badge?: string;
  /** Étape courante, à partir de 1. */
  etape: number;
  total: number;
  /** Libellé de l'étape courante (ex. « Végétation »). */
  libelleEtape: string;
  onBack?: () => void;
  testID?: string;
};

/** En-tête unique du wizard : titre, type, « Étape N sur M » et progression — maquette `WizardHeader`. */
export function WizardHeader({ titre, sousTitre, badge, etape, total, libelleEtape, onBack, testID }: Props) {
  const c = useUiTheme();
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <View style={styles.titre}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack} hitSlop={10}>
            <IconRetour color={c.fg} />
          </Pressable>
        ) : null}
        <View style={styles.textes}>
          <Text accessibilityRole="header" style={[UiText.heading, { color: c.fg }]}>
            {titre}
          </Text>
          {sousTitre ? <Text style={[UiText.caption, { color: c.fg3 }]}>{sousTitre}</Text> : null}
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: c.greenBg, borderColor: c.greenBorder }]}>
            <Text style={[UiText.micro, { color: c.primary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.etape}>
        <Text style={[UiText.eyebrow, { color: c.primary, textTransform: 'uppercase' }]}>
          {`Étape ${etape} sur ${total}`}
        </Text>
        <Text style={[UiText.caption, { color: c.fgWeak }]}>·</Text>
        <Text style={[UiText.captionMedium, { color: c.fg2, fontFamily: InterFonts.medium }]}>{libelleEtape}</Text>
      </View>
      <View
        style={styles.progression}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Étape ${etape} sur ${total}`}
        accessibilityValue={{ min: 1, max: total, now: etape }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            testID={`${testID ?? 'wizard-header'}-seg-${i + 1}`}
            style={[styles.segment, { backgroundColor: i < etape ? c.primary : c.border }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1 },
  titre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textes: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  etape: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progression: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: Radius.full },
});
