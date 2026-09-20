import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    TIMESTAMP,
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
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.prospection_model import ProspectionModel
from app.infrastructure.referentiel_model import (
    BaseAerienneModel,
    EquipeAerienneModel,
    StandRemplissageModel,
)
from app.models.base import Base


class CampagneFicheVolCompteurModel(Base):
    """Verrou d'incrément pour le compteur continu du numéro de fiche de vol
    (`composer_numero_fiche`). Une ligne par campagne, jamais réinitialisée.

    Manipulée uniquement en SQL brut (`FicheVolRepositoryImpl.next_compteur`, upsert
    atomique) : ce modèle n'existe que pour que `Base.metadata` connaisse la table
    (tests, `alembic autogenerate`) — aucune session ORM ne l'insère/modifie
    directement.
    """

    __tablename__ = "campagne_fiche_vol_compteur"

    campagne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campagne.id", ondelete="CASCADE"), primary_key=True
    )
    dernier_compteur: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)


class FicheVolModel(Base):
    __tablename__ = "fiche_vol"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # [compteur 3 chiffres]-[date]-[equipe]-[immatriculation] ; equipe = base.numero.
    # Composé côté domaine (composer_numero_fiche), jamais saisi. Arbitrage du
    # 2026-09-15, remplace le format [Date]-[Base]-[Immatriculation] d'ADR-011 §7.2.
    numero_fiche: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    date_vol: Mapped[date] = mapped_column(Date(), nullable=False)
    # Snapshot du jour (migration 0077) : renseignés depuis l'équipe aérienne à la
    # création (aéronef → immatriculation/société, cf. `FicheVol`), jamais recalculés.
    compagnie: Mapped[str] = mapped_column(String(255), nullable=False)
    immatriculation: Mapped[str] = mapped_column(String(20), nullable=False)
    # Équipe aérienne choisie à la création (migration 0077) — nullable : fiches
    # antérieures et clients mobiles qui ne l'envoient pas encore.
    equipe_aerienne_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipe_aerienne.id", ondelete="RESTRICT"), nullable=True
    )

    # Fragment du compteur continu par campagne (jamais réinitialisé) — cf.
    # campagne_fiche_vol_compteur, alimenté par FicheVolRepositoryImpl.next_compteur.
    campagne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campagne.id"), nullable=False
    )
    compteur: Mapped[int] = mapped_column(Integer(), nullable=False)

    # Lieux : référentiel dédié depuis la migration 0064 (écart assumé par rapport à
    # ADR-011 §7.4 qui les traitait comme des relevés ponctuels — voir la docstring de
    # cette migration pour la justification et le précédent lieu_aerien).
    base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("base_aerienne.id"), nullable=False
    )
    stand_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stand_remplissage.id"), nullable=False
    )

    # Pilote et mécanicien sont externes à l'IFVM (compagnie aérienne ou Armée malgache) :
    # des noms, pas des comptes. Même choix que traitement_aerien.
    pilote: Mapped[str] = mapped_column(String(255), nullable=False)
    mecanicien: Mapped[str] = mapped_column(String(255), nullable=False)
    chef_de_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    consultant_international: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Prospection "principale" affichée en en-tête (Référence) — migration 0070.
    # N'est pas le rattachement réel des vols (vol.prospection_id/rotation_id,
    # inchangés) : seulement la fiche dont numero_fiche_prospection/date_validation
    # sont dérivés par jointure, jamais stockés.
    prospection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="SET NULL"), nullable=True
    )

    # Un seul produit assumé par fiche et par jour — même forme que
    # Prospection.pesticide_* (mode extensif aérien), pas de table 1-N. Quantité
    # utilisée/restante : dérivées (somme des rotations rattachées), jamais stockées.
    pesticide_nom_commercial: Mapped[str | None] = mapped_column(Text(), nullable=True)
    pesticide_quantite_disponible: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    pesticide_quantite_recue: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    futs_disponible: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    futs_recues: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    futs_pleins: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    futs_vides: Mapped[int | None] = mapped_column(Integer(), nullable=True)

    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)
    statut: Mapped[str] = mapped_column(String(30), nullable=False, default="brouillon")
    statut_sync: Mapped[str] = mapped_column(String(30), nullable=False, default="local")
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )

    base: Mapped[BaseAerienneModel] = relationship()
    stand: Mapped[StandRemplissageModel] = relationship()
    equipe: Mapped[EquipeAerienneModel | None] = relationship()
    prospection: Mapped[ProspectionModel | None] = relationship()
    vols: Mapped[list["VolModel"]] = relationship(
        back_populates="fiche_vol", cascade="all, delete-orphan", order_by="VolModel.numero"
    )
    signatures: Mapped[list["FicheVolSignatureModel"]] = relationship(
        back_populates="fiche_vol", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("statut IN ('brouillon','validee')", name="ck_fiche_vol_statut"),
        CheckConstraint("compteur > 0", name="ck_fiche_vol_compteur_positif"),
        UniqueConstraint("campagne_id", "compteur", name="uq_fiche_vol_campagne_compteur"),
        Index("ix_fiche_vol_date_vol", "date_vol"),
        Index("ix_fiche_vol_immatriculation", "immatriculation"),
        Index("ix_fiche_vol_chef_de_base_id", "chef_de_base_id"),
        Index("ix_fiche_vol_campagne_id", "campagne_id"),
        Index("ix_fiche_vol_base_id", "base_id"),
        Index("ix_fiche_vol_stand_id", "stand_id"),
        Index("ix_fiche_vol_equipe_aerienne_id", "equipe_aerienne_id"),
        Index("ix_fiche_vol_prospection_id", "prospection_id"),
    )


