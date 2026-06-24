# ADR-002 — Stratégie de synchronisation offline

**Statut :** Accepté  
**Date :** 2026-06-23

## Contexte

Les agents de terrain créent des fiches sur tablette sans connexion réseau. À l'occasion d'une connexion (retour au PA, zone couverte), les fiches doivent être envoyées au serveur PostgreSQL. Un superviseur peut modifier ou valider les fiches côté serveur entre-temps.

## Contraintes

- Un agent ne modifie que SES propres fiches (ownership clair)
- Les superviseurs peuvent valider/corriger n'importe quelle fiche côté serveur
- La plupart des fiches sont créées ex-nihilo sur le terrain (pas de conflit d'édition simultanée)
- Le conflit réel est rare mais possible : superviseur modifie une fiche que l'agent est encore en train de corriger hors-ligne

## Décision : Ownership-based sync avec versioning serveur

### Principe

Le **serveur est source de vérité**. Chaque table porte trois colonnes de contrôle :

```sql
local_version    INTEGER NOT NULL DEFAULT 1,  -- incrémenté à chaque save local
server_version   INTEGER NOT NULL DEFAULT 0,  -- 0 = jamais synchronisé
sync_status      TEXT NOT NULL DEFAULT 'local'
                   CHECK (sync_status IN ('local', 'synced', 'conflict'))
```

### Règles de push (tablette → serveur)

| Cas | Condition | Action |
|-----|-----------|--------|
| Nouvelle fiche | `server_version = 0` | Push direct, serveur assigne `server_version = 1` |
| Mise à jour sans conflit | `local_version > server_version` ET le serveur n'a pas modifié depuis la dernière sync | Push, serveur incrémente `server_version` |
| **Conflit** | `server_version` côté serveur > `server_version` connu localement | Flag `sync_status = 'conflict'`, **ne pas écraser**, alerter le superviseur |

### Règles de pull (serveur → tablette)

- À chaque connexion : download de toutes les fiches du PA de l'agent dont `server_updated_at > last_pull_at`
- Si conflit flaggé : télécharger les deux versions (locale archivée + serveur) pour résolution manuelle

### Résolution de conflit

L'**admin** voit les fiches en `conflict` dans l'interface web. Il choisit :
- **Garder version serveur** → version locale archivée dans `fiche_conflict_archive`
- **Garder version terrain** → push forcé avec confirmation superviseur
- **Fusionner manuellement** → édition directe côté serveur

### Schéma de la table d'archive des conflits

```sql
CREATE TABLE fiche_conflict_archive (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      TEXT NOT NULL,       -- 'prospection_intensive', 'crt', etc.
    fiche_id        UUID NOT NULL,
    version_locale  JSONB NOT NULL,      -- snapshot JSON de la version terrain
    version_serveur JSONB NOT NULL,      -- snapshot JSON de la version serveur
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolu_par      UUID REFERENCES utilisateur(id),
    resolu_le       TIMESTAMPTZ,
    resolution      TEXT CHECK (resolution IN ('serveur','terrain','manuelle'))
);
```

### Numérotation offline

Les identifiants primaires sont des **UUID v4** (générés localement, pas de collision). Les numéros lisibles (N°CRT, N°relevé) sont générés localement selon le pattern :

```
{SIGLE_PA}-{ANNEE}{MOIS}-{SEQUENCE_LOCAL}
ex : TSI-202606-0042
```

Le serveur valide l'unicité à la réception et renvoie un numéro corrigé si collision.

## Alternatives écartées

| Alternative | Raison du rejet |
|-------------|-----------------|
| Last-Write-Wins pur | Risque de perte silencieuse de données superviseur |
| CRDTs | Trop complexe pour des formulaires semi-structurés, pas de lib React Native mature |
| Event sourcing complet | Sur-ingénierie pour le volume de données attendu |

## Conséquences

- Chaque table du schéma PostgreSQL ET SQLite doit porter `local_version`, `server_version`, `sync_status`, `created_by`
- L'API FastAPI expose deux endpoints de sync : `POST /sync/push` (batch upload) et `GET /sync/pull?since={timestamp}`
- Les conflits sont rares mais doivent être visibles dans le dashboard superviseur
