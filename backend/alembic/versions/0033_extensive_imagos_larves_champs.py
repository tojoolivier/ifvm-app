"""prospection_population : type_cible, direction, état/comportement, surface contaminée

La fiche Extensive (imagos/larves) n'a pas d'écran Infestation séparé comme
l'Intensif : ces informations vivent directement sur la ligne `prospection_population`
de l'espèce/catégorie concernée, une par (prospection_id, espece, categorie) — donc déjà
naturellement indépendantes entre LMC et NSE, sans effort supplémentaire.

Imagos (par espèce) :
- `type_cible` remplace l'ancien `essaim_observe` (booléen à 2 états) par les 3 mêmes
  valeurs que l'Infestation intensive (cf. migration 0031) : vol_clair/dense/tres_dense.
  `essaim_observe` n'est pas supprimée (pas de perte pour les fiches déjà enregistrées),
  simplement plus alimentée par l'écran.
- `direction_de`/`direction_vers` et `etat` (repos/deplacement, même vocabulaire que
  `prospection_infestation.comportement`) modélisent le même « État → Direction du
  déplacement » que l'Infestation intensive.
- `essaim_en_vol`/`essaim_pose` : comportement de l'essaim, dérivé automatiquement de
  `etat` côté mobile (repos -> posé, déplacement -> en vol), mêmes noms que les colonnes
  homologues de `prospection_infestation` pour rester cohérent dans tout le schéma.
- `interdistance` existe déjà sur cette table (utilisée par les larves) : réutilisée
  telle quelle pour les imagos, chaque ligne espece+categorie restant indépendante.

Larves :
- `surface_contaminee_ha` : absente de `prospection_population` (elle n'existe que sur
  `prospection_infestation`, table que l'extensif n'utilise pas pour les larves).

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-26

"""

import sqlalchemy as sa

from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection_population",
        sa.Column("type_cible", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "ck_prospection_population_type_cible",
        "prospection_population",
        "type_cible IN ('vol_clair','dense','tres_dense')",
    )

    op.add_column(
        "prospection_population",
        sa.Column("direction_de", sa.Text(), nullable=True),
    )
    op.add_column(
        "prospection_population",
        sa.Column("direction_vers", sa.Text(), nullable=True),
    )

    op.add_column(
        "prospection_population",
        sa.Column("etat", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "ck_prospection_population_etat",
        "prospection_population",
        "etat IN ('repos','deplacement')",
    )

    op.add_column(
        "prospection_population",
        sa.Column("essaim_en_vol", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "prospection_population",
        sa.Column("essaim_pose", sa.Boolean(), nullable=True),
    )

    op.add_column(
        "prospection_population",
        sa.Column("surface_contaminee_ha", sa.Numeric(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospection_population", "surface_contaminee_ha")
    op.drop_column("prospection_population", "essaim_pose")
    op.drop_column("prospection_population", "essaim_en_vol")
    op.drop_constraint("ck_prospection_population_etat", "prospection_population", type_="check")
    op.drop_column("prospection_population", "etat")
    op.drop_column("prospection_population", "direction_vers")
    op.drop_column("prospection_population", "direction_de")
    op.drop_constraint(
        "ck_prospection_population_type_cible", "prospection_population", type_="check"
    )
    op.drop_column("prospection_population", "type_cible")
