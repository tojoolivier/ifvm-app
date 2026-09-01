# Modèle de données `traitement` (ex-CRT) v2.0

Ce document capture le modèle cible discuté en revue de la PR #55 et implémenté dans
`backend/alembic/versions/0010_add_crt_tables.py`. La migration `0010` remplace la
table plate `crt` (~70 colonnes, aucun discriminant) par une spécialisation par type
de traitement (aérien/terrestre), issue du cahier des charges v2.0.

## Pourquoi `crt` → `traitement`

Le cahier des charges parle de « traitement aérien/terrestre » dans toutes les
sections fonctionnelles — `CRT` ne désigne que le *compte-rendu* (le document), alors
que la ligne en base représente l'événement de traitement lui-même. `numero_fiche`
(l'identifiant lisible affiché à l'utilisateur, ex. anciennement `numero_crt`) reste
inchangé dans son usage, seul le nom de table change.

Impacts déjà appliqués dans la migration `0010` :
- `audit_log.fiche_type` : `'crt'` → `'traitement'`.
- `CONTEXT.md` : glossaire et schéma mis à jour.

## Modèle ER

```mermaid
erDiagram
    prospection ||--o{ traitement : "lien obligatoire"
    traitement ||--|| cible : "snapshot 1-1 a la creation"
    traitement ||--o| traitement_aerien : "si type_traitement=AERIEN"
    traitement ||--o| traitement_terrestre : "si type_traitement=TERRESTRE"
    traitement ||--o{ traitement_signature : "1-N selon role/type"

    traitement_aerien ||--o{ traitement_rotation : "1-N, une cuve = une ligne"
    traitement_terrestre ||--o{ traitement_produit_utilise : "1-N produits"
    traitement_terrestre }o..o| traitement : "reprise_de (traitement_origine_id, optionnel)"

    utilisateur ||--o{ traitement_aerien : "chef_de_base_id (doit etre agent IFVM)"
    utilisateur ||--o{ traitement_terrestre : "chef_equipe_id"
    utilisateur |o--o{ traitement_terrestre : "agent_encadreur_id (facultatif)"
    pesticide ||--o{ traitement_rotation : "produit_id"
    pesticide ||--o{ traitement_produit_utilise : "produit_id"

    fiche_vol ||..o{ traitement_rotation : "cle partagee numero_cuve (hors perimetre)"

    traitement {
        uuid id PK
        string numero_fiche UK
        string type_traitement "CHECK AERIEN|TERRESTRE"
        string mode_traitement "CHECK TOTAL|BARRIERE|IRREGULIER, nullable"
        uuid prospection_id FK "NOT NULL"
        date date_traitement "NOT NULL, >= date_validation"
        date date_validation
        numeric longitude
        numeric latitude
        numeric altitude
        string region "geocodage inverse, nullable"
        string district "geocodage inverse, nullable"
        string commune "geocodage inverse, nullable"
        string localite "NOT NULL"
        string statut "CHECK brouillon|validee"
        string statut_sync "CHECK local|synced|conflict (technique, inchange)"
        jsonb zones_exposees
        numeric hauteur_strate_herbeuse_m
        numeric hauteur_strate_arboree_m
        int recouvrement_percent
        bool empoisonnement
        jsonb evaluation_risque
        bool comportement_anormal
        jsonb comportement_non_cibles
        bool mortalite
        jsonb mortalite_familles
        bool kit_combinaison
        bool kit_gants
        bool kit_lunettes
        bool kit_masques
        bool kit_boite
        timestamptz created_at
        timestamptz updated_at
    }

    cible {
        uuid traitement_id PK "FK vers traitement"
        string espece "CHECK LMC|NSE|MELANGE, nullable"
        string petites_larves "nullable"
        string grandes_larves "nullable"
        string vols_clairs_essaims "nullable"
        string repartition_population "CHECK GROUPEE|DIFFUSE, nullable"
        numeric surface_infestee_ha "NOT NULL"
    }

    traitement_aerien {
        uuid traitement_id PK "FK vers traitement"
        string pilote "NOT NULL, externe"
        string mecanicien "NOT NULL, externe"
        uuid chef_de_base_id FK "NOT NULL, doit etre agent IFVM (non verifie en DB)"
        string consultant_international "nullable, externe"
        int nb_rotations "DERIVE = COUNT(traitement_rotation)"
        numeric total_pesticide_l "DERIVE = SUM(traitement_rotation.quantite_l)"
    }

    traitement_rotation {
        uuid id PK
        uuid traitement_aerien_id FK "NOT NULL, ON DELETE CASCADE"
        int numero
        string numero_cuve "NOT NULL, cle de croisement avec fiche_vol"
        uuid produit_id FK "NOT NULL, vers pesticide"
        numeric quantite_l "NOT NULL"
        numeric temperature_debut_c "NOT NULL"
        numeric temperature_fin_c "NOT NULL"
        numeric vent_debut_ms "NOT NULL"
        numeric vent_fin_ms "NOT NULL"
        time heure_debut "NOT NULL"
        time heure_fin "NOT NULL, > heure_debut"
    }

    traitement_terrestre {
        uuid traitement_id PK "FK vers traitement"
        time heure_debut "NOT NULL"
        time heure_fin "NOT NULL, > heure_debut"
        numeric vitesse_vent_ms "NOT NULL"
        string direction_vent "CHECK N|NE|E|SE|S|SO|O|NO, nullable"
        numeric temperature_c "NOT NULL"
        bool reprise_traitement "NOT NULL"
        uuid traitement_origine_id FK "auto-reference traitement.id, NOT NULL si reprise_traitement"
        uuid chef_equipe_id FK "NOT NULL"
        uuid agent_encadreur_id FK "nullable, ne signe jamais"
        string consultant_international "nullable"
        numeric surface_atomiseur_ha "nullable"
        numeric surface_disque_rotatif_ha "nullable"
        numeric surface_ulvamast_ha "nullable"
        numeric surface_traitee_ha "DERIVE = somme des 3 surfaces"
        numeric surface_cumulee_ha "DERIVE, croise traitement_origine_id si reprise"
        numeric surface_restante_ha "DERIVE = cible.surface_infestee_ha - cumulee, plancher 0"
        bool surface_restante_abandonnee "obligatoire si surface_restante_ha > 0"
        numeric essence_litres "nullable, consommable non derivable"
        int nb_piles "nullable, consommable non derivable"
    }

    traitement_produit_utilise {
        uuid id PK
        uuid traitement_terrestre_id FK "NOT NULL, ON DELETE CASCADE"
        int numero
        uuid produit_id FK "NOT NULL, vers pesticide"
        numeric quantite_l "NOT NULL"
    }

    traitement_signature {
        uuid id PK
        uuid traitement_id FK "NOT NULL, ON DELETE CASCADE"
        string role "CHECK PILOTE|MECANICIEN|CHEF_DE_BASE|CHEF_EQUIPE|CONSULTANT_INTERNATIONAL"
        string signataire_nom "snapshot texte"
        timestamptz horodatage "NOT NULL"
    }
```

