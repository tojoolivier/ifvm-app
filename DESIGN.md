---
version: alpha
name: IFVM — Système acridien
description: Interface de gestion des prospections et campagnes de lutte antiacridienne à Madagascar
colors:
  primary: "#B4E481"
  primary-dark: "#166534"
  foreground: "#171717"
  background: "#FCFCFC"
  muted: "#EDEDED"
  muted-foreground: "#212121"
  border: "#DEDEDE"
  destructive: "#D43A19"
  sidebar: "#166534"
  sidebar-active: "#15803D"
typography:
  h1:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 8px
  lg: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  sidebar:
    backgroundColor: "{colors.sidebar-active}"
    textColor: "#FFFFFF"
    width: 224px
  sidebar-nav:
    backgroundColor: "{colors.sidebar}"
    textColor: "#FFFFFF"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  card-muted:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.md}"
  badge-status:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.full}"
---

## Overview

**Terrain de données, pas de marketing.** L'interface IFVM sert des agents de terrain et des coordinateurs qui gèrent des campagnes de lutte antiacridienne à Madagascar. Chaque écran est opérationnel : tableaux de bord de suivi, fiches de prospection géolocalisées, gestion des utilisateurs.

L'identité visuelle s'inspire de la nature malgache — un vert forêt profond ancre la navigation, un vert prairie lumineux signale les actions primaires, et le blanc cassé du fond évite la fatigue oculaire sur les sessions longues. L'ensemble doit inspirer **confiance, clarté et précision** — comme un outil de terrain professionnel, pas une app de consommation.

Le style est **sobre et utilitaire** : pas d'animations superflues, pas de gradients ostentatoires. La hiérarchie visuelle passe par le contraste et la typographie, pas la décoration.

## Colors

La palette tourne autour d'une seule famille de couleur : le vert. Deux pôles distincts.

- **Primary (#B4E481):** Vert prairie — utilisé pour les boutons d'action principale, les indicateurs actifs, les graphiques. Lumineux mais pas agressif.
- **Primary Dark (#166534):** Vert forêt — la couleur de la sidebar, les badges de statut positifs, les liens de navigation actifs. Ancre l'interface.
- **Background (#FCFCFC):** Blanc légèrement chaud — fond général des pages et des cartes. Moins fatigant que le blanc pur sur écran.
- **Foreground (#171717):** Quasi-noir — texte principal, titres. Contraste maximal sur fond clair.
- **Muted (#EDEDED):** Gris clair — fond des inputs, des zones désactivées, des blocs secondaires.
- **Muted Foreground (#212121):** Gris sombre — texte secondaire, métadonnées, labels de champs.
- **Border (#DEDEDE):** Gris fin — séparateurs, contours de cartes et d'inputs.
- **Destructive (#D43A19):** Rouge-brique — actions irréversibles (suppression), erreurs critiques, alertes terrain.
- **Sidebar (#166534):** Vert forêt profond — la barre de navigation latérale. Contraste fort avec le fond blanc du contenu.

## Typography

Système typographique basé sur Inter (ou fallback system-ui). Pas de polices d'affichage — l'interface est dense en données.

- **H1 (2rem / 700):** Titres de page principaux (ex: "Tableau de bord", "Nouvelle prospection").
- **H2 (1.5rem / 600):** Sous-titres de sections, en-têtes de cartes.
- **Body (1rem / 400):** Corps des formulaires, des tableaux, des descriptions.
- **Label (0.875rem / 500):** Labels de champs de formulaire, colonnes de tableaux, éléments de nav.
- **Caption (0.75rem / 400):** Métadonnées, dates, coordonnées GPS, états secondaires.

## Layout & Spacing

L'interface est en layout **sidebar + contenu principal** : sidebar fixe à gauche (224px), contenu à droite en scroll vertical. Hauteur écran complète (`h-screen`).

- La sidebar est réservée à la navigation globale et ne scroll pas.
- Le contenu principal scroll librement — certaines pages affichent des tableaux longs.
- Les pages de formulaire (nouvelle prospection) sont centrées avec une largeur max raisonnable.
- Espacement interne des cartes : `md` (16px) à `lg` (24px). Ne pas surcharger l'espace blanc.
- Les grilles de dashboard utilisent 2-3 colonnes sur écran large, 1 colonne sur mobile.

## Elevation & Depth

Pas d'ombres portées profondes — l'interface est plate. Les cartes se distinguent du fond uniquement par une bordure (`border: #DEDEDE`). 

Seule exception acceptable : les dropdowns et les popovers peuvent avoir une ombre légère (`shadow-sm`) pour indiquer leur surélévation sur le contenu.

## Shapes

Border-radius cohérent et modéré :
- `sm` (4px) : badges, tags, chips.
- `md` (8px) : boutons, inputs, cartes courantes.
- `lg` (8px) : modals, panneaux latéraux, cartes de dashboard.
- `full` : avatars, indicateurs de statut ronds.

## Components

### Sidebar
Fond vert forêt (`#166534`), texte blanc. L'élément actif a un fond légèrement plus clair (`#15803D`). La nav est une liste de liens textuels — pas d'icônes obligatoires, mais des icônes Lucide peuvent accompagner les labels.

### Boutons
- **Primaire** : fond vert prairie (`#B4E481`), texte vert forêt foncé (`#166534`). Pour "Enregistrer", "Créer", "Valider".
- **Destructif** : fond rouge brique (`#D43A19`), texte blanc. Uniquement pour "Supprimer" ou actions irréversibles.
- **Ghost / Outline** : fond transparent, bordure grise. Actions secondaires.

### Cartes de données
Fond blanc cassé, bordure grise fine, radius `lg`. Les en-têtes de carte ont un titre H2 + description optionnelle en caption. Pas de couleur de fond sur les cartes — elles vivent sur le fond blanc de la page.

### Badges de statut
Border-radius `full`. Code couleur sémantique :
- Vert (primary/primary-dark) : état positif, prospection terminée, campagne active.
- Orange/ambre : en cours, à traiter.
- Rouge (destructive) : critique, en retard, erreur.
- Gris (muted) : inactif, archivé.

### Tableaux
Fond blanc, lignes séparées par des bordures `border` très fines. Le header de colonne utilise le style `label`. Au survol, la ligne prend le fond `muted`. Pas de fond coloré sur les lignes — seuls les badges de statut apportent la couleur.

## Do's and Don'ts

**À faire**
- Utiliser le vert forêt (`#166534`) exclusivement pour la navigation et les éléments de marque.
- Utiliser le vert prairie (`#B4E481`) comme couleur d'action principale.
- Garder les pages denses mais aérées : padding généreux dans les cartes, pas de contenu collé aux bords.
- Afficher les coordonnées GPS et les données terrain en `caption` monospace si possible.

**À éviter**
- Ne pas introduire de nouvelles couleurs sans nécessité fonctionnelle (une couleur = une signification).
- Ne pas utiliser le rouge destructif pour des avertissements non critiques — réserver aux suppressions.
- Ne pas utiliser de gradients sur les fonds ou les boutons — l'interface doit rester plate.
- Ne pas animer les transitions de données (tableaux, graphiques) — prioriser la performance et la lisibilité.
