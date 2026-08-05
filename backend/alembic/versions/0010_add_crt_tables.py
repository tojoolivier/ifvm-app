"""add traitement (ex-CRT) tables v2.0

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
    # PESTICIDE : matiere_active est une propriete du produit,
    # pas de l'evenement de traitement (revue PR #55)
    # ==========================================
    op.add_column("pesticide", sa.Column("matiere_active", sa.Text(), nullable=True))

    # ==========================================
    # AUDIT_LOG : fiche_type 'crt' -> 'traitement'
    # ==========================================
    op.drop_constraint("ck_audit_log_fiche_type", "audit_log", type_="check")
    op.create_check_constraint(
        "ck_audit_log_fiche_type",
        "audit_log",
        "fiche_type IN ('intensive','extensive','validation','traitement','vol','meteo')",
    )

    # ==========================================
    # TABLE TRAITEMENT (ex-CRT)
    # ==========================================
    op.create_table(
        "traitement",
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
        sa.Column("numero_fiche", sa.String(50), nullable=False, unique=True),
        # ===== Référence =====
        sa.Column("type_traitement", sa.String(10), nullable=False),
        sa.Column("mode_traitement", sa.String(30), nullable=True),
        sa.Column("date_traitement", sa.Date(), nullable=False),
        sa.Column("date_validation", sa.Date(), nullable=False),
        sa.Column("localite", sa.String(255), nullable=False),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("commune", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        # ===== Moyens — kits de protection (generiques aerien/terrestre) =====
        sa.Column("kit_combinaison", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_gants", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_lunettes", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_masques", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("kit_boite", sa.Boolean(), nullable=False, server_default="false"),
        # ===== Zones exposées =====
        sa.Column("zones_exposees", JSONB(), nullable=True),
        # ===== Végétation =====
        sa.Column("hauteur_strate_herbeuse_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("hauteur_strate_arboree_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("recouvrement_percent", sa.Integer(), nullable=True),
        # ===== Empoisonnement =====
        sa.Column("empoisonnement", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("empoisonnement_type", sa.String(30), nullable=True),
        sa.Column("empoisonnement_mode", sa.String(30), nullable=True),
        sa.Column("empoisonnement_autre", sa.Text(), nullable=True),
        # ===== Évaluation du risque =====
        sa.Column("evaluation_risque", JSONB(), nullable=True),
        # ===== Comportement anormal =====
        sa.Column("comportement_anormal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("comportement_non_cibles", JSONB(), nullable=True),
        # ===== Mortalité =====
        sa.Column("mortalite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("mortalite_familles", JSONB(), nullable=True),
        # ===== Statut =====
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
        # ===== CONTRAINTES =====
        sa.CheckConstraint("type_traitement IN ('AERIEN','TERRESTRE')", name="ck_traitement_type"),
        sa.CheckConstraint(
            "mode_traitement IN ('TOTAL','BARRIERE','IRREGULIER')",
            name="ck_traitement_mode_traitement",
        ),
        sa.CheckConstraint("statut IN ('brouillon','validee')", name="ck_traitement_statut"),
        sa.CheckConstraint(
            "statut_sync IN ('local','synced','conflict')",
            name="ck_traitement_statut_sync",
        ),
        sa.CheckConstraint(
            "date_validation >= date_traitement", name="ck_traitement_date_validation"
        ),
        sa.CheckConstraint(
            "empoisonnement_type IN ('AGENT','POPULATION')",
            name="ck_traitement_empoisonnement_type",
        ),
        sa.CheckConstraint(
            "empoisonnement_mode IN ('INGESTION','INHALATION','CONTACT','AUTRE')",
            name="ck_traitement_empoisonnement_mode",
        ),
    )
    op.create_index("ix_traitement_prospection_id", "traitement", ["prospection_id"])
    op.create_index("ix_traitement_numero_fiche", "traitement", ["numero_fiche"])
    op.create_index("ix_traitement_date_traitement", "traitement", ["date_traitement"])
    op.create_index("ix_traitement_statut", "traitement", ["statut"])
    op.create_index("ix_traitement_type_traitement", "traitement", ["type_traitement"])

    # ==========================================
    # TABLE CIBLE (weak entity 1-1, snapshot a la creation)
    # ==========================================
    op.create_table(
        "cible",
        sa.Column(
            "traitement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("espece", sa.String(10), nullable=True),
        sa.Column("petites_larves", sa.String(50), nullable=True),
        sa.Column("grandes_larves", sa.String(50), nullable=True),
        sa.Column("vols_clairs_essaims", sa.String(50), nullable=True),
        sa.Column("repartition_population", sa.String(30), nullable=True),
        sa.Column("surface_infestee_ha", sa.Numeric(10, 2), nullable=False),
        sa.CheckConstraint("espece IN ('LMC','NSE','MELANGE')", name="ck_cible_espece"),
        sa.CheckConstraint(
            "repartition_population IN ('GROUPEE','DIFFUSE')",
            name="ck_cible_repartition_population",
        ),
    )
    op.execute(
        """
        COMMENT ON COLUMN cible.espece
        IS 'Espece cible du traitement: LMC (Locusta migratoria capito), NSE (Nomadacris
        septemfasciata), ou MELANGE lorsque le traitement couvre une zone ou les deux especes
        sont presentes simultanement (contrairement a prospection.espece qui ne connait que
        LMC|NSE, une observation de terrain porte toujours sur une seule espece a la fois)'
        """
    )

    # ==========================================
    # TABLE TRAITEMENT_AERIEN (specialisation disjointe totale)
    # ==========================================
    op.create_table(
        "traitement_aerien",
        sa.Column(
            "traitement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("pilote", sa.String(255), nullable=False),
        sa.Column("mecanicien", sa.String(255), nullable=False),
        sa.Column(
            "chef_de_base_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False
        ),
        sa.Column("consultant_international", sa.String(255), nullable=True),
        sa.Column("nb_rotations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_pesticide_l", sa.Numeric(10, 2), nullable=True),
    )
    op.create_index(
        "ix_traitement_aerien_chef_de_base_id", "traitement_aerien", ["chef_de_base_id"]
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_aerien.chef_de_base_id
        IS 'Doit correspondre a un agent IFVM (utilisateur.role) - non verifie par une
        contrainte DB, a valider cote application'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_aerien.nb_rotations
        IS 'Derive = COUNT(traitement_rotation) - alimente par l''application, ne pas ressaisir'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_aerien.total_pesticide_l
        IS 'Derive = SUM(traitement_rotation.quantite_l) - alimente par l''application'
        """
    )

    # ==========================================
    # TABLE TRAITEMENT_ROTATION (1-N, aerien)
    # ==========================================
    op.create_table(
        "traitement_rotation",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "traitement_aerien_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement_aerien.traitement_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("numero_cuve", sa.String(50), nullable=False),
        sa.Column("produit_id", UUID(as_uuid=True), sa.ForeignKey("pesticide.id"), nullable=False),
        sa.Column("quantite_l", sa.Numeric(10, 2), nullable=False),
        sa.Column("temperature_debut_c", sa.Numeric(5, 2), nullable=False),
        sa.Column("temperature_fin_c", sa.Numeric(5, 2), nullable=False),
        sa.Column("vent_debut_ms", sa.Numeric(5, 2), nullable=False),
        sa.Column("vent_fin_ms", sa.Numeric(5, 2), nullable=False),
        sa.UniqueConstraint("traitement_aerien_id", "numero", name="uq_traitement_rotation_numero"),
    )
    op.create_index(
        "ix_traitement_rotation_traitement_aerien_id",
        "traitement_rotation",
        ["traitement_aerien_id"],
    )
    op.create_index("ix_traitement_rotation_produit_id", "traitement_rotation", ["produit_id"])
    op.execute(
        """
        COMMENT ON COLUMN traitement_rotation.numero_cuve
        IS 'Cle de croisement (convention de saisie, pas une FK garantie) avec la future
        table fiche_vol - hors perimetre de cette migration'
        """
    )

    # ==========================================
    # TABLE TRAITEMENT_TERRESTRE (specialisation disjointe totale)
    # ==========================================
    op.create_table(
        "traitement_terrestre",
        sa.Column(
            "traitement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("heure_debut", sa.Time(), nullable=False),
        sa.Column("heure_fin", sa.Time(), nullable=False),
        sa.Column("vitesse_vent_ms", sa.Numeric(5, 2), nullable=False),
        sa.Column("direction_vent", sa.String(2), nullable=True),
        sa.Column("temperature_c", sa.Numeric(5, 2), nullable=False),
        sa.Column("reprise_traitement", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "traitement_origine_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id"),
            nullable=True,
        ),
        sa.Column(
            "chef_equipe_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False
        ),
        sa.Column(
            "agent_encadreur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
        sa.Column("consultant_international", sa.String(255), nullable=True),
        sa.Column("surface_atomiseur_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_disque_rotatif_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_ulvamast_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_traitee_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_cumulee_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_restante_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_restante_abandonnee", sa.Boolean(), nullable=True),
        sa.Column("essence_litres", sa.Numeric(10, 2), nullable=True),
        sa.Column("nb_piles", sa.Integer(), nullable=True),
        sa.CheckConstraint("heure_fin > heure_debut", name="ck_traitement_terrestre_heures"),
        sa.CheckConstraint(
            "direction_vent IN ('N','NE','E','SE','S','SO','O','NO')",
            name="ck_traitement_terrestre_direction_vent",
        ),
        sa.CheckConstraint(
            "NOT reprise_traitement OR traitement_origine_id IS NOT NULL",
            name="ck_traitement_terrestre_reprise",
        ),
        sa.CheckConstraint(
            "surface_restante_ha IS NULL OR surface_restante_ha <= 0"
            " OR surface_restante_abandonnee IS NOT NULL",
            name="ck_traitement_terrestre_surface_restante",
        ),
    )
    op.create_index(
        "ix_traitement_terrestre_traitement_origine_id",
        "traitement_terrestre",
        ["traitement_origine_id"],
    )
    op.create_index(
        "ix_traitement_terrestre_chef_equipe_id", "traitement_terrestre", ["chef_equipe_id"]
    )
    op.create_index(
        "ix_traitement_terrestre_agent_encadreur_id",
        "traitement_terrestre",
        ["agent_encadreur_id"],
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.traitement_origine_id
        IS 'Auto-reference vers traitement.id (pas traitement_terrestre.id) : pointe vers la
        fiche precedente immediate en cas de reprise (liste chainee), pas vers la fiche
        racine de la zone'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.surface_traitee_ha
        IS 'Derive = somme de surface_atomiseur_ha/surface_disque_rotatif_ha/surface_ulvamast_ha
        - alimente par l''application'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.surface_cumulee_ha
        IS 'Derive, croise traitement_origine_id si reprise_traitement - alimente par
        l''application'
        """
    )
    op.execute(
        """
        COMMENT ON COLUMN traitement_terrestre.surface_restante_ha
        IS 'Derive = cible.surface_infestee_ha - surface_cumulee_ha, plancher 0 - alimente
        par l''application'
        """
    )

    # ==========================================
    # TABLE TRAITEMENT_PRODUIT_UTILISE (1-N, terrestre)
    # ==========================================
    op.create_table(
        "traitement_produit_utilise",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "traitement_terrestre_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement_terrestre.traitement_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("produit_id", UUID(as_uuid=True), sa.ForeignKey("pesticide.id"), nullable=False),
        sa.Column("quantite_l", sa.Numeric(10, 2), nullable=False),
        sa.UniqueConstraint(
            "traitement_terrestre_id", "numero", name="uq_traitement_produit_utilise_numero"
        ),
    )
    op.create_index(
        "ix_traitement_produit_utilise_traitement_terrestre_id",
        "traitement_produit_utilise",
        ["traitement_terrestre_id"],
    )
    op.create_index(
        "ix_traitement_produit_utilise_produit_id", "traitement_produit_utilise", ["produit_id"]
    )

    # ==========================================
    # TABLE TRAITEMENT_SIGNATURE (1-N selon role/type)
    # ==========================================
    op.create_table(
        "traitement_signature",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "traitement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("signataire_nom", sa.String(255), nullable=False),
        sa.Column(
            "horodatage",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "role IN ('PILOTE','MECANICIEN','CHEF_DE_BASE','CHEF_EQUIPE',"
            "'CONSULTANT_INTERNATIONAL')",
            name="ck_traitement_signature_role",
        ),
        sa.UniqueConstraint("traitement_id", "role", name="uq_traitement_signature"),
    )
    op.create_index(
        "ix_traitement_signature_traitement_id", "traitement_signature", ["traitement_id"]
    )


def downgrade() -> None:
    op.drop_table("traitement_signature")
    op.drop_table("traitement_produit_utilise")
    op.drop_table("traitement_terrestre")
    op.drop_table("traitement_rotation")
    op.drop_table("traitement_aerien")
    op.drop_table("cible")
    op.drop_index("ix_traitement_type_traitement", table_name="traitement")
    op.drop_index("ix_traitement_statut", table_name="traitement")
    op.drop_index("ix_traitement_date_traitement", table_name="traitement")
    op.drop_index("ix_traitement_numero_fiche", table_name="traitement")
    op.drop_index("ix_traitement_prospection_id", table_name="traitement")
    op.drop_table("traitement")

    op.drop_constraint("ck_audit_log_fiche_type", "audit_log", type_="check")
    op.create_check_constraint(
        "ck_audit_log_fiche_type",
        "audit_log",
        "fiche_type IN ('intensive','extensive','validation','crt','vol','meteo')",
    )

    op.drop_column("pesticide", "matiere_active")
