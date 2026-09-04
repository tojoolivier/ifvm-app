"""traitement_rotation : quantite+unite, surface_ha, heures de vanne

Chaque rotation aérienne ne portait qu'une quantité en litres (`quantite_l`), sans
superficie traitée ni heures d'ouverture/fermeture de vanne — seulement les heures de
la rotation entière (heure_debut/heure_fin, migration 0035). Le nouvel écran mobile
« Pesticides & rotations » (#Ticket 6/7) a besoin de :

- `quantite` + `unite` (L/kg) : remplace `quantite_l`, pour permettre un pesticide dosé
  au poids (poudre) aussi bien qu'au volume (ULV) — renommage sans perte (RENAME COLUMN),
  toutes les valeurs existantes étant implicitement en litres.
- `surface_ha` : superficie traitée par la rotation elle-même — `traitement_aerien.
  surface_traitee_ha` cesse d'être une saisie directe et devient la somme de ces valeurs
  (calculée côté application, cf. `TraitementAerien.recalculer_totaux`), même patron que
  `total_pesticide_l`/`nb_rotations` déjà dérivés à l'écriture.
- `heure_ouverture_vanne`/`heure_fermeture_vanne` : bornent la phase d'épandage effective
  à l'intérieur de la rotation, distinctes de heure_debut/heure_fin qui bornent la
  rotation entière (mise en place + épandage + repli).

Colonnes ajoutées NOT NULL avec un server_default temporaire (retiré ensuite) — même
patron que la migration 0035 pour heure_debut/heure_fin sur cette même table.

Revision ID: 0047
Revises: 0046
Create Date: 2026-09-04

"""

import sqlalchemy as sa

from alembic import op

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("traitement_rotation", "quantite_l", new_column_name="quantite")

    op.add_column(
        "traitement_rotation",
        sa.Column("unite", sa.String(length=2), nullable=False, server_default="L"),
    )
    op.alter_column("traitement_rotation", "unite", server_default=None)
    op.create_check_constraint(
        "ck_traitement_rotation_unite",
        "traitement_rotation",
        "unite IN ('L', 'KG')",
    )

    op.add_column(
        "traitement_rotation",
        sa.Column("surface_ha", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.alter_column("traitement_rotation", "surface_ha", server_default=None)

    op.add_column(
        "traitement_rotation",
        sa.Column("heure_ouverture_vanne", sa.Time(), nullable=False, server_default="00:00:00"),
    )
    op.add_column(
        "traitement_rotation",
        sa.Column("heure_fermeture_vanne", sa.Time(), nullable=False, server_default="00:01:00"),
    )
    op.alter_column("traitement_rotation", "heure_ouverture_vanne", server_default=None)
    op.alter_column("traitement_rotation", "heure_fermeture_vanne", server_default=None)
    op.create_check_constraint(
        "ck_traitement_rotation_heures_vanne",
        "traitement_rotation",
        "heure_fermeture_vanne > heure_ouverture_vanne",
    )

    op.add_column(
        "traitement_aerien",
        sa.Column("total_pesticide_kg", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("traitement_aerien", "total_pesticide_kg")

    op.drop_constraint("ck_traitement_rotation_heures_vanne", "traitement_rotation", type_="check")
    op.drop_column("traitement_rotation", "heure_fermeture_vanne")
    op.drop_column("traitement_rotation", "heure_ouverture_vanne")

    op.drop_column("traitement_rotation", "surface_ha")

    op.drop_constraint("ck_traitement_rotation_unite", "traitement_rotation", type_="check")
    op.drop_column("traitement_rotation", "unite")

    op.alter_column("traitement_rotation", "quantite", new_column_name="quantite_l")
