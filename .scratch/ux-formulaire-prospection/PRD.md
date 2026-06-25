# PRD — Amélioration UX du formulaire de prospection intensive

**Status:** ready-for-agent  
**Date:** 2026-06-25

## Problem Statement

Le formulaire de prospection intensive (`NouvelleProspectionPage.tsx`) fait 1004 lignes avec 8 sections et 50+ champs sur une seule page. L'expérience utilisateur est dégradée par :

1. **Incohérence du design system** : le composant utilise un `<select>` HTML natif pour la station (ligne 555) et un `<textarea>` HTML brut pour les observations (ligne 966), au lieu des composants shadcn/ui du design system
2. **Absence de validation** : seulement 3 champs obligatoires (campagne, date, station) pour 50+ champs, pas de validation inline, les erreurs sont affichées uniquement en haut de page
3. **Pas de sauvegarde automatique** : toutes les données sont en `useState` local — une navigation accidentelle ou une perte de connexion entraîne la perte totale des données
4. **Formulaires monolithiques** : 50+ champs sur une seule page sans indication de progression, l'utilisateur ne sait pas où il en est
5. **Filtres ergonomiques cassés** : la page de liste (`ProspectionsPage.tsx`) filtre les stations par UUID au lieu du nom/code

## Solution

Refonte complète de l'expérience utilisateur du formulaire de prospection intensive avec :

- **Multi-step form** : découpage en 4 étapes logiques avec barre de progression
- **Validation Zod** : schéma de validation côté client avec erreurs inline par champ
- **Sauvegarde automatique** : persistance en localStorage toutes les 30 secondes + restauration au chargement
- **Cohérence du design system** : remplacement de toutes les balises HTML natives par les composants shadcn/ui
- **Accessibilité RGAA** : aria-live, role=alert, focus trap, navigation clavier

## User Stories

### Multi-step form

1. As a prospecteur, I want to see a progress bar at the top of the form, so that I know which step I'm on and how many steps remain
2. As a prospecteur, I want to navigate between steps with "Previous" / "Next" buttons, so that I can review and edit my answers
3. As a prospecteur, I want the form to be divided into 4 logical steps, so that I can focus on one section at a time:
   - Step 1: Informations générales + Localisation (sections 1-2)
   - Step 2: Captures + Population acridienne (sections 3-4)
   - Step 3: Infestation + Végétation + Sol (sections 5-7)
   - Step 4: Conditions environnementales + Récapitulatif (section 8 + résumé)
4. As a prospecteur, I want to see a summary of my previous steps when I reach step 4, so that I can review all my answers before submitting
5. As a prospecteur, I want to go back to any previous step by clicking on the progress bar, so that I can quickly navigate to a specific section
6. As a prospecteur, I want the form to validate the current step before allowing me to proceed, so that I don't submit incomplete data
7. As a prospecteur, I want to see which fields are missing or invalid when I try to proceed, so that I can fix them quickly

### Validation des données

8. As a prospecteur, I want to see a red border and an error message under each invalid field, so that I know exactly what to fix
9. As a prospecteur, I want the form to validate that the campagne is selected, so that the prospection is linked to a valid period
10. As a prospecteur, I want the form to validate that the date is within the campagne date range, so that the prospection is temporally coherent
11. As a prospecteur, I want the form to validate that the station is selected, so that the prospection has a geographic reference
12. As a prospecteur, I want the form to validate that at least one capture row has an effectif > 0, so that the prospection has actual data
13. As a prospecteur, I want the form to validate that surface_infestee <= surface_prospectee, so that the data is physically coherent
14. As a prospecteur, I want the form to validate that surface_prospectee <= surface_station, so that the data is physically coherent
15. As a prospecteur, I want the form to validate that latitude is between -90 and 90, so that the coordinate is valid
16. As a prospecteur, I want the form to validate that longitude is between -180 and 180, so that the coordinate is valid
17. As a prospecteur, I want the form to validate that altitude is a positive number, so that the value makes sense
18. As a prospecteur, I want the form to validate that effectif is a non-negative integer, so that the count is valid
19. As a prospecteur, I want to see a summary of all validation errors when I try to submit, so that I can fix them all at once

