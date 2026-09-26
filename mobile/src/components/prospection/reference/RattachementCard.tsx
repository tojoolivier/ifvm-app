import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Card } from '@/components/ui';
import { UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { Rattachement } from '@/hooks/use-rattachement';
import { formaterDateHeure } from '@/lib/prospection-reference';
import { formaterDistance } from '@/lib/prospection-rattachement';
import { LigneDetectee, Separateur } from './LigneDetectee';

type Props = {
  /** `null` : rien de détecté ni choisi — les deux lignes sont « À choisir ». */
  rattachement: Rattachement | null;
  horodatage: Date;
  onChangerPa: () => void;
  onChangerStation: () => void;
};

/** Carte « Rattachement — détecté par GPS » de l'intensive : PA, station et date du relevé. */
export function RattachementCard({ rattachement, horodatage, onChangerPa, onChangerStation }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const distance = rattachement ? formaterDistance(rattachement.distanceM) : '';
  const note = (manuel: boolean | undefined, auto: string) =>
    !rattachement ? t('prospection.reference.aChoisir') : manuel ? t('prospection.reference.choixManuel') : auto;
  const vide = t('prospection.reference.nonRenseigne');
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.rattachement')}</Text>
      <LigneDetectee
        icone="sites"
        libelle={t('prospection.reference.pa')}
        valeur={rattachement?.pa?.nom ?? vide}
        note={note(rattachement?.paManuel, t('prospection.reference.autoPlusProche', { distance }))}
        action={{ onPress: onChangerPa, testID: 'changer-pa' }}
      />
      <Separateur />
      <LigneDetectee
        icone="localisation"
        libelle={t('prospection.reference.station')}
        valeur={rattachement ? `${rattachement.station.code} · ${rattachement.station.nom}` : vide}
        note={note(rattachement?.stationManuel, t('prospection.reference.autoStation', { distance }))}
        action={{ onPress: onChangerStation, testID: 'changer-station' }}
      />
      <Separateur />
      <LigneDetectee
        icone="heures-de-vol"
        libelle={t('prospection.reference.dateReleve')}
        valeur={formaterDateHeure(horodatage)}
        valeurTestID="date-releve"
        note={t('prospection.reference.horodatageAuto')}
      />
    </Card>
  );
}
