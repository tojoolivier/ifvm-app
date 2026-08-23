# ADR-012 — Éradication des erreurs silencieuses de l'app mobile

**Statut :** Accepté
**Date :** 2026-08-22
**Prolonge :** [ADR-008](ADR-008-gestion-erreurs-mobile.md), qu'il ne remplace pas — ADR-008 pose le principe (hook central, `try/catch` ad hoc proscrit), ADR-012 en achève le déploiement et l'étend à la couche `lib/`, que le hook ne protège pas.
**Carte de décision :** [issue #150](https://github.com/tojoolivier/ifvm-app/issues/150) — chaque décision ci-dessous renvoie au ticket qui porte son argumentation complète.

## Contexte

ADR-008 a été accepté, puis peu appliqué. L'inventaire mené en août 2026 ([#151](https://github.com/tojoolivier/ifvm-app/issues/151)) mesure l'écart :

| grandeur | mesuré dans `mobile/src` |
|---|---|
| écrans utilisant `useAsyncAction` | **6** sur ~30 |
| blocs `catch` | **71** |
| `console.*` | **120** (72 `log`, 20 `warn`, 28 `error`) |
| `try/finally` sans `catch` | 7 |
| guard-clauses muettes (`if (!x) return`) | 66 |

L'inventaire **renverse l'hypothèse de départ**. On supposait le trou dans `lib/`, sous la ligne de flottaison du hook ; en réalité **51 % des `catch` sont dans les écrans** (36 sur 71), c'est-à-dire là où `useAsyncAction` devrait déjà régner. `lib/` est comparativement sain : 9 de ses 33 `catch` propagent déjà par `throw`.

Le problème n'est donc pas que `lib/` échappe au hook, c'est que **le hook n'est pas adopté** et que chaque écran a réimplémenté son propre `try/catch` + `Alert.alert`.

Deux découvertes techniques cadrent le reste :

- **Il n'existe aucun filet de dernier recours en release** ([#160](https://github.com/tojoolivier/ifvm-app/issues/160)). `global.addEventListener('unhandledrejection')` (`global-error-handler.ts:47`) est une branche morte — `unhandledrejection` a 0 occurrence dans `react-native/Libraries`. Le tracker d'Hermes est gardé par `__DEV__` chez RN comme chez Expo. Et `ErrorUtils.setGlobalHandler`, qui fonctionne bien en release, **ne peut structurellement pas voir un rejet de promesse** : `ExceptionsManager.handleException` ne repasse jamais par `ErrorUtils`.
- **Le seul filtre de secrets du code était à l'envers** ([#161](https://github.com/tojoolivier/ifvm-app/issues/161)). `redactBody` n'était appliqué qu'à `requestBody`, laissant `access_token` et `refresh_token` en clair dans le corps de réponse de `/auth/login`. Corrigé par la [PR #164](https://github.com/tojoolivier/ifvm-app/pull/164).

## Périmètre

**Dans le périmètre** : `mobile/` uniquement. Export **manuel** des logs par l'agent. Garde-fou = **lint bloquant en CI**.

**Hors périmètre**, décidé et non rouvrable sans redessiner ce cadrage : le backend (audit serveur, endpoint d'ingestion de logs) · tout service tiers de crash reporting (Sentry, Bugsnag — coût, dépendance réseau, souveraineté des données sur un terrain majoritairement hors ligne) · le refactor de `lib/` vers un type `Result` · le frontend web · **l'arbitrage d'un conflit de synchronisation** (écran de comparaison, choix d'une version — la *représentation* du conflit reste dedans, l'arbitrage est une fonctionnalité produit).

---

## Décision 1 — Trois frontières de capture, et un filet qui n'existe pas

**Les couches basses propagent, elles ne capturent pas.** Les `catch` se font au plus haut niveau. Une capture en profondeur n'est licite que si elle **relance** (éventuellement re-typée, avec `cause`) **ou** retourne une valeur qui *dit* l'échec. Il est interdit de retourner une valeur indiscernable d'un succès (`null`, `true`, `[]`, `0`).

| frontière | couvre |
|---|---|
| `useAsyncAction` | action déclenchée par un geste de l'agent |
| `ErrorBoundary` | erreur de rendu React — **jamais** un `useEffect` ou un `onPress` async |
| `runTask({ criticality })` | tâche de fond — **à créer**, 0 occurrence aujourd'hui |

Les préconditions passent par `assertPresent()`, qui lève `PreconditionError`. La revue cherche ainsi une **présence** (« je vois `assertPresent` ») plutôt qu'une **absence** (« il manque un `throw` ») — repérer une absence est précisément ce que l'humain rate, et c'est pourquoi le bug d'ADR-008 s'est reproduit trois fois.

**Ces trois frontières doivent être étanches : il n'y a rien derrière elles** (cf. Contexte, #160). Un site non migré n'est pas une couverture dégradée, c'est un trou noir en release.

## Décision 2 — Un jeu fermé de sept classes, décidées par `instanceof`

Jamais de regex sur `e.message`. ([#155](https://github.com/tojoolivier/ifvm-app/issues/155))

| classe | couvre |
|---|---|
| `NetworkError` | serveur injoignable, timeout |
| `AuthError` | session expirée, 401 |
| `LocalReadError` | JSON illisible, colonne absente, lecture SQLite |
| `LocalWriteError` | INSERT/ALTER refusé, contrainte violée |
| `ReferentialError` | campagne / station absente du référentiel local |
| `PermissionError` | GPS, caméra, galerie refusés par l'OS |
| `PreconditionError` | `assertPresent()` — **seule classe au message verbatim** |

**Toute erreur non typée qui atteint une frontière est un bug, par définition.** Le bug n'est pas une huitième classe : c'est l'absence de classe, ce qui rend le jeu réellement fermé.

La séparation **lecture / écriture** de la donnée locale est délibérée : même cause technique, conséquence terrain opposée. `LocalReadError` = la donnée est déjà perdue, l'agent n'y peut rien. `LocalWriteError` = l'agent saisit et va tout perdre s'il continue.

`PreconditionError` est la seule à porter un message **écrit par le développeur au site d'appel** et affiché tel quel ; les six autres sont subies et leur message est fabriqué par la couche d'affichage.

**Le typage se fait à la source.** Chaque module de `lib/` enveloppe ses propres erreurs (`throw new NetworkError(msg, { cause: e })`). Les quatre tests regex de `friendly-error.ts` sont **supprimés**, pas déplacés dans un `classify()` — remplacés par un `switch` sur `instanceof` avec retour générique par défaut. Un site non encore typé dégrade proprement vers le message générique au lieu du message brut, et la dette de typage reste visible.

**Le message technique brut ne s'affiche jamais.** Le `return { message: raw }` de `friendly-error.ts:23` disparaît : il envoie aujourd'hui `Cannot read property 'id' of undefined` sur la bannière d'un agent terrain. Le brut vit dans `detail`, qui ne va qu'au journal.

## Décision 3 — Le traitement est `f(classe, frontière)`

**Règle transversale : toute erreur part au journal, sans condition.** Ni la classe, ni la frontière, ni le flag debug ne peuvent l'en empêcher. Seul varie ce que l'agent *voit*.

**Trois catégories**, pas quatre : **BLOQUER** (l'agent ne peut pas continuer utilement) · **INFORMER** (averti, son travail continue) · **JOURNALISER SEULEMENT**.

|  | `useAsyncAction` | `runTask` `best-effort` | `runTask` `essential` | `ErrorBoundary` + filet |
|---|---|---|---|---|
| `NetworkError` | INFORMER | JOURNAL | INFORMER | — |
| `AuthError` | **BLOQUER** | JOURNAL | INFORMER | — |
| `LocalReadError` | INFORMER | JOURNAL | INFORMER | — |
| `LocalWriteError` | **BLOQUER** | JOURNAL | INFORMER | — |
| `ReferentialError` | INFORMER | JOURNAL | INFORMER | — |
| `PermissionError` | INFORMER | JOURNAL | INFORMER | — |
| `PreconditionError` | INFORMER *(verbatim)* | JOURNAL | INFORMER | — |
| *(non typée = bug)* | INFORMER *(générique)* | JOURNAL | INFORMER | **BLOQUER** |

**Pourquoi la classe seule ne suffit pas** : le même `NetworkError` est le cas nominal pendant l'auto-sync du référentiel — hors ligne est normal sur le terrain — et une information due à l'agent quand c'est lui qui a appuyé sur « Synchroniser ».

**Les colonnes de fond sont plates, volontairement** : au fond, c'est la criticité de la *tâche* qui décide, pas la nature de l'erreur. `criticality: 'best-effort' | 'essential'` est **obligatoire, sans défaut**, pour forcer le développeur à se prononcer et la revue à le voir. Le niveau `silent` est écarté — il rouvrirait la porte au silence total.

**Les deux seuls BLOQUER à l'écran** sont ceux où continuer coûte quelque chose : `AuthError` (plus rien ne fonctionnera) et `LocalWriteError` (la saisie sera perdue).

**Le silence délibéré s'écrit `ignore(error, raison)`.** Il journalise en `debug` avec la raison **dans la ligne de journal**, satisfait le lint sans dérogation, et reste auditable par `grep "ignore("`. Ce n'est pas un traitement — avec le journal inconditionnel il serait identique à JOURNALISER SEULEMENT — c'est une **forme de code** qui prouve à la revue que le silence est un choix.

## Décision 4 — Un logger unifié à verbes métier

([#156](https://github.com/tojoolivier/ifvm-app/issues/156)) `console.*` disparaît au profit de quatre points d'entrée :

```ts
const log = logger.child({ module: 'prospection-db' }, 'runTask:essential');

log.event('migration.column.adding', { column });       // fait notable
log.detail('camera.permission.checked', { status });    // fait d'investigation, verbeux
log.failure('migration.column.failed', e, { column });  // échec NOMMÉ
log.ignore(e, 'nettoyage best-effort du token');        // silence délibéré
```

**Le développeur ne choisit jamais le niveau ni le traitement** — ils sont déduits de `f(classe, frontière)`. La matrice de la décision 3 devient une **propriété du logger** au lieu d'une discipline à tenir sur ~70 sites : oublier de réfléchir ne produit plus un silence. Le journal porte `classe` et `traitement`, donc le support voit *pourquoi* l'agent a vu — ou n'a pas vu — quelque chose.

**Pas d'échappatoire `log.warn` / `log.error` bruts.** Le précédent est net : `useAsyncAction` est disponible depuis ADR-008 et adopté par 6 écrans sur 30. Une porte de sortie devient le chemin par défaut.

**Point d'entrée unique.** `error-log-store` et `request-log-store` disparaissent, absorbés. Une seule table SQLite, **une seule ligne de temps** — le `correlationId` ne sert à rien si la requête HTTP et l'erreur qu'elle a provoquée vivent dans deux flux séparés. Le volume se gère par la **rétention** (`detail` purgé agressivement, `failure` gardé longtemps), pas par la séparation. `debug-store` survit mais **ne gate plus aucune écriture**.

**Sortie** : anneau mémoire synchrone et non bloquant, miroir `console.*` **en dev uniquement**, et **flush asymétrique** — `detail` et `event` par lots, `failure` et `ignore` déclenchent un flush immédiat du tampon entier. Un flush purement périodique perdrait le dernier lot sur crash dur, c'est-à-dire précisément les lignes qu'on cherche à diagnostiquer ; vider tout le tampon sur `failure` persiste du même coup **le contexte qui précède l'échec**.

**Piège à ne pas manquer** : `sink()` écrit dans SQLite, et une écriture SQLite peut échouer — c'est `LocalWriteError`. Si le logger journalise ses propres échecs de flush *via lui-même*, on obtient une récursion infinie sur un appareil déjà en difficulté. **L'échec du flush ne passe jamais par le logger** : il lève un drapeau mémoire (`journalFlushBroken`) affiché sur l'écran de journal.

## Décision 5 — L'affichage : catégorie × lieu du manque

([#159](https://github.com/tojoolivier/ifvm-app/issues/159)) La catégorie dit l'insistance ; le **lieu** dit où.

|  | rattachée à une zone | globale |
|---|---|---|
| **BLOQUER** | zone + modale | modale |
| **INFORMER** | **état vide explicite** | bannière / toast |
| **JOURNALISER SEULEMENT** | — | — |

Deux scénarios sont tous deux INFORMER et pourtant opposés : une donnée illisible laisse une liste vide qu'**aucune bannière ne répare** — l'agent lit « aucune fiche » — tandis qu'un échec réseau sur un geste explicite ne prive l'écran de rien. Ce qui les sépare n'est pas la gravité, c'est où la donnée manquait.

Conséquence : **un vide muet devient impossible à produire** — précisément la famille la plus répandue du code (8 sites de `JSON.parse` défensif).

**Concurrence** : `error-store` ne garde qu'une erreur et écrase en silence — le dispositif chargé de rendre les erreurs visibles en avale une sur deux. Retenu : **dédoublonnage par classe** (5 échecs réseau = 1 bannière « 5 fiches n'ont pas pu partir »), la plus grave gagne, et **« +N autres › »** cliquable vers le journal.

**Une action par classe**, pas un « Réessayer » universel — l'action est une propriété de la classe, comme le niveau et le traitement :

| classe | action |
|---|---|
| `NetworkError` | Réessayer |
| `LocalWriteError` | Réessayer d'enregistrer |
| `AuthError` | Se reconnecter |
| `PermissionError` | Ouvrir les réglages |
| `ReferentialError` | Synchroniser les référentiels |
| `LocalReadError` · *(bug)* | Signaler au support |
| `PreconditionError` | *(aucune — le message dit déjà quoi faire)* |

**`ErrorBoundary` : une par route**, la racine restant en filet. Et `reset()` (`error-boundary.tsx:34`) est remplacé par un **retour en arrière** : remonter le même arbre avec les mêmes props ne peut pas réussir si la cause persiste — le bouton s'appelle « Réessayer » et n'a structurellement aucune chance. Revenir change les props.

## Décision 6 — Expurgation par nom de clé, dans `sink()`, à l'écriture

([#161](https://github.com/tojoolivier/ifvm-app/issues/161)) `sink()` est le passage obligé de toute ligne de journal : un filtre posé là est **exhaustif par construction**, là où une liste d'URL doit être tenue à jour route par route — et c'est cette granularité qui a fait échouer `redactBody`.

**Jamais de sérialisation avant `sink()`.** On passe l'**objet**, jamais la chaîne : un corps déjà `JSON.stringify` est opaque au filtre par clé.

```ts
log.event('http.response', { body: responseData });                   // ✅
log.event('http.response', { body: JSON.stringify(responseData) });   // ❌
```

**Périmètre : ce qui authentifie ou autorise, uniquement.** Un jeton *authentifie* — qui l'obtient devient l'agent ; une coordonnée GPS *décrit*. Sont expurgés `access_token`, `refresh_token`, `token`, `password`, `authorization`, `api_key`, `secret`. **Passent** : latitude/longitude, identité de l'agent, contenu des fiches — c'est la charge utile du diagnostic, et l'agent qui exporte la possède déjà.

**Forme** : `[redacted:ab12]`, préfixe d'un hachage — répond à la seule question qu'une valeur secrète permet de poser, *est-ce le même jeton qu'à la ligne d'avant ?*

**Garantie : deux filets indépendants.** Par le nom (liste d'exclusion) **et par la forme de la valeur** — toute chaîne en `^eyJ[\w-]+\.` est expurgée quel que soit son nom, ce qui attrape un champ inconnu portant un jeton. Plus un test de non-régression faisant passer des `LoginResponse` réels dans `sink()`.

## Décision 7 — L'export : signalement à commentaire optionnel

([#157](https://github.com/tojoolivier/ifvm-app/issues/157)) Le parcours actuel a une **dépendance temporelle impossible à satisfaire** : `profile.tsx:530` ne montre le lien vers le journal que si le mode débogage est actif, donc l'agent devait l'activer *avant* le bug.

- **Entrée chaude** : bouton « Signaler au support » sur l'erreur elle-même.
- **Entrée froide** : « Signaler un problème » **toujours visible** dans le Profil, sans condition.
- **Écran intermédiaire** à commentaire **optionnel**, avec deux sorties (« Envoyer » / « Envoyer sans commentaire ») — l'agent pressé reste à deux gestes, celui qui peut expliquer donne au support ce qu'aucune pile d'appel ne contient. L'écran dit aussi ce qui part.
- **Le flag debug devient un réglage de verbosité** — « Enregistrer les détails techniques », à activer à la demande du support — et non plus un gate.
- **Fichier `.jsonl` dont la première ligne est un objet d'en-tête** (version d'app et de build, appareil, OS, agent, commentaire, `correlationId`). Un objet par ligne reste du `.jsonl` valide.
- **Tranche : depuis le dernier démarrage**, plafonnée (~1 Mo), tronquée par la fin **sauf la fenêtre entourant le `correlationId`**. Contrainte physique : le fichier part sur WhatsApp depuis un téléphone d'entrée de gamme en 2G rurale, et **un envoi qui échoue est un signalement perdu**.

L'export n'a **aucune responsabilité de confidentialité** : le filtre est à l'écriture (décision 6).

## Décision 8 — Le filet global, avec nos propres options

([#165](https://github.com/tojoolivier/ifvm-app/issues/165)) `global.HermesInternal.enablePromiseRejectionTracker` est appelé **par nous**, `if (!__DEV__)` pour laisser LogBox en dev.

Les options par défaut de RN et d'Expo enveloppent le rejet dans `new Error(…, { cause: rejection })` : vu par `instanceof`, **tout rejet serait classé « bug »** alors que la classe est dans `.cause`. D'où des `onUnhandled` / `onHandled` maison.

**Journal immédiat, affichage à 500 ms annulé par `onHandled`.** Hermes attend déjà 2000 ms (100 ms pour `ReferenceError` / `TypeError` / `RangeError`), donc le journal ne perd rien — un rattrapage tardif produit sa propre ligne. Le délai ne concerne que l'écran, parce que la bannière de la décision 5 ne disparaît pas seule et ne peut donc pas se rétracter.

⚠️ **Cette décision reste conditionnée** à la vérification de [#166](https://github.com/tojoolivier/ifvm-app/issues/166) — voir « Ce qui reste à vérifier ».

## Décision 9 — Sync : l'unitaire lève, le lot résume

([#163](https://github.com/tojoolivier/ifvm-app/issues/163)) Trois conventions coexistaient pour la même issue. Une seule subsiste :

```ts
syncOne(draft): Promise<void>              // lève

syncAll(drafts): Promise<{
  reussies: string[];
  echouees: { id: string; label: string; classe: Classe }[];
  conflits: { id: string; label: string; serverVersion: unknown }[];
}>
```

Ce n'est pas le type `Result` écarté du périmètre : il ne s'agit pas de remplacer le canal d'erreur, mais de typer le résultat métier d'une opération qui a nativement plusieurs issues par fiche.

**La classe décide du sort de la fiche** — transitoire contre permanent :

| classe | `statut_sync` |
|---|---|
| `NetworkError`, `ApiError` 5xx | reste `'a_synchro'` — repart tout seul, cas nominal hors ligne |
| `ApiError` 4xx (hors 401) | passe à `'echec'` — **sort de la file**, motif stocké, demande une action |
| conflit (409) | passe à `'conflit'` — `serverVersion` **conservée** |

Aucune migration : `statut_sync` est déjà `TEXT NOT NULL DEFAULT 'local'`. Le compteur de tentatives est écarté — une semaine hors réseau produit trois échecs parfaitement normaux.

**Un résultat partiel est un état, pas une erreur** : l'`Alert` modale de `sync.tsx:105` disparaît au profit de badges par fiche (qui survivent au départ de l'écran), d'un résumé non bloquant et d'un « Réessayer les N en échec » ciblé.

## Décision 10 — Lint bloquant par périmètre, périmètre qui s'élargit

([#158](https://github.com/tojoolivier/ifvm-app/issues/158)) Les règles sont déclarées **`error` dès le départ**, restreintes par glob aux zones migrées.

```js
// eslint.config.js — étape 1
{ files: ['src/lib/**'], rules: { /* le jeu complet */ } }
// étape 2, une PR plus tard
{ files: ['src/lib/**', 'src/app/(prospection)/**'], rules: { /* … */ } }
```

**Rien n'est jamais en `warning`** : un fichier est protégé pour de bon, ou pas encore dans le périmètre. Aucune régression ne peut entrer en territoire migré, et le glob **est** l'indicateur d'avancement.

Les voies progressives classiques (`--max-warnings` dégressif, baseline de suppressions) sont écartées : elles reposent sur l'idée que les sites non traités restent couverts par autre chose. Faux — leur coût réel est « N semaines de trous noirs connus et acceptés ». Le big-bang l'est aussi : ~70 sites sur 36 écrans ne rentre dans aucune revue.

**Le jeu de règles** : `no-empty` strict · sélecteur `TryStatement[handler=null]` · sélecteur `CatchClause` sans `throw` ni appel loggeur · interdiction de `JSON.stringify` dans un argument du logger (décision 6) · `no-console` — c'est lui qui **donne son sens au mot « migré »** · et `@typescript-eslint/no-floating-promises`, qui impose d'ajouter `typescript-eslint` avec `projectService` : c'est le seul mécanisme capable de détecter une promesse flottante, et #160 en a fait une classe de trous noirs.

**Aucune dérogation locale.** Pas d'`eslint-disable` : un `eslint-disable` produit du silence, `ignore()` produit une ligne de journal. Un cas non couvert se corrige dans la configuration — une discussion versionnée — pas dans un commentaire enterré.

**CI = autorité** (`lint-mobile`, déjà bloquant, aucun changement d'infrastructure), **pre-commit = retour rapide** (ne voit que l'index, contournable par `--no-verify`).

---

## Alternatives écartées

- **Sentry / Bugsnag** — coût, dépendance réseau et souveraineté des données sur un terrain majoritairement hors ligne.
- **Refactor de `lib/` vers un type `Result`** — au profit du lint ; y revenir supposerait de redessiner le périmètre.
- **Un `classify(raw)` centralisant les regex aux frontières** — déplace le problème au lieu de le supprimer, et reste fragile aux changements de libellé d'Expo.
- **Niveau `silent` sur `runTask`** — rouvrirait la porte au silence total.
- **Commentaire de signalement obligatoire** — produit des « ça marche pas » et fait abandonner l'agent qui ne sait pas quoi écrire.
- **Compteur de tentatives pour marquer une fiche en échec** — sortirait de la file des fiches valides après une semaine hors réseau.
- **Typage opaque des secrets (`Secret<string>`)** — les corps de réponse arrivent de `response.json()` en `any`, donc le chemin réel de la fuite échappe au compilateur.
- **Geste caché pour l'export** (appui long sur la version) — doit être enseigné par téléphone, exactement le coût qu'on supprime.

## Conséquences

- **La migration est un travail d'adoption de `useAsyncAction`**, pas une réécriture de `catch` — 36 des 71 sites sont des écrans.
- **Le volume passe de ~54 à ~70 sites** : le typage à la source rend du travail les 9 `throw` de `lib/` que l'inventaire classait « déjà conformes ». Relancer ne suffit plus, il faut relancer typé.
- **La migration est bloquante, pas opportuniste.** Sans filet en release, un site non migré est un trou noir. Sans filet derrière, **la règle lint *est* le filet**.
- **`runTask` doit être conçu sans échappatoire** — pas de flag `silent`, pas de `try/finally` sans `catch`.
- **Premier client de `runTask({ criticality: 'essential' })`** : `_layout.tsx:47`, où `getDb()` et `useDebugStore.init()` sont des promesses flottantes.
- **La branche morte de `global-error-handler.ts:47` est à supprimer**, pas à corriger : tant qu'elle est là, on croit avoir un filet.
- **Ordre de migration** : `lib/` d'abord (33 sites, banc d'essai du logger), puis les écrans par groupe de routes.

## Ce qui reste à vérifier

[#166](https://github.com/tojoolivier/ifvm-app/issues/166) — **la décision 8 est conditionnée** à la vérification, sur un build **release** réel, que `HermesInternal.enablePromiseRejectionTracker` existe et tire effectivement. Cette hypothèse n'a jamais été testée.

Le doute est motivé : cette carte a trouvé **deux branches mortes du même genre** — `global.addEventListener('unhandledrejection')`, qui compile grâce à une déclaration écrite à la main et ne s'exécute jamais, et `promise/setimmediate/rejection-tracking`, inopérant sous Hermes parce que le polyfill JS n'y est jamais installé.

**Si le tracker s'avère inerte en release**, la décision 8 tombe : il n'y a alors aucun filet possible en production, et « les trois frontières doivent être étanches » (décision 1) cesse d'être une précaution pour devenir la seule garantie.

## Sources

Rapports de recherche, sur branches dédiées :

| sujet | branche |
|---|---|
| Règles lint anti-catch-silencieux | `research/lint-catch-silencieux` |
| Filet global et rejets de promesse | `research/filet-global-rejets` |
| Inventaire des erreurs silencieuses | `research/inventaire-erreurs-silencieuses` |
| Prototype — API du logger | `research/proto-logger-api` |
| Prototype — affichage des erreurs | `research/proto-affichage-erreurs` |
| Prototype — parcours d'export | `research/proto-export-logs` |
