import { useMemo, useRef } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { FICHES_GREEN, FICHES_GREEN_DARK, FICHES_GREEN_LIGHT } from './tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

const { width: SCREEN_WIDTH_DEFAULT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH_DEFAULT < 380;

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
}

export interface SearchAndFilterBarProps<T extends string> {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterOption<T>[];
  activeFilter: T;
  onFilterChange: (value: T) => void;
}

/** Barre de recherche + chips de filtre, mutualisée entre "Mes fiches" et "Mes prospections". */
export function SearchAndFilterBar<T extends string>({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  filters,
  activeFilter,
  onFilterChange,
}: SearchAndFilterBarProps<T>) {
  const scrollViewRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const showIcons = windowWidth >= 400;
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => createTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  return (
    <>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={onSearchChange}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filtersWrapper}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
          decelerationRate="fast"
        >
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  filter.disabled && styles.filterChipDisabled,
                ]}
                onPress={() => !filter.disabled && onFilterChange(filter.value)}
                disabled={filter.disabled}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                    filter.disabled && styles.filterChipTextDisabled,
                  ]}
                >
                  {showIcons && filter.icon ? `${filter.icon} ` : ''}
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const BASE_TYPE_SIZES = {
  searchIcon: 16,
  searchInput: isSmallScreen ? 14 : 15,
  clearIcon: 16,
  filterChipText: isSmallScreen ? 12 : 13,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: isSmallScreen ? 40 : 44,
    },
    searchIcon: {
      fontSize: typeSizes.searchIcon,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: typeSizes.searchInput,
      color: theme.text,
      paddingVertical: 8,
    },
    clearButton: {
      padding: 4,
    },
    clearIcon: {
      fontSize: typeSizes.clearIcon,
      color: theme.faint,
    },
    filtersWrapper: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    filtersContainer: {
      paddingVertical: 8,
    },
    filtersContent: {
      paddingHorizontal: 16,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: isSmallScreen ? 12 : 14,
      paddingVertical: isSmallScreen ? 5 : 6,
      borderRadius: 20,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    filterChipActive: {
      backgroundColor: FICHES_GREEN_LIGHT,
      borderColor: FICHES_GREEN,
    },
    filterChipDisabled: {
      opacity: 0.5,
    },
    filterChipText: {
      fontSize: typeSizes.filterChipText,
      color: theme.muted,
      fontWeight: '500',
    },
    filterChipTextActive: {
      color: FICHES_GREEN_DARK,
      fontWeight: '600',
    },
    filterChipTextDisabled: {
      color: theme.faint,
    },
  });
}
