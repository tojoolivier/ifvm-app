# Flux utilisateur — Prospection Intensive

## Vue d'ensemble

```mermaid
flowchart TD
    subgraph CAMPAGNE["Campagne en cours (une seule)"]
        direction TB
    end

    subgraph MOBILE["App Mobile — Prospecteur"]
        direction TB
        A[Clique +] --> B[Choix type: Intensive]
        B --> C[Choix station fixe]
        C --> D[Formulaire pré-rempli]
        D --> E[Remplit les données]
        E --> F[Soumet la fiche]
    end

    subgraph SYNC["Synchronisation (offline/online)"]
        direction TB
        S1[Statut sync: synchronisé] 
        S2[Statut sync: désynchronisé]
    end

    subgraph VALIDATION["Workflow de validation"]
        direction TB
        G[En attente] --> H{Vérificateur<br/>autre équipe}
        H -->|Vérifie| I[Vérifié]
        H -->|Commentaires<br/>(audit log)| H
        I --> J{Validation finale<br/>autre équipe — web}
        J -->|Approuve| K[Validé ✓]
        J -->|Rejette| L[Rejeté ✗]
    end

    CAMPAGNE --> MOBILE
    MOBILE --> SYNC
    F --> G
    SYNC -.->|indépendant| VALIDATION

    style CAMPAGNE fill:#e8f5e9,stroke:#2e7d32
    style MOBILE fill:#e3f2fd,stroke:#1565c0
    style SYNC fill:#fff3e0,stroke:#ef6c00
    style VALIDATION fill:#fce4ec,stroke:#c62828
```

## Machine à états — Fiche intensive

```mermaid
stateDiagram-v2
    [*] --> Brouillon: Créée (brouillon)
    Brouillon --> EnAttente: Prospecteur soumet
    EnAttente --> Verifiee: Vérificateur vérifie
    EnAttente --> EnAttente: Ajout commentaire (audit log)
    Verifiee --> Validee: Validation finale (web) ✓
    Verifiee --> Rejetee: Validation finale (web) ✗
    Verifiee --> Verifiee: Ajout commentaire (audit log)

    state "Sync (indépendant)" as SyncState {
        [*] --> Desynchronise
        Desynchronise --> Synchronise: Upload serveur
        Synchronise --> Desynchronise: Modification locale
    }

    note right of Validee
        Fiche finalisée.
        Visible dans les rapports.
    end note

    note right of Rejetee
        Fiche rejetée.
        Reste visible pour audit.
    end note
```

## Acteurs et responsabilités

```mermaid
flowchart LR
    subgraph ROLES["Rôles du workflow intensif"]
        direction TB
        P["🔭 Prospecteur<br/>(app mobile)"]
        V["🔍 Vérificateur<br/>(autre équipe)"]
        VF["✅ Validation finale<br/>(autre équipe — web)"]
        A["⚙️ Admin<br/>(config + conflits)"]
    end

    subgraph ACTIONS["Actions"]
        direction TB
        P -->|Remplit + soumet| FICHE
        V -->|Vérifie + commentaires| FICHE
        VF -->|Valide ou rejette| FICHE
        A -->|Gère les conflits| SYNC
    end

    FICHE["📄 Fiche intensive"]
    SYNC["🔄 Conflits sync"]

    style P fill:#c8e6c9,stroke:#2e7d32
    style V fill:#bbdefb,stroke:#1565c0
    style VF fill:#f8bbd0,stroke:#c62828
    style A fill:#e0e0e0,stroke:#616161
```

## Flux offline → online

```mermaid
sequenceDiagram
    participant P as Prospecteur
    participant App as App Mobile
    participant Server as Serveur
    participant V as Vérificateur
    participant VF as Validation (web)

    Note over P,VF: Mode hors-ligne (terrain)
    P->>App: Remplit fiche intensive
    App->>App: Sauvegarde SQLite (brouillon)
    P->>App: Soumet la fiche
    App->>App: Statut = "En attente" (local)

    Note over App,Server: Synchronisation (dès que connecté)
    App->>Server: Upload fiche
    Server-->>App: Confirmé
    App->>App: Statut sync = "synchronisé"

    Note over V,VF: Mode en ligne (bureau)
    V->>Server: Consulte fiches "En attente"
    V->>Server: Vérifie + ajoute commentaire
    Server->>Server: Statut = "Vérifié"
    VF->>Server: Consulte fiches "Vérifiées"
    VF->>Server: Valide ou rejette
    Server->>Server: Statut = "Validé" ou "Rejeté"
```
