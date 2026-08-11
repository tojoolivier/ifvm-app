import uuid
from datetime import date, datetime

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TraitementModel(Base):
    __tablename__ = "traitement"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
    )
    numero_fiche: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    type_traitement: Mapped[str] = mapped_column(String(10), nullable=False)
    mode_traitement: Mapped[str | None] = mapped_column(String(30), nullable=True)
    date_traitement: Mapped[date] = mapped_column(Date(), nullable=False)
    date_validation: Mapped[date] = mapped_column(Date(), nullable=False)
    localite: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    commune: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    kit_combinaison: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    kit_gants: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    kit_lunettes: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    kit_masques: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    kit_boite: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    zones_exposees: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    hauteur_strate_herbeuse_m: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    hauteur_strate_arboree_m: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    recouvrement_percent: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    empoisonnement: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    empoisonnement_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    empoisonnement_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    empoisonnement_autre: Mapped[str | None] = mapped_column(Text(), nullable=True)
    evaluation_risque: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    comportement_anormal: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    comportement_non_cibles: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    mortalite: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    mortalite_familles: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    statut: Mapped[str] = mapped_column(String(30), nullable=False, default="brouillon")
    statut_sync: Mapped[str] = mapped_column(String(30), nullable=False, default="local")
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )

    cible: Mapped["CibleModel | None"] = relationship(
        back_populates="traitement", cascade="all, delete-orphan", uselist=False
    )
    aerien: Mapped["TraitementAerienModel | None"] = relationship(
        back_populates="traitement", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        CheckConstraint("type_traitement IN ('AERIEN','TERRESTRE')", name="ck_traitement_type"),
        CheckConstraint("statut IN ('brouillon','validee')", name="ck_traitement_statut"),
        CheckConstraint("date_validation >= date_traitement", name="ck_traitement_date_validation"),
    )


class CibleModel(Base):
    __tablename__ = "cible"

    traitement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), primary_key=True
    )
    espece: Mapped[str | None] = mapped_column(String(10), nullable=True)
    petites_larves: Mapped[str | None] = mapped_column(String(50), nullable=True)
    grandes_larves: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vols_clairs_essaims: Mapped[str | None] = mapped_column(String(50), nullable=True)
    repartition_population: Mapped[str | None] = mapped_column(String(30), nullable=True)
    surface_infestee_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    traitement: Mapped[TraitementModel] = relationship(back_populates="cible")

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE','MELANGE')", name="ck_cible_espece"),
        CheckConstraint(
            "repartition_population IN ('GROUPEE','DIFFUSE')",
            name="ck_cible_repartition_population",
        ),
    )


class TraitementAerienModel(Base):
    __tablename__ = "traitement_aerien"

    traitement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), primary_key=True
    )
    pilote: Mapped[str] = mapped_column(String(255), nullable=False)
    mecanicien: Mapped[str] = mapped_column(String(255), nullable=False)
    chef_de_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    consultant_international: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nb_rotations: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    total_pesticide_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    traitement: Mapped[TraitementModel] = relationship(back_populates="aerien")
