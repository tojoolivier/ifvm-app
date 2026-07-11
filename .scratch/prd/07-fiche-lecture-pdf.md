# PRD — Écran 7 : Fiche de lecture / Récapitulatif A4 (export PDF)

## Contexte

La fiche de prospection validée doit pouvoir être archivée et partagée dans un format standard. Les partenaires techniques (FAO, ministère) attendent des documents PDF lisibles, proches du format papier officiel mais enrichis des calculs automatiques.

## Problème utilisateur

> « Après validation, je dois envoyer la fiche à la FAO et l'archiver. Il me faut un PDF propre, fidèle à la fiche papier, avec tous les totaux calculés. »

## Objectif

Générer automatiquement un récapitulatif A4 PDF à partir des données validées, prêt à imprimer ou à archiver numériquement.

## Fonctionnalités requises

### F1 — En-tête officiel
- Logo IFVM (remplaçable par le logo officiel)
- Titre : "Fiche de prospection antiacridienne"
- Numéro de fiche, date de création, date de validation, prospecteur, superviseur

### F2 — Section A : Localisation
- Tableau : Région / District / Commune / Coordonnées GPS (lat, long, alt)
- Surfaces : station / prospectée / infestée (ha)

### F3 — Section B/C : Grilles de captures par espèce
- Tableau complet (72 cases) pour chaque espèce observée
- Séparation ♀ / ♂, colonnes A1..A5
- Ligne de total gras
- Densité diffuse et groupée calculées automatiquement

### F4 — Section D : Infestation
- Type d'infestation, niveau, surface
- Comportement acridien (noté sur terrain)

### F5 — Section E : Végétation & Sol
- Strate herbeuse : recouvrement %, phénologie ORPAD
- Humidité du sol, texture

### F6 — Pied de page
- Date d'export, version de l'application, QR code vers la fiche en ligne (facultatif)
- Mention "Document généré automatiquement — IFVM"

### F7 — Vue de lecture web
- Avant l'export PDF, afficher un aperçu scrollable de la fiche dans le navigateur
- Bouton "Télécharger PDF" et "Imprimer"

## Design & UX

- Format A4 portrait (210 × 297 mm)
- Police : Archivo + IBM Plex Mono (cohérence avec l'app)
- Fond blanc `#FFFFFF`, encre `#16201A`
- Grilles : tableau avec bordures fines, totaux en fond vert `#235A36`
- Marges 20 mm pour impression correcte
- Compatible imprimante thermique A4 (pas d'images haute résolution)

## Critères d'acceptation

- [ ] Le PDF généré contient toutes les sections A→E avec les données de la fiche
- [ ] Les totaux et densités sont recalculés à la génération (pas de valeurs stockées brutes seulement)
- [ ] La mise en page tient sur 1 à 2 pages A4 selon le nombre d'espèces
- [ ] Le PDF est accessible depuis la console web (action "Exporter PDF") et par email
- [ ] L'aperçu web est fidèle au PDF généré
- [ ] Les fiches avec Nomadacris et Locusta tiennent sans dépassement de page

## Questions ouvertes

- Faut-il inclure une signature numérique du superviseur dans le PDF ?
- La fiche doit-elle être exportable avant validation (brouillon PDF) ?
- Quel outil de génération PDF ? (WeasyPrint côté serveur, ou Playwright/Puppeteer, ou export navigateur)
