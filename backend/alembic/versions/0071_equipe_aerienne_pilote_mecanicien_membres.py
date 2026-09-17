"""equipe_aerienne : pilote/mécanicien/consultant international + membres

Demande explicite (2026-09-17) : une équipe aérienne doit porter, en plus du
chef de base déjà modélisé (migration 0066), un pilote et un mécanicien
(obligatoires côté API pour toute nouvelle équipe), un consultant international
(facultatif), et un nombre variable d'« autres membres ».

`pilote`/`mecanicien`/`consultant_international` : colonnes texte libre sur
`equipe_aerienne`, même patron que partout ailleurs dans le domaine aérien
(`fiche_vol.pilote`/`.mecanicien`, `traitement_aerien.pilote`/`.mecanicien`) —
externes à l'IFVM, pas des comptes `utilisateur`. Nullable en base : les
équipes déjà créées avant cette migration n'ont pas ces informations, et
rendre la colonne NOT NULL sans backfill possible les invaliderait. La
contrainte « obligatoire pour une nouvelle équipe » est portée par
`EquipeAerienneCreate` (Pydantic), pas par la base — même choix que
`chef_de_base_id` doit référencer un utilisateur de rôle `chef_de_base`,
non exprimable en `CHECK` (référence une autre table) et déjà porté par
l'application (`CreateEquipeAerienne.execute`).

`equipe_aerienne_membre` : table fille pour les « autres membres », plutôt
qu'une colonne texte concaténée sur `equipe_aerienne` — un nombre variable de
membres est une dépendance fonctionnelle multivaluée ; la stocker dans une
seule colonne violerait la 1FN (repeating group) et rendrait chaque membre
impossible à identifier/supprimer individuellement. Même patron que
`fiche_vol_signature`/`traitement_rotation` : entité faible de son parent,
`ON DELETE CASCADE`.

Revision ID: 0071
Revises: 0070
Create Date: 2026-09-17

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0071"
down_revision = "0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipe_aerienne", sa.Column("pilote", sa.Text(), nullable=True))
    op.add_column("equipe_aerienne", sa.Column("mecanicien", sa.Text(), nullable=True))
    op.add_column(
        "equipe_aerienne", sa.Column("consultant_international", sa.Text(), nullable=True)
    )

    op.create_table(
        "equipe_aerienne_membre",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "equipe_aerienne_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("equipe_aerienne.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_equipe_aerienne_membre_equipe_aerienne_id",
        "equipe_aerienne_membre",
        ["equipe_aerienne_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_equipe_aerienne_membre_equipe_aerienne_id", table_name="equipe_aerienne_membre"
    )
    op.drop_table("equipe_aerienne_membre")
    op.drop_column("equipe_aerienne", "consultant_international")
    op.drop_column("equipe_aerienne", "mecanicien")
    op.drop_column("equipe_aerienne", "pilote")
