import { View, ScrollView, RefreshControl } from 'react-native';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { postes, isLoading, error } = useDashboardData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const isProspecteur = user?.role === 'prospecteur';
  const isChefEquipe = user?.role === 'chef_equipe';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View className="px-6 pt-4" style={{ maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' }}>
            <ThemedText type="subtitle" style={{ marginBottom: 4 }}>
              {greeting()}, {user?.prenom ?? 'Agent'}
            </ThemedText>
            <ThemedText type="small" style={{ color: '#6B7280', marginBottom: Spacing.four }}>
              {isProspecteur ? 'Prospecteur terrain' : isChefEquipe ? 'Chef d\'équipe' : 'Agent IFVM'}
            </ThemedText>

            {error && (
              <ThemedView type="backgroundElement" className="rounded-xl p-4 mb-4">
                <ThemedText type="small" style={{ color: '#DC2626', textAlign: 'center' }}>
                  {error}
                </ThemedText>
              </ThemedView>
            )}

            {isProspecteur && (
              <ThemedView type="backgroundElement" className="rounded-xl p-5 mb-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <ThemedText type="small" style={{ color: '#6B7280', marginBottom: 4 }}>
                      Postes acridiens
                    </ThemedText>
                    <ThemedText type="title" style={{ fontSize: 40 }}>
                      {isLoading ? '—' : postes.length}
                    </ThemedText>
                  </View>
                  <View className="w-14 h-14 bg-green-100 rounded-xl items-center justify-center">
                    <ThemedText style={{ fontSize: 28 }}>🗺️</ThemedText>
                  </View>
                </View>
                <ThemedText type="small" style={{ color: '#6B7280', marginTop: 8 }}>
                  {isLoading ? 'Chargement...' : `${postes.length} poste${postes.length > 1 ? 's' : ''} assigné${postes.length > 1 ? 's' : ''}`}
                </ThemedText>
              </ThemedView>
            )}

            {isChefEquipe && (
              <View className="gap-4">
                <ThemedView type="backgroundElement" className="rounded-xl p-5">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <ThemedText type="small" style={{ color: '#6B7280', marginBottom: 4 }}>
                        Postes acridiens
                      </ThemedText>
                      <ThemedText type="title" style={{ fontSize: 40 }}>
                        {isLoading ? '—' : postes.length}
                      </ThemedText>
                    </View>
                    <View className="w-14 h-14 bg-blue-100 rounded-xl items-center justify-center">
                      <ThemedText style={{ fontSize: 28 }}>🗺️</ThemedText>
                    </View>
                  </View>
                </ThemedView>

                <ThemedView type="backgroundElement" className="rounded-xl p-5">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <ThemedText type="small" style={{ color: '#6B7280', marginBottom: 4 }}>
                        Fiches assignées
                      </ThemedText>
                      <ThemedText type="title" style={{ fontSize: 40 }}>
                        —
                      </ThemedText>
                    </View>
                    <View className="w-14 h-14 bg-orange-100 rounded-xl items-center justify-center">
                      <ThemedText style={{ fontSize: 28 }}>📋</ThemedText>
                    </View>
                  </View>
                </ThemedView>

                <ThemedView type="backgroundElement" className="rounded-xl p-5">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <ThemedText type="small" style={{ color: '#6B7280', marginBottom: 4 }}>
                        Équipe active
                      </ThemedText>
                      <ThemedText type="title" style={{ fontSize: 40 }}>
                        —
                      </ThemedText>
                    </View>
                    <View className="w-14 h-14 bg-purple-100 rounded-xl items-center justify-center">
                      <ThemedText style={{ fontSize: 28 }}>👥</ThemedText>
                    </View>
                  </View>
                </ThemedView>
              </View>
            )}

            {!isProspecteur && !isChefEquipe && (
              <ThemedView type="backgroundElement" className="rounded-xl p-5">
                <View className="flex-row items-center justify-between">
                  <View>
                    <ThemedText type="small" style={{ color: '#6B7280', marginBottom: 4 }}>
                      Postes acridiens
                    </ThemedText>
                    <ThemedText type="title" style={{ fontSize: 40 }}>
                      {isLoading ? '—' : postes.length}
                    </ThemedText>
                  </View>
                  <View className="w-14 h-14 bg-green-100 rounded-xl items-center justify-center">
                    <ThemedText style={{ fontSize: 28 }}>🗺️</ThemedText>
                  </View>
                </View>
              </ThemedView>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
