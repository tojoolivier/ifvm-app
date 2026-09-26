import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { IconRetour } from './icons';

type Props = {
  titre: string;
  sousTitre?: string;
  onBack?: () => void;
  /** Contenu aligné à droite (ex. badge du type de fiche). */
  droite?: ReactNode;
};

/** Ligne commune à `AppHeader` et `WizardHeader` : retour, titre, sous-titre, contenu à droite. */
export function HeaderTitre({ titre, sousTitre, onBack, droite }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.ligne}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('ui.retour')} onPress={onBack} hitSlop={UiSize.hitSlop}>
          <IconRetour color={c.fg} />
        </Pressable>
      ) : null}
      <View style={styles.textes}>
        <Text accessibilityRole="header" style={[UiText.heading, { color: c.fg }]}>
          {titre}
        </Text>
        {sousTitre ? <Text style={[UiText.caption, { color: c.fg3 }]}>{sousTitre}</Text> : null}
      </View>
      {droite}
    </View>
  );
}

/** Conteneur d'en-tête partagé (fond, filet bas, marges de la maquette). */
export const headerStyles = StyleSheet.create({
  root: {
    paddingHorizontal: UiSpace[16],
    paddingTop: UiSpace[8],
    paddingBottom: UiSpace[14],
    borderBottomWidth: 1,
  },
});

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10] },
  textes: { flex: 1, gap: UiSpace[2] },
});
