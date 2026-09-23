import { useMemo } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BadgeStyle } from './tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
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
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
            <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>
              {typeBadge.icon ? `${typeBadge.icon} ` : ''}
              {typeBadge.label}
            </Text>
          </View>
          {subTypeBadge && (
            <View style={[styles.subTypeBadge, { backgroundColor: subTypeBadge.bg }]}>
              <Text style={[styles.subTypeText, { color: subTypeBadge.color }]}>
                {subTypeBadge.icon ? `${subTypeBadge.icon} ` : ''}
                {subTypeBadge.label}
              </Text>
            </View>
          )}
          {insigneBadge && (
            <View style={[styles.subTypeBadge, { backgroundColor: insigneBadge.bg }]}>
              <Text style={[styles.subTypeText, { color: insigneBadge.color }]}>
                {insigneBadge.icon ? `${insigneBadge.icon} ` : ''}
                {insigneBadge.label}
              </Text>
            </View>
          )}
          {onSyncPress ? (
            <TouchableOpacity
              style={[
                styles.statutBadge,
                styles.statutBadgeBouton,
                { backgroundColor: statutBadge.bg },
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
                <Text style={[styles.statutBadgeText, { color: statutBadge.color }]}>
                  {statutBadge.label} ↻
                </Text>
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
  typeBadgeText: isSmallScreen ? 10 : 11,
  subTypeText: 10,
  statutBadgeText: isSmallScreen ? 10 : 11,
  cardCode: isSmallScreen ? 14 : 15,
  cardMeta: isSmallScreen ? 12 : 13,
  cardExtra: isSmallScreen ? 11 : 12,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      ...(isTablet && {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
      }),
    },
    cardContent: {
      padding: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
      flexWrap: 'wrap',
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      minWidth: 40,
      alignItems: 'center',
    },
    typeBadgeText: {
      fontSize: typeSizes.typeBadgeText,
      fontWeight: '700',
    },
    subTypeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    subTypeText: {
      fontSize: typeSizes.subTypeText,
      fontWeight: '600',
    },
    statutBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      marginLeft: 'auto',
    },
    statutBadgeText: {
      fontSize: typeSizes.statutBadgeText,
      fontWeight: '600',
    },
    // Le badge devient un bouton (#synchro-fiche-par-fiche) : une bordure en
    // pointillés le distingue d'un simple statut, sans changer sa couleur (qui
    // reste celle du badge — cohérence avec la maquette des statuts).
    statutBadgeBouton: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#00000033',
      minHeight: 28,
      justifyContent: 'center',
    },
    statutBadgeDisabled: {
      opacity: 0.5,
    },
    cardBody: {
      flex: 1,
    },
    cardCode: {
      fontSize: typeSizes.cardCode,
      fontWeight: '700',
      color: '#111827',
    },
    cardMeta: {
      fontSize: typeSizes.cardMeta,
      color: '#6B7280',
      marginTop: 2,
    },
    cardExtra: {
      fontSize: typeSizes.cardExtra,
      color: '#9CA3AF',
      marginTop: 2,
    },
  });
}
