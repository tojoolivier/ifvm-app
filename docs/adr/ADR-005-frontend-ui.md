# ADR-005 — UI library frontend web

**Statut :** Accepté  
**Date :** 2026-06-24

## Contexte

Le frontend web (React + TypeScript + Vite + Tailwind CSS) n'a pas de librairie UI. Les composants de base (boutons, formulaires, tableaux) doivent être construits pour manipuler les fiches terrain, les stations, les utilisateurs, et les tableaux de bord.

## Décision

**shadcn/ui** comme librairie de composants UI.

| Composant | Choix | Alternative écartée |
|-----------|-------|---------------------|
| UI library | **shadcn/ui** (Radix UI + Tailwind CSS) | HeroUI — tier Pro payant pour fonctionnalités avancées |
| Icones | **Lucide React** (inclus avec shadcn/ui) | Heroicons, React Icons |
| Graphiques | **À décider** (Chart.js, Nivo, ECharts en options) | — |

### Justification

- **Gratuit et open source** — pas de tier Pro, pas de licence restrictive
- **Composants copiés** — le code vit dans `src/components/ui/`, pas de dépendance runtime
- **Tailwind CSS natif** — cohérence avec le stack existant et NativeWind (mobile)
- **Bonnes pratiques d'accessibilité** — basé sur Radix UI (WAI-ARIA compliant)
- **Écosystème riche** — composants pour tables, formulaires, modales, navigation

### Composants installés

button, input, label, card, table, dialog, select, tabs, separator

## Conséquences

- Les composants UI sont maintenus localement dans `src/components/ui/`
- Les mises à jour se font via `npx shadcn@latest add <component> --overwrite`
- Path alias `@/` configuré dans `tsconfig.json` et `vite.config.ts`
- Thème light uniquement pour le moment (dark mode à ajouter plus tard)
