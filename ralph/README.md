# RALPH — boucle autonome sur les issues GitHub

RALPH relance Claude Code en continu sur les issues ouvertes du dépôt
(`tojoolivier/ifvm-app`). À chaque itération, l'agent : lit les issues, les
découpe en petites tâches, en choisit **une seule**, l'exécute, lance les
boucles de rétroaction pertinentes (backend/frontend/mobile), puis committe
et met à jour l'issue et ses labels de triage.

Pattern « Ralph Wiggum » : une boucle simple, un prompt fixe, un petit pas par
tour, jusqu'à épuisement des tâches.

## Fichiers

| Fichier      | Rôle                                                                 |
| ------------ | ------------------------------------------------------------------- |
| `prompt.md`  | Instructions passées à l'agent (tâches, priorités, boucles, commit). |
| `once.sh`    | Lance **une** itération, en mode interactif.                         |
| `afk.sh`     | Lance **N** itérations d'affilée, en mode non-interactif (`--print`). |

## Prérequis

- [`gh`](https://cli.github.com/) authentifié sur `tojoolivier/ifvm-app`
  (`gh auth status`).
- `jq` (utilisé par `afk.sh` pour parser le flux JSON).
- `claude` (Claude Code) installé et **authentifié** sur cette machine
  (`claude` interactif → `/login` si besoin).
- Stack Docker du projet prête (`make up`) pour tourner le backend/frontend
  localement — cf. `CONTRIBUTING.md` racine.
- Environnement Python du backend prêt (`backend/.venv`, `pytest`) si tu veux
  lancer les tests hors Docker.

> **Exécution directe, sans sandbox.** Les scripts invoquent `claude`
> directement sur ce dépôt et ce système (pas de conteneur d'isolation).
> `afk.sh` utilise `--dangerously-skip-permissions` pour tourner sans
> confirmation : l'agent édite des fichiers et committe tout seul. À n'utiliser
> que dans un dépôt propre (rien en cours non committé que tu ne veux pas
> perdre) et dont tu surveilles les commits.

## Usage

Rends les scripts exécutables une fois :

```bash
chmod +x ralph/once.sh ralph/afk.sh
```

### Une seule itération (interactif)

À utiliser pour tester le prompt ou surveiller l'agent tour par tour :

```bash
./ralph/once.sh
```

### Plusieurs itérations (AFK — « away from keyboard »)

Enchaîne `N` itérations sans intervention. La boucle s'arrête d'elle-même si
l'agent produit `<promise>NO MORE TASKS</promise>` :

```bash
./ralph/afk.sh 10   # jusqu'à 10 itérations
```

Le texte de l'agent est streamé dans le terminal ; le résultat final de chaque
itération est inspecté pour détecter la fin des tâches.

## Ce que fait chaque itération

1. **Contexte** : les scripts injectent le JSON des issues ouvertes
   (`gh issue list`) et les 10 derniers commits `RALPH` (`git log --grep=RALPH`).
2. **Tâche** : l'agent choisit la plus petite tâche utile en suivant les
   priorités de `prompt.md` (bugfix critique → infra → tracer bullet → polish →
   refactor).
3. **Rétroaction** : selon la zone touchée —
   - `backend/` : `pytest -q --tb=short` (dans `backend/`, venv ou
     `docker compose exec backend pytest`) doit passer, `ruff check .` propre.
   - `frontend/` : `tsc -b` (via `npm run build`) doit passer ; si UI touchée,
     `npx @google/design.md lint DESIGN.md` sans avertissement.
   - `mobile/` : `npx tsc --noEmit` et `npm test` (Jest) doivent passer.
   Respect des conventions du dépôt (`CONTRIBUTING.md`, `CLAUDE.md`,
   migrations Alembic pour tout changement de schéma, vocabulaire métier de
   `CONTEXT.md`).
4. **Commit** : message préfixé `RALPH:` (indispensable au filtre `git log
   --grep=RALPH` qui alimente le contexte de l'itération suivante).
5. **Issue** : fermée si la tâche est terminée, sinon commentée avec l'avancement
   et le label de triage mis à jour (cf. `docs/agents/triage-labels.md`).

## Garde-fous

- L'agent ne traite **qu'une tâche par itération** — c'est volontaire (« ne pas
  rouler plus vite que ses phares »).
- Les PR ne sont pas une surface de triage : les issues GitHub sont la seule
  source de vérité (cf. `docs/agents/issue-tracker.md`).
- Relis `prompt.md` avant de lancer une longue série : c'est le seul levier pour
  ajuster le comportement de la boucle.
