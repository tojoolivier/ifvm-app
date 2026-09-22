import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BadgeStyle } from './tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 380;
const isTablet = SCREEN_WIDTH >= 768;

export interface FicheCardProps {
  code: string;
  typeBadge: BadgeStyle;
  subTypeBadge?: BadgeStyle | null;
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
  statutBadge,
  meta,
  extra,
  onPress,
  onSyncPress,
  syncing,
  syncDisabled,
}: FicheCardProps) {
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

const styles = StyleSheet.create({
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
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '700',
  },
  subTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subTypeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  statutBadgeText: {
    fontSize: isSmallScreen ? 10 : 11,
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
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardMeta: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
    marginTop: 2,
  },
  cardExtra: {
    fontSize: isSmallScreen ? 11 : 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
