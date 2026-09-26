## Agent skills

### Modélisation & schéma de base de données

À chaque modification touchant la base de données (nouvelle table, nouvelle colonne, migration Alembic, contraintes, clés étrangères, dénormalisation), utiliser le skill `relational-and-schema-design` avant d'écrire la migration — pour valider le modèle ER, les cardinalités et la normalisation (FD, formes normales) plutôt que d'empiler des colonnes nullables sur une table existante.

### Issue tracker

Issues live as GitHub Issues in `tojoolivier/ifvm-app` (via `gh`). External PRs are not treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.


### styles
respond in french (soit plus pedagogue)

### Design system
After every frontend modification (new component, style change, token update), run:
```bash
npx @google/design.md lint DESIGN.md
```
Fix all warnings before considering the task done.

### Contrat API mobile ↔ backend

Le mobile ne doit jamais recopier à la main les colonnes/schémas du backend (ORM SQLAlchemy, Pydantic). Utiliser le contrat OpenAPI exposé par FastAPI (`/openapi.json`) comme source de vérité :

- Types TypeScript : `mobile/src/lib/api-schema.generated.ts`, régénéré via `npm run generate:api-types` (backend démarré localement, `API_URL` pointe dessus par défaut sur `http://localhost:8000`).
- `mobile/src/lib/api-client.ts` doit utiliser les types de `api-schema.generated.ts` (`components['schemas'][...]`) pour tout ce qui correspond à un schéma Pydantic — ne pas redéfinir ces interfaces à la main.
- Après toute migration Alembic touchant un champ envoyé/reçu par le mobile (population, capture, infestation, traitement, ...), régénérer `api-schema.generated.ts` et lancer `npm run check:schema-drift` pour vérifier que le schéma SQLite local (`prospection-db.ts`, `traitement-db.ts`) suit.
- Le schéma SQLite local reste écrit à la main (c'est un cache offline, pas un miroir 1:1 obligatoire), mais toute divergence détectée par `check:schema-drift` doit être traitée avant de merger — c'est exactement ce type de dérive qui a causé un écran blanc silencieux (colonne `phase` ajoutée côté backend, jamais répercutée côté mobile).
- `check:schema-drift` n'est plus un geste à mémoriser : le hook pre-commit (`.lintstagedrc.json`) le lance automatiquement dès que `mobile/src/lib/prospection-db.ts` ou `mobile/src/lib/api-schema.generated.ts` sont dans le commit, et la CI (`.github/workflows/lint.yml`, job `lint-mobile`) le rejoue.

### Implémentation : vérifier la maquette Figma d'abord

Avant d'implémenter tout écran, composant ou changement d'UI (web ou mobile), vérifier s'il existe une maquette Figma correspondante (lien dans l'issue/PRD, ou recherche via le MCP Figma) :

- Maquette trouvée : elle fait foi. Utiliser `get_design_context` / `get_screenshot` (skill `figma:figma-design-to-code`) et réutiliser les composants partagés existants plutôt que d'en recréer.
- Aucune maquette trouvée : le signaler à l'utilisateur avant de coder, et demander s'il faut continuer sans maquette.

### Mobile : formulaires avec TanStack Form + Yup

Tout formulaire du mobile (`mobile/`) doit utiliser `@tanstack/react-form` pour l'état/soumission et `yup` pour la validation (schéma Yup branché comme validator du formulaire) :

- Pas de `useState` manuel par champ, ni de validation écrite à la main dans les handlers.
- Le schéma Yup vit dans `mobile/src/lib/` (ex. `prospection-sol-schema.ts`), séparé de l'écran, et est testable seul.
- Les messages d'erreur de champ suivent la maquette Figma.
- Consulter Context7 pour l'API à jour de TanStack Form avant d'écrire le code.
