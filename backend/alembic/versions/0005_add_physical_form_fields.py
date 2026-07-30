"""add missing fields from physical prospection form

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-29

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # ==========================================
    # 1. CHAMPS RÉFÉRENCES (A)
    # ==========================================
    columns_to_add_prospection = [
        ("region", sa.Text()),
        ("district", sa.Text()),
        ("commune", sa.Text()),
        ("za", sa.Text()),
        ("pa_code", sa.Text()),
        ("degats_cultures_pourcent", sa.Integer()),
        ("verdissement_pourcent", sa.Integer()),
        ("hauteur_herbe_cm", sa.Numeric()),
    ]
    
    for col_name, col_type in columns_to_add_prospection:
        result = conn.execute(
            sa.text("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'prospection' 
                    AND column_name = :col_name
                )
            """),
            {"col_name": col_name}
        ).scalar()
        
        if not result:
            op.add_column("prospection", sa.Column(col_name, col_type, nullable=True))
            print(f"Added column prospection.{col_name}")
        else:
            print(f"Column prospection.{col_name} already exists, skipping")
    
    # ==========================================
    # 2. CHAMPS IMAGOS ET LARVES (B & C)
    # ==========================================
    columns_to_add_infestation = [
        ("pullulation_nb", sa.Integer()),
        ("taille_long", sa.Numeric()),
        ("taille_large", sa.Numeric()),
        ("taille_epaisseur", sa.Numeric()),
        ("essaim_en_vol", sa.Boolean()),
        ("essaim_pose", sa.Boolean()),
        ("type_essaim", sa.Text()),
        ("nb_taches_bandes", sa.Integer()),
        ("interdistance_m", sa.Numeric()),
        ("surface_contaminee_ha", sa.Numeric()),
        ("type_larve", sa.Text()),
        ("surf_infestee_pourcent", sa.Numeric()),
    ]
    
    for col_name, col_type in columns_to_add_infestation:
        result = conn.execute(
            sa.text("""
                SELECT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name = 'prospection_infestation' 
                    AND column_name = :col_name
                )
            """),
            {"col_name": col_name}
        ).scalar()
        
        if not result:
            op.add_column("prospection_infestation", sa.Column(col_name, col_type, nullable=True))
            print(f"Added column prospection_infestation.{col_name}")
        else:
            print(f"Column prospection_infestation.{col_name} already exists, skipping")
    
    # ==========================================
    # 3. STADES LARVAIRES (L1 à L7)
    # ==========================================
    op.execute("ALTER TABLE prospection_capture DROP CONSTRAINT IF EXISTS ck_prospection_capture_stade")
    
    op.execute("""
        ALTER TABLE prospection_capture 
        ADD CONSTRAINT ck_prospection_capture_stade 
        CHECK (
            stade IN (
                'A1', 'A2', 'A3', 'A4', 'A5', 'A1b', 'A2b', 'A5b',
                'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'
            )
        )
    """)
    print("Updated stade constraint to include L1-L7")
    
    # ==========================================
    # 4. CONTRAINTES
    # ==========================================
    result = conn.execute(
        sa.text("""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_constraint 
                WHERE conname = 'ck_prospection_infestation_type_essaim'
            )
        """)
    ).scalar()
    
    if not result:
        op.execute("""
            ALTER TABLE prospection_infestation 
            ADD CONSTRAINT ck_prospection_infestation_type_essaim 
            CHECK (type_essaim IN ('vol_clair', 'dense', 'tres_dense'))
        """)
        print("Added constraint ck_prospection_infestation_type_essaim")
    
    result = conn.execute(
        sa.text("""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_constraint 
                WHERE conname = 'ck_prospection_infestation_type_larve'
            )
        """)
    ).scalar()
    
    if not result:
        op.execute("""
            ALTER TABLE prospection_infestation 
            ADD CONSTRAINT ck_prospection_infestation_type_larve 
            CHECK (type_larve IN ('tache_larvaire', 'bande_larvaire'))
        """)
        print("Added constraint ck_prospection_infestation_type_larve")
    
    # ==========================================
    # 5. INDEX
    # ==========================================
    result = conn.execute(
        sa.text("""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_indexes 
                WHERE indexname = 'ix_prospection_n_releve'
            )
        """)
    ).scalar()
    
    if not result:
        op.create_index("ix_prospection_n_releve", "prospection", ["n_releve"])
        print("Created index ix_prospection_n_releve")
    
    # ==========================================
    # 6. COMMENTAIRES
    # ==========================================
    op.execute("COMMENT ON COLUMN prospection.region IS 'Région de la prospection'")
    op.execute("COMMENT ON COLUMN prospection.district IS 'District de la prospection'")
    op.execute("COMMENT ON COLUMN prospection.commune IS 'Commune de la prospection'")
    op.execute("COMMENT ON COLUMN prospection.za IS 'Zone Antiacridienne'")
    op.execute("COMMENT ON COLUMN prospection.pa_code IS 'Code du Poste Acridien'")
    op.execute("COMMENT ON COLUMN prospection_infestation.pullulation_nb IS 'Nombre de pullulation observé'")
    op.execute("COMMENT ON COLUMN prospection_infestation.taille_long IS 'Taille de l''essaim (longueur en m)'")
    op.execute("COMMENT ON COLUMN prospection_infestation.taille_large IS 'Taille de l''essaim (largeur en m)'")
    op.execute("COMMENT ON COLUMN prospection_infestation.taille_epaisseur IS 'Taille de l''essaim (épaisseur en m)'")
    op.execute("COMMENT ON COLUMN prospection_infestation.essaim_en_vol IS 'Indique si l''essaim est en vol'")
    op.execute("COMMENT ON COLUMN prospection_infestation.essaim_pose IS 'Indique si l''essaim est posé'")
    op.execute("COMMENT ON COLUMN prospection_infestation.type_essaim IS 'Type d''essaim: vol_clair, dense, tres_dense'")
    op.execute("COMMENT ON COLUMN prospection_infestation.nb_taches_bandes IS 'Nombre de taches/bandes larvaires'")
    op.execute("COMMENT ON COLUMN prospection_infestation.interdistance_m IS 'Interdistance entre les taches/bandes en mètres'")
    op.execute("COMMENT ON COLUMN prospection_infestation.surface_contaminee_ha IS 'Surface contaminée en hectares'")
    op.execute("COMMENT ON COLUMN prospection_infestation.type_larve IS 'Type de larve: tache_larvaire ou bande_larvaire'")
    op.execute("COMMENT ON COLUMN prospection.degats_cultures_pourcent IS 'Pourcentage des dégâts sur les cultures'")
    op.execute("COMMENT ON COLUMN prospection.verdissement_pourcent IS 'Pourcentage de verdissement de la strate herbeuse'")
    op.execute("COMMENT ON COLUMN prospection.hauteur_herbe_cm IS 'Hauteur de la strate herbacée en cm'")
    op.execute("COMMENT ON COLUMN prospection_capture.stade IS 'Stade: A1-A5 (imagos), A1b/A2b/A5b (mâles), L1-L7 (larves)'")
    op.execute("COMMENT ON COLUMN prospection_infestation.surf_infestee_pourcent IS 'Surface infestée en pourcentage'")

