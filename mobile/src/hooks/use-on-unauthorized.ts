import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';

export function useOnUnauthorized() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);
}
