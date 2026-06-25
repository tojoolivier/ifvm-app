Status: done

## Parent

`.scratch/ux-formulaire-prospection/PRD.md`

## What to build

Ajouter deux composants UI réutilisables qui servent de fondation aux slices suivantes.

**`components/ui/textarea.tsx`** — composant `Textarea` basé sur `@base-ui/react` (même pattern que `Input` : forward ref, classes Tailwind, `cn()`). Accepte toutes les props natives d'un textarea.

**`components/ui/form-field.tsx`** — wrapper compositionnel qui combine :
- un `Label` shadcn lié au champ via `htmlFor` / `id`
- le champ lui-même (passé en `children`)
- un message d'erreur optionnel affiché sous le champ, avec `id="{fieldId}-error"` pour que le champ puisse y pointer via `aria-describedby`
- `role="alert"` et `aria-live="polite"` sur le message d'erreur

API cible :
```tsx
<FormField label="Campagne" error={errors.campagne} required>
  <Select id="campagne" aria-describedby="campagne-error" ... />
</FormField>
```

Aucune logique métier dans ces composants — pure UI infrastructure.

## Acceptance criteria

- [ ] `Textarea` s'affiche et se comporte comme le textarea natif, stylé identiquement à `Input`
- [ ] `FormField` affiche le label, le champ enfant et le message d'erreur dans cet ordre
- [ ] Quand `error` est fourni, le message d'erreur apparaît avec `role="alert"` et `aria-live="polite"`
- [ ] L'attribut `id` du message d'erreur suit le pattern `{fieldId}-error`
- [ ] Les deux composants sont exportés depuis leur fichier et utilisables dans le reste de l'app
- [ ] Pas de régression sur les composants existants

## Blocked by

None — can start immediately
