"""fiche_vol : référence optionnelle à une prospection (en-tête)

Cahier des charges « Fiche de vol » (2026-09-17) : la section Référence porte
trois champs récupérés automatiquement à partir de la fiche de prospection
traitée ce jour-là — numéro de fiche de prospection, numéro de fiche de
validation, date de validation. Aucune de ces trois valeurs n'a de colonne
propre : elles se dérivent par jointure sur `prospection` (n_fiche,
validated_at — mêmes colonnes, pas de "fiche de validation" séparée dans le
modèle existant), exactement comme `base_numero`/`stand_numero` se dérivent
déjà de `base_aerienne`/`stand_remplissage` (migration 0064).

`prospection_id` est nullable et n'a pas vocation à contraindre les vols
individuels de la fiche : `vol.prospection_id`/`vol.rotation_id` (inchangés)
restent le rattachement réel de chaque vol à sa propre prospection/rotation.
Ce nouveau champ est seulement la prospection "principale" affichée en
en-tête de la fiche — même rôle que `traitement.prospection_id`, qui, lui,
est la seule prospection d'un CRT (cardinalité différente : un CRT = une
prospection, une fiche de vol peut couvrir plusieurs prospections via ses
vols, mais n'en affiche qu'une en référence).

ON DELETE SET NULL (comme `vol.prospection_id`) : une prospection supprimée
ne doit pas emporter la fiche de vol avec elle, seulement sa référence.

Revision ID: 0070
Revises: 0069
Create Date: 2026-09-17

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0070"
down_revision = "0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fiche_vol",
        sa.Column("prospection_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_fiche_vol_prospection_id",
        "fiche_vol",
        "prospection",
        ["prospection_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_fiche_vol_prospection_id", "fiche_vol", ["prospection_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_fiche_vol_prospection_id", table_name="fiche_vol")
    op.drop_constraint("fk_fiche_vol_prospection_id", "fiche_vol", type_="foreignkey")
    op.drop_column("fiche_vol", "prospection_id")
