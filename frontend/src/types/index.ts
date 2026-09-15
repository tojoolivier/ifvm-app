export interface Utilisateur {
  id: string
  nom: string
  prenom: string
  email: string
  role: string
  /** Identifiant court (ex. "ADM") inséré dans le numéro de fiche généré côté
   * mobile pour toute fiche créée par cet utilisateur — facultatif. */
  sigle?: string | null
  actif: boolean
  created_at: string
  /** Poste acridien de rattachement — colonne « Station » de la maquette §10. */
  pa_id?: string | null
  pa_code?: string | null
  pa_nom?: string | null
}
