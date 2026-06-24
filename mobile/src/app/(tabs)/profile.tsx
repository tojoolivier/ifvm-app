import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const roleLabels: Record<string, string> = {
    prospecteur: 'Prospecteur',
    chef_equipe: 'Chef d\'équipe',
    admin: 'Administrateur',
    technicien: 'Technicien',
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-12 pb-8">
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
            <ThemedText type="title" style={{ fontSize: 32, color: '#16a34a' }}>
              {user?.username?.charAt(0).toUpperCase() ?? '?'}
            </ThemedText>
          </View>
          <ThemedText type="subtitle">{user?.username ?? 'Utilisateur'}</ThemedText>
          <ThemedText type="small" style={{ color: '#6B7280', marginTop: 4 }}>
            {roleLabels[user?.role ?? ''] ?? user?.role ?? 'Rôle inconnu'}
          </ThemedText>
        </View>

        <ThemedView type="backgroundElement" className="rounded-xl p-4 mb-6">
          <View className="flex-row justify-between items-center py-3 border-b border-gray-200">
            <ThemedText type="default">ID Utilisateur</ThemedText>
            <ThemedText type="small" style={{ color: '#6B7280' }}>
              {user?.id ?? '-'}
            </ThemedText>
          </View>
          <View className="flex-row justify-between items-center py-3">
            <ThemedText type="default">Rôle</ThemedText>
            <ThemedText type="small" style={{ color: '#6B7280' }}>
              {roleLabels[user?.role ?? ''] ?? '-'}
            </ThemedText>
          </View>
        </ThemedView>

        <TouchableOpacity
          className="w-full py-3.5 bg-red-50 border border-red-200 rounded-lg items-center"
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <ThemedText type="default" style={{ color: '#DC2626', fontWeight: '600' }}>
            Se déconnecter
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
