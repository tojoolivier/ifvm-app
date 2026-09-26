import { View } from 'react-native';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { HeaderTitre, headerStyles } from './HeaderTitre';

type Props = { titre: string; sousTitre?: string; onBack?: () => void; testID?: string };

/** En-tête simple des écrans hors wizard (aérien, journal) — maquette `AppHeader`. */
export function AppHeader({ titre, sousTitre, onBack, testID }: Props) {
  const c = useUiTheme();
  return (
    <View testID={testID} style={[headerStyles.root, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <HeaderTitre titre={titre} sousTitre={sousTitre} onBack={onBack} />
    </View>
  );
}
