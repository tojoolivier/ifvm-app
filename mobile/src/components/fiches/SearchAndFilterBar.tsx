import { useRef } from 'react';
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

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: isSmallScreen ? 40 : 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isSmallScreen ? 14 : 15,
    color: '#111827',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterChipActive: {
    backgroundColor: FICHES_GREEN_LIGHT,
    borderColor: FICHES_GREEN,
  },
  filterChipDisabled: {
    opacity: 0.5,
  },
  filterChipText: {
    fontSize: isSmallScreen ? 12 : 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: FICHES_GREEN_DARK,
    fontWeight: '600',
  },
  filterChipTextDisabled: {
    color: '#9CA3AF',
  },
});
