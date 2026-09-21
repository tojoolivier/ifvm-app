# Abandon de la fiche de vol (heures de vol)

**Statut** : accepté (2026-09-21), **partiellement révoqué** par `ADR-018` (2026-09-22).
Remplace, pour la partie fiche de vol, `ADR-011`.

> ⚠️ `ADR-018` réintroduit une entité **`vol`** — une ligne d'activité aérienne, exigée par le
> document de cadrage métier des opérations aériennes. Tout le reste de cet ADR reste en
> vigueur : `fiche_vol`, `fiche_vol_signature`, `campagne_fiche_vol_compteur`, le carnet de
> bord, les signatures et les cumuls d'heures restent abandonnés, et la perte de données de la
> migration `0080` reste assumée.

## Contexte

La fiche de vol (journal d'un aéronef sur une journée : vols, rotations rattachées, signatures,
cumuls d'heures) a été cadrée en ADR-011 puis construite (migrations 0029, 0064, 0070, 0078),
avec une saisie mobile et une consultation web. Décision produit : la retirer entièrement, en
conservant la **gestion d'équipe aérienne** (équipes, aéronefs, bases, stands) et les
**lieux aériens**, ainsi que l'entrée de menu web « Heures de vol ».

## Décision

- **Base** : la migration `0080` supprime `vol`, `fiche_vol_signature`, `fiche_vol` et
  `campagne_fiche_vol_compteur` (aucune autre table n'y pointait). Les données existantes sont
  **perdues** ; sauvegarde `pg_dump` préalable obligatoire. `downgrade` lève
  `NotImplementedError` : la seule marche arrière est la restauration de la sauvegarde.
- **Conservés** : `aeronef`, `equipe_aerienne` (+ membres), `base_aerienne`, `stand_remplissage`,
  `lieu_aerien`, `traitement_bloc`, `traitement_rotation.bloc_id`.
- **Backend** : routes `/fiches-vol*` retirées, code domaine/use cases/repositories supprimé.
- **Web** : pages liste/détail/vue A4 supprimées ; « Heures de vol » mène à une page
  « Bientôt disponible » (chemin `/fiches-vol` conservé).
- **Mobile** : parcours de saisie supprimé ; l'écran de gestion des équipes, bases et stands est
  conservé (`(app)/equipes-aeriennes`, tuile « Équipes aériennes » de l'accueil).

## Conséquences

- `FicheType.VOL` (`audit_log.fiche_type`) et son CHECK (migration 0010) restent : valeur morte,
  sans effet, évitant une modification de contrainte sur une table d'audit.
- Les applications mobiles déjà installées qui appellent `/fiches-vol` reçoivent des 404 tant
  qu'elles ne sont pas mises à jour.
- Le cahier des charges source (`docs/IFVM_fiche de vol (1).md`) est conservé pour une éventuelle
  reprise.
