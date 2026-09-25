import { useMemo } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { BadgeStyle } from './tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;

export interface FicheCardProps {
  code: string;
  typeBadge: BadgeStyle;
  subTypeBadge?: BadgeStyle | null;
  /**
   * Insigne complémentaire, indépendant du statut — #zone-a-reprendre-insigne :
   * marque une fiche de traitement validée dont la surface restante n'est pas
   * encore intégralement traitée, invitant à la reprendre depuis « Zones à
   * reprendre ». Distinct de `subTypeBadge` (Terrestre/Aérien, jamais absent
   * pour un traitement) et de `statutBadge` (toujours présent) : celui-ci est
   * facultatif et n'apparaît que pour ce cas précis.
   */
  insigneBadge?: BadgeStyle | null;
  statutBadge: BadgeStyle;
  meta: string;
  extra?: string | null;
  onPress: () => void;
  /**
   * Fourni seulement pour une fiche encore « à synchro »/« échec envoi »
   * (#synchro-fiche-par-fiche) : le badge de statut devient alors lui-même le
   * bouton de synchro de cette fiche, sans passer par l'écran Synchronisation.
   * Absent (par défaut) pour toute fiche déjà connue du serveur : le badge
   * reste une simple étiquette, comme avant.
   */
  onSyncPress?: () => void;
  /** Cette fiche précise est en cours d'envoi — affiche un spinner à la place du libellé. */
  syncing?: boolean;
  /** Une autre fiche de la liste est en cours d'envoi — grise ce bouton sans y toucher. */
  syncDisabled?: boolean;
}

/** Contenu d'une pastille : icône vectorielle de la maquette (ou emoji hérité) puis libellé. */
function ContenuBadge({ badge, style }: { badge: BadgeStyle; style: object }) {
  return (
    <>
      {badge.iconName ? <AppIcon name={badge.iconName} boite={13} color={badge.color} /> : null}
      <Text style={[style, { color: badge.color }]}>
        {!badge.iconName && badge.icon ? `${badge.icon} ` : ''}
        {badge.label}
      </Text>
    </>
  );
}

/** Carte de fiche générique, mutualisée entre "Mes fiches" et "Mes prospections". */
export function FicheCard({
  code,
  typeBadge,
  subTypeBadge,
  insigneBadge,
  statutBadge,
  meta,
  extra,
  onPress,
  onSyncPress,
  syncing,
  syncDisabled,
}: FicheCardProps) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.pastille, { backgroundColor: typeBadge.bg }]}>
            <ContenuBadge badge={typeBadge} style={styles.pastilleTexte} />
          </View>
          {subTypeBadge && (
            <View style={[styles.pastille, { backgroundColor: subTypeBadge.bg }]}>
              <ContenuBadge badge={subTypeBadge} style={styles.pastilleTexte} />
            </View>
          )}
          {insigneBadge && (
            <View style={[styles.pastille, { backgroundColor: insigneBadge.bg }]}>
              <ContenuBadge badge={insigneBadge} style={styles.pastilleTexte} />
            </View>
          )}
          {onSyncPress ? (
            <TouchableOpacity
              style={[
                styles.statutBadge,
                styles.statutBadgeBouton,
                { backgroundColor: statutBadge.bg, borderColor: statutBadge.color },
                syncDisabled && styles.statutBadgeDisabled,
              ]}
              onPress={onSyncPress}
              disabled={syncing || syncDisabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Synchroniser cette fiche — ${statutBadge.label}`}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={statutBadge.color} />
              ) : (
                <>
                  <Text style={[styles.statutBadgeText, { color: statutBadge.color }]}>{statutBadge.label}</Text>
                  <AppIcon name="synchroniser" boite={12} color={statutBadge.color} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.statutBadge, { backgroundColor: statutBadge.bg }]}>
              <Text style={[styles.statutBadgeText, { color: statutBadge.color }]}>{statutBadge.label}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardCode}>{code}</Text>
          <Text style={styles.cardMeta}>{meta}</Text>
          {extra && <Text style={styles.cardExtra}>{extra}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const BASE_TYPE_SIZES = {
  pastilleTexte: 10,
  cardCode: 14.5,
  cardMeta: 12,
  cardExtra: 11,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>, theme: ThemePalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      ...(isTablet && {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
      }),
    },
    cardContent: {
      padding: 14,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    pastille: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    pastilleTexte: {
      fontSize: typeSizes.pastilleTexte,
      fontWeight: '700',
    },
    statutBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
      marginLeft: 'auto',
    },
    statutBadgeText: {
      fontSize: typeSizes.pastilleTexte,
      fontWeight: '600',
    },
    // Le badge devient un bouton (#synchro-fiche-par-fiche) : la bordure en pointillés, de la couleur
    // du statut, le distingue d'une simple étiquette (maquette « ÉCHEC ENVOI »).
    statutBadgeBouton: {
      borderWidth: 1,
      borderStyle: 'dashed',
      minHeight: 24,
    },
    statutBadgeDisabled: {
      opacity: 0.5,
    },
    cardBody: {
      flex: 1,
      gap: 8,
    },
    cardCode: {
      fontSize: typeSizes.cardCode,
      fontWeight: '700',
      color: theme.text,
    },
    cardMeta: {
      fontSize: typeSizes.cardMeta,
      color: theme.muted,
      marginTop: 0,
    },
    cardExtra: {
      fontSize: typeSizes.cardExtra,
      color: theme.faint,
      marginTop: 2,
    },
  });
}
