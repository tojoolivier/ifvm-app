import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { IconFermer } from './icons';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  visible: boolean;
  titre: string;
  /** Couleur d'une pastille affichée devant le titre (ex. strate de végétation). */
  pastille?: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
};

/** Feuille modale (bottom sheet) : fond assombri cliquable pour fermer. */
export function BottomSheet({ visible, titre, pastille, onClose, children, testID }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={[styles.fond, { backgroundColor: c.overlay }]}
      />
      <View testID={testID} accessibilityViewIsModal style={[styles.feuille, { backgroundColor: c.surface }]}>
        <View style={[styles.poignee, { backgroundColor: c.borderField }]} />
        <View style={styles.entete}>
          {pastille ? <View testID="bottom-sheet-pastille" style={[styles.pastille, { backgroundColor: pastille }]} /> : null}
          <Text accessibilityRole="header" style={[UiText.heading, styles.titre, { color: c.fg }]}>
            {titre}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ui.fermer')}
            onPress={onClose}
            hitSlop={UiSize.hitSlop}
          >
            <IconFermer color={c.fg} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10] },
  titre: { flex: 1 },
  pastille: { width: UiSize.pastilleStrate, height: UiSize.pastilleStrate, borderRadius: Radius.full },
  feuille: {
    gap: UiSpace[12],
    padding: UiSpace[16],
    paddingBottom: UiSpace[32],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  poignee: { alignSelf: 'center', width: UiSize.sheetHandleWidth, height: UiSize.sheetHandleHeight, borderRadius: Radius.full },
});
