# Découpage du handoff web en 7 lots séquentiels, un lot = une session = une issue

**Contexte** : `docs/design_handoff_web/` livre la spécification de 11 écrans web (shell + campagnes,
prospections, validation, traitements, référentiels, etc.) et `PROMPT.md` propose déjà un découpage
en 7 lots (Lot 0 → Lot 6). Vérification faite contre le code réel avant d'acter le plan : route
`/validation-finale` bien absente de `router.tsx` (le lien de `Layout.tsx` tombe sur le catch-all
`LoginPage`), `index.css` porte bien les tokens shadcn par défaut et non la palette IFVM, les routes
`traitements` sont bien complètes côté backend, et il n'existe bien aucune écriture API pour
`pesticide`, `culture`, `code_stade`, `utilisateur_equipe`, `poste_acridien`, `station_fixe` (seul
`campagne` a un CRUD complet) ; le modèle `PesticideModel` n'a bien que `code`/`nom`/`actif` (pas de
matière active ni de dose de référence) ; côté mobile, `culture` et `code_stade` sont bien
synchronisées (`upsertCultures`, `upsertCodesStades`) mais sans fonction de lecture (`listCultures`
inexistante). Un seul écart mineur : `StationPage.tsx` fait ~26 Ko réellement, pas 39 Ko comme
annoncé — sans conséquence sur la décision de le découper avant migration.

**Décision** : on conserve ce découpage en 7 lots comme unité de travail. Chaque lot = une session
Claude Code séparée (contexte neuf) = une PR = une issue GitHub dans `tojoolivier/ifvm-app`
(équivalent d'un epic, avec la liste des tâches en checklist dans le corps, pas de hiérarchie de
sous-issues). Les 7 issues sont créées d'un coup, avec une ligne « Dépend de #N » vers le lot
précédent dans le corps des lots 2 à 6. Labels à la création : `ready-for-agent` pour les lots
0, 1, 2, 3, 4, 6 (entièrement spécifiés) ; `needs-info` pour le lot 5 (fiche de vol / relevé météo)
tant que l'arbitrage produit sur les modèles `fiche_vol`/`vol`/`releve_meteo` n'est pas fait — rien
de tout cela n'existe en base ni en API, et le prompt d'origine demande explicitement de ne pas
trancher seul.

**Alternative rejetée** : une session unique enchaînant les 7 lots avec arrêts de revue. Rejetée
car (1) le lot 5 est bloqué sur une décision produit et ne doit pas s'enchaîner automatiquement
après le lot 4, et (2) deux fichiers volumineux (`NouvelleProspectionPage.tsx` ~58 Ko,
`StationPage.tsx` ~26 Ko) doivent être découpés en commits structurels séparés avant d'être
re-stylés, ce qui gonflerait le contexte d'une session unique sans bénéfice.

**Conséquence** : la continuité entre sessions (ce qui a été décidé pendant le lot N) ne vit ni dans
le contexte de session ni dans les issues seules — cet ADR sert de point d'ancrage écrit pour toute
session future reprenant un lot.
