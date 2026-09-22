import uuid
from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Computed,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.users import FONCTIONS_EQUIPE, Utilisateur


def _equipe_type_genere(colonne_fk: str, type_equipe: str) -> Computed:
    """Colonne compagnon d'une FK vers `equipe`, pour rendre la FK *type-sûre*.

    `(equipe_id, equipe_type) -> equipe(id, type)` (ADR-018) garantit en SQL qu'un
    `lieu_aerien` ne pointe pas vers une équipe terrestre. La valeur est une constante
    déduite de la colonne FK : `GENERATED ALWAYS ... STORED` plutôt qu'une colonne
    ordinaire, pour qu'aucun chemin d'écriture n'ait à la renseigner — donc aucune
    dérive possible entre la FK et son type (la redondance est structurelle, pas
    maintenue à la main).
    """
    return Computed(
        f"CASE WHEN {colonne_fk} IS NULL THEN NULL ELSE '{type_equipe}' END", persisted=True
    )


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
    # Rattachement à une équipe terrestre (migration 0073, retargeté sur `equipe` en
    # 0082) : nullable, sans UNIQUE — plusieurs postes peuvent partager la même équipe
    # (équipe mobile). Le nom de colonne est conservé pour ne pas propager un renommage
    # jusqu'au cache SQLite du mobile ; c'est bien `equipe` qui est référencée.
    equipe_terrestre_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_terrestre_id", "terrestre"), nullable=True
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    zone: Mapped["ZoneAntiAcridienModel"] = relationship(back_populates="postes")
    stations: Mapped[list["StationFixeModel"]] = relationship(back_populates="poste")
    equipe_terrestre: Mapped["EquipeModel | None"] = relationship(
        primaryjoin="PosteAcridienModel.equipe_terrestre_id == EquipeModel.id",
        foreign_keys="PosteAcridienModel.equipe_terrestre_id",
        viewonly=True,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_terrestre_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_poste_acridien_equipe_terrestre_id",
            ondelete="RESTRICT",
        ),
    )


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
    # la gestion d'équipe aérienne).
    equipe_aerienne_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_aerienne_id", "aerien"), nullable=True
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "type_lieu IN ('principale','secondaire','stand')", name="ck_lieu_aerien_type"
        ),
        ForeignKeyConstraint(
            ["equipe_aerienne_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_lieu_aerien_equipe_aerienne_id",
            ondelete="RESTRICT",
        ),
    )


class AeronefModel(Base):
    """Hélicoptère d'une équipe aérienne (migration 0078) : `immatriculation` en est la
    clé candidate, `societe` (exploitant) et `volume_cuve_l` en dépendent — d'où une
    table à part plutôt que trois colonnes sur `equipe_aerienne` (dépendance transitive
    équipe → immatriculation → société). Affecté à au plus une équipe
    (`EquipeModel.aeronef_id` UNIQUE)."""

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


class EquipeModel(Base):
    """Équipe unique du référentiel — terrestre ou aérienne (ADR-018, migration 0082).

    Remplace `equipe_terrestre` et `equipe_aerienne`, qui étaient deux tables
    asymétriques pour la même notion. Spécialisation ramenée à une table unique typée
    par `type` : les deux sous-types partagent désormais exactement les mêmes attributs,
    les rôles autrefois nommés en dur (`chef_de_base_id`, `chef_equipe_id`, `pilote`,
    `mecanicien`, `consultant_international`) étant devenus des lignes de
    `equipe_membre`.

    `UNIQUE(id, type)` est redondant avec la clé primaire : il n'existe que pour servir
    de cible aux FK composites `(equipe_id, equipe_type)` des tables qui référencent une
    équipe — c'est ce qui interdit en SQL qu'un `lieu_aerien` pointe vers une équipe
    terrestre.

    `aeronef_id` reste ici, 1:1 comme sur l'ancienne `equipe_aerienne` ; #603 le
    remplacera par `equipe_aeronef` (affectations successives datées).
    """

    __tablename__ = "equipe"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    type: Mapped[str] = mapped_column(Text(), nullable=False)
    aeronef_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    membres: Mapped[list["EquipeMembreModel"]] = relationship(
        back_populates="equipe",
        cascade="all, delete-orphan",
        order_by="EquipeMembreModel.created_at",
    )
    aeronef: Mapped["AeronefModel | None"] = relationship()

    # Noms de contraintes explicites — doivent matcher la migration 0082 à l'identique :
    # les dépôts s'en servent pour distinguer une violation métier d'une erreur générique.
    __table_args__ = (
        CheckConstraint("type IN ('terrestre','aerien')", name="ck_equipe_type"),
        UniqueConstraint("id", "type", name="uq_equipe_id_type"),
        ForeignKeyConstraint(
            ["aeronef_id"], ["aeronef.id"], name="fk_equipe_aeronef_id", ondelete="RESTRICT"
        ),
        UniqueConstraint("aeronef_id", name="uq_equipe_aeronef_id"),
        CheckConstraint(
            "aeronef_id IS NULL OR type = 'aerien'", name="ck_equipe_aeronef_reserve_aerien"
        ),
    )


