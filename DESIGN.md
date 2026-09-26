---
version: alpha
name: IFVM — Système acridien
description: Interface de gestion des prospections et campagnes de lutte antiacridienne à Madagascar
colors:
  primary: "#235a36"
  primary-hover: "#1a4429"
  primary-on-tint: "#3a5c43"
  background: "#faf7ef"
  background-outer: "#efeada"
  surface: "#FFFFFF"
  surface-raised: "#fffdf8"
  border: "#e7e0cd"
  border-field: "#e0d9c4"
  separator: "#f1ecdd"
  separator-strong: "#f4efe2"
  foreground: "#16201a"
  foreground-secondary: "#3a3a30"
  foreground-tertiary: "#6f6a59"
  foreground-weak: "#9a9484"
  amber: "#e89b2b"
  amber-text: "#8a6d2f"
  amber-bg: "#fdf6e7"
  amber-border: "#f0e2bf"
  danger: "#c0412b"
  danger-text: "#a5341c"
  danger-bg: "#fbe9e5"
  danger-border: "#f0c4b9"
  blue-text: "#31567f"
  blue-bg: "#eaf0f7"
  blue-sheet-bg: "#eaf1f7"
  violet: "#6d3fc4"
  violet-bg: "#f1edfb"
  blue-border: "#cdddef"
  green-bg: "#eaf2ec"
  strate-herbeuse: "#6aa84f"
  strate-sol-nu: "#c9c1ab"
  strate-arbustive: "#3f7d4f"
  strate-arboree: "#2c5e3f"
  strate-buissonneuse: "#8fb573"
  strate-cultures-seches: "#d9b64f"
  strate-cultures-hygro: "#4f9bb0"
  green-light: "#f6faf7"
  green-border: "#cfe0d4"
  brouillon-text: "#6f6a59"
  brouillon-bg: "#f4efe2"
  brouillon-border: "#e0d9c4"
  bar-brouillon: "#bdb6a2"
  bar-verifiee: "#5b83b5"
  bar-fond: "#f1ecdd"
  badge-blue-solid: "#4777a2"
  badge-gray-solid: "#737373"
typography:
  h1:
    fontFamily: Archivo, sans-serif
    fontSize: 19px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.3px
  h2:
    fontFamily: Archivo, sans-serif
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
  h3:
    fontFamily: Archivo, sans-serif
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: Archivo, sans-serif
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.55
  control:
    fontFamily: Archivo, sans-serif
    fontSize: 11.5px
    fontWeight: 600
    lineHeight: 1.4
  eyebrow:
    fontFamily: Archivo, sans-serif
    fontSize: 9.5px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 1px
  badge:
    fontFamily: Archivo, sans-serif
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1.2
  numeric:
    fontFamily: IBM Plex Mono, monospace
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  kpi:
    fontFamily: IBM Plex Mono, monospace
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.1
  section-title:
    fontFamily: Archivo, sans-serif
    fontSize: 17px
    fontWeight: 800
    lineHeight: 1.25
  ui-body:
    fontFamily: Inter, sans-serif
    fontSize: 15px
    fontWeight: 500
    lineHeight: 20px
  ui-caption:
    fontFamily: Inter, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 17px
  ui-subheading:
    fontFamily: Inter, sans-serif
    fontSize: 15px
    fontWeight: 600
    lineHeight: 20px
  ui-heading:
    fontFamily: Inter, sans-serif
    fontSize: 17px
    fontWeight: 600
    lineHeight: 22px
    letterSpacing: -0.2px
  ui-title:
    fontFamily: Inter, sans-serif
    fontSize: 22px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: -0.3px
  ui-button:
    fontFamily: Inter, sans-serif
    fontSize: 16px
    fontWeight: 600
    lineHeight: 20px
  ui-numeric:
    fontFamily: Inter, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: 24px
  ui-numeric-large:
    fontFamily: Inter, sans-serif
    fontSize: 28px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: -0.3px
rounded:
  sm: 4px
  md: 8px
  lg: 11px
  panel: 10px
  header: 12px
  full: 9999px
  ui-field: 8px
  ui-control: 12px
  ui-panel-lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  content: 28px
