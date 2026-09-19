import uuid
from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
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
    # Rattachement à une équipe terrestre (migration 0073) : nullable, sans UNIQUE —
    # plusieurs postes peuvent partager la même équipe (équipe mobile).
    # `use_alter=True` : casse le cycle de FK utilisateur.pa_id -> poste_acridien
    # -> equipe_terrestre -> utilisateur.chef_equipe_id, sinon `Base.metadata.
    # create_all()` (tests) ne peut pas trier les tables topologiquement — même
    # mécanique que la migration elle-même, qui ajoute cette FK par `ALTER TABLE`
    # après coup plutôt qu'inline.
    equipe_terrestre_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "equipe_terrestre.id", use_alter=True, name="fk_poste_acridien_equipe_terrestre_id"
        ),
        nullable=True,
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    zone: Mapped["ZoneAntiAcridienModel"] = relationship(back_populates="postes")
    stations: Mapped[list["StationFixeModel"]] = relationship(back_populates="poste")
    equipe_terrestre: Mapped["EquipeTerrestreModel | None"] = relationship()


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
    # Rattachement à une équipe aérienne (migration 0074) : nullable — les lieux déjà
    # en base restent "sans équipe" jusqu'à rattachement manuel ; obligatoire côté
    # application pour toute nouvelle création (LieuAerienCreate). Pas d'UNIQUE :
    # une équipe peut posséder plusieurs lieux (bases principales/secondaires/stands),
    # contrairement à `BaseAerienneModel.equipe_id` (1:1, référentiel distinct dédié à
    # la fiche de vol).
    equipe_aerienne_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("equipe_aerienne.id", ondelete="RESTRICT"),
        nullable=True,
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "type_lieu IN ('principale','secondaire','stand')", name="ck_lieu_aerien_type"
        ),
    )


class AeronefModel(Base):
    """Hélicoptère d'une équipe aérienne (migration 0075) : `immatriculation` en est la
    clé candidate, `societe` (exploitant) et `volume_cuve_l` en dépendent — d'où une
    table à part plutôt que trois colonnes sur `equipe_aerienne` (dépendance transitive
    équipe → immatriculation → société). Affecté à au plus une équipe
    (`EquipeAerienneModel.aeronef_id` UNIQUE)."""

    __tablename__ = "aeronef"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    immatriculation: Mapped[str] = mapped_column(String(20), nullable=False)
    societe: Mapped[str] = mapped_column(Text(), nullable=False)
    volume_cuve_l: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("immatriculation", name="uq_aeronef_immatriculation"),
        CheckConstraint("volume_cuve_l > 0", name="ck_aeronef_volume_cuve_positif"),
    )


