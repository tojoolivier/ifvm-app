import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError('Identifiants incorrects. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center items-center px-8">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-green-600 rounded-2xl items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">IF</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">IFVM Mobile</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Informatique Forestière et Végétation Marginale
            </Text>
          </View>

          <View className="w-full gap-4">
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Email
              </Text>
              <TextInput
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-base"
                placeholder="votre@email.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </Text>
              <TextInput
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-base"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                editable={!isLoading}
              />
            </View>

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <Text className="text-red-700 text-sm text-center">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              className={`w-full py-3.5 rounded-lg items-center justify-center ${
                isLoading ? 'bg-green-400' : 'bg-green-600'
              }`}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Se connecter
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
