import uuid
from datetime import date, datetime

from sqlalchemy import (
    TIMESTAMP, Boolean, CheckConstraint, Date, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

_SYNC_STATUS = ("local", "synced", "conflict")
_ESPECE = ("LMC", "NSE")
_INTENSITE = ("faible", "modere", "fort")


class ProspectionExtensive(Base):
    __tablename__ = "prospection_extensive"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("station.id"), nullable=False)
    prospecteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    date_releve: Mapped[date] = mapped_column(Date, nullable=False)
    surface_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    degats_cultures_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    verdissement_herbeuse_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    hauteur_strate_herbeuse_m: Mapped[float | None] = mapped_column(Numeric(5, 2))
    derniere_pluie_date: Mapped[date | None] = mapped_column(Date)
    derniere_pluie_intensite: Mapped[str | None] = mapped_column(String(20))
    observation: Mapped[str | None] = mapped_column(Text)
    local_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    server_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ProspectionIntensive(Base):
    __tablename__ = "prospection_intensive"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_releve: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    station_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("station.id"), nullable=False)
    prospecteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    date_releve: Mapped[date] = mapped_column(Date, nullable=False)
    surface_station_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surface_prospectee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surface_infestee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    derniere_pluie_date: Mapped[date | None] = mapped_column(Date)
    derniere_pluie_intensite: Mapped[str | None] = mapped_column(String(20))
    ennemis_naturels: Mapped[str | None] = mapped_column(Text)
    observation: Mapped[str | None] = mapped_column(Text)
    local_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    server_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    vegetations: Mapped[list["Vegetation"]] = relationship(back_populates="prospection_intensive", cascade="all, delete-orphan")
    humidites_sol: Mapped[list["HumiditeSol"]] = relationship(back_populates="prospection_intensive", cascade="all, delete-orphan")
    textures_sol: Mapped[list["TextureSol"]] = relationship(back_populates="prospection_intensive", cascade="all, delete-orphan")


class Capture(Base):
    __tablename__ = "capture"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"))
    prospection_extensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_extensive.id", ondelete="CASCADE"))
    espece: Mapped[str] = mapped_column(String(10), nullable=False)
    stade_type: Mapped[str] = mapped_column(String(10), nullable=False)
    stade_code: Mapped[str] = mapped_column(String(10), nullable=False)
    sexe: Mapped[str | None] = mapped_column(String(10))
    phase: Mapped[str] = mapped_column(String(20), nullable=False)
    nombre: Mapped[int] = mapped_column(Integer, nullable=False)


class PopulationAcridien(Base):
    __tablename__ = "population_acridien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"))
    prospection_extensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_extensive.id", ondelete="CASCADE"))
    espece: Mapped[str] = mapped_column(String(10), nullable=False)
    stade_type: Mapped[str] = mapped_column(String(10), nullable=False)
    nb_captures: Mapped[int | None] = mapped_column(Integer)
    temps_capture_min: Mapped[int | None] = mapped_column(Integer)
    densite_diffuse_ha: Mapped[float | None] = mapped_column(Numeric(12, 2))
    densite_groupee_m2: Mapped[float | None] = mapped_column(Numeric(12, 2))
    accouplements: Mapped[str | None] = mapped_column(String(20))
    ponte: Mapped[str | None] = mapped_column(String(20))
    surface_infestee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    surface_contaminees_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))


class Infestation(Base):
    __tablename__ = "infestation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"))
    prospection_extensive_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_extensive.id", ondelete="CASCADE"))
    espece: Mapped[str] = mapped_column(String(10), nullable=False)
    type_formation: Mapped[str] = mapped_column(String(20), nullable=False)
    surf_totale_ha: Mapped[float | None] = mapped_column(Numeric(10, 2))
    taille_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
    taille_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
    taille_moy: Mapped[float | None] = mapped_column(Numeric(10, 2))
    densite_min: Mapped[float | None] = mapped_column(Numeric(10, 2))
    densite_max: Mapped[float | None] = mapped_column(Numeric(10, 2))
    densite_moy: Mapped[float | None] = mapped_column(Numeric(10, 2))


class Vegetation(Base):
    __tablename__ = "vegetation"
    __table_args__ = (UniqueConstraint("prospection_intensive_id", "type_strate"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False)
    type_strate: Mapped[str] = mapped_column(String(30), nullable=False)
    surf_relative_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    hauteur_moy_m: Mapped[float | None] = mapped_column(Numeric(5, 2))
    recouvrement_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    verdissement_pct: Mapped[float | None] = mapped_column(Numeric(5, 1))
    repousse: Mapped[bool | None] = mapped_column(Boolean)
    orpad_germination: Mapped[bool | None] = mapped_column(Boolean)
    orpad_feuille: Mapped[bool | None] = mapped_column(Boolean)
    orpad_fleur: Mapped[bool | None] = mapped_column(Boolean)
    orpad_fruit: Mapped[bool | None] = mapped_column(Boolean)
    orpad_sec: Mapped[bool | None] = mapped_column(Boolean)

    prospection_intensive: Mapped["ProspectionIntensive"] = relationship(back_populates="vegetations")


class HumiditeSol(Base):
    __tablename__ = "humidite_sol"
    __table_args__ = (UniqueConstraint("prospection_intensive_id", "profondeur"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False)
    profondeur: Mapped[str] = mapped_column(String(20), nullable=False)
    etat: Mapped[str | None] = mapped_column(String(10))

    prospection_intensive: Mapped["ProspectionIntensive"] = relationship(back_populates="humidites_sol")


class TextureSol(Base):
    __tablename__ = "texture_sol"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_intensive_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prospection_intensive.id", ondelete="CASCADE"), nullable=False)
    texture: Mapped[str] = mapped_column(String(20), nullable=False)

    prospection_intensive: Mapped["ProspectionIntensive"] = relationship(back_populates="textures_sol")
