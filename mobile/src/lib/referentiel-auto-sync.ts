export interface ConnectivityTransition {
  /** `null` = pas encore observé (démarrage de l'app). */
  wasConnected: boolean | null;
  isConnected: boolean;
}

/** ADR-007 : pull auto dès que la connectivité revient — y compris au tout premier check si déjà connecté. */
export function shouldTriggerAutoSync({ wasConnected, isConnected }: ConnectivityTransition): boolean {
  if (!isConnected) return false;
  return wasConnected !== true;
}
