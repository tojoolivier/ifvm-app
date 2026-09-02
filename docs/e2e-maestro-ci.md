# Workflow CI e2e mobile (Maestro) — #196

Squelette d'exécution du golden path e2e mobile (épic #193) : lance un émulateur
Android en CI, y installe l'APK preview, et rejoue le premier flow réel
(login → dashboard) avec le compte e2e-bot (#194).

Décisions structurantes : [`docs/adr/ADR-016-e2e-mobile-maestro.md`](adr/ADR-016-e2e-mobile-maestro.md).
Seed / credentials : [`docs/e2e-seed.md`](e2e-seed.md).

## Où

`.github/workflows/mobile-e2e-maestro.yml` — deux jobs :

1. **`get-apk`** (`self-hosted-linux`) : réutilise le dernier artifact
   `ifvm-preview-apk` (produit par `mobile-build.yml`) s'il existe encore
   (rétention 14 jours) ; sinon déclenche `mobile-build.yml` et attend la fin
   du build (jusqu'à 1h) avant de continuer.
2. **`e2e-maestro`** (`ubuntu-latest`, runner GitHub-hébergé — nécessaire pour
   la virtualisation KVM de l'émulateur, absente sur les runners self-hébergés
   qui servent au build) : télécharge cet APK, installe Maestro CLI, active
   KVM (requis par `reactivecircus/android-emulator-runner` sur ce type de
   runner), démarre un émulateur Android (API 33, x86_64) et exécute
   `mobile/.maestro/login.yaml`. Pas d'injection GPS dans ce ticket — le
   golden path login n'en a pas besoin (voir « Étendre le flow »).

Flow Maestro : [`mobile/.maestro/login.yaml`](../mobile/.maestro/login.yaml).

## Déclenchement manuel

Onglet GitHub **Actions → Mobile e2e (Maestro) → Run workflow**. Champ optionnel
`ref` (branche/tag à builder si aucun artifact `ifvm-preview-apk` récent
n'existe) — par défaut `main`.

```bash
gh workflow run mobile-e2e-maestro.yml --repo tojoolivier/ifvm-app
```

Secret requis : `E2E_BOT_PASSWORD` (déjà utilisé par le seed backend, voir
`docs/e2e-seed.md`) — configuré au niveau du repo GitHub.

## Voir les résultats

- Statut du run : onglet **Actions**, job `e2e-maestro` — rouge si la connexion
  ou l'assertion du dashboard échoue, avec les logs Maestro (étape par étape,
  chaque commande du flow) directement dans les logs du step. Le secret
  `E2E_BOT_PASSWORD` est masqué par GitHub Actions dans ces logs.
- Si c'est le job `get-apk` qui échoue (aucun artifact `ifvm-preview-apk`
  réutilisable et `mobile-build.yml` ne s'est pas déclenché ou n'a pas terminé
  à temps), le message d'erreur est explicite dans les logs de ce job — le
  golden path login n'a alors même pas commencé.
- Pas d'artifact de rapport Maestro séparé : le contenu de `~/.maestro/tests`
  peut journaliser les valeurs saisies (`inputText`) — le masquage GitHub
  Actions ne protège que les logs de step, pas le contenu d'un fichier
  uploadé. Le flow utilise `label:` sur la saisie du mot de passe
  (recommandation Maestro) pour l'omettre du rapport, mais l'artifact reste
  volontairement non publié par prudence. Les logs du step suffisent pour
  diagnostiquer un échec.

## Étendre le flow

Ce ticket ne couvre que login → dashboard. Le golden path complet (prospection
intensive → sync → assertion API) est un flow Maestro distinct à ajouter dans
`mobile/.maestro/` sur un ticket ultérieur de l'épic #193, en s'appuyant sur ce
même squelette CI.
