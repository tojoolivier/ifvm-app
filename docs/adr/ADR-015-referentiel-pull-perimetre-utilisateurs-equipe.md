# Périmètre de `utilisateurs_equipe` dans `GET /referentiel/pull` : retrait de l'email, pas de scope par rôle ni par poste

**Statut** : accepté (#136)

**Contexte** : `GET /referentiel/pull` renvoie `utilisateurs_equipe` avec, par agent,
`id`, `nom`, `prenom`, `email`, `role`, `pa_id`, `actif`, `updated_at`
(`backend/app/presentation/referentiel_schemas.py`, `UtilisateurEquipeSyncRead`). La route
est protégée par l'authentification mais sans aucun filtrage : tout compte terrain
authentifié — un prospecteur compris — reçoit l'annuaire complet des agents, emails
inclus, qui redescend ensuite dans le cache SQLite hors-ligne de chaque téléphone.

L'annotation de la maquette web (`docs/design_handoff_web/…`, `REF.utilisateur.note`) pose
une règle de rôle comme préalable à l'ouverture des écritures du référentiel utilisateur.

**Constat d'usage** (audit du code mobile) :

- La liste ne sert qu'aux **puces de signature** des écrans traitement
  (`mobile/src/app/(traitement)/traitement.tsx` → `listUtilisateursByRole` pour
  `chef_de_base`, `chef_equipe`, `agent_encadreur`) et au repérage de l'utilisateur
  connecté (`chefsDeBase.find(c => c.id === utilisateurConnecte.id)`).
- Le traitement **aérien** mobilise des chefs de **plusieurs bases** : un filtrage par
  `pa_id` du demandeur casserait ce cas, ainsi que le renfort inter-postes et le chef de
  base multi-postes.
- Le champ `email` est **écrit dans SQLite mais lu par aucune requête ni aucun écran**
  (`referentiel-db.ts`, `listUtilisateursByRole` ne sélectionne que `id, nom, prenom`).
  Il ne sert qu'à l'authentification côté backend.

**Décision** :

1. **Retirer `email` de `UtilisateurEquipeSyncRead`.** Le champ ne descend plus sur le
   terrain. Retiré aussi de l'entité de domaine `UtilisateurEquipe` et de son mapping
   (`referentiel_sync_repository.py`), du contrat mobile
   (`api-schema.generated.ts` régénéré, `api-client.ts`), du schéma SQLite local et de
   l'upsert (`referentiel-db.ts`, `referentiel-sync.ts`). SQLite ne sait pas relâcher le
   `NOT NULL` existant : `utilisateur_equipe` est recréée sans la colonne et son curseur
   de synchro remis à zéro (`migrateUtilisateurEquipe`), même traitement que
   `migrateCodeStade` (`mobile/src/lib/referentiel-db.ts`).
2. **Aucun scope par `pa_id`.** Tous les agents restent transportés. Un filtrage par
   poste casserait des cas d'usage réels (aérien multi-bases, renfort, chef multi-postes)
   pour un gain d'exposition marginal une fois l'email retiré.
3. **Aucune restriction de rôle sur la route.** `GET /referentiel/pull` transporte aussi
   zones, postes, stations, pesticides, cultures, stades, campagnes — tous nécessaires au
   fonctionnement hors-ligne de n'importe quel compte terrain. Restreindre la route à
   certains rôles la casserait pour ces autres entités sans bénéfice.
4. Les lignes **inactives** continuent de descendre (`actif=false`) : le pull ne
   transporte que des upserts, sans mécanisme de suppression — c'est le seul moyen de
   propager une désactivation vers un téléphone déjà synchronisé.

**Conséquence** : l'exposition se réduit aux champs strictement affichés côté terrain
(`nom`, `prenom`, `role`, `pa_id`, `actif`) sans casser aucun écran. L'ouverture des
écritures du référentiel utilisateur (`POST`/`PUT /utilisateurs-equipe`, cf. ADR-010)
n'est plus bloquée par cette question de lecture.

**Écarté** :

- *Filtrage par `pa_id`* — casse l'aérien multi-bases et le renfort.
- *Filtrage par rôle signable* — fige la liste des rôles pouvant signer dans le pull,
  alors qu'elle relève de l'UI ; complexité sans gain une fois l'email retiré.
- *403 par rôle sur la route* — pénalise les autres entités du payload.
