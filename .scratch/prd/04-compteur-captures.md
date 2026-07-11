# PRD — Écran 4 : ★ Compteur de captures (écran clé)

## Contexte

C'est l'écran le plus complexe et le plus critique de l'application. La fiche papier comporte une grille de **72 cases** (Sexe × 9 phases × 4 phénotypes) par espèce et par stade. Impossible à saisir case par case sur mobile. L'approche retenue est un **compteur guidé** : l'agent sélectionne Sexe → Phase → Phénotype, puis incrémente/décrémente un compteur.

## Problème utilisateur

> « En tenant des sauterelles dans une main et le téléphone dans l'autre, je ne peux pas remplir 72 cases. Il me faut un grand bouton + que je peux appuyer avec le pouce. »

## Objectif

Remplacer la grille de 72 cases par un compteur guidé, rapide, utilisable d'une seule main, avec validation en temps réel (total + chrono de capture).

## Fonctionnalités requises

### F1 — Sélection du sexe
- Toggle segmenté : ♀ Femelles / ♂ Mâles
- Comportement différent selon le sexe :
  - ♀ : phases A1 à A5, toutes avec sous-phases et 4 phénotypes
  - ♂ : simplifié — A1, A234 (fusionné), A5 seulement

### F2 — Sélection de la phase
- Chips de phase : A1, A2, A3, A4, A5
- Pour A3 : afficher les sous-phases ¼, ½, ¾, 4/4
- Phase active mise en avant (fond vert, puce expansée)

### F3 — Compteur par phénotype
- 4 phénotypes : Solitaires, Solitaro-transiens, Transiens, Grégaires
- Pour chaque phénotype : bouton − / affichage du total / bouton +
- Cibles + et − : ≥ 44 × 44 px
- Le phénotype actif (dernier modifié) est mis en avant

### F4 — Total et chrono en temps réel
- Card "Total capturé" : compteur cumulé de tous les phénotypes de la session
- Card "Chrono" : durée de la session de capture (objectif 30 min)
- Les deux cartes sont toujours visibles (en haut, hors scroll)

### F5 — Navigation
- Bouton "Terminer ce sexe" → passer à l'autre sexe (si applicable)
- Bouton › → passer à la phase suivante / écran suivant
- Bouton ‹ en header → revenir sans perdre les données saisies

### F6 — Persistance
- Sauvegarde automatique à chaque incrémentation (pas de bouton "Enregistrer")
- Si l'app se ferme, la session reprend depuis la dernière valeur

## Logique métier

```
Pour Locusta — Imagos — ♀ :
  Pour chaque phase Pi (A1..A5) :
    Pour chaque sous-phase si applicable (A3 → ¼, ½, ¾, 4/4) :
      Pour chaque phénotype Ph (Solitaires, Sol-trans, Transiens, Grégaires) :
        capture[espèce][stade][sexe][phase][sous-phase][phénotype] += delta

Densité diffuse = Total / Surface prospectée (ha)
Phase dominante = phénotype avec le plus grand total
```

## Design & UX

- **Fond** : `#FAF7EF` (papier), total sur fond `#235A36` (vert)
- **Bouton +** : vert `#235A36`, 34 × 34 px minimum (testable avec pouce)
- **Bouton −** : fond gris `#EFEADA`, même taille
- **Chrono** : IBM Plex Mono, rouge si > 30 min
- Haptic feedback sur chaque incrément (vibration légère)
- Mode portrait uniquement

## Critères d'acceptation

- [ ] Chaque appui sur + incrémente instantanément le compteur (< 100 ms)
- [ ] Le total global se met à jour à chaque appui
- [ ] Changement de sexe préserve les valeurs déjà saisies
- [ ] Le chrono démarre à la première interaction et s'arrête à "Terminer"
- [ ] Les données sont sauvegardées localement même si l'app est tuée
- [ ] L'écran s'affiche pour chaque combinaison espèce × stade sélectionnée à l'écran 3
- [ ] La grille complète (72 valeurs) est reconstituée en base à partir des compteurs

## Questions ouvertes

- Faut-il permettre de saisir des valeurs directement (clavier numérique) en plus du +/− ? (pour corriger rapidement une grosse valeur)
- Comment gérer la capture interrompue (terrain quitté, reprise le lendemain) ?
- Faut-il un mode "recapture" séparé du mode "observation directe" ?
