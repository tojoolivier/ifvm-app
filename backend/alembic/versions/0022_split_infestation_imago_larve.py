"""split prospection_infestation into imago/larve subclass tables (specialization)

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-14

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

IMAGO_COLUMNS = [
    ("pullulation_nb", sa.Integer()),
    ("taille_long", sa.Numeric()),
    ("taille_large", sa.Numeric()),
    ("taille_epaisseur", sa.Numeric()),
    ("essaim_en_vol", sa.Boolean()),
    ("essaim_pose", sa.Boolean()),
    ("type_essaim", sa.Text()),
    ("heure_observation", sa.Text()),
    ("densite_en_vol", sa.Numeric()),
    ("dimension_ha", sa.Numeric()),
]

LARVE_COLUMNS = [
    ("nb_taches_bandes", sa.Integer()),
    ("interdistance_m", sa.Numeric()),
    ("interdistance_min", sa.Numeric()),
    ("interdistance_max", sa.Numeric()),
    ("interdistance_moy", sa.Numeric()),
    ("surface_contaminee_ha", sa.Numeric()),
    ("surf_infestee_pourcent", sa.Numeric()),
    ("type_larve", sa.Text()),
    ("stade_dominant", sa.Text()),
    ("taille_groupe_m2", sa.Numeric()),
    ("front_longueur_m", sa.Numeric()),
    ("front_largeur_m", sa.Numeric()),
    ("densite_max_front", sa.Numeric()),
    ("densite_moy_arriere_front", sa.Numeric()),
]


def upgrade() -> None:
    op.create_table(
        "prospection_infestation_imago",
        sa.Column(
            "infestation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection_infestation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        *(sa.Column(name, coltype, nullable=True) for name, coltype in IMAGO_COLUMNS),
        sa.CheckConstraint(
            "type_essaim IN ('vol_clair', 'dense', 'tres_dense')",
            name="ck_prospection_infestation_imago_type_essaim",
        ),
    )
    op.create_table(
        "prospection_infestation_larve",
        sa.Column(
            "infestation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection_infestation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        *(sa.Column(name, coltype, nullable=True) for name, coltype in LARVE_COLUMNS),
        sa.CheckConstraint(
            "type_larve IN ('tache_larvaire', 'bande_larvaire')",
            name="ck_prospection_infestation_larve_type_larve",
        ),
    )

    imago_cols_sql = ", ".join(name for name, _ in IMAGO_COLUMNS)
    imago_not_null = " OR ".join(f"{name} IS NOT NULL" for name, _ in IMAGO_COLUMNS)
    op.execute(
        f"""
        INSERT INTO prospection_infestation_imago (infestation_id, {imago_cols_sql})
        SELECT id, {imago_cols_sql}
        FROM prospection_infestation
        WHERE {imago_not_null}
        """
    )

    larve_cols_sql = ", ".join(name for name, _ in LARVE_COLUMNS)
    larve_not_null = " OR ".join(f"{name} IS NOT NULL" for name, _ in LARVE_COLUMNS)
    op.execute(
        f"""
        INSERT INTO prospection_infestation_larve (infestation_id, {larve_cols_sql})
        SELECT id, {larve_cols_sql}
        FROM prospection_infestation
        WHERE {larve_not_null}
        """
    )

    op.drop_constraint(
        "ck_prospection_infestation_type_essaim", "prospection_infestation", type_="check"
    )
    op.drop_constraint(
        "ck_prospection_infestation_type_larve", "prospection_infestation", type_="check"
    )

    for name, _ in IMAGO_COLUMNS + LARVE_COLUMNS:
        op.drop_column("prospection_infestation", name)


def downgrade() -> None:
    for name, coltype in IMAGO_COLUMNS + LARVE_COLUMNS:
        op.add_column("prospection_infestation", sa.Column(name, coltype, nullable=True))

    op.create_check_constraint(
        "ck_prospection_infestation_type_essaim",
        "prospection_infestation",
        "type_essaim IN ('vol_clair', 'dense', 'tres_dense')",
    )
    op.create_check_constraint(
        "ck_prospection_infestation_type_larve",
        "prospection_infestation",
        "type_larve IN ('tache_larvaire', 'bande_larvaire')",
    )

    imago_cols_sql = ", ".join(name for name, _ in IMAGO_COLUMNS)
    op.execute(
        f"""
        UPDATE prospection_infestation AS pi
        SET ({imago_cols_sql}) = ({", ".join(f"imago.{name}" for name, _ in IMAGO_COLUMNS)})
        FROM prospection_infestation_imago AS imago
        WHERE imago.infestation_id = pi.id
        """
    )

    larve_cols_sql = ", ".join(name for name, _ in LARVE_COLUMNS)
    op.execute(
        f"""
        UPDATE prospection_infestation AS pi
        SET ({larve_cols_sql}) = ({", ".join(f"larve.{name}" for name, _ in LARVE_COLUMNS)})
        FROM prospection_infestation_larve AS larve
        WHERE larve.infestation_id = pi.id
        """
    )

    op.drop_table("prospection_infestation_larve")
    op.drop_table("prospection_infestation_imago")
