# PRD — Écran 6a : B · Densités (mobile)

## Contexte

Après le compteur de captures, l'agent saisit les densités de population observées pour Locusta (imagos et larves). Ces densités complètent les captures et permettent d'estimer l'étendue de l'infestation.

## Problème utilisateur

> « Je dois noter la densité de population diffuse (battage) et la densité groupée (comptage direct). Ce sont deux méthodes différentes avec des unités différentes (/ha vs /m²). »

## Fonctionnalités requises

### F1 — Densité imagos
- **Population diffuse** : valeur numérique en /ha, méthode = Battage (par défaut)
- **Population groupée** : valeur numérique en /m², méthode = Battage ou Comptage direct (toggle)

### F2 — Densité larves (si larves observées)
- **Diffuse** : /ha (peut être vide si non mesurée)
- **Groupée** : /m², méthode = Comptage direct (par défaut pour les larves)

### F3 — Alerte seuil
- Si densité diffuse imagos ≥ seuil IFVM (ex. > 1000/ha) : afficher une alerte visuelle
- Message : "Densité élevée → seuil d'alerte dépassé"

### F4 — Clavier numérique intégré

## Design & UX

- 2 blocs distincts : Imagos | Larves
- Champs numériques avec unité afichée à droite (IBM Plex Mono)
- Toggle méthode : Battage | Comptage direct (segmented control)

## Critères d'acceptation

- [ ] Les champs larves sont masqués si aucune larve n'a été cochée à l'écran 3
- [ ] L'alerte seuil apparaît dynamiquement à la saisie
- [ ] La méthode choisie est stockée avec la valeur
- [ ] Densité diffuse vide est acceptée (certains prospecteurs ne font que du comptage direct)
