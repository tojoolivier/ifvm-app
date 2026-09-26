import { Text } from 'react-native';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = { message?: string | null; testID?: string };

/** Message d'erreur sous un champ — annoncé par les lecteurs d'écran (rôle alerte). */
export function FieldError({ message, testID }: Props) {
  const c = useUiTheme();
  if (!message) return null;
  return (
    <Text
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[UiText.caption, { color: c.dangerText, marginTop: UiSpace[4] }]}
    >
      {message}
    </Text>
  );
}
