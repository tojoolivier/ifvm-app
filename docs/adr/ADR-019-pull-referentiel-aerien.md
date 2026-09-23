# ADR-019 — Pull du référentiel aérien et sort de `lieux_aeriens`

Statut : accepté (#638, parent #592)

## Contexte

Le mobile travaille hors-ligne : tout référentiel qu'il doit *choisir* arrive par
`GET /referentiel/pull` (#605 l'exige avant toute saisie de site). Le pull ne portait que
`lieux_aeriens` (ancien modèle), pas les sites aériens (#604), équipes (#602) ni aéronefs (#603/#621).

## Décision

- Cinq collections ajoutées, incrémentales sur `since_*` : `sites_aeriens` (position active
  aplatie), `equipes`, `equipe_membres`, `aeronefs`, `equipe_aeronefs`.
- Pas de `deletes` : la sortie du référentiel est `actif=false`, et une clôture
  d'affectation / un démontage de position remonte en **ligne mise à jour**.
  - `equipe_aeronef.updated_at` (migration 0096) : sans lui, une clôture était invisible du curseur.
  - Installer/démonter une position rehausse `site_aerienne.updated_at` (la position est embarquée
    dans le site), sans migration.
  - `equipe_membre` n'a que `created_at` : ses lignes sont immuables et aucun chemin de retrait
    n'existe. **Si un retrait de membre est ajouté, il faudra un `updated_at` ou une tombe.**
- `lieux_aeriens` : **déprécié** (`deprecated` dans OpenAPI), conservé tant que le mobile publié le
  lit ; retrait avec #641 (tables SQLite mobiles).
