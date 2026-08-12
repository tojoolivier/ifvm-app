import { View, StyleSheet, ViewStyle } from 'react-native';
import { traitementColors, traitementRadii, traitementSpacing } from './tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'info' | 'avertissement' | 'erreur' | 'derivee';
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<NonNullable<CardProps['variant']>, ViewStyle> = {
  default: { backgroundColor: traitementColors.carte, borderColor: traitementColors.bordure },
  info: { backgroundColor: traitementColors.infoFond, borderColor: traitementColors.infoFond },
  avertissement: { backgroundColor: traitementColors.avertissementFond, borderColor: traitementColors.avertissementBordure },
  erreur: { backgroundColor: traitementColors.erreurFond, borderColor: traitementColors.erreurBordure },
  derivee: { backgroundColor: traitementColors.infoFond, borderColor: traitementColors.vertPrincipal },
};

/** Carte générique du module traitement — fond/bordure selon la variante sémantique. */
export function Card({ children, variant = 'default', style }: CardProps) {
  return <View style={[styles.card, VARIANT_STYLES[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: traitementRadii.carte,
    padding: traitementSpacing.paddingCarte,
  },
});
