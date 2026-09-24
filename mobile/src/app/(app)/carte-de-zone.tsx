import { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const IFVM_GREEN = '#1B5E1B';
const IFVM_BG_LIGHT = '#F0F2F5';

export default function CarteDeZoneScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ThemedText style={styles.backText}>‹ Retour</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title}>Carte de zone</ThemedText>
      </View>
      <View style={styles.content}>
        <ThemedText style={styles.emoji}>🗺️</ThemedText>
        <ThemedText style={styles.message}>La carte de zone arrive bientôt</ThemedText>
        <ThemedText style={styles.sub}>
          Vous pourrez y visualiser vos fiches de prospection géolocalisées.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const BASE_TYPE_SIZES = {
  backText: 15,
  title: 17,
  emoji: 48,
  message: 16,
  sub: 13,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>, theme: ThemePalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: IFVM_BG_LIGHT,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      marginRight: 8,
    },
    backText: {
      fontSize: typeSizes.backText,
      color: IFVM_GREEN,
      fontWeight: '600',
    },
    title: {
      fontSize: typeSizes.title,
      fontWeight: '700',
      color: theme.text,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emoji: {
      fontSize: typeSizes.emoji,
      marginBottom: 16,
    },
    message: {
      fontSize: typeSizes.message,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    sub: {
      fontSize: typeSizes.sub,
      color: '#757575',
      textAlign: 'center',
    },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
