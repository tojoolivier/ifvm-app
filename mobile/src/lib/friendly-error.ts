/**
 * Traduit une erreur brute (réseau, SQLite, API FastAPI) en message métier
 * court, en français, affichable directement à l'utilisateur. Le message
 * brut reste disponible en detail pour le mode debug / support.
 */
export function toFriendlyError(error: unknown): { message: string; detail: string | null } {
  const raw = error instanceof Error ? error.message : String(error);

  if (/network request failed|fetch/i.test(raw)) {
    return { message: 'Connexion au serveur impossible pour le moment.', detail: raw };
  }
  if (/unauthorized|401/i.test(raw)) {
    return { message: 'Session expirée — reconnectez-vous.', detail: raw };
  }
  if (/UNIQUE constraint|FOREIGN KEY constraint|NOT NULL constraint|SQLITE/i.test(raw)) {
    return { message: 'Impossible d’enregistrer ces données sur l’appareil.', detail: raw };
  }
  if (/timeout/i.test(raw)) {
    return { message: 'Le serveur met trop de temps à répondre.', detail: raw };
  }

  return { message: raw || 'Une erreur inattendue est survenue.', detail: raw || null };
}