class EquipeMembreModel(Base):
    """Appartenance d'un utilisateur à une équipe, avec sa fonction (ADR-018).

    Remplace `equipe_aerienne_membre` / `equipe_terrestre_membre` (un `nom` en texte
    libre) et les rôles nommés en dur des anciennes tables d'équipe. `user_id` est NOT
    NULL : un intervenant externe sans accès applicatif (pilote, mécanicien, consultant)
    reçoit un compte « à la volée » (`peut_se_connecter=False`, cf. `ROLES_A_LA_VOLEE`)
    plutôt qu'une chaîne de caractères — une personne, une identité, partout.

    PK `(equipe_id, user_id)` : une personne n'occupe qu'une fonction dans une équipe
    donnée. Les deux index partiels portent la règle métier des anciennes contraintes
    `uq_equipe_aerienne_chef_de_base_id` / `uq_equipe_terrestre_chef_equipe_id` — une
    équipe a un seul chef, un chef ne dirige qu'une équipe — que seul un index partiel
    peut exprimer, la contrainte ne valant que pour `fonction = 'chef'`.
    """

    __tablename__ = "equipe_membre"

    equipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipe.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    fonction: Mapped[str] = mapped_column(Text(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    equipe: Mapped[EquipeModel] = relationship(back_populates="membres")
    utilisateur: Mapped[Utilisateur] = relationship()

    __table_args__ = (
        CheckConstraint(
            "fonction IN (" + ", ".join(f"'{f}'" for f in FONCTIONS_EQUIPE) + ")",
            name="ck_equipe_membre_fonction",
        ),
        Index(
            "uq_equipe_membre_chef_par_equipe",
            "equipe_id",
            unique=True,
            postgresql_where=text("fonction = 'chef'"),
        ),
        Index(
            "uq_equipe_membre_chef_par_utilisateur",
            "user_id",
            unique=True,
            postgresql_where=text("fonction = 'chef'"),
        ),
        Index("ix_equipe_membre_user_id", "user_id"),
    )


class BaseAerienneModel(Base):
    """Base principale ou base secondaire d'une équipe aérienne.

    Table unique auto-référencée (`parent_base_id NULL` = principale, sinon
    secondaire) plutôt que deux tables — même raisonnement que
    `LieuAerienModel.type_lieu` : les deux niveaux partagent exactement les
    mêmes attributs, seule la hiérarchie diffère. Introduite en migration
    0064, délibérément distincte de `lieu_aerien` malgré le chevauchement
    conceptuel : `lieu_aerien` a été débranché deux fois des fiches qui le
    référençaient (`traitement_aerien` en 0054, `prospection` en 0063) parce
    que choisir la base dans un référentiel synchronisé s'est révélé être une
    contrainte terrain non voulue. Les bases d'équipe aérienne restent malgré
    tout un référentiel dédié — décision produit explicite, maintenue en
    connaissance de ce précédent (cf. docstring de la migration 0064).

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
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_id", "aerien"), nullable=True
    )
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Noms de contraintes explicites — doivent matcher la migration 0066 à
    # l'identique (cf. commentaire équivalent sur `EquipeModel`).
    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
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
    """Stand de remplissage d'une équipe aérienne — même forme que `BaseAerienneModel`,
    sans hiérarchie.

    `equipe_aerienne_id` (migration 0078) : équipe propriétaire du stand. Sans UNIQUE —
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
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_aerienne_id", "aerien"), nullable=True
    )
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Nom explicite, conservé depuis la migration 0078 (la cible passe à `equipe` en
    # 0082) : le dépôt s'en sert pour distinguer une équipe inexistante d'un doublon de
    # `numero`.
    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_aerienne_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
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
