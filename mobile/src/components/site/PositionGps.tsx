import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { EQ } from '@/components/equipe/tokens';
import { Fonts } from '@/constants/theme';
import { useAsyncAction } from '@/hooks/use-async-action';
import { getCurrentPosition } from '@/lib/location';
import type { PositionSaisie } from '@/lib/site-aerien-regles';

interface Props {
  position: PositionSaisie;
  onChange: (position: PositionSaisie) => void;
  /** « Capturer ma position » pour un déplacement, « Position capturée » une fois le fix obtenu. */
  libelleCapture?: string;
  /** Sert au journal de debug et aux `testID` (`<id>-latitude`…). */
  id: string;
}

/** 4 chiffres suffisent à l'œil (≈ 10 m) ; la valeur complète part au serveur. */
const texteCoord = (valeur: number | null): string => (valeur === null ? '' : String(Math.round(valeur * 1e6) / 1e6));

/** Vide → `null` (absent) ; illisible → `NaN`, que `validerPosition` refuse avec un message lisible. */
function lireCoord(texte: string): number | null {
  const propre = texte.trim().replace(',', '.');
  return propre === '' ? null : Number(propre);
}

const heure = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * Carte « Position » des maquettes (Figma GPSCard) : bouton de capture GPS, latitude / longitude /
 * altitude modifiables à la main, ligne de précision. Les bornes ne sont pas contrôlées ici — le
 * formulaire les valide avec `validerPosition` pour lister toutes ses erreurs d'un coup.
 */
export function PositionGps({ position, onChange, libelleCapture = 'Capturer ma position', id }: Props) {
  const [textes, setTextes] = useState({
    latitude: texteCoord(position.latitude),
    longitude: texteCoord(position.longitude),
    altitude: texteCoord(position.altitude),
  });
  const [fix, setFix] = useState<{ precision: number | null; heure: string } | null>(null);
  const { run, isRunning } = useAsyncAction();

  const saisir = (champ: keyof PositionSaisie, texte: string) => {
    setTextes((precedents) => ({ ...precedents, [champ]: texte }));
    setFix(null);
    onChange({ ...position, [champ]: lireCoord(texte) });
  };

  const capturer = () =>
    run(
      async () => {
        const pos = await getCurrentPosition();
        setTextes({
          latitude: texteCoord(pos.latitude),
          longitude: texteCoord(pos.longitude),
          altitude: texteCoord(pos.altitude),
        });
        setFix({ precision: pos.accuracy, heure: heure(pos.timestamp) });
        onChange({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
      },
      { screen: `position-gps:${id}` }
    );

  const capturee = fix !== null;
  return (
    <View style={styles.carte}>
      <TouchableOpacity
        style={[styles.bouton, isRunning && { opacity: 0.6 }]}
        onPress={capturer}
        disabled={isRunning}
        accessibilityRole="button"
        accessibilityLabel={libelleCapture}
        testID={`${id}-capturer`}
      >
        <ThemedText style={styles.boutonTexte}>
          {isRunning ? 'Recherche du signal GPS…' : capturee ? 'Position capturée' : libelleCapture}
        </ThemedText>
      </TouchableOpacity>

      <View style={styles.ligne}>
        {(
          [
            ['latitude', 'Latitude', 82],
            ['longitude', 'Longitude', 86],
            ['altitude', 'Alt.', 76],
          ] as const
        ).map(([champ, etiquette, largeur]) => (
          <View key={champ} style={{ width: largeur }}>
            <ThemedText style={styles.etiquette}>{etiquette}</ThemedText>
            <TextInput
              style={styles.saisie}
              value={textes[champ]}
              onChangeText={(texte) => saisir(champ, texte)}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={etiquette}
              testID={`${id}-${champ}`}
            />
          </View>
        ))}
      </View>

      {fix && (
        <View style={styles.precision}>
          <View style={styles.point} />
          <ThemedText style={styles.precisionTexte}>
            {fix.precision !== null ? `Précision ${Math.round(fix.precision)} m · ` : ''}capturé à {fix.heure}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { padding: 8.5, gap: 8, borderRadius: 13, borderWidth: 1.5, borderColor: EQ.vert, backgroundColor: EQ.carte },
  bouton: { height: 36, borderRadius: 11, backgroundColor: EQ.vertDoux, alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { fontSize: 12, fontWeight: '700', color: EQ.vert },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  etiquette: { marginBottom: 3, fontSize: 9, fontWeight: '600', color: EQ.attenue },
  saisie: {
    height: 32,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.fond,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Fonts.mono,
    color: EQ.encre,
  },
  precision: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: EQ.vertPoint },
  precisionTexte: { fontSize: 9, fontWeight: '500', color: EQ.vert },
});
