"""equipe_aeronef.updated_at : rendre la clôture d'une affectation visible du pull

Ticket #638 (parent #592). `GET /referentiel/pull` est incrémental sur un curseur
`updated_at`. `equipe_aeronef` n'avait que `created_at` : clôturer une affectation
(`date_fin`) modifie la ligne sans rien changer de ce que le curseur voit, donc un
mobile déjà synchronisé aurait gardé l'affectation « en cours » à jamais.

Les lignes existantes sont initialisées à `created_at` : un mobile qui a déjà tiré
le référentiel n'a de toute façon pas ces lignes (la collection n'existait pas), son
premier pull passe `since=NULL`.
"""

import sqlalchemy as sa

from alembic import op

revision = "0096"
down_revision = "0095"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "equipe_aeronef",
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.execute("UPDATE equipe_aeronef SET updated_at = created_at WHERE created_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("equipe_aeronef", "updated_at")
