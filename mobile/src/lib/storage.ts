import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Clés de stockage
const STORAGE_KEYS = {
  PROSPECTIONS: '@prospections',
  USER_INFO: '@userInfo',
  PENDING_SYNC: '@pendingSync',
  AUTH_TOKEN: 'auth_token',
};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`[storage] getItem error for key "${key}":`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`[storage] setItem error for key "${key}":`, error);
      throw error;
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[storage] deleteItem error for key "${key}":`, error);
    }
  },
};

// ============================================
// Fonctions de gestion des prospections
// ============================================

export const saveProspection = async (prospection: any): Promise<any> => {
  try {
    const existing = await getProspections();
    const newProspection = {
      ...prospection,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      synced: false,
    };
    
    const data = JSON.stringify([newProspection, ...existing]);
    await storage.setItem(STORAGE_KEYS.PROSPECTIONS, data);
    return newProspection;
  } catch (error) {
    console.error('Erreur sauvegarde prospection:', error);
    throw error;
  }
};

export const getProspections = async (): Promise<any[]> => {
  try {
    const data = await storage.getItem(STORAGE_KEYS.PROSPECTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erreur lecture prospections:', error);
    return [];
  }
};

export const getProspectionById = async (id: string): Promise<any | null> => {
  try {
    const prospections = await getProspections();
    return prospections.find((p: any) => p.id === id) || null;
  } catch (error) {
    console.error('Erreur lecture prospection:', error);
    return null;
  }
};

export const updateProspection = async (id: string, updates: any): Promise<void> => {
  try {
    const prospections = await getProspections();
    const index = prospections.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      prospections[index] = { ...prospections[index], ...updates, updatedAt: new Date().toISOString() };
      await storage.setItem(STORAGE_KEYS.PROSPECTIONS, JSON.stringify(prospections));
    }
  } catch (error) {
    console.error('Erreur mise à jour prospection:', error);
    throw error;
  }
};

export const deleteProspection = async (id: string): Promise<void> => {
  try {
    const prospections = await getProspections();
    const filtered = prospections.filter((p: any) => p.id !== id);
    await storage.setItem(STORAGE_KEYS.PROSPECTIONS, JSON.stringify(filtered));
  } catch (error) {
    console.error('Erreur suppression prospection:', error);
    throw error;
  }
};

export const getPendingProspections = async (): Promise<any[]> => {
  try {
    const prospections = await getProspections();
    return prospections.filter((p: any) => !p.synced);
  } catch (error) {
    console.error('Erreur lecture prospections en attente:', error);
    return [];
  }
};

export const markAsSynced = async (id: string): Promise<void> => {
  await updateProspection(id, { synced: true });
};

export const markAllAsSynced = async (): Promise<void> => {
  try {
    const prospections = await getProspections();
    const synced = prospections.map((p: any) => ({ ...p, synced: true }));
    await storage.setItem(STORAGE_KEYS.PROSPECTIONS, JSON.stringify(synced));
  } catch (error) {
    console.error('Erreur synchronisation massive:', error);
    throw error;
  }
};

// ============================================
// Nouvelles fonctions pour le dashboard prospecteur
// ============================================

const NOTIFICATIONS_KEY = '@notifications';

// Récupérer les prospections d'un utilisateur spécifique
export const getProspectionsByUser = async (userId: string): Promise<any[]> => {
  try {
    const prospections = await getProspections();
    return prospections.filter((p: any) => p.prospecteurId === userId);
  } catch (error) {
    console.error('Erreur lecture prospections utilisateur:', error);
    return [];
  }
};

// Ajouter une notification
export const addNotification = async (notification: any): Promise<void> => {
  try {
    const notifications = await getNotifications();
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      date: new Date().toISOString(),
      lu: false,
    };
    await storage.setItem(NOTIFICATIONS_KEY, JSON.stringify([newNotification, ...notifications]));
  } catch (error) {
    console.error('Erreur ajout notification:', error);
  }
};

// Récupérer toutes les notifications
export const getNotifications = async (): Promise<any[]> => {
  try {
    const data = await storage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erreur lecture notifications:', error);
    return [];
  }
};

// Marquer une notification comme lue
export const markNotificationAsRead = async (id: string): Promise<void> => {
  try {
    const notifications = await getNotifications();
    const index = notifications.findIndex((n: any) => n.id === id);
    if (index !== -1) {
      notifications[index].lu = true;
      await storage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    }
  } catch (error) {
    console.error('Erreur marquage notification:', error);
  }
};

// Marquer toutes les notifications comme lues
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const notifications = await getNotifications();
    const updated = notifications.map((n: any) => ({ ...n, lu: true }));
    await storage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Erreur marquage toutes notifications:', error);
  }
};

// Récupérer les notifications non lues
export const getUnreadNotifications = async (): Promise<any[]> => {
  try {
    const notifications = await getNotifications();
    return notifications.filter((n: any) => !n.lu);
  } catch (error) {
    console.error('Erreur lecture notifications non lues:', error);
    return [];
  }
};

// Envoyer une fiche (changer le statut)
export const envoyerFiche = async (id: string, userId: string, userNom: string): Promise<void> => {
  try {
    const prospections = await getProspections();
    const index = prospections.findIndex((p: any) => p.id === id);
    
    if (index !== -1) {
      const fiche = prospections[index];
      
      // Ajouter à l'historique
      const historique = fiche.historique || [];
      historique.push({
        action: 'envoye',
        date: new Date().toISOString(),
        utilisateur: userNom,
        commentaire: 'Fiche envoyée pour validation',
      });

      prospections[index] = {
        ...fiche,
        status: 'envoye',
        envoyLe: new Date().toISOString(),
        historique,
        updatedAt: new Date().toISOString(),
      };
      
      await storage.setItem(STORAGE_KEYS.PROSPECTIONS, JSON.stringify(prospections));
      
      // Créer une notification
      await addNotification({
        ficheId: id,
        type: 'verification',
        message: `Votre fiche "${fiche.station || 'Station'}" a été envoyée pour validation`,
        status: 'envoye',
      });
    }
  } catch (error) {
    console.error('Erreur envoi fiche:', error);
    throw error;
  }
};

// Mettre à jour le statut d'une fiche (appelé par l'API)
export const updateFicheStatus = async (
  id: string, 
  status: string, 
  motif?: string,
  utilisateur?: string
): Promise<void> => {
  try {
    const prospections = await getProspections();
    const index = prospections.findIndex((p: any) => p.id === id);
    
    if (index !== -1) {
      const fiche = prospections[index];
      const historique = fiche.historique || [];
      
      historique.push({
        action: `status_${status}`,
        date: new Date().toISOString(),
        utilisateur: utilisateur || 'Système',
        commentaire: motif,
      });

      const updates: any = {
        status,
        historique,
        updatedAt: new Date().toISOString(),
      };

      switch (status) {
        case 'envoye':
          updates.envoyLe = new Date().toISOString();
          break;
        case 'verifie':
          updates.verifieLe = new Date().toISOString();
          updates.verifiePar = utilisateur;
          await addNotification({
            ficheId: id,
            type: 'verification',
            message: `Votre fiche "${fiche.station || 'Station'}" a été vérifiée`,
            status: 'verifie',
          });
          break;
        case 'rejete':
          updates.rejeteLe = new Date().toISOString();
          updates.rejetePar = utilisateur;
          updates.motifRejet = motif;
          await addNotification({
            ficheId: id,
            type: 'rejet',
            message: `Votre fiche "${fiche.station || 'Station'}" a été rejetée`,
            status: 'rejete',
            motif: motif,
          });
          break;
        case 'valide':
          updates.valideLe = new Date().toISOString();
          updates.validePar = utilisateur;
          if (fiche.envoyLe) {
            const envoy = new Date(fiche.envoyLe).getTime();
            const valide = new Date().getTime();
            updates.tempsTraitement = Math.round((valide - envoy) / (1000 * 60));
          }
          await addNotification({
            ficheId: id,
            type: 'validation',
            message: `✅ Votre fiche "${fiche.station || 'Station'}" a été validée !`,
            status: 'valide',
          });
          break;
      }

      prospections[index] = { ...prospections[index], ...updates };
      await storage.setItem(STORAGE_KEYS.PROSPECTIONS, JSON.stringify(prospections));
    }
  } catch (error) {
    console.error('Erreur mise à jour status:', error);
    throw error;
  }
};

// Récupérer les statistiques par statut
export const getStatsByStatus = async (userId: string): Promise<Record<string, number>> => {
  try {
    const prospections = await getProspectionsByUser(userId);
    return prospections.reduce((acc: any, fiche: any) => {
      const status = fiche.status || 'brouillon';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  } catch (error) {
    console.error('Erreur calcul statistiques:', error);
    return {};
  }
};

// ============================================
// FONCTIONS DE SYNC ET NOTIFICATIONS
// ============================================

const SYNC_CHECK_KEY = '@last_sync_check';
const SYNC_REMINDER_KEY = '@sync_reminder_sent';

// Vérifier les fiches en attente de synchronisation depuis plus de 3 jours
export const checkPendingSyncNotifications = async (): Promise<any[]> => {
  try {
    const prospections = await getProspections();
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    // Fiches non synchronisées créées il y a plus de 3 jours
    const pendingFiches = prospections.filter((p: any) => {
      if (p.synced) return false;
      const createdAt = new Date(p.createdAt);
      return createdAt < threeDaysAgo;
    });

    // Vérifier si une notification de rappel a déjà été envoyée
    const reminderSent = await storage.getItem(SYNC_REMINDER_KEY);
    const lastReminderDate = reminderSent ? new Date(reminderSent) : null;
    
    // Envoyer une notification si le dernier rappel date de plus de 24h
    const shouldSendReminder = !lastReminderDate || 
      (now.getTime() - lastReminderDate.getTime() > 24 * 60 * 60 * 1000);

    if (pendingFiches.length > 0 && shouldSendReminder) {
      // Ajouter une notification de rappel
      await addNotification({
        ficheId: 'sync_reminder',
        type: 'sync_reminder',
        message: `📡 ${pendingFiches.length} fiche(s) en attente de synchronisation depuis plus de 3 jours. Veuillez vous connecter à Internet pour les synchroniser.`,
        status: 'sync_reminder',
        motif: pendingFiches.map((f: any) => `- ${f.station || 'Station inconnue'} (${f.date})`).join('\n'),
      });
      
      // Mettre à jour la date du dernier rappel
      await storage.setItem(SYNC_REMINDER_KEY, now.toISOString());
    }

    return pendingFiches;
  } catch (error) {
    console.error('Erreur vérification sync:', error);
    return [];
  }
};

// Mettre à jour la date de dernière vérification
export const updateLastSyncCheck = async (): Promise<void> => {
  try {
    await storage.setItem(SYNC_CHECK_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Erreur mise à jour date vérification:', error);
  }
};

// Vérifier si une vérification est nécessaire (toutes les 6 heures)
export const shouldCheckSync = async (): Promise<boolean> => {
  try {
    const lastCheck = await storage.getItem(SYNC_CHECK_KEY);
    if (!lastCheck) return true;
    
    const lastCheckDate = new Date(lastCheck);
    const now = new Date();
    const hoursSinceLastCheck = (now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastCheck >= 6; // Vérifier toutes les 6 heures
  } catch (error) {
    console.error('Erreur vérification dernière vérification:', error);
    return true;
  }
};

// Obtenir le nombre de fiches en attente de sync
export const getPendingSyncCount = async (): Promise<number> => {
  try {
    const prospections = await getProspections();
    return prospections.filter((p: any) => !p.synced).length;
  } catch (error) {
    console.error('Erreur comptage sync:', error);
    return 0;
  }
};