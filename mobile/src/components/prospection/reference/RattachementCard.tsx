import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { Rattachement } from '@/hooks/use-rattachement';
import { formaterDistance } from '@/lib/prospection-rattachement';

type Props = {
  /** `null` : rien de détecté ni choisi — les deux lignes sont « À choisir ». */
  rattachement: Rattachement | null;
  onChangerPa: () => void;
  onChangerStation: () => void;
};

/** Carte « Rattachement » de l'intensive : PA et station, détectés par GPS ou choisis à la main. */
export function RattachementCard({ rattachement, onChangerPa, onChangerStation }: Props) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const note = (manuel?: boolean) =>
    !rattachement
      ? t('prospection.reference.aChoisir')
      : manuel
        ? t('prospection.reference.choixManuel')
        : t('prospection.reference.autoPlusProche', { distance: formaterDistance(rattachement.distanceM) });
  const vide = t('prospection.reference.nonRenseigne');
  return (
    <Card>
      <Text style={[UiText.eyebrow, { color: c.fg3 }]}>{t('prospection.reference.rattachement')}</Text>
      <Ligne
        libelle={t('prospection.reference.pa')}
        valeur={rattachement?.pa?.nom ?? vide}
        note={note(rattachement?.paManuel)}
        onChanger={onChangerPa}
        testID="changer-pa"
      />
      <Ligne
        libelle={t('prospection.reference.station')}
        valeur={rattachement ? `${rattachement.station.code} · ${rattachement.station.nom}` : vide}
        note={note(rattachement?.stationManuel)}
        onChanger={onChangerStation}
        testID="changer-station"
      />
    </Card>
  );
}

type LigneProps = { libelle: string; valeur: string; note: string; onChanger: () => void; testID: string };

function Ligne({ libelle, valeur, note, onChanger, testID }: LigneProps) {
  const c = useUiTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.ligne}>
      <View style={styles.texte}>
        <Text style={[UiText.micro, { color: c.fg3 }]}>{libelle}</Text>
        <Text style={[UiText.bodyMedium, { color: c.fg }]}>{valeur}</Text>
        <Text style={[UiText.micro, { color: c.primary }]}>{note}</Text>
      </View>
      <Pressable
        onPress={onChanger}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${t('prospection.reference.changer')} ${libelle}`}
      >
        <Text style={[UiText.captionMedium, { color: c.primary }]}>{t('prospection.reference.changer')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[12] },
  texte: { flex: 1, gap: UiSpace[4] },
});
