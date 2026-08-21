# Expo : sort de `console.*` en release, persistance et export de logs terrain

> Première note du dossier `docs/research/` — ce dossier documente les recherches factuelles menées avant une décision de conception (ici en réponse à l'issue #153), sourcées sur la documentation officielle et le code du repo, par opposition aux ADR qui documentent une décision déjà prise.

**Contexte (issue #153)** : l'app mobile IFVM tourne sur des Android bas de gamme (`buildArchs: armeabi-v7a`), souvent hors ligne, en zone rurale à Madagascar. Aujourd'hui `error-log-store.ts` et `request-log-store.ts` sont des stores Zustand en mémoire pure (`MAX_ENTRIES = 100`, tout disparaît au redémarrage). La question : que devient réellement `console.*` en build release (EAS/Hermes), et comment persister puis exporter des logs exploitables depuis le terrain ?

---

## 1. Sort de `console.*` en build release (EAS Build, Hermes)

**Conclusion tranchée** : par défaut, Expo **ne supprime pas** les appels `console.*` en production. Ils continuent à s'exécuter (coût CPU/mémoire réel, sérialisation des arguments comprise) mais perdent leur **destination visible habituelle** (le terminal Metro), sauf si on branche explicitement `adb logcat` (Android) ou la Console app (iOS). La suppression n'existe que si on l'active soi-même via la config Terser du bundler.

**Preuves** :
- Doc Expo "Minifying JavaScript" (`docs/pages/guides/minify.mdx`, branche sdk-56) est explicite sur le caractère *opt-in* de la suppression :
  ```js
  const { getDefaultConfig } = require('expo/metro-config');
  const config = getDefaultConfig(__dirname);
  config.transformer.minifierConfig = {
    compress: {
      // The option below removes all console logs statements in production.
      drop_console: true,
    },
  };
  module.exports = config;
  ```
  → Le projet IFVM n'a **pas** cette option dans sa config Metro actuelle (non trouvée dans `mobile/`), donc `console.*` reste dans le bundle release EAS et s'exécute réellement.
- Le mécanisme d'interception des logs pour les rediriger vers le terminal Metro (`captureStackForServerLogs()`, dans `@expo/metro-runtime`) est conditionné à `__DEV__` :
  ```typescript
  if (__DEV__) {
    require('./metroServerLogs').captureStackForServerLogs();
    ...
  }
  ```
  → En release (`__DEV__ = false`), cette interception est désactivée : les logs n'ont **plus de canal WebSocket** vers un poste de dev. Ce n'est pas "les logs disparaissent", c'est "personne n'écoute" — le natif (Hermes → JSI → `nativeLoggingHook`) écrit toujours vers `adb logcat`/`os_log`, canal confirmé par `docs/pages/debugging/runtime-issues.mdx` ("Use native log tools... adb logcat or the Console app").
- Le remote debugging Chrome DevTools n'est pas non plus une option viable en release standalone (doc `using-hermes.mdx` : Hermes utilise le protocole CDP mais nécessite une connexion active, absente en standalone).

**Recommandation opérationnelle** : ne pas compter sur `console.*` comme mécanisme de journalisation persistant en terrain hors ligne — il n'y a personne côté `adb logcat` pour l'écouter sur un téléphone d'agent isolé, et chaque appel a un coût réel (sérialisation d'objets, allocation de strings) qui s'accumule sur du matériel bas de gamme. `console.*` doit rester réservé au dev ; toute donnée devant survivre et être exportable doit passer par un store persistant explicite (section 2), pas par `console.*` + `drop_console`.

---

## 2. Persistance

### 2.1 `expo-file-system` (nouvelle API SDK 56 : `File` / `Directory` / `Paths`)

**Conclusion tranchée** : `Paths.document` (équivalent `FileSystem.documentDirectory` dans l'ancienne API à chaînes) est le bon répertoire pour des logs à faire survivre — il **survit** aux mises à jour OTA `expo-updates` (nouvelle version JS bundle) et aux redémarrages. `Paths.cache` (`FileSystem.cacheDirectory`) peut être purgé par le système à tout moment quand l'espace disque manque — à proscrire pour des logs qu'on veut garantir exportables.

**Preuves** (`packages/expo-file-system/src/Paths.ts`, branche sdk-56) :
```typescript
export class Paths extends PathUtilities {
  /** cache directory – peut être supprimé par le système si l'espace manque */
  static get cache() {
    return new Directory(ExpoFileSystem.cacheDirectory);
  }
  /** document directory – protégé du nettoyage système */
  static get document() {
    return new Directory(ExpoFileSystem.documentDirectory);
  }
}
```
Usage typique (nouvelle API) :
```typescript
import { File, Paths } from 'expo-file-system';

const logFile = new File(Paths.document, 'logs.jsonl');
if (!logFile.exists) logFile.create();
logFile.write(existingContent + newLine); // écriture synchrone disponible côté nouvelle API
```
L'ancienne API basée sur des chaînes (`FileSystem.documentDirectory`, `FileSystem.writeAsStringAsync`) reste disponible dans le module `legacy` mais est dépréciée au profit de `File`/`Directory`/`Paths`.

**OTA et filesystem** : la doc "EAS Update > How it works" précise que `expo-updates` télécharge uniquement le nouveau bundle JS et les assets modifiés ; il ne touche pas au répertoire document de l'app (c'est un espace applicatif indépendant du mécanisme de mise à jour, qui ne gère que `runtimeVersion`/bundle/assets). Une mise à jour OTA **ne vide donc pas** `Paths.document`. Seule une désinstallation de l'app (ou un `expo-updates` `Updates.reloadAsync()` combiné à un `clearAsync` explicite, non utilisé par défaut) purgerait ce répertoire.

**Recommandation** : écrire les logs dans `Paths.document` (ex. `Paths.document.uri + 'logs/'`), jamais dans `Paths.cache`.

### 2.2 `expo-sqlite` — table de logs dédiée

Le repo a déjà une base SQLite offline bien structurée : `mobile/src/lib/prospection-db.ts` ouvre `ifvm.db` via `SQLite.openDatabaseAsync`, active `PRAGMA journal_mode = WAL` et `PRAGMA foreign_keys = ON`, et migre le schéma via `CREATE TABLE IF NOT EXISTS` idempotents au démarrage (`openAndMigrate()`). Ajouter une table `app_log` suivrait exactement ce même pattern (coût d'intégration faible : même connexion, même mécanisme de migration).

**Coût réel à anticiper** :
- Écritures fréquentes (chaque `console.error`/`console.warn` intercepté) sur un stockage flash bas de gamme (`armeabi-v7a` cible du bas de gamme, cf. `mobile/app.json`) → batcher les écritures (buffer en mémoire, flush périodique ou sur seuil) plutôt qu'un `INSERT` synchrone par log, pour éviter d'accumuler de la latence sur le thread JS/SQLite partagé avec les écritures métier (prospection, capture).
- Rotation obligatoire : sans purge, la table grossit indéfiniment sur un device avec peu de stockage libre. Une politique simple (garder N derniers jours ou plafonner à N lignes avec suppression FIFO) est nécessaire — le repo a déjà ce réflexe côté stores en mémoire (`MAX_ENTRIES = 100`), à reproduire côté SQLite avec un seuil plus généreux vu la persistance recherchée.

### 2.3 `AsyncStorage`

`@react-native-async-storage/async-storage` n'apparaît **pas** dans `mobile/package.json` (seul `expo-secure-store` gère le stockage clé/valeur, via `mobile/src/lib/storage.ts`). Même s'il était présent, l'API clé/valeur d'AsyncStorage n'est pas conçue pour un flux append-only volumineux : la limite historique Android est ~6 Mo pour la base entière (`AsyncStorage.ts` / doc React Native), avec un import complet en mémoire à chaque lecture/écriture — inadapté à un journal qui grossit en continu. Ne pas l'introduire pour ce besoin.

### 2.4 Contraintes bas de gamme

- `buildArchs: armeabi-v7a` (`mobile/app.json`) cible des devices ARM 32-bit anciens/économiques → stockage flash lent, RAM limitée. Toute écriture de log doit être asynchrone, batchée, et bornée en taille (rotation).
- Éviter les logs contenant des objets volumineux sérialisés en JSON à chaque appel (coût CPU de `JSON.stringify` répété) — sérialiser une seule fois au flush, pas à chaque événement.

---

## 3. Export / partage

### 3.1 `expo-sharing` (`Sharing.shareAsync`)

**Comportement exact** (`packages/expo-sharing/src/Sharing.ts`, branche sdk-56) :
```typescript
export async function shareAsync(url: string, options: SharingOptions = {}): Promise<void>
export type SharingOptions = {
  mimeType?: string;   // Android uniquement — type MIME de l'Intent
  dialogTitle?: string; // Android + web uniquement — titre du dialogue
};
```
- **Android** : ouvre l'Intent système de partage (chooser), route vers les apps compatibles avec `mimeType` (ex. `text/plain` ou `application/json` pour un `.jsonl`). Un seul partage à la fois — un appel concurrent alors qu'un partage est en cours lève `SharingInProgressException` ("Another share request is being processed now").
- **iOS** : ouvre `UIActivityViewController`. La promesse se résout à la **fermeture** de la feuille de partage, pas à la fin effective du transfert — pour certaines cibles (Mail compose non envoyé) le fichier n'a pas forcément quitté l'appareil au moment où la promesse se résout ; pour d'autres (AirDrop) le transfert est déjà effectif. `dialogTitle` n'a **pas d'effet sur iOS** (seulement Android/web).
- Toujours appeler `isAvailableAsync()` avant `shareAsync` (peut retourner `false` sur certains devices/simulateurs).

### 3.2 `Share` de React Native core

`Share.share()` (RN core, pas Expo) partage du **texte ou une URL**, pas un fichier binaire arbitraire avec contrôle du MIME type comme `expo-sharing`. Pour exporter un fichier de logs (`.jsonl`), `expo-sharing` est le bon choix — `Share` core est plus adapté à partager un message texte court, pas un document.

### 3.3 Dossier Téléchargements Android / Storage Access Framework

Écrire directement dans le dossier public "Téléchargements" nécessite le `StorageAccessFramework` d'`expo-file-system` (API distincte de `File`/`Directory`/`Paths`, qui elle reste scoped au sandbox de l'app). Sans SAF, un fichier écrit dans `Paths.document` n'est **pas visible** dans l'appli "Fichiers" / gestionnaire de fichiers Android grand public — il faut soit passer par `Sharing.shareAsync` (l'agent choisit la destination via le chooser système), soit demander explicitement à l'utilisateur un répertoire public via SAF (`StorageAccessFramework.requestDirectoryPermissionsAsync`).

**Canaux réalistes en zone à connectivité intermittente** : `Sharing.shareAsync` ouvrant le chooser système permet à l'agent de terrain de choisir WhatsApp (fonctionne en différé — le message part dès que le réseau revient, comportement natif WhatsApp), Bluetooth/Nearby Share (transfert local sans réseau), ou un client mail — mais ce dernier suppose un compte mail déjà configuré sur l'appareil, hypothèse fragile sur du matériel de terrain partagé/reconditionné.

### 3.4 Différences Android/iOS pertinentes ici

- Android : `mimeType`/`dialogTitle` pilotables, chooser système classique.
- iOS : pas de `dialogTitle`, résolution de promesse au dismiss (pas au transfert effectif), pas d'équivalent direct à SAF (accès fichiers sandboxé par nature).

**Recommandation** : `Sharing.shareAsync(fileUri, { mimeType: 'application/x-jsonlines', dialogTitle: 'Exporter les logs IFVM' })` sur le fichier écrit dans `Paths.document`, sans tenter d'écrire dans le dossier Téléchargements public (complexité SAF non justifiée face au besoin ponctuel d'export terrain → dev).

---

## 4. Format : texte brut vs JSON-lines (`.jsonl`)

**Conclusion tranchée** : `.jsonl` (une entrée JSON par ligne) est préférable pour ce cas d'usage — reconstitution à distance d'une séquence d'événements par un développeur qui n'a jamais accès au téléphone.

- **Texte brut** : lisible immédiatement dans WhatsApp/mail, mais toute structure (timestamp ISO, stack trace multi-lignes, contexte objet) doit être re-parsée à l'œil ; une stack trace multi-lignes casse le découpage "une ligne = un événement" et rend la corrélation requête/erreur (via un id de corrélation) fastidieuse à extraire manuellement.
- **JSON-lines** : chaque ligne est un objet autoportant (`{"ts": "...", "level": "error", "msg": "...", "stack": "...", "correlationId": "..."}`) — trivialement parsable par un script (`jq`, pandas, etc.), résiste au tronquage partiel du fichier (une ligne corrompue n'invalide pas les autres, contrairement à un unique gros objet JSON), et permet de fusionner `error-log-store` et `request-log-store` dans un flux unique triable par timestamp avec un champ `correlationId` commun pour relier une requête HTTP à l'erreur qu'elle a déclenchée.
- Reste lisible tel quel dans WhatsApp/mail (c'est du texte), donc pas de perte côté "lisible sur le terrain" par rapport au texte brut — l'agent de terrain n'a de toute façon pas besoin de le lire, seul le fichier compte pour l'export.

**Recommandation** : `.jsonl`, un objet par ligne, champs minimaux `ts` (ISO 8601), `level`, `message`, `stack?`, `screen?`, `correlationId?` — reprenant la structure déjà présente dans `ErrorLogEntry`/`RequestLogEntry` (`mobile/src/lib/error-log-store.ts`, `mobile/src/lib/request-log-store.ts`), en y ajoutant un identifiant de corrélation commun aux deux flux.

---

## 5. Confidentialité — ce qui ne doit jamais atterrir dans un log exporté

**À bannir explicitement des logs persistés/exportés** :

1. **Tokens d'authentification** : le repo stocke les tokens via `expo-secure-store` (`mobile/src/lib/storage.ts`, plugin déclaré dans `app.json`). Aucun code actuel des stores de logs n'écrit de token — mais `request-log-store.ts` capture `requestBody`/`responseBody` **en clair** (`requestBody?: string | null; responseBody?: string | null`) dès que `useDebugStore` est activé, sans filtrage. Si une requête d'authentification transite par ce store (header `Authorization`, corps contenant un token de refresh), le token finirait en clair dans le journal persistant — **point de vigilance concret à corriger** avant de persister ce store tel quel : filtrer/masquer les headers d'auth et tout champ nommé `token`/`password`/`secret` avant écriture.
2. **Coordonnées GPS précises** : `mobile/src/lib/location.ts` (`getCurrentPosition`) récupère `latitude`/`longitude`/`altitude`/`accuracy` via `Location.getCurrentPositionAsync({})`, avec permission `ACCESS_FINE_LOCATION` déclarée dans `app.json`. Ces coordonnées ne doivent jamais apparaître dans un log d'erreur/requête exporté par WhatsApp/mail (elles identifient la position exacte d'un agent de terrain, potentiellement en zone sensible). Si un `screen`/`context` de log doit référencer une position, tronquer la précision (ex. 2 décimales ≈ 1 km) ou omettre entièrement.
3. **Identité de l'agent de terrain** : `prospecteur_id` (présent dans le schéma `prospection` de `prospection-db.ts`) ou tout nom/identifiant nominatif ne doit pas apparaître en clair dans un fichier de log destiné à être partagé par un canal non maîtrisé (WhatsApp grand public) — préférer un identifiant technique anonymisé (id d'installation de l'app) si une corrélation est nécessaire côté dev.

**Recommandation** : un point de filtrage unique (une fonction `sanitizeForLog()`) appliqué avant toute écriture dans la table SQLite de logs, qui retire/masque : headers `Authorization`/tokens, champs GPS précis (ou les arrondit), et tout champ identifiant nominativement l'agent. Ne pas compter sur une revue manuelle avant chaque export — le filtrage doit être automatique et systématique à l'écriture, pas à l'export.

---

## Recommandation de conception (synthèse)

1. **Ne pas compter sur `console.*`** en production comme mécanisme de journalisation — il n'est pas supprimé par défaut par Expo/Hermes (confirmé par la doc `minify.mdx`, `drop_console` est opt-in), mais n'a plus de destination exploitable côté terrain (mécanisme `captureStackForServerLogs()` désactivé hors `__DEV__`) et a un coût CPU réel sur du matériel `armeabi-v7a`.
2. **Persister dans une table SQLite dédiée** (`app_log`) ajoutée à la base `ifvm.db` existante (même pattern que `prospection-db.ts` : `openAndMigrate()`, `CREATE TABLE IF NOT EXISTS`), avec écritures batchées et une politique de rotation (plafond de lignes ou d'âge) pour ne pas grossir indéfiniment sur un device bas de gamme.
3. **Fusionner `error-log-store` et `request-log-store`** dans ce flux persistant unique (format JSON-lines, `correlationId` commun) plutôt que de garder deux stores en mémoire volatile plafonnés à 100 entrées.
4. **Filtrer systématiquement à l'écriture** (`sanitizeForLog()`) : jamais de token/header d'auth, GPS tronqué ou omis, pas d'identité nominative de l'agent.
5. **Export via `expo-sharing`** (`Sharing.shareAsync` sur un fichier `.jsonl` situé dans `Paths.document`, `mimeType: 'application/x-jsonlines'`), en laissant l'agent choisir le canal (WhatsApp/Bluetooth/mail) via le chooser système — pas d'écriture directe dans le dossier Téléchargements public (complexité SAF non justifiée ici).
6. **Répertoire** : `Paths.document` (nouvelle API `expo-file-system`), jamais `Paths.cache` — confirmé comme survivant aux mises à jour OTA `expo-updates`, qui ne touchent que le bundle JS/assets, pas le répertoire document de l'app.
