import { useState, useEffect } from 'react';
import { apiClient, Poste } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { useOnUnauthorized } from '@/hooks/use-on-unauthorized';

export function useDashboardData() {
  const [postes, setPostes] = useState<Poste[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((s) => s.token);
  const onUnauthorized = useOnUnauthorized();

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const currentToken = token;
    let cancelled = false;

    async function fetchPostes() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient.getPostes(currentToken, onUnauthorized);
        if (!cancelled) {
          setPostes(data);
        }
      } catch {
        if (!cancelled) {
          setError('Erreur lors du chargement des données');
          setPostes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPostes();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { postes, isLoading, error };
}
