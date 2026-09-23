import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
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
    # 0084) : nullable, sans UNIQUE — plusieurs postes peuvent partager la même équipe
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
    # contrairement à `SiteAerienneModel.equipe_id` (1:1, référentiel distinct dédié à
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
    équipe → immatriculation → société). Existe indépendamment de toute équipe
    (#621) ; ses affectations successives vivent dans `equipe_aeronef` (#603)."""

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
    """Équipe unique du référentiel — terrestre ou aérienne (ADR-018, migration 0086).

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

    L'appareil n'est plus une colonne depuis #603 : `equipe_aeronef` porte les
    affectations successives, bornées dans le temps.
    """

    __tablename__ = "equipe"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(Text(), nullable=False)
    type: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    membres: Mapped[list["EquipeMembreModel"]] = relationship(
        back_populates="equipe",
        cascade="all, delete-orphan",
        order_by="EquipeMembreModel.created_at",
    )
    # `primaryjoin` / `foreign_keys` explicites : sans eux l'ORM déduit la jointure de
    # la FK *composite* et tente d'écrire `equipe_type` à l'insertion — or c'est une
    # colonne générée, que Postgres refuse en écriture. L'appartenance se joue sur
    # `equipe_id` seul ; `equipe_type` reste l'affaire de la base.
    affectations_aeronef: Mapped[list["EquipeAeronefModel"]] = relationship(
        back_populates="equipe",
        cascade="all, delete-orphan",
        order_by="EquipeAeronefModel.date_debut.desc()",
        primaryjoin="EquipeModel.id == EquipeAeronefModel.equipe_id",
        foreign_keys="EquipeAeronefModel.equipe_id",
    )

    # Noms de contraintes explicites — doivent matcher les migrations 0086/0087 à
    # l'identique : les dépôts s'en servent pour distinguer une violation métier d'une
    # erreur générique.
    __table_args__ = (
        CheckConstraint("type IN ('terrestre','aerien')", name="ck_equipe_type"),
        UniqueConstraint("id", "type", name="uq_equipe_id_type"),
    )


class EquipeAeronefModel(Base):
    """Affectation d'un aéronef à une équipe sur une période (#603, migration 0087).

    Remplace la FK 1:1 `equipe.aeronef_id` : une équipe aérienne dispose de 2 à 3
    appareils utilisés l'un après l'autre, et le 1:1 interdisait d'en garder la trace.
    Intervalle semi-ouvert `[date_debut, date_fin)`, `date_fin IS NULL` pour
    l'affectation en cours.

    `equipe_type` porte désormais « un appareil ne s'affecte qu'à une équipe aérienne »,
    à la place de l'ancien CHECK `ck_equipe_aeronef_reserve_aerien`.

    Les deux index partiels ne sont que des garde-fous : ils interdisent deux
    affectations *ouvertes* pour la même équipe ou le même appareil. La règle complète —
    pas de chevauchement d'intervalles — demanderait `EXCLUDE USING gist`, hors scope
    (ADR-018) ; elle est validée côté application."""

    __tablename__ = "equipe_aeronef"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_id", "aerien"), nullable=True
    )
    aeronef_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    date_debut: Mapped[date] = mapped_column(Date(), nullable=False)
    date_fin: Mapped[date | None] = mapped_column(Date(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    equipe: Mapped["EquipeModel"] = relationship(
        back_populates="affectations_aeronef",
        primaryjoin="EquipeModel.id == EquipeAeronefModel.equipe_id",
        foreign_keys="EquipeAeronefModel.equipe_id",
    )
    aeronef: Mapped["AeronefModel"] = relationship()

    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_equipe_aeronef_equipe_id",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["aeronef_id"],
            ["aeronef.id"],
            name="fk_equipe_aeronef_aeronef_id",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "date_fin IS NULL OR date_fin >= date_debut", name="ck_equipe_aeronef_periode"
        ),
        Index(
            "uq_equipe_aeronef_ouverte_par_equipe",
            "equipe_id",
            unique=True,
            postgresql_where=text("date_fin IS NULL"),
        ),
        Index(
            "uq_equipe_aeronef_ouverte_par_aeronef",
            "aeronef_id",
            unique=True,
            postgresql_where=text("date_fin IS NULL"),
        ),
        Index("ix_equipe_aeronef_aeronef_id", "aeronef_id"),
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


class SiteAerienneModel(Base):
    """Site aérien : base principale, base secondaire ou stand de remplissage d'une
    équipe aérienne — table unique auto-référencée (`parent_site_id NULL` = principale,
    sinon secondaire) plutôt que plusieurs tables, même raisonnement que
    `LieuAerienModel.type_lieu`. Introduite en migration 0064 comme `base_aerienne`,
    renommée et fusionnée avec `stand_remplissage` en migration 0088 (#604) : les deux
    tables partageaient exactement la même forme (`numero`, `localite`, position),
    seule la hiérarchie (`base_aerienne`) ou l'absence de hiérarchie
    (`stand_remplissage`) différait. Après fusion, un ancien stand est une ligne
    secondaire comme une ancienne base secondaire : le rôle (« stand » vs « base
    secondaire ») est désormais **contextuel**, porté par la FK qui référence le site
    depuis l'appelant — pas par une colonne discriminante (décision produit, #592
    décision 6, confirmée par #604).

    `equipe_id` (migration 0066) : NOT NULL uniquement sur une principale
    (`ck_site_aerienne_equipe_coherente`) — une secondaire hérite de l'équipe de sa
    principale via `parent_site_id`, elle ne porte pas sa propre `equipe_id`.

    La position GPS (`longitude`/`latitude`/`altitude`, figée depuis 0064) est sortie
    en migration 0088 vers `site_aerienne_position`, qui historise les implantations
    successives — un site qui se déplace ne perd plus sa position précédente.
    """

    __tablename__ = "site_aerienne"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_site_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    equipe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    equipe_type: Mapped[str | None] = mapped_column(
        Text(), _equipe_type_genere("equipe_id", "aerien"), nullable=True
    )
    numero: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    localite: Mapped[str] = mapped_column(Text(), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Noms de contraintes explicites — doivent matcher la migration 0088 à
    # l'identique (cf. commentaire équivalent sur `EquipeModel`).
    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_site_aerienne_equipe_id",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("equipe_id", name="uq_site_aerienne_equipe_id"),
        CheckConstraint(
            "(parent_site_id IS NULL AND equipe_id IS NOT NULL) OR "
            "(parent_site_id IS NOT NULL AND equipe_id IS NULL)",
            name="ck_site_aerienne_equipe_coherente",
        ),
    )

    parent: Mapped["SiteAerienneModel"] = relationship(remote_side=[id])
    positions: Mapped[list["SiteAeriennePositionModel"]] = relationship(
        back_populates="site", order_by="SiteAeriennePositionModel.date_debut"
    )


class SiteAeriennePositionModel(Base):
    """Implantation successive d'un `site_aerienne` (migration 0088, #604).

    Une ligne par période d'implantation, `date_fin IS NULL` pour la position en cours
    — même patron que `equipe_aeronef` (migration 0087) pour l'affectation d'aéronef.
    La durée d'implantation (`date_fin - date_debut`, ou l'écart à `today()` si la
    position est encore active) est dérivée à la lecture, jamais stockée en colonne.
    """

    __tablename__ = "site_aerienne_position"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)
    altitude: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    date_debut: Mapped[date] = mapped_column(Date(), nullable=False)
    date_fin: Mapped[date | None] = mapped_column(Date(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "date_fin IS NULL OR date_fin >= date_debut", name="ck_site_aerienne_position_periode"
        ),
    )

    site: Mapped["SiteAerienneModel"] = relationship(back_populates="positions")


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


