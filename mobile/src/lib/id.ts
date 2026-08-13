/**
 * Génère un id local v4-like, sans dépendance native.
 * `globalThis.crypto.randomUUID` n'est PAS fourni par Hermes sur Android/iOS
 * (vérifié sur les sources Expo SDK 56 : expo-crypto/android/.../CryptoModule.kt
 * expose `randomUUID` en module natif précisément parce que Hermes ne
 * l'implémente pas globalement). Seul `expo-crypto`'s `randomUUID()` le
 * fournirait, mais ce package n'est pas une dépendance du projet — l'ajouter
 * pour ce seul usage introduirait une dépendance native hors périmètre.
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
