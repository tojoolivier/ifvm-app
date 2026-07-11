# PRD — Écran 8a : ★ Plan de relevé — Hub multi-espèces (mobile)

## Contexte

Quand un agent a coché plusieurs espèces ET plusieurs stades (ex. Locusta Imagos + Larves + Nomadacris Imagos + Larves), il se retrouve avec 4 grilles de captures à remplir. Sans organisation, il risque d'en oublier une ou de se perdre entre les sessions. L'approche "Hub" (variante C du design) est combinée à l'approche adaptative pour gérer ce cas.

## Problème utilisateur

> « J'ai 4 grilles à remplir. Je dois aller aux toilettes entre deux. Quand je reviens, où en étais-je ? »

## Objectif

Présenter un tableau de bord de relevé qui liste les grilles à compléter, indique leur statut et permet de reprendre n'importe laquelle dans n'importe quel ordre.

## Fonctionnalités requises

### F1 — Liste des grilles à remplir
- Générée automatiquement à partir des sélections de l'écran 3 (filtre conditionnel)
- Chaque entrée : Espèce · Stade / Statut / Résumé
- 3 statuts visuels :
  - ✓ **Terminée** : fond vert clair, résumé affiché (ex. "23 capturés · Transiens dominant")
  - ▶ **En cours** : fond blanc, bouton "Reprendre"
  - ○ **À faire** : fond gris, bouton "Commencer"

### F2 — Ordre libre
- L'agent peut compléter les grilles dans l'ordre qu'il veut
- Bouton "Reprendre : [grille en cours] ›" en CTA principal

### F3 — Progression globale
- Compteur "X / 4 terminées" visible en header

### F4 — Finalisation
- Quand toutes les grilles sont terminées → bouton "Passer à la suite ›" devient actif
- Si une grille est encore en cours : avertissement "Il reste X grille(s) à terminer"

## Design & UX

- Fond papier `#FAF7EF`
- Grille terminée : fond `#EAF2EC`, icône ✓ verte
- Grille en cours : mise en avant (légère ombre)
- Grille à faire : opacité 70 %, icône ○

## Critères d'acceptation

- [ ] La liste est générée dynamiquement depuis les sélections de l'écran 3
- [ ] Le statut de chaque grille persiste si l'app est fermée et rouverte
- [ ] Tap sur une grille terminée permet de la relire (non éditable depuis ce hub)
- [ ] Le bouton "Passer à la suite" est désactivé tant qu'au moins une grille n'est pas terminée
- [ ] Le hub n'apparaît que si ≥ 2 grilles sont à remplir (sinon enchaînement direct)

## Questions ouvertes

- Faut-il permettre de modifier une grille déjà terminée depuis le hub (correction) ?
