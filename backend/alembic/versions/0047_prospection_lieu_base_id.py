"""prospection.base/base_secondaire remplacés par lieu_base_id (référentiel lieu_aerien)

Portage partiel de la décision produit "bases aériennes / stands" (issue de la
migration `0046_lieu_aerien_equipe_pesticides_rotation.py` d'une branche non
fusionnée, `feature/base-aerienne-equipe-pesticides`, dont le numéro de
révision entrait en collision avec le `0046` de cette base — cf. `stades_imago`
mergé entre-temps) — **strictement limité au périmètre Prospection** :

- `lieu_aerien` : nouvelle table référentielle unique, typée par `type_lieu` IN
  ('principale','secondaire','stand') plutôt que trois tables séparées — même
  choix que `prospection.type_prospection` (ADR-006). Durable, indépendante de
  la campagne, soft-delete via `actif` (pattern déjà en place pour
  pesticide/culture/poste_acridien/station_fixe). Synchronisée en local mobile
  via `GET /referentiel/pull`, comme les autres référentiels de saisie terrain.
- `prospection.lieu_base_id` (nullable, remplace `base`/`base_secondaire` en
  texte libre) : nullable car la prospection extensive aérienne "généralisée"
  (début/fin de campagne) n'est rattachée à aucune base. Pas de base
  secondaire côté prospection — ce concept n'existe que pour le traitement.

Hors périmètre de cette migration (laissé à une éventuelle migration
ultérieure, non traité ici) : tout ce qui touche `traitement_aerien`/
`traitement_rotation`/`utilisateur` sur la branche source (FK équipe,
pesticides, rotations) — `lieu_aerien` n'a ici aucun autre consommateur que
`prospection`.

Revision ID: 0047
Revises: 0046
Create Date: 2026-09-05

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lieu_aerien",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("type_lieu", sa.Text(), nullable=False),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=False),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "type_lieu IN ('principale','secondaire','stand')", name="ck_lieu_aerien_type"
        ),
    )

    op.add_column(
        "prospection",
        sa.Column(
            "lieu_base_id", UUID(as_uuid=True), sa.ForeignKey("lieu_aerien.id"), nullable=True
        ),
    )
    op.drop_column("prospection", "base")
    op.drop_column("prospection", "base_secondaire")


def downgrade() -> None:
    op.add_column("prospection", sa.Column("base_secondaire", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("base", sa.Text(), nullable=True))
    op.drop_column("prospection", "lieu_base_id")
    op.drop_table("lieu_aerien")
