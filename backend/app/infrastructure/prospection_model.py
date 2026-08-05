import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    TIMESTAMP,
    Date,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProspectionModel(Base):
    __tablename__ = "prospection"
    __table_args__ = (
        CheckConstraint(
            "degats_cultures = ANY (ARRAY['nuls','faibles','moyens','forts'])",
            name="ck_prospection_degats_cultures",
        ),
        CheckConstraint(
            "statut = ANY (ARRAY['brouillon','en_attente','verifiee','validee','rejetee'])",
            name="ck_prospection_statut",
        ),
        CheckConstraint(
            "statut_sync = ANY (ARRAY['local','synced','conflict'])",
            name="ck_prospection_statut_sync",
        ),
        CheckConstraint(
            "type_prospection = ANY (ARRAY['intensive','extensive','validation'])",
            name="ck_prospection_type_prospection",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_prospection: Mapped[str] = mapped_column(Text(), nullable=False)
    campagne_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campagne.id"), nullable=False, index=True)
    prospecteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False, index=True)
    station_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("station_fixe.id"), nullable=True)

    n_releve: Mapped[str | None] = mapped_column(Text(), nullable=True)
    n_fiche: Mapped[str | None] = mapped_column(Text(), nullable=True)
    n_message: Mapped[str | None] = mapped_column(Text(), nullable=True)

    date_prospection: Mapped[date] = mapped_column(Date(), nullable=False)

    latitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    biotope: Mapped[str | None] = mapped_column(Text(), nullable=True)
    surf_station: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surf_prospectee: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surf_infestee: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    degats_cultures: Mapped[str | None] = mapped_column(Text(), nullable=True)
    derniere_pluie: Mapped[date | None] = mapped_column(Date(), nullable=True)
    intensite_pluie: Mapped[str | None] = mapped_column(Text(), nullable=True)

    vegetation: Mapped[dict[str, Any] | None] = mapped_column(JSONB(), nullable=True)
    sol: Mapped[dict[str, Any] | None] = mapped_column(JSONB(), nullable=True)

    ennemis_naturels: Mapped[str | None] = mapped_column(Text(), nullable=True)
    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)

    statut: Mapped[str] = mapped_column(Text(), nullable=False, default="brouillon")
    statut_sync: Mapped[str] = mapped_column(Text(), nullable=False, default="local")

    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    station: Mapped["StationFixeModel"] = relationship(back_populates="prospections")
    populations: Mapped[list["ProspectionPopulationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    captures: Mapped[list["ProspectionCaptureModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    infestations: Mapped[list["ProspectionInfestationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )


class ProspectionPopulationModel(Base):
    __tablename__ = "prospection_population"
    __table_args__ = (
        UniqueConstraint("prospection_id", "espece", "categorie", name="uq_prospection_population"),
        CheckConstraint("espece = ANY (ARRAY['LMC','NSE'])", name="ck_prospection_population_espece"),
        CheckConstraint("categorie = ANY (ARRAY['imago','larve'])", name="ck_prospection_population_categorie"),
        CheckConstraint(
            "accouplement = ANY (ARRAY['neant','rare','peu','beaucoup','dominant'])",
            name="ck_prospection_population_accouplement",
        ),
        CheckConstraint(
            "ponte = ANY (ARRAY['neant','rare','peu','beaucoup','dominant'])",
            name="ck_prospection_population_ponte",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False, index=True
    )
    espece: Mapped[str] = mapped_column(Text(), nullable=False)
    categorie: Mapped[str] = mapped_column(Text(), nullable=False)
    densite_diffuse: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_groupee: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    captures_nombre: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    temps_capture: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    accouplement: Mapped[str | None] = mapped_column(Text(), nullable=True)
    ponte: Mapped[str | None] = mapped_column(Text(), nullable=True)

    prospection: Mapped["ProspectionModel"] = relationship(back_populates="populations")


class ProspectionCaptureModel(Base):
    __tablename__ = "prospection_capture"
    __table_args__ = (
        CheckConstraint("espece = ANY (ARRAY['LMC','NSE'])", name="ck_prospection_capture_espece"),
        CheckConstraint("categorie = ANY (ARRAY['imago','larve'])", name="ck_prospection_capture_categorie"),
        CheckConstraint("sexe = ANY (ARRAY['F','M'])", name="ck_prospection_capture_sexe"),
        CheckConstraint(
            "phase = ANY (ARRAY['solitaire','solitaro_trans','transiens','gregaire'])",
            name="ck_prospection_capture_phase",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False, index=True
    )
    espece: Mapped[str] = mapped_column(Text(), nullable=False)
    categorie: Mapped[str] = mapped_column(Text(), nullable=False)
    sexe: Mapped[str | None] = mapped_column(Text(), nullable=True)
    phase: Mapped[str] = mapped_column(Text(), nullable=False)
    stade: Mapped[str] = mapped_column(Text(), nullable=False)
    effectif: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)

    prospection: Mapped["ProspectionModel"] = relationship(back_populates="captures")


class ProspectionInfestationModel(Base):
    __tablename__ = "prospection_infestation"
    __table_args__ = (
        CheckConstraint("espece = ANY (ARRAY['LMC','NSE'])", name="ck_prospection_infestation_espece"),
        CheckConstraint(
            "type_cible = ANY (ARRAY['tache_larvaire','bande_larvaire','vol_clair','essaim'])",
            name="ck_prospection_infestation_type_cible",
        ),
        CheckConstraint(
            "comportement = ANY (ARRAY['repos','deplacement'])",
            name="ck_prospection_infestation_comportement",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False, index=True
    )
    espece: Mapped[str | None] = mapped_column(Text(), nullable=True)
    type_cible: Mapped[str] = mapped_column(Text(), nullable=False)
    taille_min: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    taille_max: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    taille_moy: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surface_tot: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_min: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_max: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_moy: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    interdistance: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    comportement: Mapped[str | None] = mapped_column(Text(), nullable=True)
    direction_de: Mapped[str | None] = mapped_column(Text(), nullable=True)
    direction_vers: Mapped[str | None] = mapped_column(Text(), nullable=True)
    vent_de: Mapped[str | None] = mapped_column(Text(), nullable=True)
    vent_vitesse: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    prospection: Mapped["ProspectionModel"] = relationship(back_populates="infestations")