class VolModel(Base):
    """Entité faible de `fiche_vol`. La durée n'est pas une colonne : elle se dérive des
    deux heures, et la stocker laisserait des lignes capables de se contredire."""

    __tablename__ = "vol"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_vol_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False
    )
    numero: Mapped[int] = mapped_column(Integer(), nullable=False)
    type_vol: Mapped[str] = mapped_column(String(20), nullable=False)
    heure_debut: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_fin: Mapped[time] = mapped_column(Time(), nullable=False)
    rotation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement_rotation.id", ondelete="SET NULL"), nullable=True
    )
    prospection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="SET NULL"), nullable=True
    )
    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)

    fiche_vol: Mapped[FicheVolModel] = relationship(back_populates="vols")

    __table_args__ = (
        UniqueConstraint("fiche_vol_id", "numero", name="uq_vol_numero"),
        # « Une rotation nécessite au minimum 1 mise en place + 1 application » : au plus un
        # vol de chaque type par rotation. Les lignes sans rotation ne se heurtent jamais à
        # cette contrainte — en SQL, deux NULL ne sont pas égaux.
        UniqueConstraint("rotation_id", "type_vol", name="uq_vol_rotation_type"),
        CheckConstraint(
            "type_vol IN ('PROSPECTION','MEP','APPLICATION','CONVOYAGE','DIVERS')",
            name="ck_vol_type",
        ),
        CheckConstraint(
            "rotation_id IS NULL OR type_vol IN ('MEP','APPLICATION')",
            name="ck_vol_rotation_type_compatible",
        ),
        CheckConstraint(
            "prospection_id IS NULL OR type_vol = 'PROSPECTION'",
            name="ck_vol_prospection_type_compatible",
        ),
        CheckConstraint("heure_fin > heure_debut", name="ck_vol_heures"),
        Index("ix_vol_fiche_vol_id", "fiche_vol_id"),
        Index("ix_vol_rotation_id", "rotation_id"),
        Index("ix_vol_prospection_id", "prospection_id"),
    )


class FicheVolSignatureModel(Base):
    """Décalque de `traitement_signature`, augmenté du tracé manuscrit."""

    __tablename__ = "fiche_vol_signature"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiche_vol_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fiche_vol.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    signataire_nom: Mapped[str] = mapped_column(String(255), nullable=False)
    # Data URI PNG. Nullable : la fiche est enregistrable avant le passage de signature.
    signature_image: Mapped[str | None] = mapped_column(Text(), nullable=True)
    horodatage: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow
    )

    fiche_vol: Mapped[FicheVolModel] = relationship(back_populates="signatures")

    __table_args__ = (
        CheckConstraint(
            "role IN ('PILOTE','MECANICIEN','CHEF_DE_BASE','CONSULTANT_INTERNATIONAL')",
            name="ck_fiche_vol_signature_role",
        ),
        UniqueConstraint("fiche_vol_id", "role", name="uq_fiche_vol_signature"),
        Index("ix_fiche_vol_signature_fiche_vol_id", "fiche_vol_id"),
    )
