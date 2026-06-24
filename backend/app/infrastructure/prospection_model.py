import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, ForeignKey, Integer, Numeric, Text, TIMESTAMP, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProspectionModel(Base):
    __tablename__ = "prospection"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_prospection: Mapped[str] = mapped_column(Text(), nullable=False)
    campagne_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campagne.id"), nullable=False)
    prospecteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("station_fixe.id", deferrable=True, initially="deferred"), nullable=True
    )
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
    vegetation: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    sol: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
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

    populations: Mapped[list["ProspectionPopulationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    captures: Mapped[list["ProspectionCaptureModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    infestations: Mapped[list["ProspectionInfestationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )

    station: Mapped["StationFixeModel | None"] = relationship()

    __table_args__ = (
        CheckConstraint(
            "type_prospection IN ('intensive','extensive','validation')",
            name="ck_prospection_type_prospection",
        ),
        CheckConstraint(
            "statut IN ('brouillon','en_attente','verifiee','validee','rejetee')",
            name="ck_prospection_statut",
        ),
        CheckConstraint(
            "statut_sync IN ('local','synced','conflict')",
            name="ck_prospection_statut_sync",
        ),
        CheckConstraint(
            "degats_cultures IN ('nuls','faibles','moyens','forts')",
            name="ck_prospection_degats_cultures",
        ),
    )


class ProspectionPopulationModel(Base):
    __tablename__ = "prospection_population"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
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

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_population_espece"),
        CheckConstraint("categorie IN ('imago','larve')", name="ck_prospection_population_categorie"),
        CheckConstraint(
            "accouplement IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_accouplement",
        ),
        CheckConstraint(
            "ponte IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_ponte",
        ),
        UniqueConstraint("prospection_id", "espece", "categorie", name="uq_prospection_population"),
    )


class ProspectionCaptureModel(Base):
    __tablename__ = "prospection_capture"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
    )
    espece: Mapped[str] = mapped_column(Text(), nullable=False)
    categorie: Mapped[str] = mapped_column(Text(), nullable=False)
    sexe: Mapped[str | None] = mapped_column(Text(), nullable=True)
    phase: Mapped[str] = mapped_column(Text(), nullable=False)
    stade: Mapped[str] = mapped_column(Text(), nullable=False)
    effectif: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)

    prospection: Mapped["ProspectionModel"] = relationship(back_populates="captures")

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_capture_espece"),
        CheckConstraint("categorie IN ('imago','larve')", name="ck_prospection_capture_categorie"),
        CheckConstraint("sexe IN ('F','M')", name="ck_prospection_capture_sexe"),
        CheckConstraint(
            "phase IN ('solitaire','solitaro_trans','transiens','gregaire')",
            name="ck_prospection_capture_phase",
        ),
    )


class ProspectionInfestationModel(Base):
    __tablename__ = "prospection_infestation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
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

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_infestation_espece"),
        CheckConstraint(
            "type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','essaim')",
            name="ck_prospection_infestation_type_cible",
        ),
        CheckConstraint(
            "comportement IN ('repos','deplacement')",
            name="ck_prospection_infestation_comportement",
        ),
    )


class AuditLogModel(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_type: Mapped[str] = mapped_column(Text(), nullable=False)
    fiche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    auteur_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
    action: Mapped[str] = mapped_column(Text(), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "fiche_type IN ('intensive','extensive','validation','crt','vol','meteo')",
            name="ck_audit_log_fiche_type",
        ),
        CheckConstraint(
            "action IN ('creation','modification','soumission','verification','validation','rejet','commentaire')",
            name="ck_audit_log_action",
        ),
    )
