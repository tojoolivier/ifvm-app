"""Fiche de vol : fiche_vol, vol, fiche_vol_signature

Cahier des charges « Formulaire de gestion des heures de vol » ; cadrage et arbitrage dans
docs/adr/ADR-011 (§7). Trois décisions produit du 2026-08-24 sont matérialisées ici :

- les lieux (base aérienne, stand de remplissage) sont des **relevés ponctuels** portés par
  la fiche, pas des référentiels — d'où l'absence de nouvelle table de référentiel et
  l'absence d'impact sur le périmètre de sync d'ADR-007 ;
- « une seule fiche par jour **si possible** » est une convention, pas une contrainte : seul
  `numero` est UNIQUE, et il porte un compteur en cas de seconde fiche ;
- une signature porte un tracé manuscrit en plus du nom horodaté de `traitement_signature`.

Aucune colonne dérivée : ni durée de vol, ni cumul, ni décompte de rotations rapprochées.

Revision ID: 0029
Revises: 0028
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fiche_vol",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("numero", sa.String(60), nullable=False, unique=True),
        sa.Column("date_vol", sa.Date(), nullable=False),
        sa.Column("compagnie", sa.String(255), nullable=False),
        sa.Column("immatriculation", sa.String(20), nullable=False),
        sa.Column("base_code", sa.String(20), nullable=False),
        sa.Column("base_nom", sa.String(255), nullable=False),
        sa.Column("base_latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("base_longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("base_altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("stand_nom", sa.String(255), nullable=False),
        sa.Column("stand_latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("stand_longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("stand_altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("pilote", sa.String(255), nullable=False),
        sa.Column("mecanicien", sa.String(255), nullable=False),
        sa.Column(
            "chef_de_base_id",
            UUID(as_uuid=True),
            sa.ForeignKey("utilisateur.id"),
            nullable=False,
        ),
        sa.Column("consultant_international", sa.String(255), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
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
        sa.CheckConstraint("statut IN ('brouillon','validee')", name="ck_fiche_vol_statut"),
    )
    op.create_index("ix_fiche_vol_date_vol", "fiche_vol", ["date_vol"])
    op.create_index("ix_fiche_vol_immatriculation", "fiche_vol", ["immatriculation"])
    op.create_index("ix_fiche_vol_chef_de_base_id", "fiche_vol", ["chef_de_base_id"])

    op.execute(
        "COMMENT ON COLUMN fiche_vol.compagnie IS "
        "'Instantane a la creation : immatriculation -> compagnie est une dependance "
        "fonctionnelle dont le determinant n''est pas superclé. Denormalisation temporelle "
        "assumee — l''exploitant d''un appareil peut changer, une fiche ancienne garde "
        "celui du jour. Meme patron que cible.'"
    )
    op.execute(
        "COMMENT ON COLUMN fiche_vol.numero IS "
        "'[Date]-[Base numerotee]-[Immatriculation], suffixe -NN a partir de la deuxieme "
        "fiche du jour pour le meme appareil. Seule contrainte d''unicite de la fiche : "
        "« une seule fiche par jour si possible » est une convention, pas une regle.'"
    )

    op.create_table(
        "vol",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "fiche_vol_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fiche_vol.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("type_vol", sa.String(20), nullable=False),
        sa.Column("heure_debut", sa.Time(), nullable=False),
        sa.Column("heure_fin", sa.Time(), nullable=False),
        sa.Column(
            "rotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement_rotation.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "prospection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.UniqueConstraint("fiche_vol_id", "numero", name="uq_vol_numero"),
        sa.UniqueConstraint("rotation_id", "type_vol", name="uq_vol_rotation_type"),
        sa.CheckConstraint(
            "type_vol IN ('PROSPECTION','MEP','APPLICATION','CONVOYAGE','DIVERS')",
            name="ck_vol_type",
        ),
        sa.CheckConstraint(
            "rotation_id IS NULL OR type_vol IN ('MEP','APPLICATION')",
            name="ck_vol_rotation_type_compatible",
        ),
        sa.CheckConstraint(
            "prospection_id IS NULL OR type_vol = 'PROSPECTION'",
            name="ck_vol_prospection_type_compatible",
        ),
        sa.CheckConstraint("heure_fin > heure_debut", name="ck_vol_heures"),
    )
    op.create_index("ix_vol_fiche_vol_id", "vol", ["fiche_vol_id"])
    op.create_index("ix_vol_rotation_id", "vol", ["rotation_id"])
    op.create_index("ix_vol_prospection_id", "vol", ["prospection_id"])

    op.execute(
        "COMMENT ON CONSTRAINT uq_vol_rotation_type ON vol IS "
        "'Une rotation (une cuve) vaut au minimum 1 mise en place + 1 application : au plus "
        "un vol de chaque type par rotation. Les vols non rapproches ne se heurtent jamais a "
        "cette contrainte, deux NULL n''etant pas egaux en SQL.'"
    )
    op.execute(
        "COMMENT ON TABLE vol IS "
        "'Entite faible de fiche_vol. La duree du vol est derivee de heure_fin - heure_debut "
        "et n''est jamais stockee ; les cumuls jour/semaine/mois/total non plus.'"
    )

    op.create_table(
        "fiche_vol_signature",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "fiche_vol_id",
            UUID(as_uuid=True),
            sa.ForeignKey("fiche_vol.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("signataire_nom", sa.String(255), nullable=False),
        sa.Column("signature_image", sa.Text(), nullable=True),
        sa.Column(
            "horodatage",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "role IN ('PILOTE','MECANICIEN','CHEF_DE_BASE','CONSULTANT_INTERNATIONAL')",
            name="ck_fiche_vol_signature_role",
        ),
        sa.UniqueConstraint("fiche_vol_id", "role", name="uq_fiche_vol_signature"),
    )
    op.create_index("ix_fiche_vol_signature_fiche_vol_id", "fiche_vol_signature", ["fiche_vol_id"])

    op.execute(
        "COMMENT ON COLUMN fiche_vol_signature.signature_image IS "
        "'Trace manuscrit capte a l''ecran (data URI PNG). Nullable : la fiche reste "
        "enregistrable avant le passage de signature.'"
    )


def downgrade() -> None:
    op.drop_index("ix_fiche_vol_signature_fiche_vol_id", table_name="fiche_vol_signature")
    op.drop_table("fiche_vol_signature")
    op.drop_index("ix_vol_prospection_id", table_name="vol")
    op.drop_index("ix_vol_rotation_id", table_name="vol")
    op.drop_index("ix_vol_fiche_vol_id", table_name="vol")
    op.drop_table("vol")
    op.drop_index("ix_fiche_vol_chef_de_base_id", table_name="fiche_vol")
    op.drop_index("ix_fiche_vol_immatriculation", table_name="fiche_vol")
    op.drop_index("ix_fiche_vol_date_vol", table_name="fiche_vol")
    op.drop_table("fiche_vol")