def downgrade() -> None:
    op.execute("ALTER TABLE prospection_infestation DROP CONSTRAINT IF EXISTS ck_prospection_infestation_type_essaim")
    op.execute("ALTER TABLE prospection_infestation DROP CONSTRAINT IF EXISTS ck_prospection_infestation_type_larve")
    
    op.execute("ALTER TABLE prospection_capture DROP CONSTRAINT IF EXISTS ck_prospection_capture_stade")
    op.execute("""
        ALTER TABLE prospection_capture 
        ADD CONSTRAINT ck_prospection_capture_stade 
        CHECK (stade IN ('A1','A2','A3','A4','A5','A1b','A2b','A5b','L1','L2','L3','L4','L5'))
    """)
    
    op.drop_index("ix_prospection_n_releve", table_name="prospection", if_exists=True)
    
    for col in ['hauteur_herbe_cm', 'verdissement_pourcent', 'degats_cultures_pourcent', 
                'pa_code', 'za', 'commune', 'district', 'region']:
        try:
            op.drop_column("prospection", col)
        except Exception:
            pass
    
    for col in ['type_larve', 'surface_contaminee_ha', 'interdistance_m', 'nb_taches_bandes',
                'type_essaim', 'essaim_pose', 'essaim_en_vol', 'taille_epaisseur', 
                'taille_large', 'taille_long', 'pullulation_nb', 'surf_infestee_pourcent']:
        try:
            op.drop_column("prospection_infestation", col)
        except Exception:
            pass