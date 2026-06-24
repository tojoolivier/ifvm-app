# PRD — Workflow de validation de la prospection intensive

**Status:** ready-for-agent  
**Date:** 2026-06-24

## Problem Statement

Le système IFVM collecte des données de prospection acridienne sur tablette (app mobile) et les synchronise vers un serveur central. Actuellement, il n'existe pas de workflow de validation pour les fiches de prospection intensive : une fois remplie par le prospecteur, la fiche est directement disponible sans contrôle qualité.

L'équipe a besoin d'un processus structuré en 3 étapes pour garantir la fiabilité des données avant analyse :
1. Le prospecteur remplit et soumet la fiche
2. Un vérificateur (autre équipe) vérifie les données
3. Une équipe de validation finale approuve ou rejette sur l'interface web

Ce workflow doit être disponible sur **l'app mobile** (prospection + vérification) et sur **l'interface web** (validation finale + mêmes fonctionnalités que le mobile).

## Solution

Implémenter un workflow de validation en 3 étapes pour les fiches de prospection intensive, avec :

- **Statuts de fiche** : `Brouillon → En attente → Vérifié → Validé | Rejeté`
- **Audit log** : journal d'activité automatique pour tracer toutes les modifications et commentaires
- **Indépendance sync/validation** : le statut de synchronisation (offline/online) est séparé du workflow de validation
- **Interface web = interface mobile** : l'interface web peut effectuer les mêmes actions que l'app mobile

## User Stories

### Campagne

1. As an admin, I want to create a campagne with a name and date range, so that prospections intensives are regroupées sous une période d'activité
2. As an admin, I want that only one campagne is "en cours" at a time, so that there is no confusion about which campagne is active
3. As an admin, I want to close a campagne, so that no new prospections intensives can be created under it
4. As a chef_de_base, I want to view the current campagne en cours, so that I know what period is active
5. As a prospecteur, I want to see the campagne en cours when I create a prospection intensive, so that I know which context my fiche belongs to

### Création de fiche intensive (Prospecteur)

6. As a prospecteur, I want to tap a "+" button on the app mobile, so that I can start creating a new fiche
7. As a prospecteur, I want to choose "Intensive" from the type selection, so that I create the right type of fiche
8. As a prospecteur, I want to see a list of available stations (fixes), so that I can choose which station to survey
9. As a prospecteur, I want the form to be pre-filled with station information (name, coordinates, PA), so that I don't have to enter it manually
10. As a prospecteur, I want to fill in all required fields of the intensive form (captures, population, infestation, vegetation, soil), so that the data is complete
11. As a prospecteur, I want to save a fiche as "Brouillon", so that I can continue later
12. As a prospecteur, I want to submit a fiche (statut → "En attente"), so that it enters the validation workflow
13. As a prospecteur, I want to create a fiche offline, so that I can work in areas without network
14. As a prospecteur, I want my offline fiche to sync automatically when connectivity returns, so that data is not lost

### Vérification (Vérificateur - autre équipe)

15. As a vérificateur, I want to see all fiches with statut "En attente", so that I can review them
16. As a vérificateur, I want to open a fiche and see all its data, so that I can verify accuracy
17. As a vérificateur, I want to add comments to a fiche via the audit log, so that I can communicate issues to the prospecteur
18. As a vérificateur, I want to change the statut to "Vérifié", so that the fiche moves to the next step
19. As a vérificateur, I want to view the audit log history, so that I can see all previous modifications
20. As a vérificateur, I want to verify fiches on the web interface, so that I can work from my desk
21. As a vérificateur, I want to verify fiches on the mobile app, so that I can work from the field

### Validation finale (Autre équipe - web)

22. As a validateur, I want to see all fiches with statut "Vérifié", so that I can make the final decision
23. As a validateur, I want to approve a fiche (statut → "Validé"), so that it is finalized and available for analysis
24. As a validateur, I want to reject a fiche (statut → "Rejeté"), so that it is flagged as problematic
25. As a validateur, I want to add comments when rejecting, so that the reason is documented
26. As a validateur, I want to perform validation only on the web interface, so that it is a controlled desktop operation
27. As a validateur, I want to see the full audit log before making a decision, so that I have complete context

### Audit log

28. As any user, I want all modifications to be automatically logged, so that there is full traceability
29. As any user, I want to see who made each change and when, so that accountability is clear
30. As any user, I want to see comments added by other users, so that communication is transparent
31. As an admin, I want to view the audit log for any fiche, so that I can investigate issues

### Synchronisation (indépendante du workflow)

32. As a prospecteur, I want to see the sync status of my fiches (synchronisé/désynchronisé), so that I know what has been uploaded
33. As a prospecteur, I want sync to happen automatically in the background, so that I don't have to manage it
34. As a chef_de_base, I want to see the sync status of all fiches from my PA, so that I can monitor data flow
35. As an admin, I want to see sync conflicts, so that I can resolve them

### Interface web (mêmes actions que mobile)

36. As a web user, I want to create a prospection intensive from the web interface, so that I can work without the mobile app
37. As a web user, I want to view all fiches intensive with their statuts, so that I can monitor progress
38. As a web user, I want to filter fiches by statut, date, station, or prospecteur, so that I can find specific data
39. As a web user, I want to see a dashboard with statistics (nombre de fiches par statut, par campagne), so that I have an overview
40. As a web user, I want to access the audit log from the web interface, so that I can trace history

### Gestion des stations

41. As an admin, I want to manage the list of stations (fixes, ponctuelles), so that prospecteurs have accurate references
42. As a prospecteur, I want to see only stations belonging to my PA, so that my list is relevant
43. As a prospecteur, I want to see station details (name, coordinates, altitude) when selecting a station, so that I confirm I'm at the right location

