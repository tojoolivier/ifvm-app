# ADR-007 — Accès offline au référentiel (PA, stations, données de configuration)

**Statut :** Accepté
**Date :** 2026-08-02

## Contexte

ADR-002 tranche la synchronisation des **fiches** (prospection, CRT, etc.) : ownership-based,
serveur source de vérité, conflits gérés par l'admin. Mais une fiche ne peut être remplie sur
le terrain que si l'app dispose déjà du **référentiel** — Postes Acridiens, stations, équipe,
pesticides, cultures, codes stades — chargé *avant* le départ (cf. CONTEXT.md, section
« Données de référence pré-chargées »).

Cet ADR précise le **mécanisme** que CONTEXT.md ne détaille pas encore : quand le référentiel
se rafraîchit, ce qui se passe s'il devient périmé pendant une session terrain (jusqu'à 1
semaine offline), et comment l'agent se connecte à l'app sans réseau.

## Périmètre

Exactement la liste Niveau 1 + Niveau 2 de CONTEXT.md :

- Profil utilisateur (nom, rôle, PA affecté)
- Postes Acridiens (id, code, nom)
- Stations fixes du PA du prospecteur
- Équipe (autres utilisateurs de son PA)
- Pesticides disponibles
- Types de cultures / zones cibles
- Codes stades d'espèces (LMC : A1-A5, NSE : L1-L7)

Hors périmètre pour cette décision (à traiter séparément si besoin) : stations météo,
campagne en cours — ces éléments suivent des cycles de vie différents et n'ont pas été
grillés ici.

## Décision 1 — Déclenchement du rafraîchissement

**Double mécanisme** :

1. **Automatique** dès que la connectivité revient (détection réseau en arrière-plan),
   cohérent avec ADR-002 (« à l'occasion d'une connexion »).
2. **Manuel** — bouton « Forcer la synchronisation » dans l'app, pour que l'agent puisse
   déclencher le pull explicitement s'il sait qu'il a du réseau (couverture ponctuelle en
   brousse, avant de repartir).

**Push serveur — écarté.** Techniquement possible (Expo Push Service / FCM), mais rejeté :
le référentiel change rarement (nouvelle station, nouveau pesticide — pas un flux continu),
le double mécanisme auto + manuel couvre déjà le besoin réel, et un push ajouterait une
dépendance à un service tiers ainsi qu'une exigence de connectivité de fond app-fermée que
les tablettes terrain n'ont pas de façon fiable. Non réévalué tant qu'aucun incident
opérationnel ne le justifie.

## Décision 2 — Péremption du référentiel local

Le référentiel mobile est un **miroir en lecture seule** : la tablette ne l'édite jamais,
seul le serveur écrit. Conséquence directe :

- **Pas de conflit d'édition** au sens ADR-002 — il n'y a qu'une question de **fraîcheur**,
  pas de divergence entre deux écritures concurrentes.
- **Sync incrémentale par curseur**, même pattern que `GET /sync/pull?since=` pour les
  fiches : `GET /referentiel/pull?since={last_pull_at}` ne renvoie que les entités
  créées/modifiées/désactivées depuis.
- **Upsert idempotent par id (UUID)** — un renommage (ex : PA renommé) est un simple update
  par id, aucun risque de conflit puisque l'identifiant ne change pas.
- **Soft-delete uniquement, jamais de suppression physique** — `station_fixe.actif`
  (existant) passe à `false` plutôt que la ligne n'est supprimée ; les fiches déjà créées
  gardent leur FK valide. Le client masque les entrées désactivées des sélecteurs de
  nouvelle fiche mais conserve la ligne en local pour l'historique.
- Le référentiel local reste **utilisable tel quel** jusqu'au prochain sync, sans blocage ni
  avertissement de péremption — cohérent avec la contrainte « 1 semaine offline » d'ADR-002.
