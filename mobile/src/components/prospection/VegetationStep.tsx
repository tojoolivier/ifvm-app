import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useStore } from '@tanstack/react-form';
import { Banner, PrimaryButton, WizardFooter } from '@/components/ui';
import { UiSpace } from '@/constants/theme';
import { useVegetationForm } from '@/hooks/use-vegetation-form';
import { logger } from '@/lib/logger';
import { enregistrerBrouillon, type ProspectionCreate } from '@/lib/prospection-db';
import {
  champsDeVegetation,
  repartition,
  STRATE_KEYS,
  strateValeursVides,
  stratesAffichees,
  valeursDeVegetation,
  type StrateKey,
} from '@/lib/prospection-vegetation-schema';
import { AjouterStrateCard } from './vegetation/AjouterStrateCard';
import { RepartitionCard } from './vegetation/RepartitionCard';
import { SolNuCard } from './vegetation/SolNuCard';
import { StrateCard } from './vegetation/StrateCard';

const log = logger.child({ module: 'vegetation-step' });

type Props = {
  /** Brouillon créé par l'étape Référence : l'écran rouvre sa végétation et garde ce qu'il ne gère pas. */
  brouillon: ProspectionCreate & { id: string };
  onContinuer: () => void;
};

/** Étape 2 du wizard : Végétation intensive (#685) — strates ajoutées à la demande, total de 100 % toujours visible. */
export function VegetationStep({ brouillon, onContinuer }: Props) {
  const { t } = useTranslation();
  const { form, erreurs } = useVegetationForm(valeursDeVegetation(brouillon));
  const [ajoutees, setAjoutees] = useState<StrateKey[]>([]);
  const valeurs = useStore(form.store, (s) => s.values);
  const { reste, complete } = repartition(valeurs);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const affichees = stratesAffichees(valeurs.strates, ajoutees);

  const retirer = (cle: StrateKey) => {
    form.setFieldValue(`strates.${cle}`, strateValeursVides());
    setAjoutees((liste) => liste.filter((k) => k !== cle));
  };

  const continuer = async () => {
    setErreurEnregistrement(null);
    try {
      const { statut: _statut, ...saisie } = brouillon;
      await enregistrerBrouillon({ ...saisie, ...champsDeVegetation(brouillon, valeurs) });
      onContinuer();
    } catch (e) {
      log.failure('vegetation_enregistrement', e);
      setErreurEnregistrement(t('prospection.vegetation.erreurEnregistrement'));
    }
  };

  const label = complete
    ? t('prospection.vegetation.continuer')
    : reste > 0
      ? t('prospection.vegetation.ilManque', { reste })
      : t('prospection.vegetation.enTrop', { exces: -reste });

  return (
    <View style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <RepartitionCard solNu={valeurs.solNu} strates={valeurs.strates} />
        <SolNuCard form={form} />
        {affichees.map((k) => (
          <StrateCard key={k} cle={k} form={form} erreurs={erreurs} onRetirer={k === 'herbeuse' ? undefined : () => retirer(k)} />
        ))}
        <AjouterStrateCard
          ajoutables={STRATE_KEYS.filter((k) => !affichees.includes(k))}
          onAjouter={(k) => setAjoutees((liste) => [...liste, k])}
        />
        {erreurEnregistrement && <Banner tone="error" message={erreurEnregistrement} />}
      </ScrollView>
      <WizardFooter>
        <PrimaryButton
          label={label}
          disabled={!complete || Object.keys(erreurs.parChamp).length > 0}
          onPress={continuer}
          testID="vegetation-continuer"
        />
      </WizardFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { padding: UiSpace[16], gap: UiSpace[16] },
});
