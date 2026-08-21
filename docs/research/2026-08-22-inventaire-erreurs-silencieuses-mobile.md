# Inventaire des erreurs silencieuses du mobile

**Ticket** : [#151](https://github.com/tojoolivier/ifvm-app/issues/151) — carte wayfinder [#150](https://github.com/tojoolivier/ifvm-app/issues/150)
**Date du relevé** : 2026-08-22 · **Périmètre** : `mobile/src` (`.ts` / `.tsx`), `node_modules` exclu
**Méthode** : extraction automatique des blocs `catch` par appariement d'accolades + classification par
contenu du corps, puis relecture manuelle des sites ambigus. Script jetable, non versionné.

---

## 1. Les chiffres, corrigés

| grandeur | annoncé à l'ouverture de la carte | mesuré ici | commentaire |
|---|---|---|---|
| blocs `catch` | 91 | **71** | le 91 comptait probablement au-delà de `mobile/src` ; 71 recoupe le chiffre de [#152](https://github.com/tojoolivier/ifvm-app/issues/152) |
| `console.*` | 120 | **120** | 72 `log` · 20 `warn` · 28 `error` |
| `try` sans `catch` | 6 | **7** | tous des `try/finally` |
| guard-clauses muettes `if (!x) return` | — | **66** | non mesuré jusqu'ici ; c'est le trou de lint signalé par #152 |

### Répartition des 71 `catch` par couche

| couche | sites | part |
|---|---|---|
| écran (`app/`) | 36 | 51 % |
| `lib/` générique | 11 | 15 % |
| `lib/` sync | 7 | 10 % |
| `lib/` api-client | 6 | 8 % |
| store Zustand | 5 | 7 % |
| `lib/` db | 4 | 6 % |
| hook | 2 | 3 % |

### Répartition des 71 `catch` par forme du silence

| forme | sites | verdict |
|---|---|---|
| `console.*` + traitement (Alert/setState) | 15 | à migrer vers le logger, sinon sain |
| `console.*` seul | 13 | **muet en release** — rien à l'écran |
| retour muet (`return []` / `null` / `{}` / `true`) | 11 | **le plus dangereux** — voir §3 |
| traite sans journaliser (setState / Alert) | 9 | visible mais non diagnosticable |
| relance (`throw`) | 9 | conforme au principe « capturer au plus haut niveau » |
| journalise via `logError` / `setError` | 8 | conforme |
| `catch` vide | 6 | **avale tout**, sans exception |

---

## 2. Le constat qui renverse l'hypothèse de départ

La carte supposait que « le trou est dans `lib/`, sous la ligne de flottaison de `useAsyncAction` ».
**C'est à moitié faux** : **51 % des `catch` sont dans les écrans** — précisément là où `useAsyncAction`
devrait déjà régner. Le problème n'est pas que `lib/` échappe au hook ; c'est que **le hook n'est
quasiment pas adopté** (6 écrans sur ~30) et que chaque écran a réimplémenté son propre `try/catch` +
`Alert.alert` à la main.

Corollaire pour la migration : le gros du travail est un travail d'**écran**, pas de `lib/`. `lib/` est
comparativement sain — 9 `throw` sur 33 `catch` y propagent déjà correctement.

Deuxième correction : `lib/prospection-db.ts` est le champion des `console.*` (24) mais **21 de ces 24
sont des traces de migration SQLite** (`[Migration] ✅ Colonne … ajoutée`). Ce n'est pas du bruit de
debug oublié : c'est le seul journal existant d'une opération critique et irréversible. Ce fichier n'est
donc pas un site à nettoyer, c'est un **client prioritaire du logger** (niveau `info`, persisté).

---

## 3. Les familles de silence, par gravité

### A. Corruption de données locales masquée en « pas de données » — 8 sites

Le motif le plus répandu du code, et le plus insidieux : un `JSON.parse` défensif dont le `catch`
retourne la valeur vide.

```ts
// app/(prospection)/captures.tsx:86 — identique dans density.tsx:20
function parseGrillesCompletees(raw: string | null): string[] {
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
```

Sites : `captures.tsx:90`, `density.tsx:24`, `traitement-sync.ts:21`, `prospection-repository.ts:427`,
`moyens.tsx:54`, `impacts.tsx:36`, `:37`, `:38` (trois `catch {}` sur trois lignes consécutives),
`prospection-especes.ts:46`.

**Conséquence terrain** : une colonne SQLite corrompue devient un écran vide *indiscernable* d'une saisie
jamais faite. L'agent recommence sa saisie — ou pire, croit que le formulaire est vide et valide. Aucune
trace. C'est exactement le mode de panne qui a motivé la carte.

**Enjeu pour la taxonomie ([#155](https://github.com/tojoolivier/ifvm-app/issues/155))** : « donnée locale illisible » est une classe d'erreur à part entière —
ni réseau, ni bug de programmation. Elle mérite au minimum une trace journalisée, probablement un état
vide *explicite* (« ces données n'ont pas pu être relues ») plutôt qu'un vide muet.

### B. Perte silencieuse de données réseau — 3 sites

```ts
// lib/prospection-accueil.ts:53
export async function loadValidatedProspections(...): Promise<ProspectionRead[]> {
  try { return await apiClient.listProspections(...); }
  catch { return []; }
}
```

Sites : `prospection-accueil.ts:53` (`return []`), `traitement-sync.ts:186` (`return { synced: false }`
sans motif), `referentiel-auto-sync.ts:194`.

**Conséquence terrain** : « aucune fiche validée » alors que le serveur est simplement injoignable. Sur un
terrain majoritairement hors ligne, c'est *le* cas nominal, et il ment à l'agent. `traitement-sync.ts:186`
est le plus grave : il perd le motif de l'échec alors que le champ pour le porter existe déjà juste à côté
(`prospection-review.ts:352` fait bien, lui, `return { synced: false, syncError }`).

### C. `catch` vide sans exception — 6 sites

`impacts.tsx:36-38` (× 3, famille A), `references.tsx:94`, `auth-store.ts:78`, `prospection-review.ts:348`.

`auth-store.ts:75-78` est un nid : un `catch {}` de nettoyage **imbriqué dans** un autre `catch {}`.

```ts
} catch {
  try { await storage.deleteItem(tokenKey); }
  catch { /* cleanup failed — ignore */ }
  set({ isInitialized: true });
}
```

Le `catch` interne est le seul du code à porter une **justification écrite**. C'est précisément la forme
que #155 doit normaliser (« ignoré volontairement », visible à la revue, acceptable par le lint).
Le `catch` externe, lui, avale toute panne d'hydratation de session sans une ligne de journal.

### D. Muet en release — 13 `console.*` seuls

`index.tsx:81`, `:122`, `profile.tsx:56`, `use-referentiel-auto-sync.ts:22`, `auth-store.ts:98`,
`prospection-db.ts:333/388/431/460`, `prospection-review.ts:149`, `referentiel-auto-sync.ts:82/100`,
`storage.ts:37`.

D'après [#153](https://github.com/tojoolivier/ifvm-app/issues/153), `console.*` n'est pas supprimé en release — il tourne, sans destination visible.
Ces 13 sites sont donc **muets pour l'agent et muets pour le support**. Les quatre de `prospection-db.ts`
sont les plus lourds de conséquence : ce sont les `ALTER TABLE` de migration qui échouent. Une colonne
manquante en silence, c'est le mécanisme exact de la dérive de schéma décrite dans `CLAUDE.md`.

### E. Faux positifs à ne pas migrer — 2 sites

`api-client.ts:337` et `referentiel-auto-sync.ts:194` retournent `true` depuis `isTokenExpired()` quand le
décodage du JWT échoue. `auth-store.ts:129` retourne `false` depuis `refreshToken()`. **Ce sont des
fail-safe corrects** : la valeur retournée *dit* l'échec et pousse vers le chemin le plus sûr. Ils
satisfont le principe posé par le dev. À laisser tels quels, éventuellement avec une trace `debug`.

Ils sont malgré tout matchés par le sélecteur lint « `catch` sans `throw` ni loggeur » de #152 →
**ils constituent le premier lot de dérogations légitimes à arbitrer en [#158](https://github.com/tojoolivier/ifvm-app/issues/158)**.

---

## 4. Deux découvertes hors périmètre du ticket

### Le token d'authentification est écrit en clair dans les logs

```
lib/auth-store.ts:89          console.log('[auth] login API ok, token:', response.access_token?.substring(0, 30))
lib/prospection-accueil.ts:94 console.log('[startNewProspection] token:', params.token?.substring(0, 30))
```

S'ajoute à l'alerte déjà levée par #153 (`request-log-store` persiste `requestBody`/`responseBody` en
clair). Dès lors que les logs deviennent **persistés et exportables**, ces lignes partent sur WhatsApp.
`sanitizeForLog` cesse d'être un détail d'implémentation : c'est un **prérequis de l'export** ([#157](https://github.com/tojoolivier/ifvm-app/issues/157)),
pas une option de l'API du logger.

### `no-floating-promises` n'est pas outillable en l'état

`mobile/package.json` n'a que `eslint` + `eslint-config-expo`. Pas de `typescript-eslint` avec
`projectService` → **la règle `@typescript-eslint/no-floating-promises` n'est pas disponible aujourd'hui**.
L'activer suppose d'ajouter le lint type-aware, avec son coût en temps de CI. Décision pour #158.

Promesses flottantes matérielles repérées à la main (liste non exhaustive, sans le lint) :

| site | ce qui n'est pas attendu |
|---|---|
| `app/_layout.tsx:47` | `getDb()` et `useDebugStore.init()` — déjà noté dans le brouillard de la carte |
| `app/(app)/index.tsx:91,96,129` | `checkSyncStatus()`, `loadData()` |
| `app/(app)/prospection.tsx:104,181,196` | `navigateToProspectionDraft()`, `refresh()` |
| `app/(app)/sync.tsx:102` | `refresh()` |
| `app/(prospection)/density.tsx:70,80` | `hydrateFromDraft()`, `store.initGrilles()` |
| `app/(prospection)/captures.tsx:194,526,602` | `store.initGrilles()`, `store.updatePhase()`, `store.updateStadeBySex()` |
| `app/(prospection)/extensive-reference.tsx:85` | `fetchGpsPosition()` |

`captures.tsx:526` et `:602` sont dans des handlers de saisie : **une écriture de brouillon qui échoue ne
laisse aucune trace, et l'agent continue de saisir.**

---

## 5. Ce que ce relevé débloque

- **[#155](https://github.com/tojoolivier/ifvm-app/issues/155) — taxonomie.** Classes réellement observées : donnée locale illisible (A) · réseau indisponible
  attendu (B) · nettoyage best-effort (C, `auth-store.ts:76`) · migration de schéma échouée (D) ·
  fail-safe volontaire (E) · bug de programmation (le reste). « Réseau indisponible » et « fail-safe
  volontaire » sont les deux classes qui ne doivent **pas** alarmer l'agent tout en restant journalisées.
- **[#158](https://github.com/tojoolivier/ifvm-app/issues/158) — stratégie lint.** L'ampleur réelle est **71**, pas 91 ; 17 sites (relance + journalisation) sont
  déjà conformes. Le lot à traiter est de ~54 sites, dont 36 en écran. Big-bang plausible sur `lib/`
  (33 sites), progressif sur `app/`. Deux entrées concrètes : le premier lot de dérogations (§3.E) et
  le coût du lint type-aware (§4).
- **Ordre de migration** (à graduer depuis le brouillard) : `lib/` d'abord (petit, majoritairement déjà
  conforme, sert de banc d'essai au logger), puis les écrans par adoption de `useAsyncAction` —
  ce qui fait de la migration un travail d'**adoption du hook**, pas de réécriture de `catch`.

---

## Annexe — relevé site par site

#### catch vide — 6 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(traitement)/impacts.tsx:36` | ecran | `*(vide)*` |
| `app/(traitement)/impacts.tsx:37` | ecran | `*(vide)*` |
| `app/(traitement)/impacts.tsx:38` | ecran | `*(vide)*` |
| `app/(traitement)/references.tsx:94` | ecran | `*(vide)*` |
| `lib/auth-store.ts:78` | store | `*(vide)*` |
| `lib/prospection-review.ts:348` | lib | `*(vide)*` |

#### console.* seul — 13 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(app)/index.tsx:81` | ecran | `console.error('Erreur vérification sync:', error);` |
| `app/(app)/index.tsx:122` | ecran | `console.error('Erreur chargement données:', error);` |
| `app/(app)/profile.tsx:56` | ecran | `console.error('Erreur chargement image:', error);` |
| `hooks/use-referentiel-auto-sync.ts:22` | hook | `console.warn('[referentiel-auto-sync] pull failed:', error);` |
| `lib/auth-store.ts:98` | store | `console.warn('[auth] getProfile failed:', e);` |
| `lib/prospection-db.ts:333` | lib/db | `console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name}:`, error);` |
| `lib/prospection-db.ts:388` | lib/db | `console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name}:`, error);` |
| `lib/prospection-db.ts:431` | lib/db | `console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name} sur prospection_population:`, error);` |
| `lib/prospection-db.ts:460` | lib/db | `console.warn(`[Migration] ⚠️ Impossible d'ajouter ${col.name} sur traitement:`, error);` |
| `lib/prospection-review.ts:149` | lib | `console.error('❌ Erreur lors de la synchronisation:', error);` |
| `lib/referentiel-auto-sync.ts:82` | lib/sync | `console.warn( '[referentiel-auto-sync] Erreur chargement curseurs:', error );` |
| `lib/referentiel-auto-sync.ts:100` | lib/sync | `console.warn( '[referentiel-auto-sync] Erreur sauvegarde curseurs:', error );` |
| `lib/storage.ts:37` | lib | `console.warn(`[storage] deleteItem error for key "${key}":`, error);` |

#### retour muet — 11 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(prospection)/captures.tsx:90` | ecran | `return [];` |
| `app/(prospection)/density.tsx:24` | ecran | `return [];` |
| `app/(prospection)/reference.tsx:139` | ecran | `if (!isActive) return; const message = error instanceof LocationPermissionDeniedError ? 'Permission de localis` |
| `lib/api-client.ts:337` | lib/api | `return true;` |
| `lib/auth-store.ts:129` | store | `await storage.deleteItem(tokenKey); await storage.deleteItem(refreshTokenKey); set({ token: null, user: null, ` |
| `lib/location.ts:53` | lib | `return { region: null, district: null, commune: null };` |
| `lib/prospection-accueil.ts:53` | lib | `return [];` |
| `lib/prospection-especes.ts:46` | lib | `return { ...EMPTY_ESPECE_SELECTION };` |
| `lib/referentiel-auto-sync.ts:194` | lib/sync | `return true;` |
| `lib/traitement-sync.ts:21` | lib/sync | `return null;` |
| `lib/traitement-sync.ts:186` | lib/sync | `return { synced: false };` |

#### traite sans journaliser — 9 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(app)/debug-logs.tsx:112` | ecran | `Alert.alert('Export impossible', "Le rapport n'a pas pu être partagé.");` |
| `app/(app)/prospection.tsx:165` | ecran | `const label = draft.n_fiche ?? `fiche du ${draft.date_prospection}`; const message = error instanceof Error ? ` |
| `app/(app)/sync.tsx:74` | ecran | `setReferentielError( error instanceof Error ? error.message : 'Échec de la synchronisation du référentiel' );` |
| `app/(app)/sync.tsx:94` | ecran | `const message = error instanceof Error ? error.message : 'erreur inconnue'; currentFailures.push(`${ficheLabel` |
| `app/(prospection)/fiche-lecture.tsx:50` | ecran | `setExportError("Impossible d'exporter la fiche en PDF.");` |
| `app/(traitement)/moyens.tsx:54` | ecran | `setZones({});` |
| `app/(traitement)/references.tsx:99` | ecran | `const message = error instanceof LocationPermissionDeniedError ? 'Permission de localisation refusée.' : 'Posi` |
| `lib/auth-store.ts:75` | store | `try { await storage.deleteItem(tokenKey); } catch {` |
| `lib/prospection-repository.ts:427` | lib | `existing = [];` |

#### console.* + traitement — 15 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(app)/profile.tsx:138` | ecran | `console.error('Erreur récupération répertoire:', error); return '';` |
| `app/(app)/profile.tsx:176` | ecran | `console.error('📷 Erreur prise de photo:', error); Alert.alert('Erreur', 'Impossible de prendre la photo: ' + (` |
| `app/(app)/profile.tsx:214` | ecran | `console.error('🖼️ Erreur sélection image:', error); Alert.alert('Erreur', 'Impossible de sélectionner l\'image` |
| `app/(app)/profile.tsx:247` | ecran | `console.error('💾 Erreur sauvegarde image:', error); Alert.alert('Erreur', 'Impossible de sauvegarder l\'image'` |
| `app/(app)/profile.tsx:273` | ecran | `console.error('Erreur suppression image:', error); Alert.alert('Erreur', 'Impossible de supprimer l\'image');` |
| `app/(app)/profile.tsx:358` | ecran | `console.error('Erreur changement mot de passe:', error); Alert.alert( 'Erreur', error?.message \|\| 'Impossibl` |
| `app/(auth)/login.tsx:43` | ecran | `console.error('[login] login() threw:', e); if (e instanceof ApiError && e.status === 401) {` |
| `app/(prospection)/captures.tsx:433` | ecran | `console.error('Erreur sauvegarde captures:', error); Alert.alert('Erreur', 'Une erreur est survenue lors de la` |
| `app/(prospection)/extensive-imagos.tsx:141` | ecran | `console.error('Erreur lors de la sauvegarde:', error); Alert.alert('Erreur', 'Une erreur est survenue lors de ` |
| `app/(prospection)/extensive-larves.tsx:141` | ecran | `console.error('Erreur lors de la sauvegarde:', error); Alert.alert('Erreur', 'Une erreur est survenue lors de ` |
| `app/(prospection)/extensive-reference.tsx:73` | ecran | `console.error('Erreur GPS:', error); if (isMounted) { setGpsError('Impossible de récupérer la position GPS'); ` |
| `app/(prospection)/reference.tsx:312` | ecran | `console.error('Erreur lors de l\'enregistrement:', error); Alert.alert('❌ Erreur', 'Impossible d\'enregistrer ` |
| `lib/api-client.ts:407` | lib/api | `console.error( '[api-client] Erreur lors du rafraîchissement du token:', error ); return null;` |
| `lib/referentiel-auto-sync.ts:381` | lib/sync | `console.error( '[referentiel-auto-sync] Erreur lors de la synchronisation:', error ); if ( error instanceof Er` |
| `lib/storage.ts:11` | lib | `console.warn(`[storage] getItem error for key "${key}":`, error); return null;` |

#### journalise correctement — 8 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `app/(app)/profile.tsx:79` | ecran | `logError({ message: error instanceof Error ? error.message : 'Erreur inconnue lors de la synchronisation du ré` |
| `app/(prospection)/extensive-recap.tsx:64` | ecran | `setError("Impossible d'enregistrer la fiche pour le moment.");` |
| `app/(prospection)/extensive-recap.tsx:80` | ecran | `setError("Impossible d'enregistrer la vérification pour le moment.");` |
| `app/(prospection)/extensive-signalement.tsx:47` | ecran | `setError( e instanceof Error && e.message ? e.message : 'Impossible de démarrer la vérification (campagne intr` |
| `app/(prospection)/review.tsx:63` | ecran | `setError("Impossible d'enregistrer la fiche pour le moment.");` |
| `app/(prospection)/type-chooser.tsx:31` | ecran | `setError( e instanceof Error && e.message ? e.message : 'Impossible de démarrer une nouvelle fiche (campagne i` |
| `app/(prospection)/type-chooser.tsx:50` | ecran | `setError( e instanceof Error && e.message ? e.message : 'Impossible de démarrer une nouvelle fiche (campagne i` |
| `hooks/use-async-action.ts:44` | hook | `const { message, detail } = toFriendlyError(error); deps.showError({ message, detail, retry: () => { executeAs` |

#### relance (throw) — 9 site(s)

| site | couche | corps du `catch` |
|---|---|---|
| `lib/api-client.ts:527` | lib/api | `logRequest({ method: options.method \|\| 'GET', url, status: null, ok: false, durationMs: Date.now() - startTi` |
| `lib/api-client.ts:666` | lib/api | `if ( retryError instanceof ApiError ) { throw retryError; } console.error( '[api-client] Erreur lors de la ret` |
| `lib/api-client.ts:1156` | lib/api | `logRequest({ method: 'POST', url, status: null, ok: false, durationMs: Date.now() - startTime, startedAt: star` |
| `lib/api-client.ts:1273` | lib/api | `console.error( 'Erreur changement mot de passe:', error ); throw error;` |
| `lib/auth-store.ts:103` | store | `console.error('[auth] login FAILED:', e); set({ token: null, user: null, isAuthenticated: false }); throw e;` |
| `lib/prospection-accueil.ts:159` | lib | `console.error('[startNewProspection] ❌ Erreur:', error); throw error;` |
| `lib/prospection-review.ts:380` | lib | `console.error(`❌ Erreur pour ${draft.id}:`, error); if (error && typeof error === 'object' && 'response' in er` |
| `lib/referentiel-auto-sync.ts:226` | lib/sync | `console.warn( '[referentiel-auto-sync] Échec du rafraîchissement du token:', error ); throw error;` |
| `lib/storage.ts:24` | lib | `console.error(`[storage] setItem error for key "${key}":`, error); throw error;` |

#### `try` sans `catch` — 7 site(s)

| site | couche |
|---|---|
| `app/(prospection)/extensive-observations.tsx:33` | ecran |
| `app/(prospection)/extensive-reference.tsx:95` | ecran |
| `app/(prospection)/species.tsx:40` | ecran |
| `app/(traitement)/references.tsx:138` | ecran |
| `hooks/use-async-action.ts:25` | hook |
| `hooks/use-async-action.ts:77` | hook |
| `lib/api-client.ts:447` | lib/api |

#### Répartition des 120 `console.*` par fichier

| fichier | log | warn | error | total |
|---|---|---|---|---|
| `lib/prospection-db.ts` | 20 | 4 | 0 | **24** |
| `app/(app)/profile.tsx` | 14 | 0 | 7 | **21** |
| `lib/api-client.ts` | 6 | 5 | 3 | **14** |
| `lib/prospection-accueil.ts` | 11 | 0 | 3 | **14** |
| `lib/referentiel-auto-sync.ts` | 7 | 6 | 1 | **14** |
| `lib/prospection-review.ts` | 8 | 1 | 4 | **13** |
| `lib/auth-store.ts` | 5 | 1 | 1 | **7** |
| `lib/storage.ts` | 0 | 2 | 1 | **3** |
| `app/(app)/index.tsx` | 0 | 0 | 2 | **2** |
| `app/(auth)/login.tsx` | 0 | 0 | 1 | **1** |
| `app/(prospection)/captures.tsx` | 0 | 0 | 1 | **1** |
| `app/(prospection)/extensive-imagos.tsx` | 0 | 0 | 1 | **1** |
| `app/(prospection)/extensive-larves.tsx` | 0 | 0 | 1 | **1** |
| `app/(prospection)/extensive-reference.tsx` | 0 | 0 | 1 | **1** |
| `app/(prospection)/reference.tsx` | 0 | 0 | 1 | **1** |
| `app/(traitement)/references.tsx` | 1 | 0 | 0 | **1** |
| `hooks/use-referentiel-auto-sync.ts` | 0 | 1 | 0 | **1** |
