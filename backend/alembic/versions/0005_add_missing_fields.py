"""add missing fields from physical form

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-23

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('prospection', sa.Column('verdissement', sa.Numeric(), nullable=True))
    op.add_column('prospection', sa.Column('hauteur_strate', sa.Numeric(), nullable=True))
    op.add_column('prospection', sa.Column('pullulation_nb', sa.Integer(), nullable=True))
    op.add_column('prospection', sa.Column('interdistance', sa.Numeric(), nullable=True))
    op.add_column('prospection', sa.Column('taille_info', JSONB(), nullable=True))
    op.add_column('prospection', sa.Column('essaim_type', sa.Text(), nullable=True))
    op.add_column('prospection', sa.Column('essaim_vol_dir_de', sa.Text(), nullable=True))
    op.add_column('prospection', sa.Column('essaim_vol_dir_vers', sa.Text(), nullable=True))
    op.add_column('prospection', sa.Column('essaim_pose', sa.Boolean(), nullable=True))
    op.add_column('prospection', sa.Column('surface_contaminee', sa.Numeric(), nullable=True))
    
    op.create_check_constraint(
        "ck_prospection_essaim_type",
        "prospection",
        "essaim_type IN ('clair', 'dense', 'tres_dense')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_prospection_essaim_type", "prospection", type_="check")
    op.drop_column('prospection', 'surface_contaminee')
    op.drop_column('prospection', 'essaim_pose')
    op.drop_column('prospection', 'essaim_vol_dir_vers')
    op.drop_column('prospection', 'essaim_vol_dir_de')
    op.drop_column('prospection', 'essaim_type')
    op.drop_column('prospection', 'taille_info')
    op.drop_column('prospection', 'interdistance')
    op.drop_column('prospection', 'pullulation_nb')
    op.drop_column('prospection', 'hauteur_strate')
    op.drop_column('prospection', 'verdissement')
