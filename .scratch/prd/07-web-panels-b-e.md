# PRD — Écran 7 : Saisie web — panneaux B→E (tableaux pleine largeur)

## Contexte

La saisie web bureau (écran 5) présente les données B→E dans des panneaux dédiés. Sur écran large, chaque panneau affiche les données dans leur format optimal : matrices pleine largeur, grilles ORPAD complètes, tableaux éditables. Ce PRD couvre l'ensemble des panneaux B→E du formulaire web.

---

## 7a · B — Densités (web)

### Fonctionnalités
- Tableau : Stade (Imagos/Larves) × Densité diffuse (/ha) × Densité groupée (/m²) × Méthode
- Méthode : dropdown Battage | Comptage direct
- Alerte automatique si densité diffuse dépasse le seuil IFVM (ex. > 1000/ha)

### Critères d'acceptation
- [ ] Alerte seuil affichée inline (pas une popup) avec recalcul surface infestée
- [ ] Méthode stockée par stade

---

## 7b · B — Accouplement / Ponte (web)

### Fonctionnalités
- Matrice cliquable 2 lignes × 5 colonnes (Accouplement/Ponte × Néant/Rare/Peu/Beaucoup/Dominant)
- Clic direct dans la cellule sélectionne la valeur (highlight colonne)
- Aide inline : "Un seul choix par ligne — exactement comme la fiche papier."

### Critères d'acceptation
- [ ] Sélection colonne complète (highlight visuel) sur clic
- [ ] Alerte croisée Ponte×Phase transmise du mobile vers le web

---

## 7c · C — Nomadacris septemfasciata (web)

### Fonctionnalités
- Densités imagos + accouplement/ponte (4 niveaux, sans Dominant)
- Grille captures imagos : mêmes colonnes que Locusta mais ♂ fusionnés A1/A234/A5
- Lien vers panneau Larves Nomadacris (7 stades)

### Critères d'acceptation
- [ ] La grille Nomadacris est séparée de Locusta (colonnes distinctes)
- [ ] Pas de colonne "Dominant" dans la matrice accouplement/ponte

---

## 7d · D — Infestation — Description & Comportement (web)

### Fonctionnalités
- Tableau des types de cibles : Tache/Bande/Vol/Essaim × Taille / Surface / Densité min-max-moy / Interdistance
- Comportement : par type de cible → État (Repos/Déplacement) × Direction × Vent (direction + vitesse)
- Une ligne par type de cible actif

### Critères d'acceptation
- [ ] Cellules vides acceptées pour les types non observés
- [ ] Moyenne densité et interdistance calculées si min et max renseignés

---

## 7e · ★ E — Végétation — grille ORPAD complète (web)

C'est l'écran web le plus dense de la section E. Il présente toutes les strates avec toutes les colonnes ORPAD en un seul tableau.

### Fonctionnalités
- Tableau : Strate × SurfRel (%) × H.Moy (m) × Rec% × 7 colonnes phénologie ORPAD (Verdissement, Repousse, Germination, Feuillaison, Floraison, Fructification, Sécheresse)
- Chaque cellule phénologie : valeur numérique (% de la strate avec ce stade)
- Total Recouvrement affiché en ligne de pied
- Sous-section Humidité du sol : 4 classes (segmented)
- Sous-section Texture du sol : 4 options (radio)

### Critères d'acceptation
- [ ] Total Rec% recalculé à chaque saisie, mis en rouge si ≠ 100 %
- [ ] Les 7 colonnes ORPAD acceptent des % distincts par strate
- [ ] La ligne "Sol nu" a ses colonnes phénologie désactivées

---

## 7f · E — Observations, ennemis & dégâts (web)

### Fonctionnalités
- Zone de texte pleine largeur pour observations libres
- Bouton "+ Photo" (upload depuis le bureau)
- Matrice dégâts : Nuls / Faibles / Moyens / Forts (radio)
- Liste ennemis naturels : Oiseaux / Fourmis / Reptiles / Mantes / Autre (checkboxes)

### Critères d'acceptation
- [ ] Les photos uploadées depuis le web sont stockées dans le même modèle que les photos mobiles
- [ ] Observation libre synchronisée avec le champ mobile correspondant

---

## Design & UX commun aux panneaux 7a→7f

- Layout : rail de navigation (gauche) | tableau pleine largeur (centre)
- Tableaux avec lignes alternées (zebre : `#FAF7EF` / `#FFFFFF`)
- Totaux et sous-totaux : fond `#16201A`, texte blanc
- Alerte seuils : fond `#FDF6E7`, texte `#8A6D2F`, inline (pas de modal)
- Navigation : boutons "‹ Précédent" / "Section suivante ›" en sticky footer

## Questions ouvertes communes

- Les panneaux web et mobiles sont-ils éditables simultanément (conflit de version) ?
- La grille ORPAD (7e) doit-elle être exportée séparément dans les synthèses ?
