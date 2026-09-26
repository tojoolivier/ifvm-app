import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Card, NumberField } from '@/components/ui';
import { MonoFonts, Radius, UiBorder, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'fiche-card' });

type Props = {
  numeroFiche: string;
  prospecteur: { prenom: string; nom: string } | null;
  /** Extensive uniquement : pré-rempli, modifiable. */
  numeroMessage?: { valeur: string; onChange: (valeur: string) => void };
};

/** Carte « Fiche » : N° de fiche généré (copiable), prospecteur connecté, N° message (extensive). */
export function FicheCard({ numeroFiche, prospecteur, numeroMessage }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.fiche')}</Text>
      <View style={styles.ligne}>
        <View style={styles.texte}>
          <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.numeroFiche')}</Text>
          <Text testID="numero-fiche" style={[UiText.bodyMedium, { color: c.fg, fontFamily: MonoFonts.medium }]}>
            {numeroFiche}
          </Text>
          <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.genereAuto')}</Text>
        </View>
        <Pressable
          onPress={() => Clipboard.setStringAsync(numeroFiche).catch((e) => log.failure('reference_copie', e))}
          accessibilityRole="button"
          style={[styles.copier, { backgroundColor: c.greenBg }]}
        >
          <Text style={[UiText.micro, { color: c.primary }]}>{t('prospection.reference.copier')}</Text>
        </Pressable>
      </View>
      {prospecteur && (
        <View style={styles.texte}>
          <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.prospecteur')}</Text>
          <Text style={[UiText.bodyMedium, { color: c.fg }]}>
            {t('prospection.reference.prospecteurConnecte', { nom: `${prospecteur.prenom.charAt(0)}. ${prospecteur.nom}` })}
          </Text>
        </View>
      )}
      {numeroMessage && (
        <View style={[styles.messageCadre, { borderColor: c.borderField }]}>
          <NumberField
            label={t('prospection.reference.numeroMessage')}
            value={numeroMessage.valeur}
            onChangeText={numeroMessage.onChange}
            clavier="default"
            testID="numero-message"
          />
          <Text style={[UiText.micro, { color: c.fg3 }]}>{t('prospection.reference.numeroMessageAide')}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[12] },
  texte: { flex: 1, gap: UiSpace[4] },
  copier: { paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[4], borderRadius: Radius.full },
  messageCadre: {
    gap: UiSpace[6],
    padding: UiSpace[12],
    borderRadius: Radius.sm,
    borderWidth: UiBorder.field,
    borderStyle: 'dashed',
  },
});
