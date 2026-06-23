import uuid
from datetime import date, datetime

from sqlalchemy import TIMESTAMP, CheckConstraint, Date, ForeignKey, Integer, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ReleveMeteo(Base):
    __tablename__ = "releve_meteo"
    __table_args__ = (UniqueConstraint("station_meteo_id", "mois", "annee"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    station_meteo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("station_meteo.id"), nullable=False)
    mois: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    annee: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    saisi_par: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    valide_par: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
    valide_le: Mapped[date | None] = mapped_column(Date)
    local_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    server_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    mesures: Mapped[list["MesureMeteoJour"]] = relationship(back_populates="releve", cascade="all, delete-orphan")


class MesureMeteoJour(Base):
    __tablename__ = "mesure_meteo_jour"
    __table_args__ = (UniqueConstraint("releve_id", "jour"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    releve_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("releve_meteo.id", ondelete="CASCADE"), nullable=False)
    jour: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    decade: Mapped[str] = mapped_column(String(2), nullable=False)
    pluie_mm: Mapped[float | None] = mapped_column(Numeric(6, 1))
    pluie_nb_jours: Mapped[int | None] = mapped_column(SmallInteger)
    temp_min_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_max_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    temp_moy_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    direction_vent: Mapped[str | None] = mapped_column(String(10))
    force_vent_ms: Mapped[float | None] = mapped_column(Numeric(5, 1))
    observation: Mapped[str | None] = mapped_column(Text)

    releve: Mapped["ReleveMeteo"] = relationship(back_populates="mesures")
