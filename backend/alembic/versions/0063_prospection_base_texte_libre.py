"""prospection : base aérienne redevient du texte libre

Défait la partie "prospection" de la migration 0047 — même décision produit,
même mécanique que la migration 0054 (traitement_aerien_lieux_texte_libre),
qui avait déjà fait cette même bascule référentiel-FK -> texte-libre pour
`traitement_aerien` en laissant expressément `prospection.lieu_base_id` hors
périmètre à l'époque (cf. docstring 0054 : "hors périmètre de ce chantier").

`lieu_base_id` (FK vers `lieu_aerien`) est remplacée par la colonne texte
libre `base` : l'agent saisit directement la valeur au moment de la
prospection, sans dépendre du référentiel Web ni d'une synchronisation
préalable — même besoin terrain que pour le traitement aérien.

`lieu_aerien` elle-même n'est PAS supprimée ni dépréciée : elle reste gérée
par le référentiel Web (`referentiel_routes.py`/`referentiel_use_cases.py`),
qui n'est pas dans le périmètre de ce changement — seul l'usage sur
`prospection` est défait, aucune autre table ne référence plus `lieu_aerien`
après cette migration mais l'admin Web continue d'en gérer le contenu.

Backfill (upgrade) : `base` est remplie depuis `lieu_aerien.nom` via la FK
existante avant que celle-ci ne soit supprimée — aucune perte d'information
pour les lignes déjà en base. Nullable (comme `lieu_base_id` l'était déjà :
une opération aérienne "généralisée", début/fin de campagne, n'est rattachée
à aucune base).

Downgrade : ré-ajoute `lieu_base_id` (FK nullable, sans backfill — un nom en
texte libre ne redonne pas un id de façon fiable, même irréversibilité déjà
acceptée par le downgrade de la 0054).

Revision ID: 0063
Revises: 0062
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospection", sa.Column("base", sa.String(255), nullable=True))

    op.execute(
        "UPDATE prospection p SET base = l.nom FROM lieu_aerien l WHERE l.id = p.lieu_base_id"
    )

    op.drop_column("prospection", "lieu_base_id")


def downgrade() -> None:
    op.add_column(
        "prospection",
        sa.Column(
            "lieu_base_id", UUID(as_uuid=True), sa.ForeignKey("lieu_aerien.id"), nullable=True
        ),
    )

    op.drop_column("prospection", "base")
