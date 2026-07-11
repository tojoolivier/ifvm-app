# PRD — Écran 5 : ★ Saisie web — formulaire bureau (grille éditable)

## Contexte

Le web ne sert pas qu'à superviser : les agents en base (qui ressaisissent des fiches papier, ou qui ont un accès clavier/souris) doivent pouvoir remplir la grille complète via un tableau éditable façon tableur. Navigation Tab/Entrée, copier-coller, calculs en direct.

## Problème utilisateur

> « Je suis au bureau avec 20 fiches papier à ressaisir. Je veux taper case par case avec Tab/Entrée, comme dans Excel, sans devoir cliquer sur chaque cellule. »

## Objectif

Offrir une saisie clavier fluide de la grille de captures complète sur le web, avec validation en temps réel et synchronisation avec les données mobiles.

## Fonctionnalités requises

### F1 — Navigation latérale par section (rail)
- Rail gauche : sections A / B / C / D / E avec badge de complétion (✓ / En cours / vide)
- Sous-onglets pour B : Densités | Accouplement/Ponte | Captures

### F2 — Grille de captures éditable
- Tableau HTML avec cellules éditables (contenteditable ou input inline)
- Navigation : Tab → cellule suivante, Entrée → ligne suivante
- Copier-coller d'un bloc depuis Excel/Sheets
- Les totaux Σ se recalculent à chaque frappe
- ♀ et ♂ affichés dans le même tableau (séparés par un header de groupe)
- ♂ : A234 fusionné (pas de détail par sous-phase)

### F3 — Panneau latéral droit (live)
- Carte miniature de la position GPS
- Contrôles de saisie en temps réel :
  - ✓ Référence complète
  - ✓ Total ≤ max (50 imagos, 65 larves Locusta, 75 larves Nomadacris)
  - ⚠ Avertissements inline (ex. "Larves non saisies")
- Densités et phase dominante recalculées en direct

### F4 — Gestion du brouillon
- Sauvegarde automatique du brouillon toutes les 30 s
- Bouton "Enregistrer le brouillon" manuel
- Badge statut : Enregistré / Modifications non sauvegardées

### F5 — Navigation entre sections
- Boutons "‹ Précédent" / "Section suivante ›" en pied de page fixe
- Indicateur "Section X / 5"

### F6 — Raccourcis clavier
- Affichés dans un panneau rétractable : Tab (case suivante), Entrée (ligne suivante), ⌘V (coller un bloc)

## Logique métier

- Les données saisies en web et en mobile sont stockées dans le même modèle
- Une fiche ouverte en mobile ET en web simultanément : last-write-wins avec avertissement de conflit
- La fiche web peut être soumise à validation sans avoir été créée sur mobile

## Design & UX

- Layout 3 colonnes : rail (200 px) | grille (flex) | panneau live (280 px)
- Cellule active : bordure `#235A36` épaisse, fond `#EAF2EC` léger
- Totaux en ligne : fond `#16201A`, texte blanc
- Compatible Firefox, Chrome, Safari dernières versions

## Critères d'acceptation

- [ ] Tab navigue de cellule en cellule sans déclencher d'action de page
- [ ] Coller un bloc 4×5 depuis Sheets remplit correctement les cellules correspondantes
- [ ] Les totaux Σ se mettent à jour à chaque frappe sans délai visible
- [ ] Le brouillon est sauvegardé automatiquement avant fermeture d'onglet (beforeunload)
- [ ] La fiche web synchronisée apparaît correctement sur mobile (même données)
- [ ] Les alertes de validation sont affichées sans bloquer la saisie

## Questions ouvertes

- Faut-il un mode "ressaisie lot" pour importer directement depuis un fichier CSV/Excel ?
- Comment gérer les conflits si le mobile et le web modifient la même fiche en même temps ?
