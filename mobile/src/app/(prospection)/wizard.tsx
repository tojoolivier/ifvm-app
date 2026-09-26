import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PrimaryButton, WizardHeader } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { getFiche } from '@/lib/prospection-db';
import { ETAPES, NB_ETAPES, estTypeWizard, etapeDeReprise, typeDeFiche, type TypeWizard } from '@/lib/prospection-wizard';

/**
 * Wizard de prospection unique (#683) : un seul en-tête et les mêmes étapes pour tous les types.
 * Le type est choisi avant (`type-chooser`) et passé en paramètre `type` : l'écran ne le change jamais.
 * `id` rouvre un brouillon sur son type et sa bonne étape.
 */
export default function WizardScreen() {
  const { type, id } = useLocalSearchParams<{ type?: string; id?: string }>();
  const router = useRouter();
  const c = useUiTheme();
  const { t } = useTranslation();
  const [typeFiche, setTypeFiche] = useState<TypeWizard | null>(estTypeWizard(type) ? type : null);
  const [numero, setNumero] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    if (!id) return;
    let annule = false;
    getFiche(id)
      .then((locale) => {
        if (annule) return;
        if (!locale) return setIntrouvable(true);
        setTypeFiche(typeDeFiche(locale.fiche));
        setNumero(locale.fiche.n_fiche ?? null);
        setIndex(etapeDeReprise(locale.fiche));
      })
      .catch(() => !annule && setIntrouvable(true));
    return () => {
      annule = true;
    };
  }, [id]);

  if (introuvable) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.surfaceMuted }]}>
        <Text style={[UiText.bodyMedium, styles.message, { color: c.fg }]}>{t('prospection.ficheIntrouvable')}</Text>
      </SafeAreaView>
    );
  }
  if (!typeFiche) return null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: c.surfaceMuted }]}>
      <WizardHeader
        testID="wizard-header"
        titre={t('prospection.titre')}
        sousTitre={numero ? t('prospection.ficheNumero', { numero }) : t('prospection.ficheNonNumerotee')}
        badge={t(`prospection.types.${typeFiche}`)}
        etape={index + 1}
        total={NB_ETAPES}
        libelleEtape={t(`prospection.etapes.${ETAPES[index]}`)}
        onBack={() => (index === 0 ? router.back() : setIndex(index - 1))}
      />
      {index < NB_ETAPES - 1 && (
        <PrimaryButton label={t('prospection.suivant')} onPress={() => setIndex(index + 1)} testID="wizard-suivant" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, message: { padding: UiSpace[16] } });

export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
