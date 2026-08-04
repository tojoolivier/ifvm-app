"""add crt (compte rendu de traitement) tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-05

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # TABLE CRT (Compte Rendu de Traitement)
    # ==========================================
    op.create_table(
        "crt",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        # ===== Lien avec la prospection =====
        sa.Column(
            "prospection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero_crt", sa.String(50), nullable=False, unique=True),
        # ===== 1. RÉFÉRENCE =====
        sa.Column(
            "chef_equipe_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
        sa.Column(
            "agent_encadreur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
        sa.Column("date_validation", sa.Date(), nullable=True),
        sa.Column("numero_validation", sa.String(50), nullable=True),
        sa.Column("date_traitement", sa.Date(), nullable=False),
        sa.Column("localite", sa.String(255), nullable=True),
        sa.Column("cr", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("pa_code", sa.String(50), nullable=True),
        sa.Column("za", sa.String(50), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        # ===== 2. CIBLE =====
        sa.Column("espece", sa.String(10), nullable=True),
        sa.Column("phase", sa.String(50), nullable=True),
        sa.Column("surface_infestee_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("densite_ind_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("population_type", sa.String(30), nullable=True),
        # ===== 3. TRAITEMENT =====
        sa.Column("mode_traitement", sa.String(30), nullable=True),
        sa.Column("surface_atomiseur_dos", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_disque_rotatif", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_autre", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_reste_traiter", sa.Numeric(10, 2), nullable=True),
        sa.Column("traitement_debut", sa.Time(), nullable=True),
        sa.Column("traitement_fin", sa.Time(), nullable=True),
        sa.Column("vent", sa.String(50), nullable=True),
        sa.Column("temperature_debut", sa.Numeric(5, 2), nullable=True),
        sa.Column("temperature_fin", sa.Numeric(5, 2), nullable=True),
        sa.Column("taux_mortalite", sa.Numeric(5, 2), nullable=True),
        sa.Column("evaluation_apres_traitement", sa.Text(), nullable=True),
        sa.Column("methode_evaluation", sa.String(30), nullable=True),
        # ===== 4. MOYENS =====
        sa.Column("nb_agents_permanents", sa.Integer(), nullable=True),
        sa.Column("nb_agents_temporaires", sa.Integer(), nullable=True),
        sa.Column("nb_personnel_local", sa.Integer(), nullable=True),
        sa.Column("nb_atomiseur", sa.Integer(), nullable=True),
        sa.Column("essence_litres", sa.Numeric(10, 2), nullable=True),
        sa.Column("nb_disque_rotatif", sa.Integer(), nullable=True),
        sa.Column("nb_piles", sa.Integer(), nullable=True),
        sa.Column("nb_poudreuse_manuelle", sa.Integer(), nullable=True),
        sa.Column("autre_materiel", sa.Text(), nullable=True),
        # ===== Kits de protection =====
        sa.Column("kit_combinaison", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_gants", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_lunettes", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_masques", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_boite", sa.Boolean(), nullable=False, server_default="false"),
        # ===== 5. PESTICIDES =====
        sa.Column("pesticide_id", UUID(as_uuid=True), sa.ForeignKey("pesticide.id"), nullable=True),
        sa.Column("matiere_active", sa.String(255), nullable=True),
        sa.Column("stock_initial_l", sa.Numeric(10, 2), nullable=True),
        sa.Column("approvisionnement_l", sa.Numeric(10, 2), nullable=True),
        sa.Column("produits_consommes_l", sa.Numeric(10, 2), nullable=True),
        sa.Column("stock_final_l", sa.Numeric(10, 2), nullable=True),
        # ===== 6. ZONES EXPOSÉES =====
        sa.Column("zones_exposees", JSONB(), nullable=True),
        # ===== 7. VÉGÉTATION =====
        sa.Column("hauteur_strate_herbeuse_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("hauteur_strate_arboree_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("recouvrement_percent", sa.Integer(), nullable=True),
        # ===== 8. EMPOISONNEMENT =====
        sa.Column("empoisonnement", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("empoisonnement_type", sa.String(30), nullable=True),
        sa.Column("empoisonnement_mode", sa.String(30), nullable=True),
        sa.Column("empoisonnement_autre", sa.Text(), nullable=True),
        # ===== 9. ÉVALUATION DU RISQUE =====
        sa.Column("evaluation_risque", JSONB(), nullable=True),
        # ===== 10. COMPORTEMENT ANORMAL =====
        sa.Column("comportement_anormal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("comportement_non_cibles", JSONB(), nullable=True),
        # ===== 11. MORTALITÉ =====
        sa.Column("mortalite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("mortalite_familles", JSONB(), nullable=True),
        # ===== STATUT =====
        sa.Column("statut", sa.String(30), nullable=False, server_default="brouillon"),
        sa.Column("statut_sync", sa.String(30), nullable=False, server_default="local"),
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
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True),
        sa.Column(
            "validated_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
        sa.Column("validated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        # ===== CONTRAINTES =====
        sa.CheckConstraint(
            "statut IN ('brouillon','en_attente','validee','rejetee')",
            name="ck_crt_statut",
        ),
        sa.CheckConstraint(
            "statut_sync IN ('local','synced','conflict')",
            name="ck_crt_statut_sync",
        ),
        sa.CheckConstraint(
            "espece IN ('LMC','NSE','MELANGE')",
            name="ck_crt_espece",
        ),
        sa.CheckConstraint(
            "population_type IN ('DIFFUSE','GROUPE','TACHE','BANDE')",
            name="ck_crt_population_type",
        ),
        sa.CheckConstraint(
            "mode_traitement IN ('TOTAL','BARRIERE','IRREGULIER')",
            name="ck_crt_mode_traitement",
        ),
        sa.CheckConstraint(
            "methode_evaluation IN ('VISUELLE','COMPTAGE')",
            name="ck_crt_methode_evaluation",
        ),
        sa.CheckConstraint(
            "empoisonnement_type IN ('AGENT','POPULATION')",
            name="ck_crt_empoisonnement_type",
        ),
        sa.CheckConstraint(
            "empoisonnement_mode IN ('INGESTION','INHALATION','CONTACT','AUTRE')",
            name="ck_crt_empoisonnement_mode",
        ),
    )

    # ===== INDEX =====
    op.create_index("ix_crt_prospection_id", "crt", ["prospection_id"])
    op.create_index("ix_crt_numero", "crt", ["numero_crt"])
    op.create_index("ix_crt_date_traitement", "crt", ["date_traitement"])
    op.create_index("ix_crt_statut", "crt", ["statut"])
    op.create_index("ix_crt_created_by", "crt", ["created_by"])

    # ==========================================
    # TABLE CRT_PERSONNEL
    # ==========================================
    op.create_table(
        "crt_personnel",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "crt_id",
            UUID(as_uuid=True),
            sa.ForeignKey("crt.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "utilisateur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False
        ),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "role IN ('AGENT_PERMANENT','AGENT_TEMPORAIRE','PERSONNEL_LOCAL')",
            name="ck_crt_personnel_role",
        ),
        sa.UniqueConstraint("crt_id", "utilisateur_id", "role", name="uq_crt_personnel"),
    )
    op.create_index("ix_crt_personnel_crt_id", "crt_personnel", ["crt_id"])
    op.create_index("ix_crt_personnel_utilisateur", "crt_personnel", ["utilisateur_id"])

    # ==========================================
    # TABLE CRT_MATERIEL
    # ==========================================
    op.create_table(
        "crt_materiel",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "crt_id",
            UUID(as_uuid=True),
            sa.ForeignKey("crt.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type_materiel", sa.String(100), nullable=False),
        sa.Column("quantite", sa.Integer(), nullable=False),
        sa.Column("unite", sa.String(30), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_crt_materiel_crt_id", "crt_materiel", ["crt_id"])


def downgrade() -> None:
    op.drop_table("crt_materiel")
    op.drop_table("crt_personnel")
    op.drop_index("ix_crt_created_by", table_name="crt")
    op.drop_index("ix_crt_statut", table_name="crt")
    op.drop_index("ix_crt_date_traitement", table_name="crt")
    op.drop_index("ix_crt_numero", table_name="crt")
    op.drop_index("ix_crt_prospection_id", table_name="crt")
    op.drop_table("crt")
