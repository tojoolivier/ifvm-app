# Gestion centralisée des erreurs sur l'app mobile

**Contexte** : plusieurs écrans de prospection (`accouplement.tsx`, `extensive-imagos.tsx`, `density.tsx`) contenaient le même bug — un `try { ... } finally { ... }` sans `catch`, et des gardes-fous du type `if (!draftId) return;` — qui avalent silencieusement les erreurs. Résultat côté terrain : l'utilisateur clique sur un bouton et rien ne se passe, sans aucun message, sans pouvoir savoir pourquoi il ne peut pas avancer.

**Décision** : toute action async ou précondition sur un écran mobile doit passer par un hook centralisé (`useAsyncAction` ou équivalent) qui garantit qu'aucune erreur ni précondition manquante ne peut rester silencieuse — elle est systématiquement remontée (bannière d'erreur ou message de champ) et journalisée en mode debug. Le `try/catch` et le guard-clause "silencieux" ad hoc écran par écran sont proscrits.

**Alternative rejetée** : corriger chaque écran individuellement en ajoutant un `catch` au cas par cas. Rejetée car le bug s'est déjà reproduit trois fois indépendamment avec le même pattern — rien n'empêcherait un nouvel écran de le réintroduire sans un mécanisme qui le rend structurellement impossible.

**Périmètre de déploiement** : écrans de prospection en premier (débloque le bug urgent), généralisation au reste de l'app mobile ensuite.
