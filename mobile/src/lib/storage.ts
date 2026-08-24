import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LocalReadError, LocalWriteError } from './errors';

/**
 * Adaptateur du stockage sécurisé — ADR-012 décision 2, issue #173.
 *
 * Il ne décide rien : il traduit une panne du magasin en classe du jeu fermé
 * et laisse l'appelant choisir entre subir, taire (`log.ignore`) ou remonter.
 *
 * Les trois `catch` d'origine décidaient à sa place, et mal : `getItem`
 * rendait `null`, ce qui rend « magasin en panne » indiscernable de « clé
 * absente » — au démarrage, l'agent se retrouvait déconnecté sans que rien ne
 * dise pourquoi.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      throw new LocalReadError(
        `Lecture de « ${key} » impossible dans le stockage de l’appareil`,
        { cause: error }
      );
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
      throw new LocalWriteError(
        `Écriture de « ${key} » impossible dans le stockage de l’appareil`,
        { cause: error }
      );
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
      throw new LocalWriteError(
        `Suppression de « ${key} » impossible dans le stockage de l’appareil`,
        { cause: error }
      );
    }
  },
};
