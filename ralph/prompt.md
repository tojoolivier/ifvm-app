# ISSUES

Le JSON des issues est fourni au début du contexte. Parse-le pour obtenir les issues ouvertes avec leur corps, labels et commentaires (dépôt `tojoolivier/ifvm-app`).

On t'a aussi passé un fichier contenant les 10 derniers commits RALPH (SHA, date, message complet). Relis-les pour comprendre le travail déjà accompli.

# CONTEXTE PROJET

IFVM (Ivotoerana Famongorana ny Valala eto Madagasikara) — système de gestion de la lutte antiacridienne à Madagascar. Chaîne terrain-bureau : collecte sur tablette (mobile), synchronisation vers un serveur central (backend), consultation et analyse (frontend web).

Avant toute conception, lis :

- `CLAUDE.md` — conventions impératives du dépôt (issue tracker, labels de triage, docs de domaine, style, design system).
- `CONTEXT.md` — vocabulaire métier et logique domaine (espèces LMC/NSE, fiches terrain, workflow de validation des fiches, chaînes de déclenchement prospection/signalement).
- `docs/adr/` — décisions d'architecture existantes ; ne les contredis pas sans le signaler explicitement.
- `CONTRIBUTING.md` — setup local, conventions de code par sous-projet, migrations, commits.

Stack :

- `backend/` — FastAPI + SQLAlchemy 2 (async) + Alembic, Python 3.12. Modèles dans `app/models/`, schémas Pydantic v2 dans `app/schemas/`, un fichier par domaine dans `app/routers/`. Pas de logique métier dans les routers.
- `frontend/` — React 18 + TypeScript + Vite + Tailwind + shadcn/ui. Composants dans `src/components/`, pages dans `src/pages/`, client HTTP dans `src/api/client.ts`.
- `mobile/` — React Native (Expo SDK 56) + NativeWind v4, navigation file-based via Expo Router (`src/app/`).

Conventions non négociables :

- **CRT / fiches terrain** : respecter le vocabulaire exact de `CONTEXT.md` (prospection intensive/extensive/validation, relevé météo, compte-rendu de traitement, fiche de vol). Un « relevé » (ligne en base) n'est pas une « fiche papier ».
- **Toute modification de schéma passe par Alembic** (`make migrate msg="..."` puis `make upgrade`) — jamais de modification manuelle de la base.
- **UI via shadcn/ui** — ne pas créer de composant ad hoc quand un composant shadcn existe.
- **Code en français** pour les docstrings/commentaires métier ; le code lui-même suit les conventions habituelles de chaque stack.

# DÉCOUPAGE EN TÂCHES

Décompose les issues en tâches. Une issue peut contenir une seule tâche (petit bugfix, ajustement) ou beaucoup de tâches (une PRD, un gros refactor).

Fais de chaque tâche la plus petite unité de travail possible. On ne veut pas rouler plus vite que nos phares. Vise un seul petit changement par tâche.

# SÉLECTION DE LA TÂCHE

Utilise les labels de triage (`docs/agents/triage-labels.md`) pour filtrer : ne travaille que sur des issues `ready-for-agent` (ou sans label si le contenu est sans ambiguïté). Ignore `needs-triage`, `needs-info`, `ready-for-human`, `wontfix`.

Parmi les issues éligibles, priorise dans cet ordre :

1. Bugfixes critiques (données corrompues, régression bloquante, faille de sécurité)
2. Infrastructure de développement (tests, fixtures, migrations Alembic, scripts, CI)

Rendre l'infrastructure prête (tests, boucles de rétroaction) est un précurseur important à la construction de features.

3. Tracer bullets pour de nouvelles features

Les *tracer bullets* viennent du Pragmatic Programmer. Écris une tranche minimale de fonctionnalité qui traverse toutes les couches concernées (modèle → migration → endpoint → client API → UI) pour obtenir un feedback le plus tôt possible et valider l'architecture avant d'investir lourdement.

TL;DR — construis d'abord une tranche verticale minuscule et bout-en-bout, puis élargis-la.

4. Polissage et gains rapides
5. Refactors

S'il n'y a plus de tâche éligible, produis `<promise>NO MORE TASKS</promise>`.

# EXPLORATION

Explore le dépôt et remplis ton contexte avec les informations pertinentes pour mener la tâche à bien. Respecte le vocabulaire métier de `CONTEXT.md` (espèces LMC/NSE, station fixe/ponctuelle, workflow de validation en 3 étapes, `n_fiche`).

Identifie quel(s) sous-projet(s) la tâche touche (`backend/`, `frontend/`, `mobile/`) avant de commencer.

# EXÉCUTION

Réalise la tâche.

Si tu constates qu'elle est plus grosse que prévu (par ex. elle exige un refactor préalable), produis « HANG ON A SECOND ».

Puis trouve un moyen de la découper en un plus petit morceau et ne fais que ce morceau (par ex. réalise seulement le petit refactor).

# BOUCLES DE RÉTROACTION

Avant de committer, lance les boucles de rétroaction pertinentes selon la zone touchée :

- **Backend** (`backend/`) : `pytest -q --tb=short` (depuis `backend/`, en venv local ou `docker compose exec backend pytest`) — bloquant, doit passer. `ruff check .` propre.
- **Frontend** (`frontend/`) : `npm run build` (= `tsc -b && vite build`) doit passer sans erreur TypeScript.
- **Mobile** (`mobile/`) : `npx tsc --noEmit` et `npm test` (Jest) doivent passer.

Vérifie aussi, quand c'est pertinent :

- Tout changement de schéma backend est accompagné de sa migration Alembic (`backend/alembic/versions/`).
- **Toute modification frontend (nouveau composant, style, token) est suivie de `npx @google/design.md lint DESIGN.md`** — corrige tous les avertissements avant de committer.
- Nouveaux endpoints/services documentés, vocabulaire métier cohérent avec `CONTEXT.md`.

## Vérification manuelle

Il n'y a pas toujours d'UI facilement testable en boucle automatisée. Quand une tâche touche un flux visible (formulaire de prospection, écran mobile, page frontend), vérifie plutôt le comportement via `make up` (stack Docker locale) et un test manuel ciblé du chemin concerné plutôt que de te fier uniquement au typecheck.

# COMMIT

Fais un commit git. Le message doit :

1. Commencer par le préfixe `RALPH:`
2. Suivre du type conventionnel (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `infra`) et de sa portée, ex. `RALPH: fix(prospection): ...`
3. Indiquer la tâche réalisée + référence issue (`#N`)
4. Résumer les décisions clés
5. Lister les fichiers changés
6. Noter les bloqueurs / points pour la prochaine itération

Reste concis.

# L'ISSUE

Si la tâche est terminée, ferme l'issue GitHub d'origine (`gh issue close <N> --comment "..."`).

Si elle n'est pas terminée, laisse un commentaire sur l'issue avec ce qui a été fait (`gh issue comment <N> --body "..."`) et ajuste le label de triage si nécessaire (`gh issue edit <N> --add-label "..." --remove-label "..."`).

Les PR ne sont pas une surface de triage — n'ouvre/ne modifie pas de PR dans le cadre de cette boucle, travaille directement sur `main` (ou la branche courante) et committe.

# RÈGLES FINALES

NE TRAVAILLE QUE SUR UNE SEULE TÂCHE.