## Décisions de conception

- **Spécialisation Method 1** (`traitement` + sous-tables disjointes/totales) plutôt
  qu'une table plate — `type_traitement` est disjoint et obligatoire.
- **Champs dérivés stockés** (`nb_rotations`, `total_pesticide_l`, `surface_traitee_ha`,
  `surface_cumulee_ha`, `surface_restante_ha`) : jamais saisis, mais stockés, car le
  mode hors-ligne + le verrouillage post-validation le justifient. Un seul chemin
  d'écriture applicatif doit les alimenter (non couvert par cette migration — schema
  only, comme le reste du module `traitement`).
- **`moyens_traitement`** (choix multiple, section 4 du formulaire) n'est pas modélisé
  séparément : entièrement dérivable des colonnes `surface_atomiseur_ha`/
  `surface_disque_rotatif_ha`/`surface_ulvamast_ha` non nulles sur `traitement_terrestre`.
- **`essence_litres`/`nb_piles`** sont conservés sur `traitement_terrestre` : ce sont
  des consommables non dérivables des surfaces (pas de doublon avec les colonnes
  ci-dessus), contrairement aux anciens compteurs `nb_agents_*`/`nb_atomiseur`/
  `nb_disque_rotatif`/`nb_poudreuse_manuelle` de la v1 qui, eux, dupliquaient
  `crt_personnel`/`crt_materiel` et ont été supprimés.
- **`crt_personnel`/`crt_materiel` supprimées** : remplacées par les FK de rôle
  explicites (`chef_de_base_id`, `pilote`, `mecanicien`, `chef_equipe_id`,
  `agent_encadreur_id`, `consultant_international`) + `traitement_signature`.
- **`matiere_active`** déplacé de `crt` vers `pesticide` (`pesticide_id → matiere_active`
  est une FD réelle du domaine : propriété du produit, pas de l'événement de traitement).
- **Sections 6-11 du formulaire physique** (zones exposées, végétation, empoisonnement,
  évaluation du risque, comportement anormal, mortalité) restent sur `traitement`
  inchangées : elles ne posaient pas de problème ER et sont hors du périmètre discuté
  en revue.
- **`traitement_origine_id`** (reprise de traitement) référence `traitement.id` et
  pointe vers la **fiche précédente immédiate** (liste chaînée), pas la fiche racine
  de la zone — tranché après revue le 2026-08-05. `surface_cumulee_ha` se calcule donc
  en remontant la chaîne côté application.
- **`VARCHAR(n)` plutôt que `Text()` pour les colonnes bornées/à domaine contraint**
  (`type_traitement`, `statut`, `espece`, `role`, noms de personnes, etc.) — écart
  assumé par rapport à la convention `Text()` des migrations `0001`-`0009`, pour la
  portabilité vers un SGBD qui traite les deux différemment (ex. MySQL : pas de
  valeur par défaut sur `TEXT`, indexation par préfixe obligatoire). Les champs
  réellement en texte libre non borné (ex. `empoisonnement_autre`) restent en
  `Text()`. Décision prise en revue le 2026-08-05 ; les migrations antérieures ne
  sont pas rétro-alignées (hors périmètre).

## Points ouverts (hors périmètre de cette migration)

- §7.2 (source CDG) — clé `numero_cuve` partagée avec la future `fiche_vol` : simple
  convention de saisie documentée par `COMMENT ON COLUMN`, pas une FK garantie en base
  (la table `fiche_vol` n'existe pas encore).
- Contrainte "`chef_de_base_id` doit être un agent IFVM" : non vérifiable par un CHECK
  inter-lignes, à valider côté application.
- Aucun modèle ORM (SQLAlchemy), schéma Pydantic ni router FastAPI n'est ajouté par
  cette migration — comme la `0010` d'origine, ce travail reste schema-only ; la
  couche applicative est une itération future.
