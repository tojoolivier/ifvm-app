Status: done

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Remplacer tous les éléments HTML natifs de `NouvelleProspectionPage` par les composants shadcn/ui du design system du projet. Règle du projet : ne jamais utiliser de balises HTML natives quand un composant shadcn équivalent existe.

**Trois remplacements concrets :**

1. **Station fixe** : le `<select>` natif (ligne ~555) est remplacé par le composant `Select` shadcn. La recherche par nom/code (actuellement un `<Input>` séparé au-dessus) est intégrée dans un pattern combobox : champ de recherche → liste filtrée affichée en dessous. Comportement identique à l'actuel, visuel cohérent.

2. **Observations** : le `<textarea>` natif est remplacé par le composant `Textarea` (créé dans le slice #01).

3. **Boutons** :
   - "← Retour" → `Button variant="ghost"` avec icône ou préfixe flèche
   - Boutons "✕" de suppression de ligne (captures, infestations) → `Button variant="destructive" size="sm"`

Aucun changement de logique métier ni d'état — uniquement la couche présentation.

## Acceptance criteria

- [ ] Plus aucun `<select>` ni `<textarea>` HTML natif dans `NouvelleProspectionPage`
- [ ] Le composant station combine recherche + liste dans un seul bloc visuel cohérent
- [ ] Le bouton Retour utilise `Button variant="ghost"`
- [ ] Les boutons de suppression (captures, infestations) utilisent `Button variant="destructive"`
- [ ] La fonctionnalité (sélection station + auto-remplissage lat/lon/alt, suppression de lignes) est identique à l'actuelle
- [ ] Pas de régression sur les autres sections du formulaire

## Blocked by

- `01-composants-ui-infrastructure.md` (composant `Textarea`)