components:
  ui-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground-secondary}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.full}"
    height: 40px
  ui-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.ui-body}"
    rounded: "{rounded.full}"
    height: 40px
  ui-stepper-value:
    textColor: "{colors.foreground}"
    typography: "{typography.ui-numeric}"
  ui-number-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.ui-field}"
    height: 48px
  ui-caption:
    textColor: "{colors.foreground-tertiary}"
    typography: "{typography.ui-caption}"
  ui-primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.ui-button}"
    rounded: "{rounded.ui-control}"
    height: 54px
  ui-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.ui-heading}"
  ui-line-icon-badge:
    backgroundColor: "{colors.green-bg}"
    rounded: "{rounded.full}"
    height: 36px
    width: 36px
  ui-surface-bar:
    backgroundColor: "{colors.strate-herbeuse}"
    rounded: "{rounded.full}"
    height: 10px
  ui-repartition-sol-nu:
    backgroundColor: "{colors.strate-sol-nu}"
    rounded: "{rounded.full}"
    height: 14px
  ui-repartition-arbustive:
    backgroundColor: "{colors.strate-arbustive}"
    rounded: "{rounded.full}"
    height: 14px
  ui-repartition-arboree:
    backgroundColor: "{colors.strate-arboree}"
    rounded: "{rounded.full}"
    height: 14px
  ui-repartition-buissonneuse:
    backgroundColor: "{colors.strate-buissonneuse}"
    rounded: "{rounded.full}"
    height: 14px
  ui-repartition-cultures-seches:
    backgroundColor: "{colors.strate-cultures-seches}"
    rounded: "{rounded.full}"
    height: 14px
  ui-repartition-cultures-hygro:
    backgroundColor: "{colors.strate-cultures-hygro}"
    rounded: "{rounded.full}"
    height: 14px
  ui-stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.ui-numeric-large}"
    rounded: "{rounded.ui-control}"
  ui-timeline-vol:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: 28px
  ui-timeline-poser:
    backgroundColor: "{colors.amber}"
    rounded: "{rounded.full}"
    size: 28px
  sidebar:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    width: 236px
  header:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.foreground}"
    typography: "{typography.h1}"
    height: 66px
  login-page:
    backgroundColor: "{colors.background-outer}"
    textColor: "{colors.foreground}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 18px
  card-header-hero:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.header}"
    padding: 20px
  data-table:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground-secondary}"
    typography: "{typography.body}"
    padding: 12px
  table-header:
    textColor: "{colors.foreground-weak}"
    typography: "{typography.eyebrow}"
  table-cell-numeric:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.numeric}"
  kpi-value:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.kpi}"
  filter-chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground-tertiary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
  nav-tabs:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground-tertiary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
  pill:
    backgroundColor: "{colors.brouillon-bg}"
    textColor: "{colors.brouillon-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
  status-badge:
    backgroundColor: "{colors.brouillon-bg}"
    textColor: "{colors.brouillon-text}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
  status-badge-verifiee:
    backgroundColor: "{colors.blue-bg}"
    textColor: "{colors.blue-text}"
    rounded: "{rounded.full}"
  bandeau-equipe:
    backgroundColor: "{colors.green-light}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
  nouvelle-fiche-icone-prospection:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.primary}"
    rounded: "{rounded.header}"
  nouvelle-fiche-icone-traitement:
    backgroundColor: "{colors.violet-bg}"
    textColor: "{colors.violet}"
    rounded: "{rounded.header}"
  nouvelle-fiche-icone-vol:
    backgroundColor: "{colors.blue-sheet-bg}"
    rounded: "{rounded.header}"
  vol-badge-prospection:
    backgroundColor: "{colors.badge-blue-solid}"
    textColor: "{colors.surface}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
  vol-badge-neutre:
    backgroundColor: "{colors.badge-gray-solid}"
    textColor: "{colors.surface}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
  error-banner:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.panel}"
  info-panel:
    backgroundColor: "{colors.green-bg}"
    textColor: "{colors.primary-on-tint}"
    rounded: "{rounded.panel}"
  warning-panel:
    backgroundColor: "{colors.amber-bg}"
    textColor: "{colors.amber-text}"
    rounded: "{rounded.panel}"
  alert-dot:
    backgroundColor: "{colors.amber}"
    rounded: "{rounded.full}"
    size: 6px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground-secondary}"
    rounded: "{rounded.md}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
  switch:
    backgroundColor: "{colors.border-field}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  chart-bar-track:
    backgroundColor: "{colors.bar-fond}"
    rounded: "{rounded.sm}"
  chart-bar-brouillon:
    backgroundColor: "{colors.bar-brouillon}"
    rounded: "{rounded.sm}"
  chart-bar-verifiee:
    backgroundColor: "{colors.bar-verifiee}"
    rounded: "{rounded.sm}"
  hairline-card:
    backgroundColor: "{colors.border}"
    height: 1px
  hairline-field:
    backgroundColor: "{colors.border-field}"
    height: 1px
  hairline-inner:
    backgroundColor: "{colors.separator}"
    height: 1px
  hairline-row:
    backgroundColor: "{colors.separator-strong}"
    height: 1px
  hairline-success:
    backgroundColor: "{colors.green-border}"
    height: 1px
  hairline-warning:
    backgroundColor: "{colors.amber-border}"
    height: 1px
  hairline-danger:
    backgroundColor: "{colors.danger-border}"
    height: 1px
  hairline-info:
    backgroundColor: "{colors.blue-border}"
    height: 1px
  hairline-neutral:
    backgroundColor: "{colors.brouillon-border}"
    height: 1px
