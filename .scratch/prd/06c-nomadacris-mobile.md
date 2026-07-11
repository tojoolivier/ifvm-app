# PRD — Écran 6c : C · Nomadacris septemfasciata (mobile)

## Contexte

Nomadacris septemfasciata (criquet nomade) a des caractéristiques différentes de Locusta : pas de phase Dominant pour l'accouplement/ponte (4 niveaux seulement), et des stades larvaires L1→L7 (7 stades vs 5 pour Locusta). L'écran s'adapte automatiquement à l'espèce.

## Problème utilisateur

> « Pour Nomadacris je n'ai pas la même grille que pour Locusta. Il faut que l'app s'adapte sinon je vais faire des erreurs. »

## Fonctionnalités requises

### F1 — Densités imagos
- Diffuse (/ha) et groupée (/m²) — mêmes champs que Locusta

### F2 — Accouplement / Ponte (4 niveaux)
- **Néant | Rare | Peu | Beaucoup** (pas de "Dominant" pour Nomadacris)
- 2 lignes (Accouplement / Ponte)

### F3 — Captures imagos (compteur)
- Même logique que l'écran 4 (Compteur de captures)
- ♂ stades fusionnés : A1 / A234 / A5 (identique à Locusta)
- Bouton "Captures Nomadacris ›" pour accéder au compteur

### F4 — Lien vers les larves
- Si Nomadacris larves cochées à l'écran 3 : bouton "Larves L1→L7 ›"
- Information contextuelle : "Nomadacris : 7 stades larvaires (L1→L7), grille adaptée"

## Logique différenciatrice Locusta vs Nomadacris

| Critère | Locusta migratoria | Nomadacris septemfasciata |
|---|---|---|
| Stades larvaires | L1→L5 | L1→L7 |
| Phénotypes larves | 4 (Sol, Sol-trans, Trans, Greg) | 3 (Sol, Trans, Greg) |
| Niveaux accouplement | 5 (+ Dominant) | 4 (sans Dominant) |
| ♂ capture | A1/A234/A5 | A1/A234/A5 |

## Design & UX

- En-tête de section : "C · Nomadacris septemfasciata"
- Indicateur d'espèce clairement visible (nom latin + nom commun)
- Même charte graphique que les autres écrans B

## Critères d'acceptation

- [ ] L'écran ne propose que 4 niveaux pour accouplement/ponte (sans Dominant)
- [ ] Le lien vers les larves n'apparaît que si Nomadacris larves a été coché
- [ ] Les données sont stockées séparément de Locusta en base
- [ ] L'écran ne s'affiche pas si Nomadacris n'a pas été cochée à l'écran 3

## Questions ouvertes

- D'autres espèces peuvent-elles être ajoutées à l'avenir (ex. Schistocerca gregaria) ? Si oui, faut-il un système de configuration d'espèce ?
