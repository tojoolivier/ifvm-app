import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ZoneAntiAcridienModel(Base):
    __tablename__ = "zone_anti_acridien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    postes: Mapped[list["PosteAcridienModel"]] = relationship(back_populates="zone")


class PosteAcridienModel(Base):
    __tablename__ = "poste_acridien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    za_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zone_anti_acridien.id"), nullable=False
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    zone: Mapped["ZoneAntiAcridienModel"] = relationship(back_populates="postes")
    stations: Mapped[list["StationFixeModel"]] = relationship(back_populates="poste")


class RegionModel(Base):
    __tablename__ = "region"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)

    districts: Mapped[list["DistrictModel"]] = relationship(back_populates="region")


class DistrictModel(Base):
    __tablename__ = "district"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("region.id"), nullable=False
    )

    region: Mapped["RegionModel"] = relationship(back_populates="districts")
    communes: Mapped[list["CommuneModel"]] = relationship(back_populates="district")


class CommuneModel(Base):
    __tablename__ = "commune"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    district_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("district.id"), nullable=False
    )

    district: Mapped["DistrictModel"] = relationship(back_populates="communes")


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
    commune_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("commune.id"), nullable=False
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    poste: Mapped["PosteAcridienModel"] = relationship(back_populates="stations")
    commune: Mapped["CommuneModel"] = relationship()


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