### Sauvegarde automatique

20. As a prospecteur, I want the form to auto-save to localStorage every 30 seconds, so that I don't lose data if my browser crashes
21. As a prospecteur, I want to see a "Draft saved" indicator with a timestamp, so that I know my data is safe
22. As a prospecteur, I want to see a warning if I try to leave the page with unsaved changes, so that I don't accidentally lose data
23. As a prospecteur, I want to restore a draft when I return to the form, so that I can continue where I left off
24. As a prospecteur, I want to see a "Resume draft" button if a draft exists, so that I can choose to continue or start fresh
25. As a prospecteur, I want the draft to be cleared after successful submission, so that I don't see old drafts
26. As a prospecteur, I want the auto-save to be disabled during submission, so that there are no conflicts

### Cohérence du design system

27. As a prospecteur, I want the station selector to use the shadcn Select component, so that the UI is consistent
28. As a prospecteur, I want the station selector to support search by name or code, so that I can find my station quickly
29. As a prospecteur, I want the observations field to use a proper Textarea component, so that the UI is consistent
30. As a prospecteur, I want all buttons to use the shadcn Button component, so that the UI is consistent
31. As a prospecteur, I want all form fields to use the shadcn Input and Label components, so that the UI is consistent
32. As a prospecteur, I want all tables to use the shadcn Table component, so that the UI is consistent
33. As a prospecteur, I want all modals to use the shadcn Dialog component, so that the UI is consistent
34. As a prospecteur, I want the "Back" link to use a shadcn Button with variant="ghost", so that the UI is consistent
35. As a prospecteur, I want the delete buttons to use shadcn Button with variant="destructive", so that the UI is consistent

### Accessibilité (RGAA)

36. As a prospecteur, I want error messages to have `role="alert"` and `aria-live="polite"`, so that screen readers announce them
37. As a prospecteur, I want each form field to have an `aria-describedby` linking to its error message, so that screen readers can read the error
38. As a prospecteur, I want the focus to be trapped within the current step, so that keyboard navigation is logical
39. As a prospecteur, I want to navigate between fields using the Tab key in a logical order, so that I can use the form without a mouse
40. As a prospecteur, I want the progress bar to be accessible via keyboard, so that I can navigate steps without a mouse
41. As a prospecteur, I want all interactive elements to have visible focus indicators, so that I can see where I am
42. As a prospecteur, I want the form to have a "Skip to main content" link, so that screen reader users can bypass the navigation

### Filtres ergonomiques (page de liste)

43. As a web user, I want the station filter to search by name or code instead of UUID, so that I can find stations easily
44. As a web user, I want to see the number of results before the list loads, so that I know what to expect
45. As a web user, I want the filters to be persisted in the URL query parameters, so that I can share filtered views
46. As a web user, I want to clear all filters with one click, so that I can reset the view quickly
47. As a web user, I want the filter options to be loaded from the API, so that they are always up to date

## Implementation Decisions

### Composants UI à ajouter

| Composant | Emplacement | Description |
|-----------|-------------|-------------|
| `Textarea` | `components/ui/textarea.tsx` | Composant textarea basé sur `@base-ui/react/textarea`, même pattern que `Input` |
| `FormField` | `components/ui/form-field.tsx` | Wrapper combinant `Label` + `Input`/`Select` + message d'erreur avec `aria-describedby` |
| `Stepper` | `components/ui/stepper.tsx` | Barre de progression avec steps cliquables, accessibilité clavier |

### Schéma de validation Zod

Fichier : `lib/prospection-schema.ts`

