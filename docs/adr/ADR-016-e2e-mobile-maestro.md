# Tests e2e mobile : Maestro, staging actuel, seed dédié, golden path unique V1

**Statut** : accepté (2026-09-02). Épic `tojoolivier/ifvm-app#193`, complète #194 (seed, fait) et
prépare #195 (workflow CI Maestro, à venir).

## Contexte

Le mobile a déjà subi une régression de sync silencieuse (colonne `phase` ajoutée côté backend,
jamais répercutée côté mobile — voir la carte wayfinder #150 et ADR-012) qui n'aurait été détectée
par aucun test unitaire ou d'intégration existant : elle ne se manifestait qu'au bout d'un vrai
parcours utilisateur, sur un vrai appareil, contre un vrai backend. C'est le trou que cet épic
cherche à combler — un test de bout en bout qui rejoue le parcours métier critique (prospection),
pas une simulation en mémoire.

Quatre décisions structurantes se posaient avant d'écrire le premier flow : l'outil, la cible
réseau, l'isolation des données, et le déclenchement.

## Décision 1 — Outil : Maestro

**Maestro** (flows YAML, CLI, orchestration via `adb`) plutôt que Detox ou Appium.

- **Detox** écarté : nécessite une intégration native profonde (détection de synchronisation via
  hooks JS/natifs) qui suppose un contrôle fin du code natif. Le mobile est un projet Expo géré
  (`mobile/eas.json`, prebuild à la volée) — Detox impose typiquement un détachement du flux
  managé ou une configuration native supplémentaire pour s'y greffer, coût que ce projet n'a pas à
  payer pour un unique golden path.
- **Appium** écarté : protocole WebDriver généraliste multi-plateforme, plus lourd à opérer
  (serveur Appium, capabilities, sélecteurs XPath/accessibility fragiles) pour un besoin qui reste
  volontairement étroit (un parcours, une plateforme). Le rapport effort d'installation / valeur
  ne le justifie pas en V1.
- **Maestro retenu** : flows déclaratifs (YAML) lisibles sans expertise de test, résilients aux
  petits changements de mise en page (sélection par texte/id plutôt que XPath), CLI simple à
  invoquer depuis un runner CI, et aligné avec le seul besoin réel du golden path (interactions
  UI + assertions de texte, pas de test de perf ni de deep-linking complexe).

## Décision 2 — Environnement cible : le staging actuel, nature transitoire assumée

Les flows Maestro tournent contre `https://ifvm.orakotondravao.com/api` (`mobile/eas.json`,
profils `preview` et `production` — les deux pointent aujourd'hui vers la même URL) et contre
l'artifact `ifvm-preview-apk` produit par `mobile-build.yml` (build `preview`, voir #195).

**Point de vigilance explicite** : il n'existe aujourd'hui **aucune séparation** entre
environnement de préproduction et environnement de production réelle — `preview` et `production`
partagent la même `EXPO_PUBLIC_API_URL` et, côté backend, la même base. « Staging » ici désigne
donc l'environnement actuellement déployé, pas un environnement dédié aux tests. **Le jour où une
vraie production distincte sera créée, la cible des tests e2e devra être réévaluée** — pour
continuer à taper sur l'environnement de préproduction et jamais sur la production réelle. Ce
choix n'est pas définitif ; il documente l'état du projet au moment de l'épic, pas un objectif à
long terme.

## Décision 3 — Isolation des données de test : compte et campagne dédiés, seed idempotent, pas de nettoyage auto en V1

Le golden path e2e s'exécute contre l'environnement partagé décrit ci-dessus (pas de base
éphémère par run), ce qui impose d'isoler ses données de celles des utilisateurs réels dès la
conception, sans attendre un incident.

- **Compte et campagne dédiés** (#194, `backend/app/e2e_seed.py`) : utilisateur
  `e2e-bot@e2e.ifvm.test` (rôle prospecteur), campagne `[E2E] Campagne e2e-bot`, zone
  anti-acridienne `E2E-ZAA-01`. Tous les objets créés portent un marqueur filtrable (domaine
  `@e2e.ifvm.test` ou préfixe `[E2E] `), ce qui permet de les exclure des rapports et statistiques
  réels sans avoir à les supprimer.
- **Seed idempotent** : chaque objet est retrouvé par sa clé naturelle (email/nom/code) et jamais
  dupliqué ; le mot de passe et le statut actif du compte sont réalignés à chaque exécution, ce qui
  rend la rotation du secret CI (`E2E_BOT_PASSWORD`) sans opération manuelle. Garde-fou : le script
  refuse de tourner sans `E2E_BOT_PASSWORD` explicite (pas de mot de passe par défaut, public, posé
  sur staging).
- **Pas de nettoyage automatique en V1** : les fiches de prospection créées par le golden path
  (login → prospection intensive → sync → logout) s'accumulent d'un run à l'autre plutôt que
  d'être supprimées en fin de test. Décision volontairement minimale : un nettoyage automatique
  (purge post-run, TTL, reset de campagne) est un mécanisme supplémentaire à concevoir et fiabiliser
  — hors scope tant qu'un seul golden path tourne manuellement. Le marqueur `[E2E] ` / `E2E-`
  suffit à isoler ces données du reste ; leur accumulation reste un nettoyage manuel occasionnel à
  faire, pas un risque de pollution des données réelles.

## Décision 4 — Scope fonctionnel V1 et mode de déclenchement

- **Scope V1** : Android uniquement (pas d'iOS — cohérent avec le parc terrain, voir ADR-004 sur
  le support d'appareils Android d'entrée de gamme). Un seul golden path :
  **login → prospection intensive → sync → logout**, avec assertion croisée UI + API (pas
  seulement une assertion visuelle) pour vérifier que ce qui apparaît à l'écran correspond
  réellement à ce qui a été persisté côté serveur — le type de vérification que la régression de
  sync silencieuse de la carte #150 aurait fait échouer.
- **Mode de déclenchement : manuel uniquement** (`workflow_dispatch`), pas d'exécution automatique
  sur chaque push ni en gate de merge. Le workflow (#195) réutilise l'artifact `ifvm-preview-apk`
  déjà produit par `mobile-build.yml` plutôt que de builder son propre APK, et injecte la position
  GPS de test (constantes du seed : `-23.712, 44.401`) avant de lancer le flow. Ce choix garde le
  coût d'exploitation bas (pas de runner Android à maintenir en continu, pas de flakiness à
  absorber dans le chemin critique de CI) pendant que l'épic ne couvre qu'un seul parcours ;
  l'automatisation en gate de merge est un futur possible mais pas un objectif de la V1.

## Alternatives écartées

Voir Décision 1 pour Detox et Appium. Aucune alternative n'a été considérée sérieusement pour
l'environnement cible (Décision 2) : monter un environnement de staging dédié était hors scope
budgétaire et temporel de cet épic, d'où le choix assumé — et documenté comme transitoire — de
réutiliser l'environnement existant.

## Conséquences

- Ce document est la référence sur le point de vigilance « staging = production aujourd'hui » ;
  toute création d'un environnement de production distinct doit déclencher une relecture de cet
  ADR et une mise à jour de la cible des flows Maestro et de `mobile-build.yml`.
- Les flows `.maestro/` (`mobile/`) et le workflow CI (#195) doivent s'appuyer sur le compte et la
  campagne seedés par #194, jamais sur un compte réel.
- Étendre le scope V1 (multi-flows, iOS, déclenchement automatique) est un choix distinct à
  documenter dans un ADR ultérieur, pas une extension implicite de celui-ci.

## Référencé depuis

- Issue `tojoolivier/ifvm-app#193` (épic parent).
- `docs/e2e-seed.md` (§ « Le workflow Maestro (#195) lit ce même secret »).
