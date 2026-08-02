import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PosteAcridienModel(Base):
    __tablename__ = "poste_acridien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    region: Mapped[str | None] = mapped_column(Text(), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    stations: Mapped[list["StationFixeModel"]] = relationship(back_populates="poste")


class StationFixeModel(Base):
    __tablename__ = "station_fixe"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    pa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("poste_acridien.id"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Numeric(), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(), nullable=False)
    altitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    poste: Mapped["PosteAcridienModel"] = relationship(back_populates="stations")


class PesticideModel(Base):
    __tablename__ = "pesticide"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class CultureModel(Base):
    __tablename__ = "culture"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class CodeStadeModel(Base):
    __tablename__ = "code_stade"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    espece: Mapped[str] = mapped_column(Text(), nullable=False)
    libelle: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