Le schéma doit contenir :
- Validation des champs de base (campagne, date, station)
- Validation des coordonnées (latitude -90..90, longitude -180..180)
- Validation des surfaces (infestee <= prospectee <= station)
- Validation des captures (au moins 1 ligne avec effectif > 0)
- Messages d'erreur en français

### Structure multi-step

Le formulaire sera découpé en 4 étapes :
- **Étape 1** : Informations générales + Localisation (sections 1-2)
- **Étape 2** : Captures + Population acridienne (sections 3-4)
- **Étape 3** : Infestation + Végétation + Sol (sections 5-7)
- **Étape 4** : Conditions environnementales + Récapitulatif (section 8)

Chaque étape sera un composant séparé, le parent `NouvelleProspectionPage` gérera l'état global et la navigation.

### Sauvegarde automatique

- Utilisation de `localStorage` avec une clé `prospection-draft-{user_id}`
- Sauvegarde déclenchée toutes les 30 secondes si modification détectée
- Restauration au chargement avec proposition "Reprendre le brouillon" / "Commencer à zéro"
- Nettoyage après soumission réussie
- Indicateur visuel "Brouillon sauvegardé à HH:MM"

### Seam de test

Le seam principal est le **composant `NouvelleProspectionPage`** lui-même. C'est ici que :
- La validation est déclenchée à chaque changement d'étape
- La sauvegarde automatique est gérée
- La navigation entre étapes est contrôlée

Les seams secondaires sont :
- Le schéma Zod (`prospection-schema.ts`) — testable indépendamment
- Les composants UI (`FormField`, `Stepper`) — testables unitairement
- La page de liste (`ProspectionsPage.tsx`) — testable pour les filtres

## Testing Decisions

### Principes

- Tester le **comportement utilisateur** (remplir un champ, voir l'erreur, naviguer entre étapes), pas les détails d'implémentation
- Chaque user story doit avoir un test correspondant
- Les tests de validation doivent vérifier que les erreurs s'affichent et disparaissent correctement
- Les tests de navigation doivent vérifier que les étapes sont accessibles et que la progression fonctionne

### Modules testés

| Module | Type de test |
|--------|--------------|
| `prospection-schema.ts` | Tests unitaires (chaque règle de validation) |
| `NouvelleProspectionPage` | Tests d'intégration (remplissage multi-step + soumission) |
| `FormField` | Tests unitaires (affichage erreur, accessibilité) |
| `Stepper` | Tests unitaires (navigation, accessibilité) |
| `ProspectionsPage` | Tests d'intégration (filtres, recherche station) |

### Priorart

Pas de tests frontend existants dans le repo. Le mobile établit le pattern avec Jest + React Native Testing Library. Pour le frontend web, utiliser **Vitest** + **React Testing Library** (déjà compatible avec Vite).

## Out of Scope

- **Changement du backend** : pas de nouvel endpoint, pas de modification de schéma Pydantic
- **Authentification** : le login n'est pas modifié dans ce PRD
- **Dark mode** : thème light uniquement
- **Mobile** : les améliorations sont uniquement pour l'interface web
- **Tableau de bord** : pas de graphiques ni de statistiques dans ce PRD
- **Pagination côté serveur** : la pagination reste côté client pour l'instant
- **React Hook Form** : on reste sur useState pour l'instant (migration ultérieure possible)

## Further Notes

- Le design system est bien documenté dans `DesignSystemPage.tsx` — s'en inspirer pour les conventions
- Les composants shadcn/ui sont basés sur `@base-ui/react` (pas Radix UI) — respecter ce pattern
- La page `DesignSystemPage` liste explicitement les règles : "ne jamais utiliser de balises HTML natives"
- Le PRD workflow (`prospection-intensive-workflow/PRD.md`) a déjà défini les statuts et l'audit log — ne pas les modifier
- Le formulaire est le cœur du métier IFVM — la qualité UX impacte directement la collecte de données terrain
