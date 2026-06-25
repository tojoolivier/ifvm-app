Status: ready-for-agent

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Transformer le formulaire monolithique en un formulaire multi-étapes avec barre de progression accessible.

**`components/ui/stepper.tsx`** — barre de progression composée de 4 steps cliquables :
- Step actif : visuellement mis en évidence
- Steps complétés : cliquables pour revenir en arrière
- Steps futurs : non cliquables (désactivés)
- Navigation clavier : Tab entre les steps, Enter/Space pour activer
- `aria-current="step"` sur le step actif

**Découpage du formulaire en 4 étapes :**

| Étape | Contenu | Sections actuelles |
|-------|---------|-------------------|
| 1 | Informations générales + Localisation | 1–2 |
| 2 | Captures + Population acridienne | 3–4 |
| 3 | Infestation + Végétation + Sol | 5–7 |
| 4 | Conditions environnementales + Récapitulatif | 8 + résumé |

**Navigation :**
- Boutons "Précédent" / "Suivant" en bas de chaque étape
- À "Suivant" : valider uniquement les champs de l'étape courante (sous-schéma Zod)
- Les erreurs de l'étape courante bloquent l'avancement
- Cliquer un step complété dans le Stepper : revenir à cette étape

**Récapitulatif (étape 4) :**
- Afficher en lecture seule les valeurs saisies aux étapes 1–3
- Chaque section du récapitulatif a un lien "Modifier" qui ramène à l'étape correspondante
- Boutons "Sauvegarder (brouillon)" et "Soumettre" uniquement à l'étape 4

**Accessibilité :**
- `role="group"` avec `aria-label="Étape X sur 4"` sur le contenu de chaque étape
- Focus déplacé vers le titre de l'étape lors de la navigation entre étapes
- Lien "Aller au contenu" en tête de page

## Acceptance criteria

- [ ] Le Stepper affiche 4 steps, le step actif est identifiable visuellement et via `aria-current="step"`
- [ ] Les steps complétés sont cliquables, les steps futurs ne le sont pas
- [ ] "Suivant" valide l'étape courante avant de progresser ; les erreurs s'affichent inline
- [ ] "Précédent" revient à l'étape précédente sans perdre les données saisies
- [ ] L'étape 4 affiche un récapitulatif des étapes 1–3 en lecture seule
- [ ] Les boutons "Soumettre" et "Sauvegarder" n'apparaissent qu'à l'étape 4
- [ ] Le focus est déplacé vers le titre de l'étape après chaque navigation
- [ ] La navigation clavier dans le Stepper fonctionne sans souris
- [ ] Toutes les données saisies sur les étapes précédentes sont conservées

## Blocked by

- `03-coherence-design-system.md`
- `04-validation-zod-inline.md`
