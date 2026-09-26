import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Champs manquants : désactive le bouton et remplace le libellé par « Il manque : … ». */
  manques?: string[];
  testID?: string;
};

/** Action principale du wizard — maquette `PrimaryButton` (Enabled / Disabled / Secondary). */
export function PrimaryButton({ label, onPress, variant = 'primary', disabled, manques, testID }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const aDesManques = !!manques && manques.length > 0;
  const inactif = !!disabled || aDesManques;
  const texte = aDesManques ? t('ui.ilManque', { champs: manques.join(', ') }) : label;

  const fond = inactif ? c.border : variant === 'secondary' ? c.surface : c.primary;
  const couleur = inactif ? c.fgWeak : variant === 'secondary' ? c.primary : c.onPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      accessibilityLabel={texte}
      accessibilityState={{ disabled: inactif }}
      style={[
        styles.bouton,
        { backgroundColor: fond },
        variant === 'secondary' && !inactif && { borderWidth: 1.5, borderColor: c.primary },
      ]}
    >
      <Text style={[UiText.button, { color: couleur }]} numberOfLines={2}>
        {texte}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bouton: {
    minHeight: UiSize.button,
    paddingHorizontal: UiSpace[16],
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