- **Le seul vrai conflit possible** : l'agent crée hors-ligne une fiche référençant une
  station que l'admin a désactivée/supprimée entre-temps côté serveur. Il se détecte **au
  push de la fiche**, pas au niveau du référentiel, et se route dans le mécanisme de
  résolution déjà construit pour les fiches (`fiche_conflict_archive`) plutôt qu'un système
  parallèle.

## Décision 3 — Authentification offline

1. **Login initial toujours en ligne** (typiquement au PA, avant départ terrain) — email/mot
   de passe contre l'API, retourne un JWT (access + refresh token).
2. **Session locale persistante, TTL refresh token = 14 jours** — le refresh token est
   stocké chiffré via `expo-secure-store` (Android Keystore). 14 jours donne une marge de
   2× sur la contrainte « 1 semaine offline » d'ADR-002, pour absorber un retour de campagne
   retardé (panne véhicule, prolongation terrain) sans forcer un re-login réseau impossible
   à faire sur place.
3. **PIN local obligatoire à l'activation** — protège l'accès à la tablette (partagée ou
   perdue) entre deux sessions ; indépendant du JWT (le PIN déverrouille l'app, le JWT
   autorise les appels serveur). Obligatoire plutôt qu'optionnel : la tablette circule entre
   plusieurs agents d'un même PA et transporte des données terrain non chiffrées à l'écran.
   **5 tentatives** avant verrouillage progressif (délai croissant : 30s, 1min, 5min...) ;
   pas de wipe des données locales (pas d'administration à distance en zone non couverte) —
   déverrouillage définitif uniquement par re-login réseau complet.
4. **Aucune vérification réseau requise pour ouvrir l'app** — le JWT est validé localement
   (expiration/signature) ; la révocation côté serveur ne prend effet qu'au prochain contact
   réseau (risque accepté pour ce contexte terrain).

## Alternatives écartées

| Alternative | Raison du rejet |
|-------------|-----------------|
| Bloquer la création de fiches si référentiel trop périmé | Contredit la contrainte « 1 semaine offline » d'ADR-002 ; les id UUID restent valides même périmés |
| Conflict-resolution complet sur le référentiel (comme les fiches) | Le référentiel est en lecture seule côté mobile — pas d'écriture concurrente possible, donc pas de conflit à résoudre, seulement de la fraîcheur |
| Re-login obligatoire à chaque perte de connexion | Inutilisable en conditions terrain (couverture réseau intermittente) |

## Spec technique

### Endpoint API

```
GET /referentiel/pull?since={timestamp|null}
```

Réponse : un objet par type d'entité du périmètre (`postes_acridiens`, `stations_fixes`,
`utilisateurs_equipe`, `pesticides`, `cultures`, `codes_stades`), chacun sous la forme
`{ upserts: [...], server_time: timestamp }`. `since=null` (premier login) renvoie
l'intégralité du référentiel du PA de l'agent. Un `actif=false` dans `upserts` vaut
soft-delete côté client.

### Schéma SQLite (tablette)

Chaque table référentiel porte, en plus de ses colonnes métier :

```sql
updated_at   TEXT NOT NULL,   -- ISO8601, fourni par le serveur, sert de curseur de tri
actif        INTEGER NOT NULL DEFAULT 1
```

Une table `referentiel_sync_meta (entity_type TEXT PRIMARY KEY, last_pull_at TEXT)` garde,
par type d'entité, le curseur `since` à envoyer au prochain pull — permet de rafraîchir
chaque table référentiel indépendamment plutôt qu'en bloc.

## Conséquences

- Nouvel endpoint API `GET /referentiel/pull?since={timestamp}` (pattern identique à
  `/sync/pull` d'ADR-002, appliqué aux entités référentiel).
- Tables référentiel côté PostgreSQL ET SQLite portent un champ de dernière modification
  (`updated_at`) et un flag `actif` pour le soft-delete (déjà présent sur `station_fixe`, à
  généraliser aux autres tables référentiel du périmètre).
- `expo-secure-store` devient une dépendance mobile pour le stockage du refresh token.
