"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-23

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "poste_acridien",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("region", sa.String(100), nullable=False),
        sa.Column("district", sa.String(100)),
        sa.Column("commune", sa.String(100)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "station",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("nom", sa.String(100)),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("altitude_m", sa.Integer),
        sa.Column("biotope", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("pa_id", "code"),
        sa.CheckConstraint("type IN ('fixe', 'ponctuelle')", name="ck_station_type"),
    )

    op.create_table(
        "station_meteo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=False),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("nom", sa.String(100)),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("altitude_m", sa.Integer),
    )

    op.create_table(
        "utilisateur",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("nom", sa.String(100), nullable=False),
        sa.Column("prenom", sa.String(100), nullable=False),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(200), nullable=False, server_default=""),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id")),
        sa.Column("actif", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "role IN ('prospecteur','chef_equipe','agent_encadreur','pilote','mecanicien','chef_de_base','admin')",
            name="ck_utilisateur_role",
        ),
    )

    op.create_table(
        "releve_meteo",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("station_meteo_id", UUID(as_uuid=True), sa.ForeignKey("station_meteo.id"), nullable=False),
        sa.Column("mois", sa.SmallInteger, nullable=False),
        sa.Column("annee", sa.SmallInteger, nullable=False),
        sa.Column("saisi_par", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("valide_par", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("valide_le", sa.Date),
        sa.Column("local_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("server_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="local"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("station_meteo_id", "mois", "annee"),
    )

    op.create_table(
        "mesure_meteo_jour",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("releve_id", UUID(as_uuid=True), sa.ForeignKey("releve_meteo.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jour", sa.SmallInteger, nullable=False),
        sa.Column("decade", sa.String(2), nullable=False),
        sa.Column("pluie_mm", sa.Numeric(6, 1)),
        sa.Column("pluie_nb_jours", sa.SmallInteger),
        sa.Column("temp_min_c", sa.Numeric(4, 1)),
        sa.Column("temp_max_c", sa.Numeric(4, 1)),
        sa.Column("temp_moy_c", sa.Numeric(4, 1)),
        sa.Column("direction_vent", sa.String(10)),
        sa.Column("force_vent_ms", sa.Numeric(5, 1)),
        sa.Column("observation", sa.Text),
        sa.UniqueConstraint("releve_id", "jour"),
    )

    op.create_table(
        "prospection_extensive",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("numero", sa.String(30), nullable=False, unique=True),
        sa.Column("station_id", UUID(as_uuid=True), sa.ForeignKey("station.id"), nullable=False),
        sa.Column("prospecteur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("date_releve", sa.Date, nullable=False),
        sa.Column("surface_ha", sa.Numeric(10, 2)),
        sa.Column("degats_cultures_pct", sa.Numeric(5, 1)),
        sa.Column("verdissement_herbeuse_pct", sa.Numeric(5, 1)),
        sa.Column("hauteur_strate_herbeuse_m", sa.Numeric(5, 2)),
        sa.Column("derniere_pluie_date", sa.Date),
        sa.Column("derniere_pluie_intensite", sa.String(20)),
        sa.Column("observation", sa.Text),
        sa.Column("local_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("server_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="local"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "prospection_intensive",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("numero_releve", sa.String(30), nullable=False, unique=True),
        sa.Column("station_id", UUID(as_uuid=True), sa.ForeignKey("station.id"), nullable=False),
        sa.Column("prospecteur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("date_releve", sa.Date, nullable=False),
        sa.Column("surface_station_ha", sa.Numeric(10, 2)),
        sa.Column("surface_prospectee_ha", sa.Numeric(10, 2)),
        sa.Column("surface_infestee_ha", sa.Numeric(10, 2)),
        sa.Column("derniere_pluie_date", sa.Date),
        sa.Column("derniere_pluie_intensite", sa.String(20)),
        sa.Column("ennemis_naturels", sa.Text),
        sa.Column("observation", sa.Text),
        sa.Column("local_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("server_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="local"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "capture",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE")),
        sa.Column("prospection_extensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_extensive.id", ondelete="CASCADE")),
        sa.Column("espece", sa.String(10), nullable=False),
        sa.Column("stade_type", sa.String(10), nullable=False),
        sa.Column("stade_code", sa.String(10), nullable=False),
        sa.Column("sexe", sa.String(10)),
        sa.Column("phase", sa.String(20), nullable=False),
        sa.Column("nombre", sa.Integer, nullable=False),
    )

    op.create_table(
        "population_acridien",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE")),
        sa.Column("prospection_extensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_extensive.id", ondelete="CASCADE")),
        sa.Column("espece", sa.String(10), nullable=False),
        sa.Column("stade_type", sa.String(10), nullable=False),
        sa.Column("nb_captures", sa.Integer),
        sa.Column("temps_capture_min", sa.Integer),
        sa.Column("densite_diffuse_ha", sa.Numeric(12, 2)),
        sa.Column("densite_groupee_m2", sa.Numeric(12, 2)),
        sa.Column("accouplements", sa.String(20)),
        sa.Column("ponte", sa.String(20)),
        sa.Column("surface_infestee_ha", sa.Numeric(10, 2)),
        sa.Column("surface_contaminees_ha", sa.Numeric(10, 2)),
    )

    op.create_table(
        "infestation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE")),
        sa.Column("prospection_extensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_extensive.id", ondelete="CASCADE")),
        sa.Column("espece", sa.String(10), nullable=False),
        sa.Column("type_formation", sa.String(20), nullable=False),
        sa.Column("surf_totale_ha", sa.Numeric(10, 2)),
        sa.Column("taille_min", sa.Numeric(10, 2)),
        sa.Column("taille_max", sa.Numeric(10, 2)),
        sa.Column("taille_moy", sa.Numeric(10, 2)),
        sa.Column("densite_min", sa.Numeric(10, 2)),
        sa.Column("densite_max", sa.Numeric(10, 2)),
        sa.Column("densite_moy", sa.Numeric(10, 2)),
        sa.Column("interdistance_m", sa.Numeric(10, 2)),
        sa.Column("repos", sa.Boolean),
        sa.Column("deplacement", sa.Boolean),
        sa.Column("direction_de", sa.String(50)),
        sa.Column("direction_vers", sa.String(50)),
        sa.Column("vent_de", sa.String(50)),
        sa.Column("vent_vitesse_ms", sa.Numeric(5, 1)),
        sa.Column("densite_vol", sa.String(20)),
    )

    op.create_table(
        "vegetation",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type_strate", sa.String(30), nullable=False),
        sa.Column("surf_relative_pct", sa.Numeric(5, 1)),
        sa.Column("hauteur_moy_m", sa.Numeric(5, 2)),
        sa.Column("recouvrement_pct", sa.Numeric(5, 1)),
        sa.Column("verdissement_pct", sa.Numeric(5, 1)),
        sa.Column("repousse", sa.Boolean),
        sa.Column("orpad_germination", sa.Boolean),
        sa.Column("orpad_feuille", sa.Boolean),
        sa.Column("orpad_fleur", sa.Boolean),
        sa.Column("orpad_fruit", sa.Boolean),
        sa.Column("orpad_sec", sa.Boolean),
        sa.UniqueConstraint("prospection_intensive_id", "type_strate"),
    )

    op.create_table(
        "humidite_sol",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False),
        sa.Column("profondeur", sa.String(20), nullable=False),
        sa.Column("etat", sa.String(10)),
        sa.UniqueConstraint("prospection_intensive_id", "profondeur"),
    )

    op.create_table(
        "texture_sol",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False),
        sa.Column("texture", sa.String(20), nullable=False),
    )

    op.create_table(
        "compte_rendu_traitement",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("numero_crt", sa.String(30), nullable=False, unique=True),
        sa.Column("numero_validation", sa.String(30), unique=True),
        sa.Column("date_validation", sa.Date),
        sa.Column("date_traitement", sa.Date, nullable=False),
        sa.Column("chef_equipe_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("agent_encadreur_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("prospection_intensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_intensive.id")),
        sa.Column("prospection_extensive_id", UUID(as_uuid=True), sa.ForeignKey("prospection_extensive.id")),
        sa.Column("pa_id", UUID(as_uuid=True), sa.ForeignKey("poste_acridien.id"), nullable=False),
        sa.Column("localite", sa.String(100)),
        sa.Column("commune_rurale", sa.String(100)),
        sa.Column("district", sa.String(100)),
        sa.Column("zone_acridienne", sa.String(100)),
        sa.Column("region", sa.String(100)),
        sa.Column("espece_cible", sa.String(10), nullable=False),
        sa.Column("surface_infestee_ha", sa.Numeric(10, 2)),
        sa.Column("densite_ind_ha", sa.Numeric(10, 2)),
        sa.Column("population_type", sa.String(20)),
        sa.Column("mode_traitement", sa.String(30), nullable=False),
        sa.Column("surf_atomiseur_dos_ha", sa.Numeric(10, 2)),
        sa.Column("surf_disque_rotatif_ha", sa.Numeric(10, 2)),
        sa.Column("surf_ulvamast_ha", sa.Numeric(10, 2)),
        sa.Column("surf_aeronef_ha", sa.Numeric(10, 2)),
        sa.Column("surf_reste_traiter_ha", sa.Numeric(10, 2)),
        sa.Column("heure_debut", sa.Time),
        sa.Column("heure_fin", sa.Time),
        sa.Column("vent_vitesse_ms", sa.Numeric(5, 1)),
        sa.Column("vent_direction", sa.String(10)),
        sa.Column("temperature_c", sa.Numeric(4, 1)),
        sa.Column("taux_mortalite_pct", sa.Numeric(5, 1)),
        sa.Column("evaluation_apres_h", sa.Numeric(4, 1)),
        sa.Column("methode_evaluation", sa.String(30)),
        sa.Column("cas_empoisonnement", sa.Boolean),
        sa.Column("empoisonne_qui", sa.String(20)),
        sa.Column("empoisonne_mode", sa.String(20)),
        sa.Column("comportement_anormal", sa.Boolean),
        sa.Column("mortalite_non_cibles", sa.Boolean),
        sa.Column("observation", sa.Text),
        sa.Column("local_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("server_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="local"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "crt_point_gps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordre", sa.SmallInteger, nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.UniqueConstraint("crt_id", "ordre", "type"),
    )

    op.create_table(
        "crt_cible_espece",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("espece", sa.String(10), nullable=False),
        sa.Column("phase", sa.String(50)),
        sa.Column("stade", sa.String(50)),
        sa.UniqueConstraint("crt_id", "espece"),
    )

    op.create_table(
        "crt_zone_cible",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("surface_ha", sa.Numeric(10, 2)),
    )

    op.create_table(
        "crt_moyens_humains",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("nb_agents_permanents", sa.Integer),
        sa.Column("nb_agents_temporaires", sa.Integer),
        sa.Column("nb_personnel_local", sa.Integer),
    )

    op.create_table(
        "crt_moyens_materiels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("nb_atomiseurs", sa.Integer),
        sa.Column("essence_litres", sa.Numeric(8, 2)),
        sa.Column("nb_disques_rotatifs", sa.Integer),
        sa.Column("nb_piles", sa.Integer),
        sa.Column("nb_ulvamasts", sa.Integer),
        sa.Column("nb_combinaisons", sa.Integer),
        sa.Column("nb_gants", sa.Integer),
        sa.Column("nb_lunettes", sa.Integer),
        sa.Column("nb_masques", sa.Integer),
        sa.Column("nb_bottes", sa.Integer),
    )

    op.create_table(
        "crt_pesticide",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nom_commercial", sa.String(100), nullable=False),
        sa.Column("matieres_actives", sa.String(200)),
        sa.Column("stock_initial_l", sa.Numeric(10, 2)),
        sa.Column("approvisionnement_l", sa.Numeric(10, 2)),
        sa.Column("produit_consomme_l", sa.Numeric(10, 2)),
        sa.Column("stock_final_l", sa.Numeric(10, 2)),
    )

    op.create_table(
        "crt_non_cible",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("famille", sa.String(20), nullable=False),
    )

    op.create_table(
        "crt_habitat_proximite",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordre", sa.SmallInteger, nullable=False),
        sa.Column("localisation", sa.String(200)),
        sa.Column("distance_km", sa.Numeric(6, 2)),
        sa.Column("sensibilisation", sa.Boolean),
        sa.UniqueConstraint("crt_id", "ordre"),
    )

    op.create_table(
        "fiche_vol",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("numero", sa.String(30), nullable=False, unique=True),
        sa.Column("crt_id", UUID(as_uuid=True), sa.ForeignKey("compte_rendu_traitement.id"), nullable=False, unique=True),
        sa.Column("date_vol", sa.Date, nullable=False),
        sa.Column("societe", sa.String(100)),
        sa.Column("immatriculation", sa.String(20)),
        sa.Column("mecanicien_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("chef_de_base_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("pilote_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("base_nom", sa.String(100)),
        sa.Column("base_latitude", sa.Numeric(9, 6)),
        sa.Column("base_longitude", sa.Numeric(9, 6)),
        sa.Column("base_sec_nom", sa.String(100)),
        sa.Column("base_sec_latitude", sa.Numeric(9, 6)),
        sa.Column("base_sec_longitude", sa.Numeric(9, 6)),
        sa.Column("heures_vol_avant_grande_visite", sa.Numeric(6, 2)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "fiche_vol_passage",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fiche_vol_id", UUID(as_uuid=True), sa.ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False),
        sa.Column("numero_passage", sa.SmallInteger, nullable=False),
        sa.Column("numero_cuve", sa.String(20)),
        sa.Column("produit", sa.String(100)),
        sa.Column("quantite_l", sa.Numeric(8, 2)),
        sa.Column("heure_debut", sa.Time),
        sa.Column("temp_debut_c", sa.Numeric(4, 1)),
        sa.Column("vent_debut_ms", sa.Numeric(5, 1)),
        sa.Column("heure_fin", sa.Time),
        sa.Column("temp_fin_c", sa.Numeric(4, 1)),
        sa.Column("vent_fin_ms", sa.Numeric(5, 1)),
        sa.Column("heures_vol_decimal", sa.Numeric(5, 2)),
        sa.Column("type_vol", sa.String(20), nullable=False),
        sa.Column("observation", sa.Text),
        sa.UniqueConstraint("fiche_vol_id", "numero_passage"),
    )

    op.create_table(
        "fiche_vol_cumul",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fiche_vol_id", UUID(as_uuid=True), sa.ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False),
        sa.Column("periode", sa.String(10), nullable=False),
        sa.Column("convoyage_h", sa.Numeric(6, 2)),
        sa.Column("mixte_h", sa.Numeric(6, 2)),
        sa.Column("prospection_h", sa.Numeric(6, 2)),
        sa.Column("mise_en_place_h", sa.Numeric(6, 2)),
        sa.Column("application_h", sa.Numeric(6, 2)),
        sa.Column("divers_h", sa.Numeric(6, 2)),
        sa.Column("total_h", sa.Numeric(6, 2)),
        sa.UniqueConstraint("fiche_vol_id", "periode"),
    )

    op.create_table(
        "fiche_vol_pesticide",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fiche_vol_id", UUID(as_uuid=True), sa.ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nom_commercial", sa.String(100), nullable=False),
        sa.Column("quantite_dispo_l", sa.Numeric(10, 2)),
        sa.Column("quantite_recue_l", sa.Numeric(10, 2)),
        sa.Column("quantite_utilisee_l", sa.Numeric(10, 2)),
        sa.Column("quantite_perdue_l", sa.Numeric(10, 2)),
        sa.Column("quantite_restante_l", sa.Numeric(10, 2)),
        sa.Column("explication_perte", sa.Text),
        sa.Column("futs_disponibles", sa.Integer),
        sa.Column("futs_recus", sa.Integer),
        sa.Column("futs_pleins", sa.Integer),
        sa.Column("futs_vides", sa.Integer),
    )

    op.create_table(
        "fiche_conflict_archive",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("table_name", sa.Text, nullable=False),
        sa.Column("fiche_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version_locale", JSONB, nullable=False),
        sa.Column("version_serveur", JSONB, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolu_par", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id")),
        sa.Column("resolu_le", sa.TIMESTAMP(timezone=True)),
        sa.Column("resolution", sa.String(20)),
    )

    # Index
    op.create_index("idx_station_pa", "station", ["pa_id"])
    op.create_index("idx_prosp_ext_station", "prospection_extensive", ["station_id"])
    op.create_index("idx_prosp_ext_date", "prospection_extensive", ["date_releve"])
    op.create_index("idx_prosp_int_station", "prospection_intensive", ["station_id"])
    op.create_index("idx_prosp_int_date", "prospection_intensive", ["date_releve"])
    op.create_index("idx_crt_pa", "compte_rendu_traitement", ["pa_id"])
    op.create_index("idx_crt_date", "compte_rendu_traitement", ["date_traitement"])
    op.create_index("idx_capture_intensive", "capture", ["prospection_intensive_id"])
    op.create_index("idx_capture_extensive", "capture", ["prospection_extensive_id"])
    op.create_index("idx_meteo_station_mois", "releve_meteo", ["station_meteo_id", "annee", "mois"])
    op.create_index("idx_conflict_table", "fiche_conflict_archive", ["table_name", "fiche_id"])


def downgrade() -> None:
    op.drop_table("fiche_conflict_archive")
    op.drop_table("fiche_vol_pesticide")
    op.drop_table("fiche_vol_cumul")
    op.drop_table("fiche_vol_passage")
    op.drop_table("fiche_vol")
    op.drop_table("crt_habitat_proximite")
    op.drop_table("crt_non_cible")
    op.drop_table("crt_pesticide")
    op.drop_table("crt_moyens_materiels")
    op.drop_table("crt_moyens_humains")
    op.drop_table("crt_zone_cible")
    op.drop_table("crt_cible_espece")
    op.drop_table("crt_point_gps")
    op.drop_table("compte_rendu_traitement")
    op.drop_table("texture_sol")
    op.drop_table("humidite_sol")
    op.drop_table("vegetation")
    op.drop_table("infestation")
    op.drop_table("population_acridien")
    op.drop_table("capture")
    op.drop_table("prospection_intensive")
    op.drop_table("prospection_extensive")
    op.drop_table("mesure_meteo_jour")
    op.drop_table("releve_meteo")
    op.drop_table("utilisateur")
    op.drop_table("station_meteo")
    op.drop_table("station")
    op.drop_table("poste_acridien")
