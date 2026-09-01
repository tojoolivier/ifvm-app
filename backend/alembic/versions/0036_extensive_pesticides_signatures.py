"""extensive (mode aérien) : pesticides embarqués + signatures

Poursuit la migration 0035 (mode aérien) — ajoute à la fiche de prospection
extensive aérienne :

- Un bloc « Pesticides embarqués » (OUI/NON + détail si OUI : nom commercial,
  quantités disponible/reçue, nombre de fûts par état). Comme `mode_extensif`
  et les 7 champs équipe/aéronef (migration 0035), un seul jeu de valeurs par
  fiche (non répétable) → colonnes nullables directes sur `prospection`, pas
  de table séparée. Rien n'est CHECK-lié à `mode_extensif` : la fiche
  terrestre n'écrit simplement jamais ces colonnes (même principe que les 7
  champs équipe/aéronef, jamais liés non plus).
- Un bloc « Signatures » (VISA, Consultant FAO, Pilote, Chef de base),
  indépendant du choix Pesticides. Réutilise le pattern déjà en place pour
  `traitement_signature` (nom du signataire + horodatage), mais en colonnes
  nommées à plat plutôt qu'une table enfant à `role` libre : ici l'ensemble
  des rôles est fixe et connu (4, jamais plus), contrairement aux rôles de
  traitement qui varient par type de fiche — cohérent avec le choix déjà fait
  pour l'équipe/aéronef (societe/pilote/mecanicien/chef_de_base... eux aussi
  un jeu fixe de champs nommés, pas une liste).

Revision ID: 0036
Revises: 0035
Create Date: 2026-09-01

"""

import sqlalchemy as sa

from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # Pesticides embarqués (mode aérien)
    # ==========================================
    op.add_column("prospection", sa.Column("pesticides_embarques", sa.Boolean(), nullable=True))
    op.add_column("prospection", sa.Column("pesticide_nom_commercial", sa.Text(), nullable=True))
    op.add_column(
        "prospection", sa.Column("pesticide_quantite_disponible", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "prospection", sa.Column("pesticide_quantite_recue", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column("prospection", sa.Column("futs_disponible", sa.Integer(), nullable=True))
    op.add_column("prospection", sa.Column("futs_pleins", sa.Integer(), nullable=True))
    op.add_column("prospection", sa.Column("futs_vides", sa.Integer(), nullable=True))
    op.add_column("prospection", sa.Column("futs_recues", sa.Integer(), nullable=True))

    op.create_check_constraint(
        "ck_prospection_pesticide_quantite_disponible",
        "prospection",
        "pesticide_quantite_disponible IS NULL OR pesticide_quantite_disponible >= 0",
    )
    op.create_check_constraint(
        "ck_prospection_pesticide_quantite_recue",
        "prospection",
        "pesticide_quantite_recue IS NULL OR pesticide_quantite_recue >= 0",
    )
    op.create_check_constraint(
        "ck_prospection_futs_disponible",
        "prospection",
        "futs_disponible IS NULL OR futs_disponible >= 0",
    )
    op.create_check_constraint(
        "ck_prospection_futs_pleins", "prospection", "futs_pleins IS NULL OR futs_pleins >= 0"
    )
    op.create_check_constraint(
        "ck_prospection_futs_vides", "prospection", "futs_vides IS NULL OR futs_vides >= 0"
    )
    op.create_check_constraint(
        "ck_prospection_futs_recues", "prospection", "futs_recues IS NULL OR futs_recues >= 0"
    )

    # ==========================================
    # Signatures (mode aérien) — indépendantes du choix Pesticides
    # ==========================================
    op.add_column("prospection", sa.Column("signature_visa_nom", sa.Text(), nullable=True))
    op.add_column(
        "prospection",
        sa.Column("signature_visa_horodatage", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "prospection", sa.Column("signature_consultant_fao_nom", sa.Text(), nullable=True)
    )
    op.add_column(
        "prospection",
        sa.Column(
            "signature_consultant_fao_horodatage", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    op.add_column("prospection", sa.Column("signature_pilote_nom", sa.Text(), nullable=True))
    op.add_column(
        "prospection",
        sa.Column("signature_pilote_horodatage", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column("prospection", sa.Column("signature_chef_base_nom", sa.Text(), nullable=True))
    op.add_column(
        "prospection",
        sa.Column("signature_chef_base_horodatage", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospection", "signature_chef_base_horodatage")
    op.drop_column("prospection", "signature_chef_base_nom")
    op.drop_column("prospection", "signature_pilote_horodatage")
    op.drop_column("prospection", "signature_pilote_nom")
    op.drop_column("prospection", "signature_consultant_fao_horodatage")
    op.drop_column("prospection", "signature_consultant_fao_nom")
    op.drop_column("prospection", "signature_visa_horodatage")
    op.drop_column("prospection", "signature_visa_nom")

    op.drop_constraint("ck_prospection_futs_recues", "prospection", type_="check")
    op.drop_constraint("ck_prospection_futs_vides", "prospection", type_="check")
    op.drop_constraint("ck_prospection_futs_pleins", "prospection", type_="check")
    op.drop_constraint("ck_prospection_futs_disponible", "prospection", type_="check")
    op.drop_constraint("ck_prospection_pesticide_quantite_recue", "prospection", type_="check")
    op.drop_constraint("ck_prospection_pesticide_quantite_disponible", "prospection", type_="check")

    op.drop_column("prospection", "futs_recues")
    op.drop_column("prospection", "futs_vides")
    op.drop_column("prospection", "futs_pleins")
    op.drop_column("prospection", "futs_disponible")
    op.drop_column("prospection", "pesticide_quantite_recue")
    op.drop_column("prospection", "pesticide_quantite_disponible")
    op.drop_column("prospection", "pesticide_nom_commercial")
    op.drop_column("prospection", "pesticides_embarques")
