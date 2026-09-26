import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Card, Chip, PrimaryButton, WizardFooter } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useSolForm } from '@/hooks/use-sol-form';
import { useUiTheme } from '@/hooks/use-ui-theme';
import { logger } from '@/lib/logger';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import { champsDeSol, HUMIDITES, TEXTURES, valeursDeSol } from '@/lib/prospection-sol-schema';
import { DEGATS_CULTURES } from '@/lib/prospection-vegetation-extensive-schema';
import { ChoixMultipleCard } from './sol/ChoixMultipleCard';
import { RappelVegetation } from './sol/RappelVegetation';

const log = logger.child({ module: 'sol-step' });

type Props = {
  /** Brouillon enregistré par l'étape Végétation : l'écran en rappelle la répartition et garde tout ce qu'il ne gère pas. */
  brouillon: ProspectionCreate & { id: string };
  onContinuer: () => void;
  /** « Modifier » sur le rappel : retour à l'étape Végétation. */
  onModifier: () => void;
};

/** Étape 3 du wizard intensif (#689) : humidité, texture (obligatoires) et dégâts sur les cultures. */
export function SolStep({ brouillon, onContinuer, onModifier }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const { form, erreurs } = useSolForm(valeursDeSol(brouillon));
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);

  const continuer = async () => {
    setErreurEnregistrement(null);
    try {
      const { statut: _statut, ...saisie } = brouillon;
      await enregistrerBrouillon({ ...saisie, ...champsDeSol(brouillon, form.state.values) });
      onContinuer();
    } catch (e) {
      log.failure('sol_enregistrement', e);
      setErreurEnregistrement(t('prospection.sol.erreurEnregistrement'));
    }
  };

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <RappelVegetation brouillon={brouillon} onModifier={onModifier} />
        <ChoixMultipleCard
          champ="humidite"
          form={form}
          titre={t('prospection.sol.humiditeTitre')}
          aide={t('prospection.sol.humiditeAide')}
          options={HUMIDITES}
          libelle={(code) => t(`prospection.sol.humidite.${code as (typeof HUMIDITES)[number]}`)}
          testIDPrefix="humidite"
        />
        <ChoixMultipleCard
          champ="texture"
          form={form}
          titre={t('prospection.sol.textureTitre')}
          aide={t('prospection.sol.textureAide')}
          options={TEXTURES}
          libelle={(code) => t(`prospection.sol.texture.${code as (typeof TEXTURES)[number]}`)}
          testIDPrefix="texture"
        />
        <Card testID="sol-degats">
          <View style={styles.titres}>
            <Text style={[UiText.subheading, { color: c.fg }]}>{t('prospection.vegetation.extensive.degatsTitre')}</Text>
            <Text style={[UiText.caption, { color: c.fg3 }]}>{t('prospection.sol.degatsAide')}</Text>
          </View>
          <form.Field name="degats">
            {(field) => (
              <View style={styles.rangee}>
                {DEGATS_CULTURES.map((d) => (
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
        <PrimaryButton label={t('prospection.vegetation.continuer')} manques={erreurs.manques} onPress={continuer} testID="sol-continuer" />
      </WizardFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
  flex: { flex: 1 },
  titres: { gap: UiSpace[2] },
  rangee: { flexDirection: 'row', gap: UiSpace[6] },
});