---

## Overview

**Terrain de données, pas de marketing.** L'interface IFVM sert des agents de terrain et des
coordinateurs qui gèrent des campagnes de lutte antiacridienne à Madagascar. Chaque écran est
opérationnel : tableaux de bord de suivi, fiches de prospection géolocalisées, fiches de traitement,
référentiels.

La source de vérité de cette charte est le handoff de maquette :
`docs/design_handoff_web/README.md` §Design tokens et `docs/design_handoff_web/Prototype Web IFVM.dc.html`.
Son implémentation est le bloc `ifvm` de `frontend/tailwind.config.js`. **Toute valeur décrite ici
doit exister dans l'un des deux** — ce document ne propose pas une direction artistique, il décrit
celle qui est en place.

L'identité visuelle est celle d'un document de travail imprimé : fond papier chaud (`#faf7ef`),
vert forêt profond (`#235a36`) pour la navigation et les chiffres clés, aucune ombre portée.
La hiérarchie passe par la **bordure**, le **fond teinté** et la **typographie** — jamais par
l'élévation. Le style est sobre et dense : pas d'animations superflues, pas de gradients.

## Colors

### Marque

- **Primary (`#235a36`) :** vert IFVM. Sidebar, en-têtes de fiche, chiffres clés, n° de fiche,
  état actif des chips et onglets, boutons primaires. C'est la couleur de marque unique.
- **Primary Hover (`#1a4429`) :** survol des liens et des boutons primaires.
- **Primary On Tint (`#3a5c43`) :** texte vert posé sur un fond vert clair, quand `primary`
  manquerait de respiration.

### Surfaces

- **Background (`#faf7ef`) :** fond de l'application et des en-têtes de tableau. Papier chaud.
- **Background Outer (`#efeada`) :** fond hors du cadre applicatif (page de connexion, marges).
- **Surface (`#FFFFFF`) :** fond des cartes et des tableaux.
- **Surface Raised (`#fffdf8`) :** header contextuel et sous-surfaces à peine détachées.

### Traits

- **Border (`#e7e0cd`) :** contour des cartes et du header.
- **Border Field (`#e0d9c4`) :** contour des champs, des chips et des boutons secondaires.
- **Separator (`#f1ecdd`) / Separator Strong (`#f4efe2`) :** filets internes, lignes de tableau.

### Textes

- **Foreground (`#16201a`) :** titres et données principales.
- **Foreground Secondary (`#3a3a30`) :** corps de texte, cellules.
- **Foreground Tertiary (`#6f6a59`) :** légendes, texte des chips inactives.
- **Foreground Weak (`#9a9484`) :** labels uppercase, fil d'Ariane, en-têtes de colonne.

### Sémantique

Chaque famille sémantique porte un trio **fond / texte / bordure** et ne s'emploie qu'avec ce trio.

| Famille | Sens | Fond | Texte | Bordure |
|---|---|---|---|---|
| Vert clair | validée, panneau d'aide | `#eaf2ec` | `#235a36` | `#cfe0d4` |
| Ambre | en attente, avertissement | `#fdf6e7` | `#8a6d2f` | `#f0e2bf` |
| Bleu | vérifiée | `#eaf0f7` | `#31567f` | `#cdddef` |
| Danger | rejetée, erreur API | `#fbe9e5` | `#a5341c` | `#f0c4b9` |
| Brouillon | brouillon, neutre, inactif | `#f4efe2` | `#6f6a59` | `#e0d9c4` |

