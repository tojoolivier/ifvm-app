import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconPosition } from '@/components/ui/icons';
import { Radius, UiSize, UiSpace, UiText } from '@/constants/theme';
import { useUiTheme } from '@/hooks/use-ui-theme';
import type { PositionRetenue } from '@/hooks/use-position-reference';

const formaterCoord = (n: number) => n.toFixed(6).replace('.', ',');

/** Carte « Position acquise » : précision, latitude, longitude, altitude, zone administrative. */
export function PositionCard({ position, zone, children }: { position: PositionRetenue | null; zone?: string; children?: ReactNode }) {
  const c = useUiTheme();
  const { t } = useTranslation();
  const tuiles = !position
    ? []
    : [
    ['latitude', formaterCoord(position.latitude)],
    ['longitude', formaterCoord(position.longitude)],
    ['altitude', t('prospection.reference.altitudeMetres', { metres: Math.round(position.altitude ?? 0) })],
  ] as const;
  return (
    <View style={[styles.carte, { backgroundColor: c.primary }]}>
      <View style={styles.titre}>
        <IconPosition size={UiSize.iconeTitre} color={c.onPrimary} />
        <Text style={[UiText.subheading, styles.flex, { color: c.onPrimary }]}>{t(position ? 'prospection.reference.positionAcquise' : 'prospection.reference.positionEnCours')}</Text>
        {position?.accuracy != null && (
          <Text style={[UiText.micro, styles.pastille, { color: c.onPrimary, backgroundColor: c.onPrimaryPill }]}>
            {t('prospection.reference.precision', { metres: Math.round(position.accuracy) })}
          </Text>
        )}
      </View>
      <View style={styles.rangee}>
        {tuiles.map(([cle, valeur]) => (
          <View key={cle} style={[styles.tuile, { backgroundColor: c.onPrimaryTile }]}>
            <Text style={[UiText.micro, { color: c.greenBorder }]}>{t(`prospection.reference.${cle}`)}</Text>
            <Text style={[UiText.caption, { color: c.onPrimary }]}>{valeur}</Text>
          </View>
        ))}
      </View>
      {zone && <Text style={[UiText.caption, { color: c.greenBorder }]}>{zone}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { padding: UiSpace[16], borderRadius: Radius.lg, gap: UiSpace[12] },
  titre: { flexDirection: 'row', alignItems: 'center', gap: UiSpace[8] },
  flex: { flex: 1 },
  pastille: { paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[4], borderRadius: Radius.full, overflow: 'hidden' },
  rangee: { flexDirection: 'row', gap: UiSpace[8] },
  tuile: { flex: 1, gap: UiSpace[2], paddingHorizontal: UiSpace[10], paddingVertical: UiSpace[8], borderRadius: Radius.sm },
});
