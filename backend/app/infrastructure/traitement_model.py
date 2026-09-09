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
    kit_combinaison: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    kit_gants: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    kit_lunettes: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    kit_masques: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    kit_botte: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
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
        back_populates="traitement",
        cascade="all, delete-orphan",
        uselist=False,
        # Nécessaire depuis la migration 0050 : traitement_aerien porte désormais
        # deux FK vers traitement.id (traitement_id, sa PK, et
        # traitement_origine_id) — sans ceci SQLAlchemy ne peut plus déterminer
        # laquelle porte cette relation (AmbiguousForeignKeysError), même
        # ambiguïté déjà résolue côté Terrestre ci-dessous.
        foreign_keys="TraitementAerienModel.traitement_id",
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
    evaluations_risque_population: Mapped[list["EvaluationRisquePopulationModel"]] = relationship(
        back_populates="traitement",
        cascade="all, delete-orphan",
        order_by="EvaluationRisquePopulationModel.ordre",
    )

    __table_args__ = (
        CheckConstraint("type_traitement IN ('AERIEN','TERRESTRE')", name="ck_traitement_type"),
        CheckConstraint("statut IN ('brouillon','validee')", name="ck_traitement_statut"),
        # Nom de contrainte conservé pour continuité malgré l'inversion du sens : elle
        # porte toujours sur la relation date_traitement/date_validation.
        CheckConstraint("date_traitement >= date_validation", name="ck_traitement_date_validation"),
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
    # Équipe : chef de base reste une FK utilisateur (référentiel), seul rôle à
    # devoir préexister. pilote/mécanicien/consultant_international sont
    # redevenus du texte libre (migration 0048, défait la migration 0047) :
    # pilote/mécanicien obligatoires, consultant_international facultatif —
    # même patron que `TraitementTerrestreModel.consultant_international`. La
    # distinction chef/pilote/mécanicien (ex-ck_traitement_aerien_roles_distincts,
    # impossible à exprimer en CHECK SQL entre une FK et du texte libre) est
    # validée côté application (`valider_roles_aerien_distincts`).
    chef_de_base_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    pilote: Mapped[str] = mapped_column(String(255), nullable=False)
    mecanicien: Mapped[str] = mapped_column(String(255), nullable=False)
    consultant_international: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Base principale/stand/base secondaire : texte libre (migration 0054),
    # même patron que pilote/mécanicien/consultant_international ci-dessus —
    # saisie directe par l'utilisateur, sans dépendre du référentiel
    # `lieu_aerien` (qui reste utilisé par la prospection extensive aérienne,
    # inchangée). Base principale obligatoire pour tout traitement aérien
    # (aucune exception, contrairement à la prospection généralisée) ; stand
    # facultatif (vide = ravitaillement fait directement à une base) ; base
    # secondaire facultative.
    base_principale: Mapped[str] = mapped_column(String(255), nullable=False)
    stand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_secondaire: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Date d'installation (migration 0056) — facultative, indépendante de
    # celle du Stand/de la Base secondaire elle-même : un lieu peut être
    # renseigné sans date connue, ou vice-versa. Aucun champ équivalent pour
    # base_principale (hors périmètre, #stand-base-secondaire-date-installation).
    stand_date_installation: Mapped[date | None] = mapped_column(Date(), nullable=True)
    base_secondaire_date_installation: Mapped[date | None] = mapped_column(Date(), nullable=True)
    immatricule_aeronef: Mapped[str] = mapped_column(Text(), nullable=False)
    nb_rotations: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    # Deux cumuls distincts par unité (une rotation en L ne s'additionne jamais
    # à une rotation en kg) — dérivés des rotations, recalculés à chaque
    # écriture sur `traitement_rotation`, pas à la lecture (même philosophie
    # que `total_pesticide_l` avant cette migration).
    total_pesticide_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_pesticide_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    # Dérivée (somme de `traitement_rotation.surface_ha`), non saisissable.
    surface_traitee_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    surface_restante_ha: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    pesticide_recu_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    pesticide_stock_restant_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    # Chaînage de reprise (migration 0050) — mirroir de TraitementTerrestreModel,
    # généralisé à l'Aérien : une prospection partiellement traitée par une
    # première fiche aérienne peut être reprise par une fiche suivante plutôt
    # que de bloquer ou de perdre le suivi du cumul déjà traité.
    reprise_traitement: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=False)
    traitement_origine_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id"), nullable=True
    )
    # NOT NULL défaut 0, contrairement à son équivalent Terrestre (nullable) —
    # même choix que les autres champs dérivés de traitement_aerien depuis la
    # migration 0047 : single-writer, jamais NULL.
    surface_cumulee_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    traitement: Mapped[TraitementModel] = relationship(
        back_populates="aerien", foreign_keys=[traitement_id]
    )
    rotations: Mapped[list["RotationModel"]] = relationship(
        back_populates="aerien", cascade="all, delete-orphan", order_by="RotationModel.numero"
    )

    __table_args__ = (
        # ck_traitement_aerien_roles_distincts supprimée (migration 0048_..._texte_libre) :
        # comparait trois FK UUID, impossible à exprimer en SQL une fois pilote/mécanicien
        # en texte libre — validée côté application (valider_roles_aerien_distincts).
        CheckConstraint(
            "NOT reprise_traitement OR traitement_origine_id IS NOT NULL",
            name="ck_traitement_aerien_reprise",
        ),
        Index(
            "uq_traitement_aerien_origine_id",
            "traitement_origine_id",
            unique=True,
            postgresql_where=text("traitement_origine_id IS NOT NULL"),
        ),
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
    # Dérivé de `numero` (str(numero)) côté application — plus de saisie libre
    # (le numéro de cuve s'incrémente automatiquement par traitement, comme
    # `numero`). Colonne conservée telle quelle pour ne pas casser l'existant.
    numero_cuve: Mapped[str] = mapped_column(String(50), nullable=False)
    produit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pesticide.id"), nullable=False
    )
    # Une seule quantité par rotation avec son unité — jamais L et kg à la
    # fois pour une même rotation (un produit a une seule forme physique).
    quantite: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unite: Mapped[str] = mapped_column(String(2), nullable=False)
    # Superficie correspondant à cette rotation ; la surface totale du
    # traitement (`traitement_aerien.surface_traitee_ha`) en est la somme.
    surface_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    temperature_debut_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    temperature_fin_c: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    vent_debut_ms: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    vent_fin_ms: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    # heure_debut/heure_fin bornent la rotation entière (mise en place +
    # application) ; heure_ouverture_vanne/heure_fermeture_vanne bornent
    # l'application seule (communiquées par le pilote au chef de base). Durée
    # d'application, durée totale et durée de mise en place s'en dérivent
    # côté application, aucune des trois n'est stockée.
    heure_debut: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_ouverture_vanne: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_fermeture_vanne: Mapped[time] = mapped_column(Time(), nullable=False)
    heure_fin: Mapped[time] = mapped_column(Time(), nullable=False)
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: Mapped[str | None] = mapped_column(Text(), nullable=True)

    aerien: Mapped[TraitementAerienModel] = relationship(back_populates="rotations")

    __table_args__ = (
        UniqueConstraint("traitement_aerien_id", "numero", name="uq_traitement_rotation_numero"),
        UniqueConstraint(
            "traitement_aerien_id", "numero_cuve", name="uq_traitement_rotation_numero_cuve"
        ),
        CheckConstraint("unite IN ('L','kg')", name="ck_traitement_rotation_unite"),
        CheckConstraint("heure_fin > heure_debut", name="ck_traitement_rotation_heures"),
        CheckConstraint(
            "heure_debut <= heure_ouverture_vanne "
            "AND heure_ouverture_vanne <= heure_fermeture_vanne "
            "AND heure_fermeture_vanne <= heure_fin",
            name="ck_traitement_rotation_vanne_ordre",
        ),
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
    pesticide_recu_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    pesticide_stock_restant_l: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

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
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: Mapped[str | None] = mapped_column(Text(), nullable=True)

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
    # Tracé du pavé de signature (mobile), chemin SVG — migration 0049. Nullable :
    # rétrocompatibilité avec les lignes déjà écrites avant cette migration.
    signature_image: Mapped[str | None] = mapped_column(Text(), nullable=True)
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


class EvaluationRisquePopulationModel(Base):
    """« Impact et risque → Évaluation du risque pour la population » (migration
    0055) — liée directement à `traitement` (pas à aerien/terrestre), comme
    `TraitementSignatureModel` : le slide est identique pour les deux types.
    Liste dynamique ("+"), remplacée en bloc à chaque enregistrement de la
    fiche (même sémantique que `ProspectionModel.populations` côté prospection)
    plutôt qu'une sous-ressource à endpoints dédiés (cf. `RotationModel`) —
    plus simple, suffisant ici (pas de contrainte d'unicité ni de valeur
    dérivée entre lignes)."""

    __tablename__ = "traitement_evaluation_risque_population"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    traitement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("traitement.id", ondelete="CASCADE"), nullable=False
    )
    # Position dans la liste (« Évaluation 1 », « Évaluation 2 »...), jamais
    # déduite de l'ordre de retour SQL seul.
    ordre: Mapped[int] = mapped_column(Integer(), nullable=False)
    habitat_proche: Mapped[str | None] = mapped_column(Text(), nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    sensibilisation: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)

    traitement: Mapped[TraitementModel] = relationship(
        back_populates="evaluations_risque_population"
    )

    __table_args__ = (
        UniqueConstraint(
            "traitement_id", "ordre", name="uq_traitement_evaluation_risque_population_ordre"
        ),
    )
