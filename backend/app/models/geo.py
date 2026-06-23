import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, CheckConstraint, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PosteAcridien(Base):
    __tablename__ = "poste_acridien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    region: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str | None] = mapped_column(String(100))
    commune: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    stations: Mapped[list["Station"]] = relationship(back_populates="poste_acridien")
    stations_meteo: Mapped[list["StationMeteo"]] = relationship(back_populates="poste_acridien")


class Station(Base):
    __tablename__ = "station"
    __table_args__ = (UniqueConstraint("pa_id", "code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("poste_acridien.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    nom: Mapped[str | None] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    altitude_m: Mapped[int | None] = mapped_column(Integer)
    biotope: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    poste_acridien: Mapped["PosteAcridien"] = relationship(back_populates="stations")


class StationMeteo(Base):
    __tablename__ = "station_meteo"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("poste_acridien.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    nom: Mapped[str | None] = mapped_column(String(100))
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    altitude_m: Mapped[int | None] = mapped_column(Integer)

    poste_acridien: Mapped["PosteAcridien"] = relationship(back_populates="stations_meteo")
