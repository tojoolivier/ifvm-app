Status: ready-for-agent

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Ajouter une validation côté client complète au formulaire de prospection, avec erreurs affichées inline sous chaque champ.

**`lib/prospection-schema.ts`** — schéma Zod couvrant :
- `campagne_id` : requis
- `date_prospection` : requise, dans la plage de la campagne sélectionnée
- `station_id` : requis
- `latitude` : nombre entre -90 et 90 (si renseigné)
- `longitude` : nombre entre -180 et 180 (si renseigné)
- `altitude` : nombre positif (si renseigné)
- `surf_infestee <= surf_prospectee <= surf_station` : validations croisées
- Captures : au moins une ligne avec `effectif > 0`
- `effectif` : entier non négatif
- Tous les messages d'erreur en français

**Intégration dans `NouvelleProspectionPage`** :
- Validation déclenchée au clic "Soumettre" et "Sauvegarder (brouillon)"
- Chaque champ invalide affiche son message d'erreur via `FormField` (slice #01), avec `aria-describedby` pointant vers le message
- La validation de campagne/date est aussi déclenchée quand la campagne change (pour valider la date en temps réel)
- Le résumé en haut de page reste pour lister toutes les erreurs

## Acceptance criteria

- [ ] `prospection-schema.ts` est testable indépendamment (export du schéma Zod)
- [ ] Les 3 champs obligatoires (campagne, date, station) affichent une erreur inline si vides à la soumission
- [ ] La date est validée contre la plage de la campagne sélectionnée
- [ ] Les coordonnées invalides (lat hors -90..90, lon hors -180..180) affichent une erreur inline
- [ ] `surf_infestee > surf_prospectee` déclenche une erreur sur `surf_infestee`
- [ ] L'absence de capture avec effectif > 0 bloque la soumission avec un message clair
- [ ] Chaque message d'erreur a `role="alert"` et `aria-live="polite"` (via `FormField`)
- [ ] Pas de régression sur la soumission en cas de formulaire valide

## Blocked by

- `01-composants-ui-infrastructure.md` (composant `FormField`)
