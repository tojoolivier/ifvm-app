"""Suppression de la fonctionnalité « fiche de vol / heures de vol »

Abandon de la fiche de vol (ADR-011 §3.1-3.2, 3.4 et 7) : on supprime ses 4 tables.

Supprimées, dans l'ordre imposé par les clés étrangères :
- `vol` (FK vers `fiche_vol`, `traitement_rotation`, `prospection`) ;
- `fiche_vol_signature` (FK vers `fiche_vol`) ;
- `fiche_vol` (FK vers `campagne`, `base_aerienne`, `stand_remplissage`,
  `equipe_aerienne`, `prospection`, `utilisateur`) ;
- `campagne_fiche_vol_compteur` (FK vers `campagne`).

Aucune autre table ne pointe vers elles : les DROP ne cascadent nulle part. Index et
contraintes (uq_vol_rotation_type, ck_fiche_vol_compteur_positif…) partent avec les tables.

CONSERVÉES volontairement — ce sont des référentiels de la gestion d'équipe, pas de la fiche :
`aeronef`, `equipe_aerienne`, `base_aerienne` (+ `equipe_id`), `stand_remplissage`
(+ `equipe_aerienne_id`), `lieu_aerien`, `traitement_bloc`, `traitement_rotation.bloc_id`.

DESTRUCTIF ET IRRÉVERSIBLE : les fiches de vol, vols et signatures existants sont perdus.
Sauvegarder avant d'appliquer :
    pg_dump -t fiche_vol -t vol -t fiche_vol_signature -t campagne_fiche_vol_compteur

Revision ID: 0080
Revises: 0079
Create Date: 2026-09-21

"""

from alembic import op

revision = "0080"
down_revision = "0079"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("vol")
    op.drop_table("fiche_vol_signature")
    op.drop_table("fiche_vol")
    op.drop_table("campagne_fiche_vol_compteur")


def downgrade() -> None:
    raise NotImplementedError(
        "0080 supprime les données des fiches de vol : irréversible. "
        "Restaurer depuis la sauvegarde pg_dump (fiche_vol, vol, fiche_vol_signature, "
        "campagne_fiche_vol_compteur) puis revenir à la révision 0079 avec "
        "`alembic stamp 0079`."
    )
