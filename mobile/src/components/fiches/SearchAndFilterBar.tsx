import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { EQ } from '@/components/equipe/tokens';
import { FICHES_GREEN, FICHES_GREEN_LIGHT } from './tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';


export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  /** Icône vectorielle de la maquette ; prime sur `icon` (emoji). */
  iconName?: AppIconName;
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
          <View style={styles.searchIcon}>
            <AppIcon name="rechercher" boite={18} color={EQ.etiquette} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={EQ.etiquette}
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
        <View style={styles.filtersContent}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter.value;
            const couleur = isActive ? FICHES_GREEN : EQ.attenue;
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
                {filter.iconName ? <AppIcon name={filter.iconName} boite={15} color={couleur} /> : null}
                <Text style={[styles.filterChipText, { color: couleur }]}>
                  {!filter.iconName && showIcons && filter.icon ? `${filter.icon} ` : ''}
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const BASE_TYPE_SIZES = {
  searchIcon: 16,
  searchInput: 13,
  clearIcon: 16,
  filterChipText: 12,
} as const;

function createTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof createTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    searchContainer: {
      paddingHorizontal: 16,
      paddingTop: 14,
      backgroundColor: theme.card,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#F8F6F0',
      borderRadius: 10,
      paddingHorizontal: 14,
      height: 44,
    },
    searchIcon: {
      width: 18,
      height: 18,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
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
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    filtersContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: '#F8F6F0',
      borderWidth: 1,
      borderColor: EQ.bordure,
    },
    filterChipActive: {
      backgroundColor: FICHES_GREEN_LIGHT,
      borderColor: FICHES_GREEN,
    },
    filterChipDisabled: {
      opacity: 0.45,
    },
    filterChipText: {
      fontSize: typeSizes.filterChipText,
      fontWeight: '600',
    },
  });
}