class MouvementPesticideModel(Base):
    """Mouvement de stock de pesticide au niveau d'un site aérien principal (#606).

    Pas de colonne « stock actuel » dénormalisée : le solde par (site, pesticide,
    unité) se calcule par agrégation de ces mouvements (source de vérité unique,
    décision actée). `site_id`/`site_destination_id` référencent `site_aerienne`
    sans distinguer principal/secondaire en base (même table depuis la migration
    0086, #604) — le garde-fou « stock rattaché au principal » est validé côté
    application (`SiteNonPrincipalError`), pas exprimable en CHECK SQL sans
    jointure.
    """

    __tablename__ = "mouvement_pesticide"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(Text(), nullable=False)
    pesticide_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pesticide.id", ondelete="RESTRICT"), nullable=False
    )
    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=False
    )
    # Renseigné si et seulement si `type = 'transfert'`
    # (ck_mouvement_pesticide_destination_coherente).
    site_destination_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    quantite: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # Même vocabulaire que `traitement_rotation.unite` (ck_traitement_rotation_unite) —
    # une quantité en L ne s'additionne jamais à une quantité en kg.
    unite: Mapped[str] = mapped_column(String(2), nullable=False)
    date_mouvement: Mapped[date] = mapped_column(Date(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    # Fiche traitement aérien d'origine (migration 0093, #609) : NULL pour tout
    # mouvement manuel (approvisionnement, transfert) — renseigné uniquement pour
    # une `consommation` générée depuis les rotations d'une fiche, seul moyen de
    # la retrouver et de la régénérer (`ondelete=CASCADE` : ces mouvements n'ont
    # pas de sens sans la fiche qui les a produits).
    traitement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "type IN ('approvisionnement', 'transfert', 'consommation')",
            name="ck_mouvement_pesticide_type",
        ),
        CheckConstraint(
            "unite IN ('L', 'kg')",
            name="ck_mouvement_pesticide_unite",
        ),
        CheckConstraint(
            "(type = 'transfert' AND site_destination_id IS NOT NULL) OR "
            "(type != 'transfert' AND site_destination_id IS NULL)",
            name="ck_mouvement_pesticide_destination_coherente",
        ),
        Index("ix_mouvement_pesticide_site_id", "site_id"),
        Index("ix_mouvement_pesticide_site_destination_id", "site_destination_id"),
        Index("ix_mouvement_pesticide_pesticide_id", "pesticide_id"),
        Index("ix_mouvement_pesticide_traitement_id", "traitement_id"),
    )


