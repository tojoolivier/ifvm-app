"""pesticide : type de produit (choc / barrière)

Classification demandée côté administration web pour distinguer, dans le
référentiel pesticide, les produits de choc (action rapide, traitement
d'urgence) des produits barrière (action rémanente, prévention). Nullable :
les pesticides déjà enregistrés n'ont pas cette classification et ne peuvent
pas être rétro-déduits automatiquement — seules les créations/modifications à
venir la renseignent, via un `select` fermé côté formulaire (#recherche-tri-
pagination).

Même gabarit que `code_stade.categorie` (migration 0030) : colonne texte
nullable + CHECK plutôt qu'un type ENUM Postgres, pour rester alignable sans
migration de type si un troisième type de produit apparaît un jour.

N'est PAS exposée dans `PesticideSyncRead` (`GET /referentiel/pull`) : c'est
une classification d'administration web, sans usage mobile identifié à ce
jour — l'ajouter au pull imposerait de la répercuter dans le SQLite hors-ligne
(`referentiel-db.ts`) pour rien.

Revision ID: 0044
Revises: 0043
Create Date: 2026-09-03

"""

import sqlalchemy as sa

from alembic import op

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pesticide", sa.Column("type_produit", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_pesticide_type_produit",
        "pesticide",
        "type_produit IN ('produit_choc', 'produit_barriere')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_pesticide_type_produit", "pesticide", type_="check")
    op.drop_column("pesticide", "type_produit")
