import { useEffect, useRef, useState } from 'react';
import { PanResponder, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { traitementColors, traitementRadii } from '@/components/traitement/tokens';

/**
 * Pavé de signature numérique (#signatures-auto-equipe) — remplace le bouton
 * « Signer » qui n'enregistrait qu'un nom saisi à la main. Le tracé est
 * capturé en vecteur (chemin SVG, attribut `d`), jamais en image raster : pas
 * de dépendance native supplémentaire (`react-native-svg` est inclus dans
 * Expo Go), rendu identique au pixel près à la relecture.
 *
 * Chaque trait (pose du doigt jusqu'au relâchement) devient un sous-chemin
 * `M x y L x y L x y…` ; plusieurs traits sont concaténés dans un seul chemin
 * (un nouveau `M` par trait) — un unique `<Path>` suffit à les rendre tous.
 */

const HAUTEUR_PAVE = 160;

export interface SignaturePadProps {
  /** Chemin SVG existant, affiché tel quel (relecture ou reprise d'un tracé). */
  value: string | null | undefined;
  /** Appelé à chaque relâchement du doigt avec le chemin complet à cet instant. */
  onChange: (path: string) => void;
  /** Pavé non interactif — tracé affiché en lecture seule. */
  readOnly?: boolean;
  /** Distingue plusieurs pavés à l'écran (un par rôle de signature) — tests. */
  testID?: string;
}

/**
 * Non contrôlé après montage : `value` n'amorce le tracé qu'au premier rendu
 * (état interne ensuite, pour ne pas re-render tout l'écran à chaque pixel
 * dessiné). Pour vider le pavé (« Modifier » qui repart d'un tracé vierge),
 * l'appelant change la prop `key` du composant plutôt que `value` — un
 * remontage complet, seul moyen fiable de réinitialiser un non-contrôlé.
 *
 * `pathRef`/`onChangeRef`/`readOnlyRef` ne sont jamais écrites pendant le
 * rendu (règle `react-hooks/refs`) : elles se synchronisent via `useEffect`,
 * et ne sont lues que depuis les gestionnaires du geste (`PanResponder`),
 * jamais depuis le corps du composant.
 */
export function SignaturePad({ value, onChange, readOnly = false, testID }: SignaturePadProps) {
  const [path, setPath] = useState(value ?? '');
  const pathRef = useRef(path);
  const onChangeRef = useRef(onChange);
  const readOnlyRef = useRef(readOnly);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  // Créé une seule fois (initialiseur paresseux de `useState`, jamais une
  // ré-exécution) : ses gestionnaires capturent les refs ci-dessus par
  // fermeture et ne les lisent qu'à l'appel (geste tactile réel), jamais à la
  // création — la règle `react-hooks/refs` ne sait pas distinguer « capturer
  // une ref par fermeture » de « lire sa valeur pendant le rendu » ; ce
  // patron (fabriquer une fois les gestionnaires d'un `PanResponder`) est le
  // patron recommandé par React Native lui-même pour ce composant.
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !readOnlyRef.current,
      onMoveShouldSetPanResponder: () => !readOnlyRef.current,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const suite = `${pathRef.current}M${locationX.toFixed(1)} ${locationY.toFixed(1)} `;
        pathRef.current = suite;
        setPath(suite);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const suite = `${pathRef.current}L${locationX.toFixed(1)} ${locationY.toFixed(1)} `;
        pathRef.current = suite;
        setPath(suite);
      },
      onPanResponderRelease: () => {
        onChangeRef.current(pathRef.current.trim());
      },
    })
  );

  return (
    <View
      style={[styles.pave, readOnly && styles.paveLectureSeule]}
      {...(readOnly ? {} : panResponder.panHandlers)}
      testID={testID ?? 'signature-pad'}
    >
      <Svg width="100%" height="100%">
        <Path d={path} stroke={traitementColors.texteTitre} strokeWidth={2.5} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pave: {
    height: HAUTEUR_PAVE,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  paveLectureSeule: {
    borderStyle: 'solid',
    backgroundColor: traitementColors.infoFond,
  },
});
