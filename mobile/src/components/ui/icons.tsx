import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Petites icônes en trait (stroke 2) du socle UI — la couleur est un paramètre. */
type IconProps = { size?: number; color: string };

/** Enveloppe commune : icône décorative (masquée aux lecteurs d'écran), viewBox 24×24. */
function IconeSvg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {children}
    </Svg>
  );
}

const trait = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

export function IconMoins({ size = 20, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M5 12H19" stroke={color} {...trait} />
    </IconeSvg>
  );
}

export function IconPlus({ size = 20, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M12 5V19M5 12H19" stroke={color} {...trait} />
    </IconeSvg>
  );
}

export function IconRetour({ size = 24, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M15 18L9 12L15 6" stroke={color} {...trait} />
    </IconeSvg>
  );
}

/** Vol : avion en vol. */
export function IconVol({ size = 16, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M3 12L21 4L17 20L12 14L3 12Z" stroke={color} {...trait} />
    </IconeSvg>
  );
}

/** Poser : flèche vers le bas sur une ligne de sol. */
export function IconPoser({ size = 16, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M12 4V16M6 11L12 17L18 11M5 21H19" stroke={color} {...trait} />
    </IconeSvg>
  );
}

/** Base : maison. */
export function IconBase({ size = 16, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M4 11L12 4L20 11V20H4V11Z" stroke={color} {...trait} />
    </IconeSvg>
  );
}

export function IconFermer({ size = 20, color }: IconProps) {
  return (
    <IconeSvg size={size}>
      <Path d="M6 6L18 18M18 6L6 18" stroke={color} {...trait} />
    </IconeSvg>
  );
}

/** Poste acridien : drapeau (maquette Référence, boîte 18×18, trait 1,5). */
export function IconPosteAcridien({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" testID="icone-poste-acridien" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3.75 15.75V3H12L10.5 6L12 9H3.75" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Station : cible — anneau et point central (maquette Référence, boîte 18×18, trait 1,5). */
export function IconStation({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" testID="icone-station" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={9} cy={9} r={2.25} fill={color} />
      <Circle cx={9} cy={9} r={6} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

/** Position GPS : épingle à point central plein (maquette Référence, boîte 20×20, trait 1,667). */
export function IconPosition({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" testID="icone-position" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M10 17.5C10 17.5 4.16667 12.3333 4.16667 7.91667C4.16667 6.36957 4.78125 4.88584 5.87521 3.79188C6.96917 2.69791 8.4529 2.08333 10 2.08333C11.5471 2.08333 13.0308 2.69791 14.1248 3.79188C15.2188 4.88584 15.8333 6.36957 15.8333 7.91667C15.8333 12.3333 10 17.5 10 17.5Z"
        stroke={color}
        strokeWidth={1.66667}
      />
      <Circle cx={10} cy={7.91667} r={2.08333} fill={color} />
    </Svg>
  );
}
