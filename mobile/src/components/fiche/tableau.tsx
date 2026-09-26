import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import type { ThemePalette } from '@/constants/theme';
import { texte } from '@/lib/fiche-tableau';

/**
 * Briques des fiches de lecture en tableaux : elles reprennent la mise en page des formulaires
 * papier (gabarits PDF du backend) — bandeaux de section, lignes « Libellé : valeur », cases à
 * cocher, grilles — pour que l'écran et le PDF téléchargé se lisent de la même façon.
 *
 * Une grille large (les 11 colonnes des imagos, par exemple) défile horizontalement dans son
 * propre cadre : la page, elle, ne défile jamais de côté.
 */

const BASE_TYPE_SIZES = {
  titre: 13,
  corps: 13,
  cellule: 12,
} as const;

/** Largeur minimale d'une colonne de grille : en dessous, la grille défile au lieu de s'écraser. */
const LARGEUR_COLONNE = 54;

const StylesContext = createContext<ReturnType<typeof createStyles> | null>(null);

function createStyles(sizes: typeof BASE_TYPE_SIZES, theme: ThemePalette) {
  return StyleSheet.create({
    bandeau: {
      backgroundColor: theme.chipBg,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginTop: 14,
      marginBottom: 8,
    },
    bandeauTexte: { color: theme.text, fontSize: sizes.titre, fontWeight: '700' },
    ref: { color: theme.text, fontSize: sizes.corps, lineHeight: sizes.corps * 1.55, marginVertical: 2 },
    gras: { fontWeight: '700' },
    grilleCadre: { marginVertical: 4 },
    grille: {
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: theme.inputBorder,
      flexGrow: 1,
    },
    ligne: { flexDirection: 'row' },
    cellule: {
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.inputBorder,
      paddingHorizontal: 4,
      paddingVertical: 5,
      justifyContent: 'center',
    },
    celluleTexte: { color: theme.text, fontSize: sizes.cellule, textAlign: 'center' },
    celluleGauche: { textAlign: 'left' },
    entete: { backgroundColor: theme.chipBg },
    enteteTexte: { fontWeight: '700' },
    sousTitre: { color: theme.muted, fontSize: sizes.corps, fontWeight: '700', marginTop: 6 },
  });
}

/** Fournit les styles (thème + taille de police de l'utilisateur) à toutes les briques d'une fiche. */
export function FicheStyles({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { scale } = useFontScale();
  const styles = useMemo(() => createStyles(scaleTypeSizes(BASE_TYPE_SIZES, scale), theme), [scale, theme]);
  return <StylesContext.Provider value={styles}>{children}</StylesContext.Provider>;
}

function useStyles() {
  const styles = useContext(StylesContext);
  if (!styles) throw new Error('Les briques de fiche doivent être rendues sous <FicheStyles>.');
  return styles;
}

/** Bandeau gris des titres de blocs (A. Références, B. Imagos…). */
export function Bandeau({ titre, children }: { titre: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel={titre}>
      <View style={styles.bandeau}>
        <Text accessibilityRole="header" style={styles.bandeauTexte}>
          {titre}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** Ligne de références : les `Info` qu'elle contient passent à la ligne selon la largeur. */
export function Ref({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.ref}>{children}</Text>;
}

/** « **Libellé :** valeur ». */
export function Info({ label, valeur }: { label: string; valeur: unknown }) {
  const styles = useStyles();
  return (
    <Text>
      <Text style={styles.gras}>{label} :</Text> {texte(valeur)}
      {'    '}
    </Text>
  );
}

/** Texte en gras seul (« Accouplement / Ponte », « Larves »). */
export function SousTitre({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={[styles.ref, styles.gras]}>{children}</Text>;
}

/** Case à cocher en lecture seule ; exposée comme telle aux lecteurs d'écran. */
export function Case({ cochee, label }: { cochee: boolean; label: string }) {
  return (
    <Text
      accessibilityRole="checkbox"
      accessibilityState={{ checked: cochee, disabled: true }}
      accessibilityLabel={label}
    >
      {cochee ? '☒' : '☐'}
    </Text>
  );
}

/** « Libellé ☐ » — `nom` précise le nom accessible quand le libellé seul serait ambigu. */
export function Option({ label, cochee, nom }: { label: string; cochee: boolean; nom?: string }) {
  return (
    <Text>
      {label} <Case cochee={cochee} label={nom ?? label} />
      {'    '}
    </Text>
  );
}

export function LigneOptions({
  options,
}: {
  options: { label: string; cochee: boolean; nom?: string }[];
}) {
  const styles = useStyles();
  return (
    <Text style={styles.ref}>
      {options.map((o) => (
        <Option key={o.nom ?? o.label} label={o.label} cochee={o.cochee} nom={o.nom} />
      ))}
    </Text>
  );
}

/**
 * Grille : `colonnes` fixe la largeur minimale (`LARGEUR_COLONNE` par colonne) sous laquelle
 * elle défile horizontalement dans son cadre au lieu d'écraser ses cellules.
 */
export function Grille({
  caption,
  colonnes,
  children,
}: {
  caption: string;
  colonnes: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View accessibilityLabel={caption} style={styles.grilleCadre}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.grille, { minWidth: colonnes * LARGEUR_COLONNE }]}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function Ligne({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.ligne}>{children}</View>;
}

/**
 * Cellule : `span` = nombre de colonnes couvertes (le `colSpan` du PDF). `entete` = cellule d'en-tête
 * (fond grisé, gras). `gauche` aligne à gauche (libellés de ligne).
 */
export function Cellule({
  children,
  span = 1,
  entete,
  gauche,
  poids,
}: {
  children?: ReactNode;
  span?: number;
  entete?: boolean;
  gauche?: boolean;
  /** Part de largeur quand la colonne doit être plus large que les autres (libellés de ligne). */
  poids?: number;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.cellule, entete && styles.entete, { flex: poids ?? span }]}>
      <Text
        accessibilityRole={entete ? 'header' : undefined}
        style={[styles.celluleTexte, gauche && styles.celluleGauche, entete && styles.enteteTexte]}
      >
        {children}
      </Text>
    </View>
  );
}
