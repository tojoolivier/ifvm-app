import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { UiBorder, UiSpace } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

/** Pied de page du wizard (maquette « Footer ») : fond surface, filet en haut, le bouton principal respire autour. */
export function WizardFooter({ children }: { children: ReactNode }) {
  const c = useUiTheme();
  return <View style={[styles.pied, { backgroundColor: c.surface, borderTopColor: c.border }]}>{children}</View>;
}

const styles = StyleSheet.create({
  pied: {
    paddingTop: UiSpace[12],
    paddingBottom: UiSpace[16],
    paddingHorizontal: UiSpace[16],
    borderTopWidth: UiBorder.hairline,
  },
});
