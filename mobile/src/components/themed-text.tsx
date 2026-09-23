import { useMemo } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const BASE_THEMED_TEXT_SIZES = {
  small: 14,
  smallBold: 14,
  default: 16,
  title: 48,
  subtitle: 32,
  link: 14,
  linkPrimary: 14,
  code: 12,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_THEMED_TEXT_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>) {
  return StyleSheet.create({
    small: {
      fontSize: typeSizes.small,
      lineHeight: 20,
      fontWeight: 500,
    },
    smallBold: {
      fontSize: typeSizes.smallBold,
      lineHeight: 20,
      fontWeight: 700,
    },
    default: {
      fontSize: typeSizes.default,
      lineHeight: 24,
      fontWeight: 500,
    },
    title: {
      fontSize: typeSizes.title,
      fontWeight: 600,
      lineHeight: 52,
    },
    subtitle: {
      fontSize: typeSizes.subtitle,
      lineHeight: 44,
      fontWeight: 600,
    },
    link: {
      lineHeight: 30,
      fontSize: typeSizes.link,
    },
    linkPrimary: {
      lineHeight: 30,
      fontSize: typeSizes.linkPrimary,
      color: '#3c87f7',
    },
    code: {
      fontFamily: Fonts.mono,
      fontWeight: Platform.select({ android: 700 }) ?? 500,
      fontSize: typeSizes.code,
    },
  });
}
