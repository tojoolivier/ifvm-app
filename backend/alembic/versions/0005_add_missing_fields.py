"""add missing fields from IFVM prospection form

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-22

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name, conn):
    """Vérifie si une colonne existe dans une table"""
    result = conn.execute(
        sa.text(
            f"""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = :table_name 
                AND column_name = :column_name
            )
            """
        ),
        {"table_name": table_name, "column_name": column_name}
    )
    return result.scalar()


def upgrade() -> None:
    # Obtenir la connexion
    conn = op.get_bind()

    # ==================== 1. TABLE UTILISATEUR ====================
    if not column_exists("utilisateur", "poste_acridien_id", conn):
        op.add_column(
            "utilisateur", 
            sa.Column("poste_acridien_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=True)
        )
    
    if not column_exists("utilisateur", "telephone", conn):
        op.add_column(
            "utilisateur", 
            sa.Column("telephone", sa.String(20), nullable=True)
        )

    # ==================== 2. TABLE PROSPECTION ====================
    if not column_exists("prospection", "pa_id", conn):
        op.add_column(
            "prospection", 
            sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=True)
        )
    
    # Supprimer et recréer la contrainte biotope
    op.execute("ALTER TABLE prospection DROP CONSTRAINT IF EXISTS ck_prospection_biotope")
    op.execute("""
        ALTER TABLE prospection ADD CONSTRAINT ck_prospection_biotope
        CHECK (biotope IN ('xerophyle', 'mesophyle', 'hydrophyle'))
    """)
    
    # GPS précis
    if not column_exists("prospection", "accuracy", conn):
        op.add_column("prospection", sa.Column("accuracy", sa.Numeric(10, 2), nullable=True))
    
    if not column_exists("prospection", "gps_provider", conn):
        op.add_column("prospection", sa.Column("gps_provider", sa.String(50), nullable=True))
    
    if not column_exists("prospection", "gps_captured_at", conn):
        op.add_column("prospection", sa.Column("gps_captured_at", sa.TIMESTAMP(timezone=True), nullable=True))
    
    # Métadonnées mobile
    if not column_exists("prospection", "version_app", conn):
        op.add_column("prospection", sa.Column("version_app", sa.String(20), nullable=True))
    
    if not column_exists("prospection", "device_phone", conn):
        op.add_column("prospection", sa.Column("device_phone", sa.String(20), nullable=True))
    
    # Observations - Végétation
    if not column_exists("prospection", "pourcentage_verdure", conn):
        op.add_column("prospection", sa.Column("pourcentage_verdure", sa.Integer(), nullable=True))
    
    if not column_exists("prospection", "hauteur_herbeuse_cm", conn):
        op.add_column("prospection", sa.Column("hauteur_herbeuse_cm", sa.Numeric(6, 1), nullable=True))
    
    # Infestation détaillée
    if not column_exists("prospection", "surface_contaminee_ha", conn):
        op.add_column("prospection", sa.Column("surface_contaminee_ha", sa.Numeric(10, 2), nullable=True))
    
    if not column_exists("prospection", "pourcentage_infestation", conn):
        op.add_column("prospection", sa.Column("pourcentage_infestation", sa.Numeric(5, 2), nullable=True))

    # ==================== 3. TABLE PROSPECTION_INFESTATION ====================
    # Pullulation
    if not column_exists("prospection_infestation", "pullulation_nb", conn):
        op.add_column("prospection_infestation", sa.Column("pullulation_nb", sa.Integer(), nullable=True))
    
    # Taille spécifique
    if not column_exists("prospection_infestation", "longueur_mm", conn):
        op.add_column("prospection_infestation", sa.Column("longueur_mm", sa.Numeric(6, 1), nullable=True))
    
    if not column_exists("prospection_infestation", "largeur_mm", conn):
        op.add_column("prospection_infestation", sa.Column("largeur_mm", sa.Numeric(6, 1), nullable=True))
    
    if not column_exists("prospection_infestation", "epaisseur_mm", conn):
        op.add_column("prospection_infestation", sa.Column("epaisseur_mm", sa.Numeric(6, 1), nullable=True))
    
    # Essaim
    if not column_exists("prospection_infestation", "essaim_en_vol", conn):
        op.add_column("prospection_infestation", sa.Column("essaim_en_vol", sa.Boolean(), nullable=True))
    
    if not column_exists("prospection_infestation", "essaim_pose", conn):
        op.add_column("prospection_infestation", sa.Column("essaim_pose", sa.Boolean(), nullable=True))
    
    # Direction
    if not column_exists("prospection_infestation", "direction_de", conn):
        op.add_column("prospection_infestation", sa.Column("direction_de", sa.Text(), nullable=True))
    
    if not column_exists("prospection_infestation", "direction_vers", conn):
        op.add_column("prospection_infestation", sa.Column("direction_vers", sa.Text(), nullable=True))
    
    # TL/BL
    if not column_exists("prospection_infestation", "nombre_cibles", conn):
        op.add_column("prospection_infestation", sa.Column("nombre_cibles", sa.Integer(), nullable=True))
    
    # Mise à jour de la contrainte type_cible
    op.execute("ALTER TABLE prospection_infestation DROP CONSTRAINT IF EXISTS ck_prospection_infestation_type_cible")
    op.execute("""
        ALTER TABLE prospection_infestation ADD CONSTRAINT ck_prospection_infestation_type_cible
        CHECK (type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','vol_dense','vol_tres_dense','essaim'))
    """)

    # ==================== 4. TABLE PROSPECTION_CAPTURE ====================
    if not column_exists("prospection_capture", "point", conn):
        op.add_column("prospection_capture", sa.Column("point", sa.String(10), nullable=True))

    # ==================== 5. MODIFICATION DE LA TABLE PROSPECTION_POPULATION ====================
    # Mettre à jour les contraintes
    op.execute("ALTER TABLE prospection_population DROP CONSTRAINT IF EXISTS ck_prospection_population_accouplement")
    op.execute("ALTER TABLE prospection_population DROP CONSTRAINT IF EXISTS ck_prospection_population_ponte")
    
    op.execute("""
        ALTER TABLE prospection_population ADD CONSTRAINT ck_prospection_population_accouplement
        CHECK (accouplement IN ('neant','rare','peu','beaucoup','dominant'))
    """)
    op.execute("""
        ALTER TABLE prospection_population ADD CONSTRAINT ck_prospection_population_ponte
        CHECK (ponte IN ('neant','rare','peu','beaucoup','dominant'))
    """)

    # ==================== 6. INDEX ====================
    op.create_index("ix_prospection_pa_id", "prospection", ["pa_id"], if_not_exists=True)


def downgrade() -> None:
    # Supprimer les index
    op.drop_index("ix_prospection_pa_id", table_name="prospection")
    
    # Restaurer les contraintes de prospection_population
    op.execute("ALTER TABLE prospection_population DROP CONSTRAINT IF EXISTS ck_prospection_population_accouplement")
    op.execute("ALTER TABLE prospection_population DROP CONSTRAINT IF EXISTS ck_prospection_population_ponte")
    op.execute("""
        ALTER TABLE prospection_population ADD CONSTRAINT ck_prospection_population_accouplement
        CHECK (accouplement IN ('neant','rare','peu','beaucoup','dominant'))
    """)
    op.execute("""
        ALTER TABLE prospection_population ADD CONSTRAINT ck_prospection_population_ponte
        CHECK (ponte IN ('neant','rare','peu','beaucoup','dominant'))
    """)
    
    # Restaurer la contrainte de prospection_infestation
    op.execute("ALTER TABLE prospection_infestation DROP CONSTRAINT IF EXISTS ck_prospection_infestation_type_cible")
    op.execute("""
        ALTER TABLE prospection_infestation ADD CONSTRAINT ck_prospection_infestation_type_cible
        CHECK (type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','essaim'))
    """)
    
    # Supprimer les colonnes de prospection_capture
    op.drop_column("prospection_capture", "point")
    
    # Supprimer les colonnes de prospection_infestation
    op.drop_column("prospection_infestation", "nombre_cibles")
    op.drop_column("prospection_infestation", "direction_vers")
    op.drop_column("prospection_infestation", "direction_de")
    op.drop_column("prospection_infestation", "essaim_pose")
    op.drop_column("prospection_infestation", "essaim_en_vol")
    op.drop_column("prospection_infestation", "epaisseur_mm")
    op.drop_column("prospection_infestation", "largeur_mm")
    op.drop_column("prospection_infestation", "longueur_mm")
    op.drop_column("prospection_infestation", "pullulation_nb")
    
    # Supprimer les colonnes de prospection
    op.drop_column("prospection", "pourcentage_infestation")
    op.drop_column("prospection", "surface_contaminee_ha")
    op.drop_column("prospection", "hauteur_herbeuse_cm")
    op.drop_column("prospection", "pourcentage_verdure")
    op.drop_column("prospection", "device_phone")
    op.drop_column("prospection", "version_app")
    op.drop_column("prospection", "gps_captured_at")
    op.drop_column("prospection", "gps_provider")
    op.drop_column("prospection", "accuracy")
    op.drop_column("prospection", "pa_id")
    
    # Supprimer la contrainte biotope
    op.execute("ALTER TABLE prospection DROP CONSTRAINT IF EXISTS ck_prospection_biotope")
    
    # Supprimer les colonnes de utilisateur
    op.drop_column("utilisateur", "telephone")
    op.drop_column("utilisateur", "poste_acridien_id")