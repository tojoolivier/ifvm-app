import Svg, { Path } from 'react-native-svg';

/** Petites icônes en trait (stroke 2) du socle UI — la couleur est un paramètre. */
type IconProps = { size?: number; color: string };

const trait = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function IconMoins({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M5 12H19" stroke={color} {...trait} />
    </Svg>
  );
}

export function IconPlus({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M12 5V19M5 12H19" stroke={color} {...trait} />
    </Svg>
  );
}

export function IconRetour({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M15 18L9 12L15 6" stroke={color} {...trait} />
    </Svg>
  );
}

/** Vol : avion en vol. */
export function IconVol({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3 12L21 4L17 20L12 14L3 12Z" stroke={color} {...trait} />
    </Svg>
  );
}

/** Poser : flèche vers le bas sur une ligne de sol. */
export function IconPoser({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M12 4V16M6 11L12 17L18 11M5 21H19" stroke={color} {...trait} />
    </Svg>
  );
}

/** Base : maison. */
export function IconBase({ size = 16, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M4 11L12 4L20 11V20H4V11Z" stroke={color} {...trait} />
    </Svg>
  );
}
