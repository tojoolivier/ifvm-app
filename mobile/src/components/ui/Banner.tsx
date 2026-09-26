import { StyleSheet, Text, View } from 'react-native';
import { Radius, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

export type BannerTone = 'info' | 'warning' | 'error';

type Props = {
  tone: BannerTone;
  message: string;
  /** Liste sous le message (bandeau récapitulatif des erreurs de formulaire). */
  items?: string[];
  testID?: string;
};

/** Bandeau info / avertissement / erreur (`info-panel`, `warning-panel`, `error-banner` de DESIGN.md). */
export function Banner({ tone, message, items, testID }: Props) {
  const c = useUiTheme();
  const palette = {
    info: { bg: c.greenBg, border: c.greenBorder, text: c.infoText },
    warning: { bg: c.warnBg, border: c.warnBorder, text: c.warnText },
    error: { bg: c.dangerBg, border: c.dangerBorder, text: c.dangerText },
  }[tone];
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole={tone === 'info' ? undefined : 'alert'}
      accessibilityLiveRegion={tone === 'info' ? 'none' : 'polite'}
      style={[styles.root, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[UiText.captionMedium, { color: palette.text }]}>{message}</Text>
      {items?.map((item) => (
        <Text key={item} style={[UiText.caption, { color: palette.text }]}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: UiSpace[4], padding: UiSpace[12], borderRadius: Radius.panel, borderWidth: 1 },
});
