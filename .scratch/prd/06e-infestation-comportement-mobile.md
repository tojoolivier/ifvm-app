# PRD — Écran 6e : D · Infestation — Comportement (mobile)

## Contexte

Le comportement acridien (repos vs déplacement, direction, vent) est crucial pour prévoir la progression de l'infestation. Ces données permettent aux superviseurs d'anticiper les zones à risque dans les 24–48h suivantes.

## Problème utilisateur

> « Je dois noter si les acridiens se déplacent, vers où, et dans quel vent. C'est le genre d'info qu'on perd si on rentre au bureau sans la noter. »

## Fonctionnalités requises

### F1 — État du comportement (par type de cible)
- Pour chaque cible saisie à l'écran 6d :
  - **État** : Repos | Déplacement (radio)
  - Si Déplacement : **Direction** en boussole 8 points (N, NE, E, SE, S, SO, O, NO)

### F2 — Boussole tactile
- Représentation visuelle d'une boussole 8 directions
- Tap sur une direction la sélectionne
- Direction affichée en texte (ex. "SE")

### F3 — Vent
- **Direction du vent** : boussole 8 points (même composant que F2)
- **Vitesse du vent** : valeur numérique en km/h

### F4 — Alerte de contexte
- Si direction de déplacement = direction du vent (vent portant) → afficher :
  > "Déplacement [DIR] + vent portant → progression vers [direction] estimée."
- Alerte non bloquante, informationnelle

## Design & UX

- Boussole : cercle avec 8 segments tactiles ≥ 44 px chacun
- Direction sélectionnée : segment en vert `#235A36`
- Vent en km/h : IBM Plex Mono
- Layout vertical compact

## Critères d'acceptation

- [ ] La boussole fonctionne au toucher (tap sur le segment)
- [ ] L'alerte vent portant se déclenche uniquement si déplacement = direction vent
- [ ] Les données comportement sont liées à la cible correspondante en base
- [ ] L'écran affiche un bloc par type de cible actif (ex. si 2 types : 2 blocs)
- [ ] Champs optionnels : un comportement peut être soumis sans vent renseigné

## Questions ouvertes

- Faut-il intégrer une boussole physique (via API capteurs du téléphone) ou uniquement manuelle ?
