import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    TIMESTAMP, Date, ForeignKey, Integer, Numeric, SmallInteger,
    String, Text, Time, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FicheVol(Base):
    __tablename__ = "fiche_vol"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    crt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("compte_rendu_traitement.id"), nullable=False, unique=True)
    date_vol: Mapped[date] = mapped_column(Date, nullable=False)
    societe: Mapped[str | None] = mapped_column(String(100))
    immatriculation: Mapped[str | None] = mapped_column(String(20))
    mecanicien_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    chef_de_base_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    pilote_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    base_nom: Mapped[str | None] = mapped_column(String(100))
    base_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    base_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    base_sec_nom: Mapped[str | None] = mapped_column(String(100))
    base_sec_latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    base_sec_longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    heures_vol_avant_grande_visite: Mapped[float | None] = mapped_column(Numeric(6, 2))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    passages: Mapped[list["FicheVolPassage"]] = relationship(back_populates="fiche_vol", cascade="all, delete-orphan")
    cumuls: Mapped[list["FicheVolCumul"]] = relationship(back_populates="fiche_vol", cascade="all, delete-orphan")
    pesticides: Mapped[list["FicheVolPesticide"]] = relationship(back_populates="fiche_vol", cascade="all, delete-orphan")


class FicheVolPassage(Base):
    __tablename__ = "fiche_vol_passage"
    __table_args__ = (UniqueConstraint("fiche_vol_id", "numero_passage"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_vol_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False)
    numero_passage: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    numero_cuve: Mapped[str | None] = mapped_column(String(20))
    produit: Mapped[str | None] = mapped_column(String(100))
    quantite_l: Mapped[float | None] = mapped_column(Numeric(8, 2))
    heure_debut: Mapped[time | None] = mapped_column(Time)
    temp_debut_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    vent_debut_ms: Mapped[float | None] = mapped_column(Numeric(5, 1))
    heure_fin: Mapped[time | None] = mapped_column(Time)
    temp_fin_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    vent_fin_ms: Mapped[float | None] = mapped_column(Numeric(5, 1))
    heures_vol_decimal: Mapped[float | None] = mapped_column(Numeric(5, 2))
    type_vol: Mapped[str] = mapped_column(String(20), nullable=False)
    observation: Mapped[str | None] = mapped_column(Text)

    fiche_vol: Mapped["FicheVol"] = relationship(back_populates="passages")


class FicheVolCumul(Base):
    __tablename__ = "fiche_vol_cumul"
    __table_args__ = (UniqueConstraint("fiche_vol_id", "periode"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_vol_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False)
    periode: Mapped[str] = mapped_column(String(10), nullable=False)
    convoyage_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    mixte_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    prospection_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    mise_en_place_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    application_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    divers_h: Mapped[float | None] = mapped_column(Numeric(6, 2))
    total_h: Mapped[float | None] = mapped_column(Numeric(6, 2))

    fiche_vol: Mapped["FicheVol"] = relationship(back_populates="cumuls")


class FicheVolPesticide(Base):
    __tablename__ = "fiche_vol_pesticide"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_vol_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False)
    nom_commercial: Mapped[str] = mapped_column(String(100), nullable=False)
    quantite_dispo_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    quantite_recue_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    quantite_utilisee_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    quantite_perdue_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    quantite_restante_l: Mapped[float | None] = mapped_column(Numeric(10, 2))
    explication_perte: Mapped[str | None] = mapped_column(Text)
    futs_disponibles: Mapped[int | None] = mapped_column(Integer)
    futs_recus: Mapped[int | None] = mapped_column(Integer)
    futs_pleins: Mapped[int | None] = mapped_column(Integer)
    futs_vides: Mapped[int | None] = mapped_column(Integer)

    fiche_vol: Mapped["FicheVol"] = relationship(back_populates="pesticides")