`amber` (`#e89b2b`) et `danger` (`#c0412b`) pleins sont réservés aux pastilles et aux points de
signalement, jamais à un fond de bloc.

Les badges de catégorie de vol du mobile (« Mes vols », maquette M/Badge) sont **pleins**, texte blanc :
vert `#235a36` (application), ambre `#8a6d2f` (convoyage), bleu `badge-blue-solid` `#4777a2`
(prospection) et gris `badge-gray-solid` `#737373` (mise en place, divers). Comme `amber` et `danger`
pleins, ils ne servent qu'aux pastilles, jamais à un fond de bloc.

### Contexte d'équipe (mobile)

L'équipe de travail est le contexte des écrans de saisie. Le **bandeau d'équipe** (`bandeau-equipe`)
rappelle son nom, son type (badge AÉRIENNE en vert doux, TERRESTRE en ambre) et « Changer › » ; il se
pose sous la recherche de « Mes fiches » (avec la puce « Toutes les équipes ») et sous le titre de la
feuille « Nouvelle fiche ». Sans équipe, il devient une invitation en pointillés ambre : « Définir
l'équipe ».

Une action que le type de l'équipe ne permet pas (vol avec une équipe terrestre, prospection
intensive avec une équipe aérienne) n'est jamais masquée : sa carte passe à 55 % d'opacité et son
sous-titre donne le motif (« Demande une équipe aérienne — « … » est terrestre. Touchez pour changer
d'équipe. »). Un appui ouvre le choix d'équipe. Maquettes : page « Parcours — Mes fiches ».

### Graphiques

Les barres du pipeline du tableau de bord ont leurs propres teintes, plus claires que les tons de
badge car elles remplissent de larges surfaces : `bar-brouillon` (`#bdb6a2`),
`bar-verifiee` (`#5b83b5`), sur fond `bar-fond` (`#f1ecdd`). Les segments validés reprennent `primary`.

## Typography

Deux familles, chargées depuis Google Fonts dans `index.html` :
**Archivo** (400/500/600/700/800) pour l'UI, **IBM Plex Mono** (400→700) pour tout ce qui est
chiffre, code, identifiant ou horodatage. Les chiffres en colonne sont alignés à droite.

L'échelle est délibérément petite et resserrée — l'écran est dense en données.

- **Section Title (17px / 800) :** titre d'un bloc majeur ou d'un en-tête de fiche.
- **H1 (19px / 800, `-0.3px`) :** titre de page dans le header.
- **H2 (14px / 700) :** titre de carte principale.
- **H3 (13px / 700) :** titre de carte secondaire, en-tête de section interne.
- **Body (12px / 500, interligne 1.55) :** corps, cellules de tableau, descriptions.
- **Control (11.5px / 600) :** libellés de chips, d'onglets, de boutons, de champs.
- **Eyebrow (9.5px / 600, uppercase, `1px`) :** fil d'Ariane, labels de section, en-têtes de colonne
  (`0.8px` de letter-spacing en tableau), en `foreground-weak`.
- **Badge (10px / 700) :** badges de statut et pilules.
- **Numeric (12px / 600, IBM Plex Mono) :** valeurs chiffrées en cellule.
- **KPI (30px / 700, IBM Plex Mono, 1.1) :** valeur d'une carte KPI ; `15–18px` pour un chiffre de
  panneau latéral.

## Layout & Spacing

Cadre de référence `1440×920` : **sidebar `236px`** fixe à gauche, **header `66px`**, contenu en
scroll vertical.

- Padding de contenu : **`26px 28px 40px`** — le `28px` horizontal est la valeur normative, il aligne
  le contenu sur le header. `px-8` (32px) est une dérive à corriger là où elle subsiste.
- Padding de carte : `16px 18px` (carte de filtres, carte compacte) ou `18px 20px` (carte de contenu).
- Padding de cellule : `12px`, porté à `20px` en première et dernière colonne pour aligner sur le
  bord de la carte.
- Gouttière de grille : `14–20px`. Pile verticale entre cartes : `16px`.
- Grilles à deux colonnes des écrans de détail : `1fr 320px` (`1fr 316px` sur la fiche de lecture).

## Elevation & Depth

**Aucune ombre portée.** La hiérarchie passe exclusivement par la bordure et le fond. Une carte se
distingue du fond `#faf7ef` par sa surface blanche et son contour `#e7e0cd`.

Seule exception : dropdowns et popovers, qui peuvent porter une ombre légère pour signaler qu'ils
flottent au-dessus du contenu.

## Shapes

- `sm` (4px) : pastilles d'icône, petits marqueurs, barres de graphique. À cette taille `3px` et
  `4px` sont indiscernables — les deux sont admis dans cette famille.
- `md` (8px) : champs, boutons, chips de filtre, lignes de navigation de la sidebar. Les onglets et
  boutons de la maquette montent à 9px — 8 et 9 sont interchangeables dans cette famille.
- `panel` (10px) : bandeaux d'alerte et panneaux latéraux.
- `lg` (11px) : **cartes** — c'est le rayon le plus visible de l'interface.
- `header` (12px) : en-tête vert d'une fiche.
- `full` : badges de statut et pilules (`20px` dans la maquette, plein arrondi à cette hauteur).

## Components

Les composants ci-dessous vivent dans `frontend/src/components/ui/` et sont la seule voie autorisée
pour ces motifs — les recopier à la main sur un écran fait dériver la charte.

> **Convention `hairline-*`.** Le schéma de `design.md` ne connaît pas de sous-token `borderColor` :
> les seules clés colorées sont `backgroundColor` et `textColor`. Les couleurs de trait sont donc
> déclarées comme des composants `hairline-*` — un filet de `1px` rempli de la couleur en question.
> `hairline-card` = contour de carte, `hairline-field` = contour de champ, `hairline-row` = filet de
> ligne de tableau, `hairline-inner` = séparateur interne, et `hairline-success` / `-warning` /
> `-danger` / `-info` / `-neutral` = la bordure de chaque famille sémantique. C'est ce qui permet au
> lint de vérifier qu'aucune bordure du code ne sort de la palette.

### Sidebar (`Layout.tsx`)
Fond `primary`, texte blanc, largeur `236px`. En-tête : carré blanc `38px` rayon `10px`.
Navigation : une ligne par écran, `padding 9px 11px`, rayon `8px`, puce `5px`, compteur à droite en
`600 10px IBM Plex Mono`. Actif : fond `rgba(255,255,255,.14)`, texte blanc, poids 700.
Inactif : blanc 72 %, poids 500.

### Header
`66px`, fond `surface-raised`, bordure basse `border`, padding horizontal `28px`. Fil d'Ariane
(eyebrow) + titre (h1) à gauche ; à droite les pilules campagne active (vert clair) et fiches en
attente (ambre, point `6px`).

### DataTable (`data-table.tsx`)
En-tête de colonne en eyebrow sur fond `background`, sans bordure basse. Lignes séparées par
`border-top: 1px solid #f4efe2`. Cellules `12px` ; les colonnes numériques passent en
`font-mono font-semibold` et s'alignent à droite. Aucune couleur de fond sur les lignes — la couleur
vient des badges. Une ligne cliquable prend le curseur pointer.

### FilterChip (`filter-chip.tsx`)
`padding 8px 13px`, rayon `8px`, texte control. Inactive : fond `background`, texte
`foreground-tertiary`, bordure `border-field`. Active : fond et bordure `primary`, texte blanc.
Porte `aria-pressed`.

### NavTabs (`nav-tabs.tsx`)
`padding 9px 16px`, rayon `9px`, `700 12px`. Actif : fond `primary`, texte blanc. Inactif : fond
`background`, texte `foreground-tertiary`, bordure `brouillon-border`. Ce sont de vrais liens
(`aria-current="page"`), pas un état local.

### Pill (`pill.tsx`)
`padding 3px 9px`, rayon plein, `700 10px`. Le ton est un trio complet pris dans la palette
sémantique (`PILL_TONES` : aérien = bleu, terrestre / signé = vert clair, neutre = brouillon).

### StatusBadge (`status-badge.tsx`)
Même forme que `Pill`, mais le ton est dérivé du statut métier et n'est pas paramétrable :
brouillon → brouillon, en attente → ambre, vérifiée → bleu, validée → vert clair, rejetée → danger.
Un statut inconnu retombe sur le ton brouillon.

### ErrorBanner (`error-banner.tsx`)
`role="alert"`, rayon `10px`, trio danger complet, `padding 12px 16px`. Libellé en gras puis
message. C'est le rendu unique des erreurs API (403, 404, 409, 422).

### Panneaux d'aide et d'avertissement
Même forme que `ErrorBanner` avec le trio vert clair (aide, rappel de règle) ou ambre
(avertissement, snapshot figé, données à confirmer).

### Boutons
- **Primaire** : fond `primary`, texte blanc, rayon `8–9px`. « Enregistrer », « Créer », « Valider ».
- **Secondaire** : fond `surface`, texte `foreground-secondary`, bordure `border-field`.
- **Danger** : trio danger, réservé aux actions irréversibles et aux rejets motivés.

### Champs (`input.tsx`, `select.tsx`, `textarea.tsx`)
Fond `surface`, bordure `border-field`, rayon `8px`, texte `12px`. Label au-dessus en eyebrow.

### Switch (`switch.tsx`)
Rayon plein. Éteint : piste `border-field`. Allumé : piste `primary`, pouce blanc. Sert exclusivement
à la **désactivation logique** (`actif`) des référentiels — jamais à une suppression.

## Périmètre — écrans encore hors charte

Trois écrans n'ont pas encore été réécrits sur le handoff et portent des couleurs qui ne figurent
volontairement pas ci-dessus. Ce sont des dettes identifiées, pas des extensions de la palette :

- `LoginPage.tsx` — palette propre (`#1F4D33`, `#FBF8F0`, `#B65C28`…), hors du cadre applicatif.
- `CartePage.tsx` — `#dc2626` / `#fb923c` / `#facc15` pour les marqueurs de carte ; un jeu de
  couleurs de données à faire dériver des tons ambre / danger de la charte.
- `DesignSystemPage.tsx` — vitrine de l'**ancien** socle visuel (`#166534`, `#dcfce7`…). Elle décrit
  une charte qui n'existe plus et devrait être refaite sur ce document ou supprimée.

Partout ailleurs, chaque couleur et chaque rayon employés dans `frontend/src` figurent dans cette
charte.

## Accessibilité — dette connue

Le couple `foreground-weak` (`#9a9484`) sur `background` (`#faf7ef`) donne un contraste de
**2,8:1**, sous le minimum WCAG AA de 4,5:1 pour du texte de cette taille. Il porte pourtant les
labels uppercase `9.5px`, le fil d'Ariane et les en-têtes de colonne — soit ~52 occurrences dans
`frontend/src`. C'est la valeur de la maquette : la corriger est un arbitrage produit, pas une
retouche de charte, et il faut le traiter en une passe pour ne pas fabriquer deux gris de labels.
Tant que l'arbitrage n'est pas rendu, `table-header` est déclaré sans `backgroundColor` dans le
frontmatter — le lint ne peut donc pas vérifier ce couple précis. Toute autre paire texte/fond de la
charte passe AA.

`foreground-tertiary` (`#6f6a59`) est le remplaçant naturel : 5,0:1 sur le fond applicatif, déjà
dans la palette.

## Do's and Don'ts

**À faire**
- Prendre les couleurs dans les classes `ifvm-*` de Tailwind ; un hex en dur dans un `.tsx` est une
  dette, pas un style.
- Employer une famille sémantique par son trio complet fond / texte / bordure.
- Réutiliser `DataTable`, `FilterChip`, `NavTabs`, `Pill`, `StatusBadge`, `ErrorBanner` plutôt que
  de recomposer le motif.
- Mettre en IBM Plex Mono tout ce qui est chiffre, identifiant, coordonnée GPS ou horodatage.
- Utiliser `28px` de padding de contenu.

**À éviter**
- Ne pas introduire de couleur hors de cette charte : une couleur = une signification. Une nouvelle
  teinte passe d'abord par le handoff, puis par `tailwind.config.js`, puis par ce document.
- Ne pas poser d'ombre portée sur une carte, un tableau ou un bouton.
- Ne pas utiliser le danger pour un avertissement non critique — c'est le rôle de l'ambre.
- Ne pas utiliser de gradient.
- Ne pas animer les transitions de données (tableaux, graphiques) — lisibilité et performance
  d'abord.
- Ne pas laisser cette charte diverger du code : toute modification de la palette met à jour
  `docs/design_handoff_web/README.md`, `frontend/tailwind.config.js` **et** ce fichier.
