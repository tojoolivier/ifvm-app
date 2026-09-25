"""mouvement_pesticide.traitement_id : rattachement à la fiche d'origine

Ticket #609 (parent #592). Un traitement aérien va désormais générer ses propres
mouvements `consommation` (débités automatiquement des rotations de la fiche, cf.
migration suivante 0094 qui retire `pesticide_recu_l`/`pesticide_stock_restant_l`
de `traitement_aerien`). Sans rattachement, ces mouvements générés seraient
indiscernables d'une saisie manuelle et invisibles depuis la fiche qui les a
produits — impossible de les retrouver pour les régénérer quand une rotation est
modifiée ou supprimée (AC #609).

## Ce que fait cette migration

Ajoute `mouvement_pesticide.traitement_id`, FK nullable vers `traitement.id` :

- **Nullable** : tous les mouvements manuels (`approvisionnement`, `transfert`,
  saisis via `POST /mouvements-pesticide`) n'ont pas de fiche d'origine — seuls les
  mouvements `consommation` générés depuis une fiche aérienne le renseignent.
- **`ondelete=CASCADE`** : supprimer une fiche traitement aérien (hors périmètre
  actuel, aucune route ne le permet) supprimerait ses mouvements de consommation —
  ils n'ont pas de sens sans la fiche qui les a produits, contrairement à un
  mouvement manuel.
- Aucun backfill : les mouvements existants sont tous antérieurs à cette migration,
  donc tous manuels (`traitement_id` reste NULL) — la génération automatique par
  fiche n'existait pas avant #609.
- Exception ponctuelle à « aucune mise à jour ni suppression de mouvement »
  (docstring de la migration 0090, #606) : les mouvements `consommation` rattachés
  à `traitement_id` sont régénérés (supprimés puis recréés) à chaque écriture sur
  les rotations de la fiche — ils ne sont jamais saisis à la main, ils suivent le
  cycle de vie de ce qui les a produits. Les mouvements manuels restent, eux,
  définitifs.

Revision ID: 0093
Revises: 0092
Create Date: 2026-09-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0093"
down_revision = "0092"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mouvement_pesticide", sa.Column("traitement_id", UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_mouvement_pesticide_traitement_id",
        "mouvement_pesticide",
        "traitement",
        ["traitement_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_mouvement_pesticide_traitement_id", "mouvement_pesticide", ["traitement_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_mouvement_pesticide_traitement_id", table_name="mouvement_pesticide")
    op.drop_constraint(
        "fk_mouvement_pesticide_traitement_id", "mouvement_pesticide", type_="foreignkey"
    )
    op.drop_column("mouvement_pesticide", "traitement_id")