## Implementation Decisions

### Statuts de fiche

La machine à états des fiches intensives :

```python
STATUTS_INTENSIVE = [
    "brouillon",      # Créée, pas encore soumise
    "en_attente",     # Soumise, en attente de vérification
    "verifiee",       # Vérifiée par le vérificateur
    "validee",        # Approuvée par la validation finale
    "rejetee"         # Rejetée par la validation finale
]
```

Transitions autorisées :
- `brouillon → en_attente` (prospecteur soumet)
- `en_attente → verifiee` (vérificateur vérifie)
- `verifiee → validee` (validation finale approuve)
- `verifiee → rejetee` (validation finale rejette)

### Statut de sync (indépendant)

```python
STATUTS_SYNC = [
    "local",       # Jamais synchronisé (offline)
    "synced",      # Synchronisé avec le serveur
    "conflict"     # Conflit de synchronisation
]
```

Ce statut est **indépendant** du workflow de validation. Une fiche peut être `validee` mais `conflict` en sync.

### Audit log

Table `audit_log` :

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Clé primaire |
| fiche_type | TEXT | Type de fiche (intensive, extensive, validation, crt, vol, meteo) |
| fiche_id | UUID | ID de la fiche concernée |
| auteur_id | UUID FK → utilisateur | Qui a fait l'action |
| action | TEXT | Type d'action (creation, modification, soumission, verification, validation, rejet, commentaire) |
| details | JSONB | Détails de l'action (champs modifiés, commentaire, etc.) |
| created_at | TIMESTAMPTZ | Horodatage |

### Modèle de données — Prospection intensive

Ajouter à la table `prospection_intensive` :

| Colonne | Type | Description |
|---------|------|-------------|
| statut | TEXT NOT NULL DEFAULT 'brouillon' | Statut du workflow de validation |
| statut_sync | TEXT NOT NULL DEFAULT 'local' | Statut de synchronisation |
| campagne_id | UUID FK → campagne | Campagne associée (nullable) |
| verified_by | UUID FK → utilisateur | Vérificateur |
| verified_at | TIMESTAMPTZ | Date de vérification |
| validated_by | UUID FK → utilisateur | Validateur |
| validated_at | TIMESTAMPTZ | Date de validation finale |

### API endpoints

Backend FastAPI :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/prospections-intensives` | Créer une fiche (brouillon ou soumise) |
| GET | `/prospections-intensives` | Lister les fiches (filtres: statut, campagne, station, prospecteur) |
| GET | `/prospections-intensives/{id}` | Détail d'une fiche |
| PUT | `/prospections-intensives/{id}` | Modifier une fiche |
| PATCH | `/prospections-intensives/{id}/statut` | Changer le statut (soumettre, vérifier, valider, rejeter) |
| POST | `/prospections-intensives/{id}/commentaire` | Ajouter un commentaire (audit log) |
| GET | `/prospections-intensives/{id}/audit-log` | Historique des modifications |

### Navigation mobile

```
mobile/src/app/(tabs)/
├── index.tsx           # Dashboard
├── prospection.tsx     # Liste des prospections + bouton "+"
├── fiches.tsx          # Fiches en cours
├── supervision.tsx     # Vérification (vérificateur)
├── sync.tsx            # Statut de synchronisation
└── profile.tsx         # Profil utilisateur
```

### Navigation web

```
frontend/src/pages/
├── DashboardPage.tsx        # Tableau de bord
├── CampagnesPage.tsx        # Gestion des campagnes
├── ProspectionsPage.tsx     # Liste des fiches intensive
├── ProspectionDetailPage.tsx # Détail + audit log
└── LoginPage.tsx            # Connexion
```

### Seam de test

Le seam principal est l'**API endpoint `PATCH /prospections-intensives/{id}/statut`**. C'est ici que :
- La transition d'état est validée
- L'audit log est créé automatiquement
- Les permissions sont vérifiées (qui peut faire quoi)

Ce seam couvre tout le workflow : création, vérification, validation.

## Testing Decisions

### Principes

- Tester le **comportement externe** (API responses, statuts, audit log), pas les détails d'implémentation
- Chaque transition de statut doit avoir un test
- Chaque refus de transition (permission invalide) doit avoir un test
- L'audit log doit être vérifié à chaque modification

### Modules testés

| Module | Type de test |
|--------|--------------|
| API `/prospections-intensives` | Tests d'intégration (end-to-end avec DB) |
| Use cases de validation | Tests unitaires |
| Audit log | Tests d'intégration |
| Sync status | Tests unitaires (indépendant du workflow) |

### Prior art

Les tests existants dans le repo utilisent pytest avec des fixtures de DB. Suivre le même pattern.

## Out of Scope

- **Prospection extensive** : workflow séparé, à traiter dans un PRD ultérieur
- **Prospection de validation** : workflow séparé (signalement agriculteur), à traiter dans un PRD ultérieur
- **CRT et fiche de vol** : pas dans le périmètre de ce PRD
- **Gestion des conflits sync** : déjà couverte par ADR-002, pas de changement ici
- **Dark mode** : thème light uniquement (cohérent avec ADR-005)
- **Graphiques/dashboard avancés** : à décider plus tard (Chart.js, Nivo, ECharts)

## Further Notes

- La vérification peut être faite sur mobile OU web (le vérificateur est une "autre équipe")
- La validation finale est **uniquement sur web** (opération de bureau contrôlée)
- Le prospecteur est **libre de choisir ses stations** (pas d'assignation)
- Une seule campagne en cours à la fois (règle métier)
- L'audit log remplace tout système de chat/commentaire manuel
- Ce PRD s'appuie sur les diagrammes Mermaid dans `docs/flux-intensif.md`
