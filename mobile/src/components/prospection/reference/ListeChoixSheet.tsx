import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BottomSheet, NumberField } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { Feuille } from '@/hooks/use-rattachement';

type Props = { feuille: Feuille | null; recherche: string; onRecherche: (texte: string) => void; onClose: () => void };

/** Liste de choix avec recherche (PA ou stations), ouverte par « Changer ». */
export function ListeChoixSheet({ feuille, recherche, onRecherche, onClose }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const filtre = recherche.trim().toLowerCase();
  return (
    <BottomSheet visible={!!feuille} titre={feuille?.titre ?? ''} onClose={onClose}>
      <NumberField
        label={t('prospection.reference.rechercher')}
        value={recherche}
        onChangeText={onRecherche}
        clavier="default"
        testID="recherche-liste"
      />
      {feuille?.items
        .filter((i) => i.libelle.toLowerCase().includes(filtre))
        .map((i) => (
          <Pressable key={i.id} onPress={i.choisir} testID={`choix-${i.id}`} accessibilityRole="button">
            <Text style={[UiText.bodyMedium, styles.choix, { color: c.fg }]}>{i.libelle}</Text>
          </Pressable>
        ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ choix: { paddingVertical: UiSpace[12] } });
