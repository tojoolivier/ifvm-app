import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
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
    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)
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
    terrestre: Mapped["TraitementTerrestreModel | None"] = relationship(
        back_populates="traitement",
        cascade="all, delete-orphan",
        uselist=False,
        foreign_keys="TraitementTerrestreModel.traitement_id",
    )
    signatures: Mapped[list["TraitementSignatureModel"]] = relationship(
        back_populates="traitement", cascade="all, delete-orphan"
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
    surface_infestee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

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
    rotations: Mapped[list["RotationModel"]] = relationship(
        back_populates="aerien", cascade="all, delete-orphan", order_by="RotationModel.numero"
    )


class RotationModel(Base):
    __tablename__ = "traitement_rotation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traitement_aerien_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("traitement_aerien.traitement_id", ondelete="CASCADE"),
        nullable=False,
    )
    numero: Mapped[int] = mapped_column(Integer(), nullable=False)
    numero_cuve: Mapped[str] = mapped_column(String(50), nullable=False)
    produit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pesticide.id"), nullable=False
    )
    quantite_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    temperature_debut_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    temperature_fin_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    vent_debut_ms: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    vent_fin_ms: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    aerien: Mapped[TraitementAerienModel] = relationship(back_populates="rotations")

    __table_args__ = (
        UniqueConstraint("traitement_aerien_id", "numero", name="uq_traitement_rotation_numero"),
    )


class TraitementTerrestreModel(Base):
    __tablename__ = "traitement_terrestre"

    traitement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), primary_key=True
    )
    heure_debut: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_fin: Mapped[time] = mapped_column(Time(), nullable=False)
    vitesse_vent_ms: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    direction_vent: Mapped[str | None] = mapped_column(String(2), nullable=True)
    temperature_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    reprise_traitement: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    traitement_origine_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id"), nullable=True
    )
    chef_equipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    agent_encadreur_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    consultant_international: Mapped[str | None] = mapped_column(String(255), nullable=True)
    surface_atomiseur_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_disque_rotatif_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_ulvamast_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_traitee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_cumulee_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_restante_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    surface_restante_abandonnee: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    motif_surface_restante_abandonnee: Mapped[str | None] = mapped_column(Text(), nullable=True)
    essence_litres: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    nb_piles: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    total_pesticide_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    traitement: Mapped[TraitementModel] = relationship(
        back_populates="terrestre", foreign_keys=[traitement_id]
    )
    produits: Mapped[list["ProduitUtiliseModel"]] = relationship(
        back_populates="terrestre",
        cascade="all, delete-orphan",
        order_by="ProduitUtiliseModel.numero",
    )

    __table_args__ = (
        CheckConstraint("heure_fin > heure_debut", name="ck_traitement_terrestre_heures"),
        CheckConstraint(
            "direction_vent IN ('N','NE','E','SE','S','SO','O','NO')",
            name="ck_traitement_terrestre_direction_vent",
        ),
        CheckConstraint(
            "surface_restante_ha IS NULL OR surface_restante_ha <= 0"
            " OR surface_restante_abandonnee IS NOT NULL",
            name="ck_traitement_terrestre_surface_restante",
        ),
        Index(
            "uq_traitement_terrestre_origine_id",
            "traitement_origine_id",
            unique=True,
            postgresql_where=text("traitement_origine_id IS NOT NULL"),
        ),
    )


class ProduitUtiliseModel(Base):
    __tablename__ = "traitement_produit_utilise"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traitement_terrestre_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("traitement_terrestre.traitement_id", ondelete="CASCADE"),
        nullable=False,
    )
    numero: Mapped[int] = mapped_column(Integer(), nullable=False)
    produit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pesticide.id"), nullable=False
    )
    quantite_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    terrestre: Mapped[TraitementTerrestreModel] = relationship(back_populates="produits")

    __table_args__ = (
        UniqueConstraint(
            "traitement_terrestre_id", "numero", name="uq_traitement_produit_utilise_numero"
        ),
    )


class TraitementSignatureModel(Base):
    __tablename__ = "traitement_signature"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traitement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    signataire_nom: Mapped[str] = mapped_column(String(255), nullable=False)
    horodatage: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )

    traitement: Mapped[TraitementModel] = relationship(back_populates="signatures")

    __table_args__ = (
        CheckConstraint(
            "role IN ('PILOTE','MECANICIEN','CHEF_DE_BASE','CHEF_EQUIPE',"
            "'CONSULTANT_INTERNATIONAL')",
            name="ck_traitement_signature_role",
        ),
        UniqueConstraint("traitement_id", "role", name="uq_traitement_signature"),
    )
