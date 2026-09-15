import uuid
from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
)
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


class LieuAerienModel(Base):
    """Base principale, base secondaire ou stand de remplissage.

    Table unique typée par `type_lieu` plutôt que trois tables séparées : les
    trois partagent exactement les mêmes attributs (nom, coordonnées), même
    choix que `prospection.type_prospection` (ADR-006). Un `traitement_aerien`
    référence cette table jusqu'à trois fois avec des rôles différents (base
    principale, stand, base secondaire) — relation récursive-par-rôles, pas de
    contrainte SQL possible pour forcer `type_lieu` par rôle (CHECK inter-table
    impossible en Postgres) : à valider côté application.
    """

    __tablename__ = "lieu_aerien"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_lieu: Mapped[str] = mapped_column(Text(), nullable=False)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "type_lieu IN ('principale','secondaire','stand')", name="ck_lieu_aerien_type"
        ),
    )


class BaseAerienneModel(Base):
    """Base principale ou base secondaire de la fiche de vol.

    Table unique auto-référencée (`parent_base_id NULL` = principale, sinon
    secondaire) plutôt que deux tables — même raisonnement que
    `LieuAerienModel.type_lieu` : les deux niveaux partagent exactement les
    mêmes attributs, seule la hiérarchie diffère. Introduite en migration
    0064, délibérément distincte de `lieu_aerien` malgré le chevauchement
    conceptuel : `lieu_aerien` a été débranché deux fois des fiches qui le
    référençaient (`traitement_aerien` en 0054, `prospection` en 0063) parce
    que choisir la base dans un référentiel synchronisé s'est révélé être une
    contrainte terrain non voulue. La fiche de vol reprend malgré tout un
    référentiel dédié — décision produit explicite, maintenue en connaissance
    de ce précédent (cf. docstring de la migration 0064).
    """

    __tablename__ = "base_aerienne"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_base_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("base_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    parent: Mapped["BaseAerienneModel"] = relationship(remote_side=[id])


class StandRemplissageModel(Base):
    """Stand de remplissage de la fiche de vol — même forme que `BaseAerienneModel`,
    sans hiérarchie."""

    __tablename__ = "stand_remplissage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class PesticideModel(Base):
    __tablename__ = "pesticide"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    matiere_active: Mapped[str | None] = mapped_column(Text(), nullable=True)
    dose_reference: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # NULL = pesticides déjà enregistrés avant l'ajout de cette classification
    # (#0044) — aucune valeur ne peut leur être déduite automatiquement.
    type_produit: Mapped[str | None] = mapped_column(Text(), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "type_produit IN ('produit_choc', 'produit_barriere')",
            name="ck_pesticide_type_produit",
        ),
    )


class CultureModel(Base):
    __tablename__ = "culture"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class StadeModel(Base):
    """Vocabulaire des stades : ce qu'une capture a le droit de référencer.

    Distinct de `code_stade`, qui dit *où* un code apparaît à la saisie — un même code
    figure dans plusieurs grilles (A1 est un stade femelle et un stade mâle).
    """

    __tablename__ = "stade"

    code: Mapped[str] = mapped_column(Text(), primary_key=True)
    libelle: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)


class CodeStadeModel(Base):
    """Place d'un code de stade dans une grille de saisie — l'entité que les tablettes
    synchronisent pour construire leurs écrans de capture."""

    __tablename__ = "code_stade"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(Text(), ForeignKey("stade.code"), nullable=False)
    categorie: Mapped[str] = mapped_column(Text(), nullable=False)
    # NULL = stade larvaire, non sexé à la saisie.
    sexe: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # NULL = applicable aux deux espèces (A1, L1, ...) ; seuls L6/L7 sont propres à
    # Nomadacris.
    espece: Mapped[str | None] = mapped_column(Text(), nullable=True)
    libelle: Mapped[str] = mapped_column(Text(), nullable=False)
    ordre: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("categorie IN ('imago', 'larve')", name="ck_code_stade_categorie"),
        CheckConstraint("sexe IN ('F', 'M')", name="ck_code_stade_sexe"),
        Index(
            "uq_code_stade_grille",
            "code",
            "categorie",
            "sexe",
            "espece",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
    )
