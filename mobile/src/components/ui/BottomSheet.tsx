import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';

type Props = {
  visible: boolean;
  titre: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
};

/** Feuille modale (bottom sheet) : fond assombri cliquable pour fermer. */
export function BottomSheet({ visible, titre, onClose, children, testID }: Props) {
  const c = useUiTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={onClose}
        style={[styles.fond, { backgroundColor: c.overlay }]}
      />
      <View testID={testID} style={[styles.feuille, { backgroundColor: c.surface }]}>
        <View style={[styles.poignee, { backgroundColor: c.borderField }]} />
        <Text accessibilityRole="header" style={[UiText.heading, { color: c.fg }]}>
          {titre}
        </Text>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  feuille: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopLeftRadius: Radius.md * 1.5,
    borderTopRightRadius: Radius.md * 1.5,
  },
  poignee: { alignSelf: 'center', width: 36, height: 4, borderRadius: Radius.full },
});
