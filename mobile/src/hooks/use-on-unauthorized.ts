import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

export function useOnUnauthorized() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useCallback(async () => {
    const refreshed = await refreshToken();
    if (refreshed) return;

    await logout();
    router.replace('/(auth)/login');
  }, [refreshToken, logout, router]);
}
