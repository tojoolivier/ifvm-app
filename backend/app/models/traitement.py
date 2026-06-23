import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    TIMESTAMP, Boolean, Date, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, Time, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CompteRenduTraitement(Base):
    __tablename__ = "compte_rendu_traitement"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_crt: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    numero_validation: Mapped[str | None] = mapped_column(String(30), unique=True)
    date_validation: Mapped[date | None] = mapped_column(Date)
    date_traitement: Mapped[date] = mapped_column(Date, nullable=False)
    chef_equipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    agent_encadreur_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    prospection_intensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id"))
    prospection_extensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_extensive.id"))
    pa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("poste_acridien.id"), nullable=False)
    localite: Mapped[str | None] = mapped_column(String(100))
    commune_rurale: Mapped[str | None] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(100))
    zone_acridienne: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    espece_cible: Mapped[str] = mapped_column(String(10), nullable=False)
    surface_infestee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    densite_ind_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    population_type: Mapped[str | None] = mapped_column(String(20))
    mode_traitement: Mapped[str] = mapped_column(String(30), nullable=False)
    surf_atomiseur_dos_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surf_disque_rotatif_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surf_ulvamast_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surf_aeronef_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surf_reste_traiter_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    heure_debut: Mapped[time | None] = mapped_column(Time)
    heure_fin: Mapped[time | None] = mapped_column(Time)
    vent_vitesse_ms: Mapped[float | None] = mapped_column(Numeric(5, 1))
    vent_direction: Mapped[str | None] = mapped_column(String(10))
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    taux_mortalite_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    evaluation_apres_h: Mapped[float | None] = mapped_column(Numeric(4, 1))
    methode_evaluation: Mapped[str | None] = mapped_column(String(30))
    cas_empoisonnement: Mapped[bool | None] = mapped_column(Boolean)
    empoisonne_qui: Mapped[str | None] = mapped_column(String(20))
    empoisonne_mode: Mapped[str | None] = mapped_column(String(20))
    comportement_anormal: Mapped[bool | None] = mapped_column(Boolean)
    mortalite_non_cibles: Mapped[bool | None] = mapped_column(Boolean)
    observation: Mapped[str | None] = mapped_column(Text)
    local_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    server_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    points_gps: Mapped[list["CrtPointGps"]] = relationship(back_populates="crt", cascade="all, delete-orphan")
    pesticides: Mapped[list["CrtPesticide"]] = relationship(back_populates="crt", cascade="all, delete-orphan")


class CrtPointGps(Base):
    __tablename__ = "crt_point_gps"
    __table_args__ = (UniqueConstraint("crt_id", "ordre", "type"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    ordre: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)

    crt: Mapped["CompteRenduTraitement"] = relationship(back_populates="points_gps")


class CrtCibleEspece(Base):
    __tablename__ = "crt_cible_espece"
    __table_args__ = (UniqueConstraint("crt_id", "espece"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    espece: Mapped[str] = mapped_column(String(10), nullable=False)
    phase: Mapped[str | None] = mapped_column(String(50))
    stade: Mapped[str | None] = mapped_column(String(50))


class CrtZoneCible(Base):
    __tablename__ = "crt_zone_cible"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    surface_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))


class CrtMoyensHumains(Base):
    __tablename__ = "crt_moyens_humains"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False, unique=True)
    nb_agents_permanents: Mapped[int | None] = mapped_column(Integer)
    nb_agents_temporaires: Mapped[int | None] = mapped_column(Integer)
    nb_personnel_local: Mapped[int | None] = mapped_column(Integer)


class CrtMoyensMateriels(Base):
    __tablename__ = "crt_moyens_materiels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False, unique=True)
    nb_atomiseurs: Mapped[int | None] = mapped_column(Integer)
    essence_litres: Mapped[float | None] = mapped_column(Numeric(8, 2))
    nb_disques_rotatifs: Mapped[int | None] = mapped_column(Integer)
    nb_piles: Mapped[int | None] = mapped_column(Integer)
    nb_ulvamasts: Mapped[int | None] = mapped_column(Integer)
    nb_combinaisons: Mapped[int | None] = mapped_column(Integer)
    nb_gants: Mapped[int | None] = mapped_column(Integer)
    nb_lunettes: Mapped[int | None] = mapped_column(Integer)
    nb_masques: Mapped[int | None] = mapped_column(Integer)
    nb_bottes: Mapped[int | None] = mapped_column(Integer)


class CrtPesticide(Base):
    __tablename__ = "crt_pesticide"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    nom_commercial: Mapped[str] = mapped_column(String(100), nullable=False)
    matieres_actives: Mapped[str | None] = mapped_column(String(200))
    stock_initial_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    approvisionnement_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    produit_consomme_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    stock_final_l: Mapped[float | None] = mapped_column(Numeric(10, 2))

    crt: Mapped["CompteRenduTraitement"] = relationship(back_populates="pesticides")


class CrtNonCible(Base):
    __tablename__ = "crt_non_cible"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    famille: Mapped[str] = mapped_column(String(20), nullable=False)


class CrtHabitatProximite(Base):
    __tablename__ = "crt_habitat_proximite"
    __table_args__ = (UniqueConstraint("crt_id", "ordre"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id", ondelete="CASCADE"), nullable=False)
    ordre: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    localisation: Mapped[str | None] = mapped_column(String(200))
    distance_km: Mapped[float | None] = mapped_column(Numeric(6, 2))
    sensibilisation: Mapped[bool | None] = mapped_column(Boolean)


class FicheConflictArchive(Base):
    __tablename__ = "fiche_conflict_archive"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_name: Mapped[str] = mapped_column(Text, nullable=False)
    fiche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    version_locale: Mapped[dict] = mapped_column(JSONB, nullable=False)
    version_serveur: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    resolu_par: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    resolu_le: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    resolution: Mapped[str | None] = mapped_column(String(20))
