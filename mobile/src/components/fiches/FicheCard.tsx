import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
}

/** Carte de fiche générique, mutualisée entre "Mes fiches" et "Mes prospections". */
export function FicheCard({ code, typeBadge, subTypeBadge, statutBadge, meta, extra, onPress }: FicheCardProps) {
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
          <View style={[styles.statutBadge, { backgroundColor: statutBadge.bg }]}>
            <Text style={[styles.statutBadgeText, { color: statutBadge.color }]}>{statutBadge.label}</Text>
          </View>
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
