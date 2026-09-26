"""mouvement_pesticide : stock de pesticides par site aérien principal

Ticket #606 (parent #592). Aujourd'hui : aucun objet stock. `traitement_aerien`
porte `pesticide_recu_l`/`pesticide_stock_restant_l`, un stock photographié par
fiche, sans continuité d'un traitement au suivant, sans traçabilité des entrées,
sans rattachement à un lieu. Le document de cadrage demande l'inverse : la gestion
des pesticides centralisée au niveau de la base aérienne principale, transferts,
chargements et consommations tracés.

## Ce que fait cette migration

Crée `mouvement_pesticide(id, type, pesticide_id, site_id, site_destination_id,
quantite, unite, date_mouvement, created_at)` :

- `type` : `approvisionnement` (entrée, origine hors système), `transfert` (entre
  deux sites), `consommation` (sortie) — `ck_mouvement_pesticide_type`.
- `unite` : reprend le vocabulaire de `traitement_rotation.unite`
  (`ck_traitement_rotation_unite`) — `L` ou `kg`, jamais additionnées entre elles
  (`ck_mouvement_pesticide_unite`).
- `site_destination_id` renseigné si et seulement si `type = 'transfert'`
  (`ck_mouvement_pesticide_destination_coherente`).
- Aucune colonne « stock actuel » dénormalisée : le solde par (site, pesticide,
  unité) se calcule par agrégation à la lecture (décision actée, #606).
- Le garde-fou « stock rattaché au site principal » (un mouvement visant un site
  secondaire/stand est refusé) n'est pas exprimable en CHECK SQL sans jointure sur
  `site_aerienne.parent_site_id` — validé côté application
  (`SiteNonPrincipalError`), même patron que les garde-fous d'équipe de 0066/0086.
- Aucune mise à jour ni suppression de mouvement : une correction passe par un
  mouvement compensatoire, pas par une modification de l'historique — pas de route
  PUT/DELETE côté API.

Revision ID: 0090
Revises: 0089
Create Date: 2026-09-22
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0090"
down_revision = "0089"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mouvement_pesticide",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("pesticide_id", UUID(as_uuid=True), nullable=False),
        sa.Column("site_id", UUID(as_uuid=True), nullable=False),
        sa.Column("site_destination_id", UUID(as_uuid=True), nullable=True),
        sa.Column("quantite", sa.Numeric(10, 2), nullable=False),
        sa.Column("unite", sa.String(2), nullable=False),
        sa.Column("date_mouvement", sa.Date(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["pesticide_id"],
            ["pesticide.id"],
            name="fk_mouvement_pesticide_pesticide_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["site_id"],
            ["site_aerienne.id"],
            name="fk_mouvement_pesticide_site_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["site_destination_id"],
            ["site_aerienne.id"],
            name="fk_mouvement_pesticide_site_destination_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "type IN ('approvisionnement', 'transfert', 'consommation')",
            name="ck_mouvement_pesticide_type",
        ),
        sa.CheckConstraint("unite IN ('L', 'kg')", name="ck_mouvement_pesticide_unite"),
        sa.CheckConstraint(
            "(type = 'transfert' AND site_destination_id IS NOT NULL) OR "
            "(type != 'transfert' AND site_destination_id IS NULL)",
            name="ck_mouvement_pesticide_destination_coherente",
        ),
    )
    op.create_index("ix_mouvement_pesticide_site_id", "mouvement_pesticide", ["site_id"])
    op.create_index(
        "ix_mouvement_pesticide_site_destination_id",
        "mouvement_pesticide",
        ["site_destination_id"],
    )
    op.create_index("ix_mouvement_pesticide_pesticide_id", "mouvement_pesticide", ["pesticide_id"])


def downgrade() -> None:
    op.drop_table("mouvement_pesticide")
