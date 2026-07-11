# PRD — Écran 2 : A · Référence & Localisation (autofill GPS)

## Contexte

La section A de la fiche papier concentre les champs administratifs et GPS : coordonnées, région, district, commune, numéro de fiche, date. Sur terrain, remplir ces champs manuellement prend du temps et génère des erreurs de frappe.

## Problème utilisateur

> « Je dois saisir les coordonnées GPS, le nom de la commune et le numéro de fiche à la main — c'est long et je me trompe souvent. »

## Objectif

Pré-remplir automatiquement tous les champs de la section A depuis le GPS du téléphone. Le prospecteur n'a qu'à vérifier et saisir les surfaces (ha).

## Fonctionnalités requises

### F1 — Acquisition GPS automatique
- Démarrer l'acquisition GPS dès l'ouverture de l'écran
- Afficher : latitude, longitude, altitude, précision (ex. ± 4 m)
- Carte de statut verte si position acquise, orange si en cours, rouge si erreur
- Résolution inverse : latitude/longitude → Région → District → Commune (référentiel officiel malgache)

### F2 — Champs auto-remplis (non modifiables)
- N° de fiche : généré automatiquement (format `AAAA-NNNN`, séquence côté serveur ou locale)
- Date et heure : horodatage à la seconde de l'ouverture de l'écran
- Prospecteur : compte connecté (non modifiable)

### F3 — Saisie surfaces (ha)
- Trois champs numériques : **Surface station**, **Surface prospectée**, **Surface infestée**
- Clavier numérique intégré à l'écran (pas le clavier système) — touches ≥ 44 px
- Validation : surface prospectée ≤ surface station ; surface infestée ≤ surface prospectée
- Calcul automatique affiché en direct

### F4 — Stepper de progression
- Indicateur 4 étapes en haut de l'écran (barre de progression segmentée)
- Étape 1 active

## Comportements hors-ligne

- L'acquisition GPS fonctionne sans réseau (chip GPS natif)
- La résolution inverse Région/District/Commune utilise un référentiel embarqué (pas d'API externe)
- Le numéro de fiche est généré localement (incrémental, réconcilié à la synchronisation)

## Design & UX

- Carte GPS en fond vert `#235A36` (rassure que la position est acquise)
- Champs auto-remplis visuellement distincts des champs à saisir (fond grisé, icône ⟳)
- Champ actif : bordure `#235A36` épaisse
- Bouton "Continuer ›" en vert, fixe en bas

## Critères d'acceptation

- [ ] Position GPS acquise en < 30 s en conditions normales
- [ ] Région/District/Commune résolus automatiquement depuis les coordonnées
- [ ] N° de fiche et date/heure pré-remplis et non modifiables
- [ ] Validation des surfaces : message d'erreur inline si incohérence
- [ ] "Continuer" désactivé si surface prospectée vide ou invalide

## Questions ouvertes

- Que se passe-t-il si le GPS n'obtient pas de position après 60 s ? (saisie manuelle de secours ?)
- La résolution commune doit-elle utiliser les shapefile BNGRC ou un référentiel IFVM propre ?
