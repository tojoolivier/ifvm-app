# PRD — Écran 1 : Accueil / Liste hors-ligne (mobile)

## Contexte

Les prospecteurs IFVM travaillent en zone rurale, souvent sans réseau. Ils doivent pouvoir démarrer, retrouver et reprendre une fiche de prospection sans connexion internet.

## Problème utilisateur

> « Je suis sur le terrain à 6h du matin. Je veux ouvrir l'app, voir mes fiches récentes et en créer une nouvelle — même sans réseau. »

## Objectif

Fournir un point d'entrée clair et rassurant qui indique l'état de synchronisation et permet d'agir immédiatement.

## Utilisateurs cibles

- **Prospecteur de terrain** (profil principal) — agent de terrain IFVM, sur Android, souvent hors-ligne
- **Superviseur** (consultation seule depuis cet écran)

## Fonctionnalités requises

### F1 — Indicateur d'état réseau/sync
- Afficher l'état de connectivité en temps réel (en ligne / hors-ligne)
- Afficher le nombre de fiches en attente de synchronisation
- Bannière jaune/ocre si fiches non synchronisées (ex. : « 3 fiches en attente »)

### F2 — Liste des prospections récentes
- Afficher les 10 dernières fiches du prospecteur connecté
- Par fiche : numéro, commune, date, statut (brouillon / à synchro / synchronisé ✓)
- Barre de progression pour les fiches en brouillon (% de complétion)
- Tags espèces observées si la fiche est complète

### F3 — Bouton "Nouvelle prospection"
- Bouton primaire toujours visible en bas d'écran (CTA principal)
- Action : lance le flux de saisie → Écran 2 (Référence)
- Disponible hors-ligne

### F4 — En-tête utilisateur
- Prénom + code poste (ex. : « Rakoto · PA Antsirabe »)
- Logo IFVM (badge monogramme remplaçable)

## Comportements hors-ligne

- L'app fonctionne intégralement sans réseau
- Les fiches créées sont stockées localement (SQLite / IndexedDB)
- La synchronisation s'effectue automatiquement à la reconnexion (file FIFO)

## Design & UX

- **Thème** : fond papier `#FAF7EF`, vert champ `#235A36` pour la barre de statut
- **Cibles tactiles** : ≥ 44 px (utilisation avec gants possible)
- **Typographie** : Archivo (interface), IBM Plex Mono (numéros de fiche, dates)
- **Densité** : compacte mais lisible en plein soleil (pas de gris trop clair)

## Critères d'acceptation

- [ ] L'écran s'affiche en < 500 ms sans réseau
- [ ] Le nombre de fiches non synchronisées est correct et se met à jour à la reconnexion
- [ ] Une fiche en brouillon affiche sa progression (%)
- [ ] Tap sur une fiche existante ouvre la vue lecture (ou reprend la saisie si brouillon)
- [ ] Tap sur "+ Nouvelle prospection" lance l'écran Référence avec GPS pré-chargé

## Questions ouvertes

- Faut-il permettre de filtrer/rechercher parmi les fiches ? (hors scope MVP)
- Quel est le comportement si 2 prospecteurs utilisent le même appareil ?
