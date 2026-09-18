/**
 * Téléchargement + partage d'un PDF généré côté backend (#533) — partagé entre
 * le récap fiche de vol (#494) et le récap CRT (#495), pour que les deux
 * écrans appellent la même logique plutôt que de réinventer chacun son fetch
 * authentifié et son mécanisme de partage.
 *
 * Même frontière qu'entre `signalement.ts` et `signalement-natif.ts` : ce
 * module décide (URL, statut HTTP → erreur typée), `pdf-partage-natif.ts`
 * porte ce qui ne s'exécute que sur l'appareil (fetch réel, fichier, partage).
 */
import { AuthError, NetworkError } from './errors';

export interface PdfPartageDeps {
  lireToken: () => Promise<string | null>;
  baseUrl: () => string;
  fetcher: (url: string, token: string | null) => Promise<Response>;
  ecrire: (nomFichier: string, contenu: Uint8Array) => Promise<string>;
  partager: (uri: string) => Promise<void>;
}

/**
 * Télécharge le PDF exposé par `endpoint` (authentifié) puis lance le partage
 * natif. `endpoint` est relatif (ex. `/fiches-vol/{id}/pdf`), `nomFichier` sert
 * de nom au fichier local (ex. `fiche-vol-2026-042.pdf`).
 */
export async function telechargerEtPartagerPdf(
  deps: PdfPartageDeps,
  endpoint: string,
  nomFichier: string
): Promise<void> {
  const token = await deps.lireToken();
  const url = `${deps.baseUrl()}${endpoint}`;

  let response: Response;
  try {
    response = await deps.fetcher(url, token);
  } catch (error) {
    throw new NetworkError('Serveur injoignable', { cause: error });
  }

  if (response.status === 401) {
    throw new AuthError('Session expirée. Veuillez vous reconnecter.');
  }

  if (!response.ok) {
    throw new NetworkError(`Échec du téléchargement du PDF (statut ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const uri = await deps.ecrire(nomFichier, new Uint8Array(buffer));
  await deps.partager(uri);
}
