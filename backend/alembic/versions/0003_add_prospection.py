"""add prospection tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-24

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prospection",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type_prospection", sa.Text(), nullable=False),
        sa.Column("campagne_id", UUID(as_uuid=True), sa.ForeignKey("campagne.id"), nullable=False),
        sa.Column("prospecteur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("station_id", UUID(as_uuid=True), nullable=True),
        sa.Column("n_releve", sa.Text(), nullable=True),
        sa.Column("n_fiche", sa.Text(), nullable=True),
        sa.Column("n_message", sa.Text(), nullable=True),
        sa.Column("date_prospection", sa.Date(), nullable=False),
        sa.Column("latitude", sa.Numeric(), nullable=True),
        sa.Column("longitude", sa.Numeric(), nullable=True),
        sa.Column("altitude", sa.Numeric(), nullable=True),
        sa.Column("biotope", sa.Text(), nullable=True),
        sa.Column("surf_station", sa.Numeric(), nullable=True),
        sa.Column("surf_prospectee", sa.Numeric(), nullable=True),
        sa.Column("surf_infestee", sa.Numeric(), nullable=True),
        sa.Column("degats_cultures", sa.Text(), nullable=True),
        sa.Column("derniere_pluie", sa.Date(), nullable=True),
        sa.Column("intensite_pluie", sa.Text(), nullable=True),
        sa.Column("vegetation", JSONB(), nullable=True),
        sa.Column("sol", JSONB(), nullable=True),
        sa.Column("ennemis_naturels", sa.Text(), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("statut", sa.Text(), nullable=False, server_default="brouillon"),
        sa.Column("statut_sync", sa.Text(), nullable=False, server_default="local"),
        sa.Column("verified_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True),
        sa.Column("verified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("validated_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True),
        sa.Column("validated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "type_prospection IN ('intensive','extensive','validation')",
            name="ck_prospection_type_prospection",
        ),
        sa.CheckConstraint(
            "statut IN ('brouillon','en_attente','verifiee','validee','rejetee')",
            name="ck_prospection_statut",
        ),
        sa.CheckConstraint(
            "statut_sync IN ('local','synced','conflict')",
            name="ck_prospection_statut_sync",
        ),
        sa.CheckConstraint(
            "degats_cultures IN ('nuls','faibles','moyens','forts')",
            name="ck_prospection_degats_cultures",
        ),
    )
    op.create_index("ix_prospection_type_statut", "prospection", ["type_prospection", "statut"])
    op.create_index("ix_prospection_campagne_id", "prospection", ["campagne_id"])
    op.create_index("ix_prospection_prospecteur_id", "prospection", ["prospecteur_id"])

    op.create_table(
        "prospection_population",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_id", UUID(as_uuid=True), sa.ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False),
        sa.Column("espece", sa.Text(), nullable=False),
        sa.Column("categorie", sa.Text(), nullable=False),
        sa.Column("densite_diffuse", sa.Numeric(), nullable=True),
        sa.Column("densite_groupee", sa.Numeric(), nullable=True),
        sa.Column("captures_nombre", sa.Integer(), nullable=True),
        sa.Column("temps_capture", sa.Integer(), nullable=True),
        sa.Column("accouplement", sa.Text(), nullable=True),
        sa.Column("ponte", sa.Text(), nullable=True),
        sa.CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_population_espece"),
        sa.CheckConstraint("categorie IN ('imago','larve')", name="ck_prospection_population_categorie"),
        sa.CheckConstraint(
            "accouplement IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_accouplement",
        ),
        sa.CheckConstraint(
            "ponte IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_ponte",
        ),
        sa.UniqueConstraint("prospection_id", "espece", "categorie", name="uq_prospection_population"),
    )
    op.create_index("ix_prospection_population_prospection_id", "prospection_population", ["prospection_id"])

    op.create_table(
        "prospection_capture",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_id", UUID(as_uuid=True), sa.ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False),
        sa.Column("espece", sa.Text(), nullable=False),
        sa.Column("categorie", sa.Text(), nullable=False),
        sa.Column("sexe", sa.Text(), nullable=True),
        sa.Column("phase", sa.Text(), nullable=False),
        sa.Column("stade", sa.Text(), nullable=False),
        sa.Column("effectif", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_capture_espece"),
        sa.CheckConstraint("categorie IN ('imago','larve')", name="ck_prospection_capture_categorie"),
        sa.CheckConstraint("sexe IN ('F','M')", name="ck_prospection_capture_sexe"),
        sa.CheckConstraint(
            "phase IN ('solitaire','solitaro_trans','transiens','gregaire')",
            name="ck_prospection_capture_phase",
        ),
    )
    op.create_index("ix_prospection_capture_prospection_id", "prospection_capture", ["prospection_id"])

    op.create_table(
        "prospection_infestation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_id", UUID(as_uuid=True), sa.ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False),
        sa.Column("espece", sa.Text(), nullable=True),
        sa.Column("type_cible", sa.Text(), nullable=False),
        sa.Column("taille_min", sa.Numeric(), nullable=True),
        sa.Column("taille_max", sa.Numeric(), nullable=True),
        sa.Column("taille_moy", sa.Numeric(), nullable=True),
        sa.Column("surface_tot", sa.Numeric(), nullable=True),
        sa.Column("densite_min", sa.Numeric(), nullable=True),
        sa.Column("densite_max", sa.Numeric(), nullable=True),
        sa.Column("densite_moy", sa.Numeric(), nullable=True),
        sa.Column("interdistance", sa.Numeric(), nullable=True),
        sa.Column("comportement", sa.Text(), nullable=True),
        sa.Column("direction_de", sa.Text(), nullable=True),
        sa.Column("direction_vers", sa.Text(), nullable=True),
        sa.Column("vent_de", sa.Text(), nullable=True),
        sa.Column("vent_vitesse", sa.Numeric(), nullable=True),
        sa.CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_infestation_espece"),
        sa.CheckConstraint(
            "type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','essaim')",
            name="ck_prospection_infestation_type_cible",
        ),
        sa.CheckConstraint(
            "comportement IN ('repos','deplacement')",
            name="ck_prospection_infestation_comportement",
        ),
    )
    op.create_index("ix_prospection_infestation_prospection_id", "prospection_infestation", ["prospection_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fiche_type", sa.Text(), nullable=False),
        sa.Column("fiche_id", UUID(as_uuid=True), nullable=False),
        sa.Column("auteur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("details", JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "fiche_type IN ('intensive','extensive','validation','crt','vol','meteo')",
            name="ck_audit_log_fiche_type",
        ),
        sa.CheckConstraint(
            "action IN ('creation','modification','soumission','verification','validation','rejet','commentaire')",
            name="ck_audit_log_action",
        ),
    )
    op.create_index("ix_audit_log_fiche", "audit_log", ["fiche_type", "fiche_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("prospection_infestation")
    op.drop_table("prospection_capture")
    op.drop_table("prospection_population")
    op.drop_table("prospection")
