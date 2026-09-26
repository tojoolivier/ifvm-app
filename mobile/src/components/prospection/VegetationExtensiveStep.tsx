import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@tanstack/react-form';
import { Banner, Card, Chip, NumberField, PrimaryButton, WizardFooter } from '@/components/ui';
import { IconInfo } from '@/components/ui/icons';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { useVegetationExtensiveForm } from '@/hooks/use-vegetation-extensive-form';
import { logger } from '@/lib/logger';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import {
  champsDeVegetationExtensive,
  RACCOURCIS_VERDISSEMENT,
  valeursDeVegetationExtensive,
  type DegatsCultures,
} from '@/lib/prospection-vegetation-extensive-schema';
import { JETON_COULEUR } from './vegetation/couleurs';

const log = logger.child({ module: 'vegetation-extensive-step' });

const DEGATS: readonly DegatsCultures[] = ['nuls', 'faibles', 'moyens', 'forts'];

type Props = {
  /** Brouillon créé par l'étape Référence : l'écran rouvre ses colonnes de végétation et garde le reste. */
  brouillon: ProspectionCreate & { id: string };
  onContinuer: () => void;
};

/** Étape 2 du wizard en extensif (#688) : strate herbeuse seule (hauteur, verdissement) et dégâts sur les cultures. */
export function VegetationExtensiveStep({ brouillon, onContinuer }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const { form, erreurs } = useVegetationExtensiveForm(valeursDeVegetationExtensive(brouillon));
  const valeurs = useStore(form.store, (s) => s.values);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);

  const continuer = async () => {
    setErreurEnregistrement(null);
    try {
      const { statut: _statut, ...saisie } = brouillon;
      await enregistrerBrouillon({ ...saisie, ...champsDeVegetationExtensive(valeurs) });
      onContinuer();
    } catch (e) {
      log.failure('vegetation_extensive_enregistrement', e);
      setErreurEnregistrement(t('prospection.vegetation.erreurEnregistrement'));
    }
  };

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={[styles.info, { backgroundColor: c.blueBg }]}>
          <IconInfo color={c.blueText} />
          <Text style={[UiText.caption, styles.flex, { color: c.blueText }]}>{t('prospection.vegetation.extensive.info')}</Text>
        </View>
        <Card testID="strate-herbeuse-extensive">
          <View style={styles.entete}>
            <View style={[styles.pastille, { backgroundColor: c[JETON_COULEUR.herbeuse] as string }]} />
            <View style={styles.flex}>
              <Text style={[UiText.heading, { color: c.fg }]}>{t('prospection.vegetation.strates.herbeuse')}</Text>
              <Text style={[UiText.caption, { color: c.fg3 }]}>{t('prospection.vegetation.extensive.herbeuseDetail')}</Text>
            </View>
          </View>
          <View style={styles.champs}>
            <View style={styles.flex}>
              <form.Field name="hauteurCm">
                {(field) => (
                  <NumberField
                    label={t('prospection.vegetation.extensive.hauteur')}
                    unit={t('prospection.vegetation.extensive.cm')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    error={field.state.value !== '' ? erreurs.parChamp.hauteurCm : undefined}
                    testID="extensive-hauteur"
                  />
                )}
              </form.Field>
            </View>
            <View style={styles.flex}>
              <form.Field name="verdissement">
                {(field) => (
                  <NumberField
                    label={t('prospection.vegetation.verdissement')}
                    unit={t('prospection.vegetation.pourcent')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    error={field.state.value !== '' ? erreurs.parChamp.verdissement : undefined}
                    testID="extensive-verdissement"
                  />
                )}
              </form.Field>
            </View>
          </View>
          <Text style={[UiText.captionMedium, { color: c.fg3 }]}>{t('prospection.vegetation.extensive.verdissementRapide')}</Text>
          <View style={styles.rangee}>
            {RACCOURCIS_VERDISSEMENT.map((n) => (
              <View key={n} style={styles.flex}>
                <Chip
                  label={`${n} ${t('prospection.vegetation.pourcent')}`}
                  selected={valeurs.verdissement === String(n)}
                  onPress={() => form.setFieldValue('verdissement', String(n))}
                  testID={`raccourci-${n}`}
                />
              </View>
            ))}
          </View>
        </Card>
        <Card testID="degats-cultures">
          <Text style={[UiText.subheading, { color: c.fg }]}>{t('prospection.vegetation.extensive.degatsTitre')}</Text>
          <form.Field name="degats">
            {(field) => (
              <View style={styles.rangee}>
                {DEGATS.map((d) => (
                  <View key={d} style={styles.flex}>
                    <Chip
                      label={t(`prospection.vegetation.extensive.degats.${d}`)}
                      selected={field.state.value === d}
                      onPress={() => field.handleChange(field.state.value === d ? null : d)}
                      testID={`degats-${d}`}
                    />
                  </View>
                ))}
              </View>
            )}
          </form.Field>
        </Card>
        {erreurEnregistrement && <Banner tone="error" message={erreurEnregistrement} />}
      </ScrollView>
      <WizardFooter>
        <PrimaryButton
          label={t('prospection.vegetation.continuer')}
          disabled={Object.keys(erreurs.parChamp).length > 0}
          onPress={continuer}
          testID="vegetation-extensive-continuer"
        />
      </WizardFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
  flex: { flex: 1 },
  info: { flexDirection: 'row', gap: UiSpace[10], paddingHorizontal: UiSpace[14], paddingVertical: UiSpace[12], borderRadius: Radius.md },
  entete: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[10] },
  pastille: { width: UiSize.pastilleStrate, height: UiSize.pastilleStrate, borderRadius: Radius.full },
  champs: { flexDirection: 'row', gap: UiSpace[10] },
  rangee: { flexDirection: 'row', gap: UiSpace[6] },
});