class EquipeAerienneModel(Base):
    """Équipe aérienne (#equipe-aerienne, migration 0066) : une équipe = un chef de
    base (`chef_de_base_id` UNIQUE) = une base aérienne principale
    (`BaseAerienneModel.equipe_id` UNIQUE). Demande utilisateur du 2026-09-16, en
    continuité de la fiche de vol (migration 0064).

    `pilote`/`mecanicien`/`consultant_international` (migration 0072) : texte libre,
    même choix que partout ailleurs dans le domaine aérien
    (`fiche_vol.pilote`/`.mecanicien`, `traitement_aerien.pilote`/`.mecanicien`) —
    externes à l'IFVM, pas des comptes `utilisateur`. Nullable en base pour ne pas
    invalider les équipes créées avant cette migration ; `EquipeAerienneCreate`
    (schéma API) exige `pilote`/`mecanicien` pour toute nouvelle équipe,
    `consultant_international` reste facultatif des deux côtés.
    `membres` (`equipe_aerienne_membre`, table fille) : les autres membres de
    l'équipe au-delà de ces rôles nommés, en nombre variable — une liste, pas une
    chaîne concaténée, pour rester en 1FN (chaque membre reste individuellement
    identifiable/supprimable).
    """

    __tablename__ = "equipe_aerienne"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    chef_de_base_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    pilote: Mapped[str | None] = mapped_column(Text(), nullable=True)
    mecanicien: Mapped[str | None] = mapped_column(Text(), nullable=True)
    consultant_international: Mapped[str | None] = mapped_column(Text(), nullable=True)
    # Hélicoptère de l'équipe (migration 0075) : 1:1 (UNIQUE), nullable pour les
    # équipes créées avant cette migration ; exigé par `EquipeAerienneCreate`.
    aeronef_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    membres: Mapped[list["EquipeAerienneMembreModel"]] = relationship(
        back_populates="equipe",
        cascade="all, delete-orphan",
        order_by="EquipeAerienneMembreModel.created_at",
    )
    aeronef: Mapped["AeronefModel | None"] = relationship()

    # Noms de contraintes explicites — doivent matcher la migration 0066 à
    # l'identique : `_traduire_integrite` (referentiel_sync_repository.py) et
    # `EquipeAerienneRepositoryImpl.create` en dépendent pour distinguer les
    # violations (chef déjà assigné) d'une erreur générique.
    __table_args__ = (
        ForeignKeyConstraint(
            ["chef_de_base_id"],
            ["utilisateur.id"],
            name="fk_equipe_aerienne_chef_de_base_id",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("chef_de_base_id", name="uq_equipe_aerienne_chef_de_base_id"),
        ForeignKeyConstraint(
            ["aeronef_id"],
            ["aeronef.id"],
            name="fk_equipe_aerienne_aeronef_id",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("aeronef_id", name="uq_equipe_aerienne_aeronef_id"),
    )


class EquipeAerienneMembreModel(Base):
    """Membre supplémentaire d'une équipe aérienne (migration 0072), au-delà du chef
    de base/pilote/mécanicien/consultant déjà nommés sur `EquipeAerienneModel` — un
    nom, en nombre variable. Table fille plutôt qu'une chaîne concaténée sur
    `equipe_aerienne` (1FN) : chaque membre reste identifiable et supprimable
    individuellement, même patron que `fiche_vol_signature`/`traitement_rotation`."""

    __tablename__ = "equipe_aerienne_membre"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_aerienne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipe_aerienne.id", ondelete="CASCADE"), nullable=False
    )
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    equipe: Mapped[EquipeAerienneModel] = relationship(back_populates="membres")

    __table_args__ = (Index("ix_equipe_aerienne_membre_equipe_aerienne_id", "equipe_aerienne_id"),)


class EquipeTerrestreModel(Base):
    """Équipe terrestre (migration 0073) : une équipe = un chef d'équipe
    (`chef_equipe_id` UNIQUE, rôle `chef_equipe`). Contrairement à l'équipe
    aérienne, pas de UNIQUE côté `PosteAcridienModel.equipe_terrestre_id` :
    plusieurs postes peuvent partager la même équipe terrestre (équipe mobile).
    `membres` (`equipe_terrestre_membre`, table fille) : autres membres de
    l'équipe en nombre variable, même patron que `EquipeAerienneMembreModel`.
    """

    __tablename__ = "equipe_terrestre"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    chef_equipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    membres: Mapped[list["EquipeTerrestreMembreModel"]] = relationship(
        back_populates="equipe",
        cascade="all, delete-orphan",
        order_by="EquipeTerrestreMembreModel.created_at",
    )

    # Noms de contraintes explicites — doivent matcher la migration 0073 à
    # l'identique : `EquipeTerrestreRepositoryImpl.create` en dépend pour
    # distinguer la violation (chef déjà assigné) d'une erreur générique.
    __table_args__ = (
        ForeignKeyConstraint(
            ["chef_equipe_id"],
            ["utilisateur.id"],
            name="fk_equipe_terrestre_chef_equipe_id",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("chef_equipe_id", name="uq_equipe_terrestre_chef_equipe_id"),
    )


class EquipeTerrestreMembreModel(Base):
    """Membre supplémentaire d'une équipe terrestre (migration 0073), au-delà du chef
    d'équipe déjà nommé sur `EquipeTerrestreModel` — un nom, en nombre variable.
    Table fille plutôt qu'une chaîne concaténée (1FN), même patron que
    `EquipeAerienneMembreModel`."""

    __tablename__ = "equipe_terrestre_membre"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_terrestre_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipe_terrestre.id", ondelete="CASCADE"), nullable=False
    )
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    equipe: Mapped[EquipeTerrestreModel] = relationship(back_populates="membres")

    __table_args__ = (
        Index("ix_equipe_terrestre_membre_equipe_terrestre_id", "equipe_terrestre_id"),
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

    `equipe_id` (migration 0066) : NOT NULL uniquement sur une base principale
    (`ck_base_aerienne_equipe_coherente`) — une base secondaire hérite de l'équipe
    de sa principale via `parent_base_id`, elle ne porte pas sa propre `equipe_id`.
    """

    __tablename__ = "base_aerienne"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_base_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("base_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    equipe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Noms de contraintes explicites — doivent matcher la migration 0066 à
    # l'identique (cf. commentaire équivalent sur `EquipeAerienneModel`).
    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_id"],
            ["equipe_aerienne.id"],
            name="fk_base_aerienne_equipe_id",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("equipe_id", name="uq_base_aerienne_equipe_id"),
        CheckConstraint(
            "(parent_base_id IS NULL AND equipe_id IS NOT NULL) OR "
            "(parent_base_id IS NOT NULL AND equipe_id IS NULL)",
            name="ck_base_aerienne_equipe_coherente",
        ),
    )

    parent: Mapped["BaseAerienneModel"] = relationship(remote_side=[id])


class StandRemplissageModel(Base):
    """Stand de remplissage de la fiche de vol — même forme que `BaseAerienneModel`,
    sans hiérarchie.

    `equipe_aerienne_id` (migration 0075) : équipe propriétaire du stand. Sans UNIQUE —
    une équipe possède plusieurs stands, contrairement à sa base principale. Nullable :
    les stands antérieurs restent « sans équipe » jusqu'à rattachement manuel ; exigé à
    la création côté application."""

    __tablename__ = "stand_remplissage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    equipe_aerienne_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Nom explicite, identique à la migration 0075 : le dépôt s'en sert pour distinguer
    # une équipe inexistante d'un doublon de `numero`.
    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_aerienne_id"],
            ["equipe_aerienne.id"],
            name="fk_stand_remplissage_equipe_aerienne_id",
            ondelete="RESTRICT",
        ),
    )


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
