from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Date,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

# ✅ Correction : utiliser les modèles existants
from app.models.base import Base  # au lieu de app.infrastructure.base_model


class TraitementModel(Base):
    """Table traitement (table principale)"""

    __tablename__ = "traitement"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    prospection_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
    )
    numero_fiche: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    type_traitement: Mapped[str] = mapped_column(String(30), nullable=False)  # AERIEN, TERRESTRE
    mode_traitement: Mapped[str | None] = mapped_column(String(30), nullable=True)
    traitement_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("prospection.id", ondelete="CASCADE"),
        nullable=False,
    )
    date_validation: Mapped[Date | None] = mapped_column(Date, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(11, 8), nullable=True)
    altitude: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    commune: Mapped[str | None] = mapped_column(String(100), nullable=True)
    localite: Mapped[str] = mapped_column(String(255), nullable=False)
    statut: Mapped[str] = mapped_column(String(30), nullable=False, default="brouillon")
    statut_sync: Mapped[str] = mapped_column(String(30), nullable=False, default="local")
    created_at: Mapped[Date] = mapped_column(Date, nullable=False)
    updated_at: Mapped[Date] = mapped_column(Date, nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id"),
        nullable=True,
    )
    validated_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id"),
        nullable=True,
    )
    validated_at: Mapped[Date | None] = mapped_column(Date, nullable=True)

    # Relations (à définir plus tard)
    # prospection: Mapped["ProspectionModel"] = relationship()
    # created_by_user: Mapped["Utilisateur"] = relationship(foreign_keys=[created_by])
    # validated_by_user: Mapped["Utilisateur"] = relationship(foreign_keys=[validated_by])


class TraitementAerienModel(Base):
    __tablename__ = "traitement_aerien"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    traitement_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("traitement.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # Relation 1-1
    )
    pilote: Mapped[str] = mapped_column(String(255), nullable=False)
    mecanicien: Mapped[str] = mapped_column(String(255), nullable=False)
    chef_de_base_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("utilisateur.id"),
        nullable=False,
    )
    consultant_international: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nb_rotations: Mapped[int] = mapped_column(nullable=False, default=0)
    total_pesticide_l: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0"),
    )

    # Relations
    rotations: Mapped[list["TraitementRotationModel"]] = relationship(
        back_populates="traitement_aerien",
        cascade="all, delete-orphan",
        order_by="TraitementRotationModel.numero",
    )


class TraitementRotationModel(Base):
    __tablename__ = "traitement_rotation"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    traitement_aerien_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("traitement_aerien.id", ondelete="CASCADE"),
        nullable=False,
    )
    numero: Mapped[int] = mapped_column(nullable=False)
    numero_cuve: Mapped[str] = mapped_column(String(50), nullable=False)
    produit_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("pesticide.id"),
        nullable=False,
    )
    quantite_l: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    temperature_debut_c: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    temperature_fin_c: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    vent_debut_ms: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    vent_fin_ms: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)

    __table_args__ = (
        UniqueConstraint("traitement_aerien_id", "numero", name="uq_rotation_numero"),
        UniqueConstraint("traitement_aerien_id", "numero_cuve", name="uq_rotation_cuve"),
    )

    # Relations
    traitement_aerien: Mapped["TraitementAerienModel"] = relationship(back_populates="rotations")