class VolModel(Base):
    """Ligne d'activité aérienne (ADR-018, migration 0092, #608).

    Réintroduite après la suppression de l'ancienne `vol` (migration 0080, ADR-017) —
    ce n'est pas le même objet, cf. docstring du domaine `Vol`.

    `equipe_type` est en `GENERATED ALWAYS ... STORED` et vaut toujours `'aerien'` —
    constante littérale plutôt que le `CASE WHEN equipe_id IS NULL ...` réutilisé sur
    les FK nullables (`SiteAerienneModel`) : `equipe_id` est NOT NULL sur `vol`, la
    branche NULL de ce CASE serait morte.

    Les trois FK vers `site_aerienne` (`site_principal_id`, `stand_id`,
    `base_secondaire_id`) sont indépendantes : un vol peut désigner le même site pour
    plusieurs rôles, ou trois sites différents. Seule la paire
    mise_en_place/application impose `site_principal_id` et `stand_id` NOT NULL en
    base (`ck_vol_site_mise_en_place_application`) ; la cohérence hiérarchique
    (stand/base secondaire rattachés au site principal) n'est pas exprimable en CHECK
    SQL — validée côté application (`SiteHorsBaseError`)."""

    __tablename__ = "vol"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(Text(), nullable=False)
    equipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    equipe_type: Mapped[str] = mapped_column(
        Text(), Computed("'aerien'", persisted=True), nullable=False
    )
    aeronef_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("aeronef.id", ondelete="RESTRICT"), nullable=False
    )
    site_principal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    stand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    base_secondaire_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("site_aerienne.id", ondelete="RESTRICT"), nullable=True
    )
    # Traitement aérien réalisé par ce vol (migration 0095, #610) : 0..1,
    # nullable et jamais renseigné à la création — le compte-rendu de
    # traitement est souvent rédigé après les vols, parfois sur un autre
    # appareil (ADR-014, question 9). Rattaché plus tard via une mise à jour.
    # `ondelete=RESTRICT`, même politique que les autres FK de `vol`.
    traitement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("traitement_aerien.traitement_id", ondelete="RESTRICT"),
        nullable=True,
    )
    date_vol: Mapped[date] = mapped_column(Date(), nullable=False)
    heure_debut: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_fin: Mapped[time] = mapped_column(Time(), nullable=False)
    motif: Mapped[str | None] = mapped_column(Text(), nullable=True)
    lieu_depart: Mapped[str | None] = mapped_column(Text(), nullable=True)
    lieu_arrivee: Mapped[str | None] = mapped_column(Text(), nullable=True)
    observations: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_vol_equipe_id",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "type IN ('mise_en_place', 'application', 'convoyage', 'prospection', 'divers')",
            name="ck_vol_type",
        ),
        CheckConstraint(
            "type NOT IN ('mise_en_place', 'application') OR "
            "(site_principal_id IS NOT NULL AND stand_id IS NOT NULL)",
            name="ck_vol_site_mise_en_place_application",
        ),
        CheckConstraint(
            "type NOT IN ('convoyage', 'divers') OR motif IS NOT NULL",
            name="ck_vol_motif_requis",
        ),
        CheckConstraint(
            "type != 'convoyage' OR (lieu_depart IS NOT NULL AND lieu_arrivee IS NOT NULL)",
            name="ck_vol_lieux_convoyage",
        ),
        CheckConstraint("heure_fin > heure_debut", name="ck_vol_heures_coherentes"),
        CheckConstraint(
            "traitement_id IS NULL OR type = 'application'",
            name="ck_vol_traitement_type",
        ),
        Index("ix_vol_equipe_id", "equipe_id"),
        Index("ix_vol_aeronef_id", "aeronef_id"),
        Index("ix_vol_site_principal_id", "site_principal_id"),
        Index("ix_vol_stand_id", "stand_id"),
        Index("ix_vol_base_secondaire_id", "base_secondaire_id"),
        Index("ix_vol_date_vol", "date_vol"),
        Index("ix_vol_traitement_id", "traitement_id"),
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
