// src/hooks/use-dashboard-data.ts
import { useState, useEffect } from 'react';
import { getProspections } from '@/lib/storage';

interface Poste {
  id: number;
  name: string;
  region?: string;
  code?: string;
  responsable?: string;
  fichesCount?: number;
}

interface DashboardStats {
  totalFiches: number;
  todayFiches: number;
  pendingSync: number;
  cdvCount: number;
  ifvmCount: number;
  postesCount: number;
  alertes: number;
  rapports: number;
}

export function useDashboardData() {
  const [postes, setPostes] = useState<Poste[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalFiches: 0,
    todayFiches: 0,
    pendingSync: 0,
    cdvCount: 0,
    ifvmCount: 0,
    postesCount: 0,
    alertes: 0,
    rapports: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Données mockées des postes
      const postesData: Poste[] = [
        { id: 1, name: 'Poste Androy', region: 'Androy', code: 'AND-001', responsable: 'Rakoto Jean' },
        { id: 2, name: 'Poste Atsimo Andrefana', region: 'Atsimo Andrefana', code: 'ATS-002', responsable: 'Rabe Pierre' },
        { id: 3, name: 'Poste Menabe', region: 'Menabe', code: 'MEN-003', responsable: 'Rajaonarivelo Marie' },
      ];

      setPostes(postesData);

      // Récupérer les prospections
      const prospections = await getProspections();
      const today = new Date().toISOString().split('T')[0];
      const todayFiches = prospections.filter((p: any) => p.date === today);
      const pendingSync = prospections.filter((p: any) => !p.synced);

      // Calculer le nombre de fiches par poste
      const postesWithFiches = postesData.map(poste => ({
        ...poste,
        fichesCount: prospections.filter((p: any) => p.station === poste.name).length,
      }));
      setPostes(postesWithFiches);

      setStats({
        totalFiches: prospections.length,
        todayFiches: todayFiches.length,
        pendingSync: pendingSync.length,
        cdvCount: prospections.filter((p: any) => p.type === 'cdv').length,
        ifvmCount: prospections.filter((p: any) => p.type === 'ifvm').length,
        postesCount: postesData.length,
        alertes: 0,
        rapports: 0,
      });
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return {
    postes,
    stats,
    isLoading,
    refresh: loadData,
  };
}