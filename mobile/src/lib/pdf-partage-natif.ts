/**
 * Câblage réel de `pdf-partage.ts` (#533) — fetch authentifié, écriture sur
 * l'appareil, partage natif. Même frontière qu'entre `signalement.ts` et
 * `signalement-natif.ts` : rien ne se décide ici, donc rien à tester ici.
 */
import { File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import { storage } from './storage';
import type { PdfPartageDeps } from './pdf-partage';

const TOKEN_KEY = 'auth_token';

const getBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

async function ecrire(nomFichier: string, contenu: Uint8Array): Promise<string> {
  const fichier = new File(Paths.cache, nomFichier);
  await fichier.write(contenu);
  return fichier.uri;
}

/** Les dépendances réelles, à passer à `telechargerEtPartagerPdf`. */
export function depsPdfPartage(): PdfPartageDeps {
  return {
    lireToken: () => storage.getItem(TOKEN_KEY),
    baseUrl: getBaseUrl,
    fetcher: (url, token) =>
      fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    ecrire,
    partager: (uri) =>
      shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le PDF',
      }),
  };
}
