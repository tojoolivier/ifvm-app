# PRD — Écran 4b : Lecture mobile (vue récapitulatif sur téléphone)

## Contexte

Après validation par le superviseur, le prospecteur peut consulter sa fiche depuis son téléphone. Il ne s'agit pas d'un écran de saisie mais d'une vue de lecture compacte, adaptée au mobile, qui affiche le résultat validé de la prospection.

## Problème utilisateur

> « Je veux pouvoir relire la fiche que j'ai soumise depuis mon téléphone, sans devoir ouvrir un PDF ou aller sur le site web. »

## Objectif

Présenter un résumé lisible et compact de la fiche validée sur mobile, avec accès à l'export PDF.

## Fonctionnalités requises

### F1 — En-tête de fiche
- Numéro de fiche + badge statut "Validée ✓"
- Commune, date, prospecteur

### F2 — Niveau d'alerte infestation
- Affichage proéminent du niveau (ÉLEVÉ / MOYEN / FAIBLE) avec couleur correspondante
- Type de cible + surface + phase dominante

### F3 — Synthèse par espèce
- Pour chaque espèce observée : totaux imagos, totaux larves, densité principale
- Format compact (pas la grille complète — elle est sur le web)

### F4 — Synthèse végétation
- Recouvrement herbe %, phénologie principale, texture et humidité sol
- Dégâts sur cultures

### F5 — Accès PDF
- Bouton "Exporter en PDF" → génère ou ouvre le PDF de la fiche de lecture (Écran 7)

## Design & UX

- Mode lecture seule (aucun champ éditable)
- Fond papier `#FAF7EF`, badge "Validée" en vert `#235A36`
- Badge niveau alerte : rouge `#C0412B` si ÉLEVÉ, ocre `#E89B2B` si MOYEN
- Scrollable si le contenu dépasse l'écran

## Critères d'acceptation

- [ ] Aucun champ n'est modifiable
- [ ] Le niveau d'infestation est visible sans scroll
- [ ] Le bouton PDF génère le document correct
- [ ] La vue s'affiche correctement sur les fiches sans espèces (prospection négative)

## Questions ouvertes

- Faut-il permettre de partager la fiche directement (WhatsApp, email) depuis cet écran ?
