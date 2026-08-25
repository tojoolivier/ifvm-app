import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProspectionModel(Base):
    __tablename__ = "prospection"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_prospection: Mapped[str] = mapped_column(Text(), nullable=False)
    campagne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campagne.id"), nullable=False
    )
    prospecteur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("station_fixe.id", deferrable=True, initially="deferred"),
        nullable=True,
    )
    n_releve: Mapped[str | None] = mapped_column(Text(), nullable=True)
    n_fiche: Mapped[str | None] = mapped_column(Text(), nullable=True)
    n_message: Mapped[str | None] = mapped_column(Text(), nullable=True)
    date_prospection: Mapped[date] = mapped_column(Date(), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    biotope: Mapped[str | None] = mapped_column(Text(), nullable=True)
    surface_station: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surface_prospectee: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surface_infestee: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    degats_cultures: Mapped[str | None] = mapped_column(Text(), nullable=True)
    derniere_pluie: Mapped[date | None] = mapped_column(Date(), nullable=True)
    intensite_pluie: Mapped[str | None] = mapped_column(Text(), nullable=True)
    vegetation: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    sol: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    verdissement: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    hauteur_strate: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    ennemis_naturels: Mapped[str | None] = mapped_column(Text(), nullable=True)
    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)
    statut: Mapped[str] = mapped_column(Text(), nullable=False, server_default="brouillon")
    statut_sync: Mapped[str] = mapped_column(Text(), nullable=False, server_default="local")
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    validated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    validated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
        onupdate=sa.text("now()"),
    )

    # ==========================================
    # NOUVEAUX CHAMPS - Références (A)
    # ==========================================
    region: Mapped[str | None] = mapped_column(Text(), nullable=True)
    district: Mapped[str | None] = mapped_column(Text(), nullable=True)
    commune: Mapped[str | None] = mapped_column(Text(), nullable=True)
    za: Mapped[str | None] = mapped_column(Text(), nullable=True)
    pa_code: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # ==========================================
    # NOUVEAUX CHAMPS - Observations (D)
    # ==========================================
    degats_cultures_pourcent: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    verdissement_pourcent: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    hauteur_herbe_cm: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif & Validation
    # ==========================================
    station_libre: Mapped[str | None] = mapped_column(Text(), nullable=True)
    type_station: Mapped[str | None] = mapped_column(Text(), nullable=True)
    verdure_strate: Mapped[str | None] = mapped_column(Text(), nullable=True)
    signalement_source: Mapped[str | None] = mapped_column(Text(), nullable=True)
    signalement_date: Mapped[str | None] = mapped_column(Text(), nullable=True)
    signalement_description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    conclusion_validation: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # ==========================================
    # NOUVEAUX CHAMPS - Avertissements non bloquants (#106)
    # ==========================================
    avertissements: Mapped[list[str]] = mapped_column(
        JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
    )

    populations: Mapped[list["ProspectionPopulationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    captures: Mapped[list["ProspectionCaptureModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )
    infestations: Mapped[list["ProspectionInfestationModel"]] = relationship(
        back_populates="prospection", cascade="all, delete-orphan"
    )

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
        CheckConstraint(
            "biotope IN ('xerophyle', 'mesophyle', 'hydrophyle')",
            name="ck_prospection_biotope",
        ),
        CheckConstraint(
            "type_station IN ('xerophyle', 'mesophyle', 'hydrophyle')",
            name="ck_prospection_type_station",
        ),
        CheckConstraint(
            "verdure_strate IN ('faible','moyenne','forte')",
            name="ck_prospection_verdure_strate",
        ),
        CheckConstraint(
            "conclusion_validation IN ('confirmee','infirmee')",
            name="ck_prospection_conclusion_validation",
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
    methode: Mapped[str | None] = mapped_column(Text(), nullable=True)
    phase: Mapped[str | None] = mapped_column(Text(), nullable=True)
    accouplement: Mapped[str | None] = mapped_column(Text(), nullable=True)
    ponte: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Imagos (B)
    # ==========================================
    captures_sol: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    captures_trans: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    captures_greg: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    stade_imago: Mapped[str | None] = mapped_column(Text(), nullable=True)
    essaim_observe: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)

    # ==========================================
    # NOUVEAUX CHAMPS - Extensif Larves (C)
    # ==========================================
    densites_larve: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    tache_larvaire: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    bande_larvaire: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    interdistance: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    deplacement: Mapped[str | None] = mapped_column(Text(), nullable=True)

    prospection: Mapped["ProspectionModel"] = relationship(back_populates="populations")

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_population_espece"),
        CheckConstraint(
            "categorie IN ('imago','larve')", name="ck_prospection_population_categorie"
        ),
        CheckConstraint(
            "accouplement IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_accouplement",
        ),
        CheckConstraint(
            "ponte IN ('neant','rare','peu','beaucoup','dominant')",
            name="ck_prospection_population_ponte",
        ),
        CheckConstraint(
            "methode IN ('visuel','comptage_direct')",
            name="ck_prospection_population_methode",
        ),
        CheckConstraint(
            "stade_imago IN ('A1','A2','A3','A4','A5')",
            name="ck_prospection_population_stade_imago",
        ),
        CheckConstraint(
            "deplacement IN ('repos','perchee')",
            name="ck_prospection_population_deplacement",
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
    # Le référentiel `stade` est l'unique autorité sur le vocabulaire des stades : une
    # énumération recopiée ici dériverait de lui (#201).
    stade: Mapped[str] = mapped_column(Text(), ForeignKey("stade.code"), nullable=False)
    effectif: Mapped[int] = mapped_column(Integer(), nullable=False, server_default="0")

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
    surface_totale: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
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
    imago: Mapped["ProspectionInfestationImagoModel | None"] = relationship(
        back_populates="infestation", uselist=False, cascade="all, delete-orphan"
    )
    larve: Mapped["ProspectionInfestationLarveModel | None"] = relationship(
        back_populates="infestation", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("espece IN ('LMC','NSE')", name="ck_prospection_infestation_espece"),
        CheckConstraint(
            "type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','dense','tres_dense')",
            name="ck_prospection_infestation_type_cible",
        ),
        CheckConstraint(
            "comportement IN ('repos','deplacement')",
            name="ck_prospection_infestation_comportement",
        ),
    )


class ProspectionInfestationImagoModel(Base):
    """Sous-type Imagos (vol clair / essaim) de ProspectionInfestationModel."""

    __tablename__ = "prospection_infestation_imago"

    infestation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prospection_infestation.id", ondelete="CASCADE"),
        primary_key=True,
    )
    pullulation_nb: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    taille_long: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    taille_large: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    taille_epaisseur: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    essaim_en_vol: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    essaim_pose: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    type_essaim: Mapped[str | None] = mapped_column(Text(), nullable=True)
    heure_observation: Mapped[str | None] = mapped_column(Text(), nullable=True)
    densite_en_vol: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    dimension_ha: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    infestation: Mapped["ProspectionInfestationModel"] = relationship(back_populates="imago")

    __table_args__ = (
        CheckConstraint(
            "type_essaim IN ('vol_clair', 'dense', 'tres_dense')",
            name="ck_prospection_infestation_imago_type_essaim",
        ),
    )


class ProspectionInfestationLarveModel(Base):
    """Sous-type Larves (tache / bande larvaire) de ProspectionInfestationModel."""

    __tablename__ = "prospection_infestation_larve"

    infestation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prospection_infestation.id", ondelete="CASCADE"),
        primary_key=True,
    )
    nb_taches_bandes: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    interdistance_m: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    interdistance_min: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    interdistance_max: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    interdistance_moy: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surface_contaminee_ha: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    surface_infestee_pourcent: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    type_larve: Mapped[str | None] = mapped_column(Text(), nullable=True)
    stade_dominant: Mapped[str | None] = mapped_column(Text(), nullable=True)
    taille_groupe_m2: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    front_longueur_m: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    front_largeur_m: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_max_front: Mapped[float | None] = mapped_column(Numeric(), nullable=True)
    densite_moy_arriere_front: Mapped[float | None] = mapped_column(Numeric(), nullable=True)

    infestation: Mapped["ProspectionInfestationModel"] = relationship(back_populates="larve")

    __table_args__ = (
        CheckConstraint(
            "type_larve IN ('tache_larvaire', 'bande_larvaire')",
            name="ck_prospection_infestation_larve_type_larve",
        ),
    )


class AuditLogModel(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_type: Mapped[str] = mapped_column(Text(), nullable=False)
    fiche_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    auteur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(Text(), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "fiche_type IN ('intensive','extensive','validation','crt','vol','meteo')",
            name="ck_audit_log_fiche_type",
        ),
        CheckConstraint(
            "action IN ('creation','modification','soumission',"
            "'verification','validation','rejet','commentaire')",
            name="ck_audit_log_action",
        ),
    )
