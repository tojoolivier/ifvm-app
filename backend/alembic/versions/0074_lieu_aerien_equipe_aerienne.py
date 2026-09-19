"""lieu_aerien.equipe_aerienne_id : rattachement d'un lieu aérien à son équipe

Demande utilisateur (2026-09-19) : identifier, dans le référentiel `lieu_aerien`
(bases principales/secondaires/stands utilisés par la Prospection Extensive
Aérienne, mobile + web), à quelle équipe aérienne appartient chaque lieu.

## Cardinalités (confirmées avec l'utilisateur)

- Une équipe aérienne peut posséder plusieurs lieux (plusieurs bases
  principales, secondaires, stands) : `lieu_aerien.equipe_aerienne_id`
  (nullable, FK simple) **sans UNIQUE** — contrairement à
  `base_aerienne.equipe_id` (1:1, référentiel distinct dédié à la fiche de
  vol, migration 0066). Même principe que `poste_acridien.equipe_terrestre_id`
  (migration 0073) : plusieurs lignes peuvent partager la même équipe.
- Nullable : les lieux déjà en base restent « sans équipe » jusqu'à
  rattachement manuel via l'écran de modification web. Le champ devient
  obligatoire uniquement pour toute nouvelle création (validé côté
  application, `LieuAerienCreate`), pas en base.
- Aucun cycle de FK entre `lieu_aerien` et `equipe_aerienne` (contrairement à
  `poste_acridien`/`equipe_terrestre` via `utilisateur.pa_id`) : pas besoin de
  `use_alter` côté modèle ORM.

Revision ID: 0074
Revises: 0073
Create Date: 2026-09-19

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0074"
down_revision = "0073"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lieu_aerien", sa.Column("equipe_aerienne_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_lieu_aerien_equipe_aerienne_id",
        "lieu_aerien",
        "equipe_aerienne",
        ["equipe_aerienne_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_lieu_aerien_equipe_aerienne_id", "lieu_aerien", ["equipe_aerienne_id"])


def downgrade() -> None:
    op.drop_index("ix_lieu_aerien_equipe_aerienne_id", table_name="lieu_aerien")
    op.drop_constraint("fk_lieu_aerien_equipe_aerienne_id", "lieu_aerien", type_="foreignkey")
    op.drop_column("lieu_aerien", "equipe_aerienne_id")
