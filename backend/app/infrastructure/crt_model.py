import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CRTModel(Base):
    __tablename__ = "crt"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prospection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prospection.id", ondelete="CASCADE"), nullable=False
    )
    numero_crt: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    # ===== 1. RÉFÉRENCE =====
    chef_equipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    agent_encadreur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    date_validation: Mapped[date] = mapped_column(Date, nullable=True)
    numero_validation: Mapped[str] = mapped_column(String(50), nullable=True)
    date_traitement: Mapped[date] = mapped_column(Date, nullable=False)
    localite: Mapped[str] = mapped_column(String(255), nullable=True)
    cr: Mapped[str] = mapped_column(String(100), nullable=True)
    district: Mapped[str] = mapped_column(String(100), nullable=True)
    pa_code: Mapped[str] = mapped_column(String(50), nullable=True)
    za: Mapped[str] = mapped_column(String(50), nullable=True)
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=True)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=True)
    altitude: Mapped[float] = mapped_column(Numeric(8, 2), nullable=True)

    # ===== 2. CIBLE =====
    espece: Mapped[str] = mapped_column(String(10), nullable=True)
    phase: Mapped[str] = mapped_column(String(50), nullable=True)
    surface_infestee_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    densite_ind_ha: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    population_type: Mapped[str] = mapped_column(String(30), nullable=True)

    # ===== 3. TRAITEMENT =====
    mode_traitement: Mapped[str] = mapped_column(String(30), nullable=True)
    surface_atomiseur_dos: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    surface_disque_rotatif: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    surface_autre: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    surface_reste_traiter: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    traitement_debut: Mapped[time] = mapped_column(Time, nullable=True)
    traitement_fin: Mapped[time] = mapped_column(Time, nullable=True)
    vent: Mapped[str] = mapped_column(String(50), nullable=True)
    temperature_debut: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    temperature_fin: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    taux_mortalite: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    evaluation_apres_traitement: Mapped[str] = mapped_column(Text, nullable=True)
    methode_evaluation: Mapped[str] = mapped_column(String(30), nullable=True)

    # ===== 4. MOYENS =====
    nb_agents_permanents: Mapped[int] = mapped_column(Integer, nullable=True)
    nb_agents_temporaires: Mapped[int] = mapped_column(Integer, nullable=True)
    nb_personnel_local: Mapped[int] = mapped_column(Integer, nullable=True)
    nb_atomiseur: Mapped[int] = mapped_column(Integer, nullable=True)
    essence_litres: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    nb_disque_rotatif: Mapped[int] = mapped_column(Integer, nullable=True)
    nb_piles: Mapped[int] = mapped_column(Integer, nullable=True)
    nb_poudreuse_manuelle: Mapped[int] = mapped_column(Integer, nullable=True)
    autre_materiel: Mapped[str] = mapped_column(Text, nullable=True)

    # ===== Kits de protection =====
    kit_combinaison: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kit_gants: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kit_lunettes: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kit_masques: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    kit_boite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # ===== 5. PESTICIDES =====
    pesticide_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pesticide.id"), nullable=True
    )
    matiere_active: Mapped[str] = mapped_column(String(255), nullable=True)
    stock_initial_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    approvisionnement_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    produits_consommes_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    stock_final_l: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)

    # ===== 6. ZONES EXPOSÉES =====
    zones_exposees: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # ===== 7. VÉGÉTATION =====
    hauteur_strate_herbeuse_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    hauteur_strate_arboree_m: Mapped[float] = mapped_column(Numeric(5, 2), nullable=True)
    recouvrement_percent: Mapped[int] = mapped_column(Integer, nullable=True)

    # ===== 8. EMPOISONNEMENT =====
    empoisonnement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    empoisonnement_type: Mapped[str] = mapped_column(String(30), nullable=True)
    empoisonnement_mode: Mapped[str] = mapped_column(String(30), nullable=True)
    empoisonnement_autre: Mapped[str] = mapped_column(Text, nullable=True)

    # ===== 9. ÉVALUATION DU RISQUE =====
    evaluation_risque: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # ===== 10. COMPORTEMENT ANORMAL =====
    comportement_anormal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    comportement_non_cibles: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # ===== 11. MORTALITÉ =====
    mortalite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mortalite_familles: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # ===== STATUT =====
    statut: Mapped[str] = mapped_column(String(30), nullable=False, default="brouillon")
    statut_sync: Mapped[str] = mapped_column(String(30), nullable=False, default="local")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    validated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True
    )
    validated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # ===== RELATIONSHIPS =====
    prospection = relationship("ProspectionModel", backref="crts")
    chef_equipe = relationship("Utilisateur", foreign_keys=[chef_equipe_id])
    agent_encadreur = relationship("Utilisateur", foreign_keys=[agent_encadreur_id])
    pesticide = relationship("PesticideModel", backref="crts")
    personnel = relationship(
        "CRTPersonnelModel", back_populates="crt", cascade="all, delete-orphan"
    )
    materiel = relationship("CRTMaterielModel", back_populates="crt", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "statut IN ('brouillon','en_attente','validee','rejetee')", name="ck_crt_statut"
        ),
        CheckConstraint("statut_sync IN ('local','synced','conflict')", name="ck_crt_statut_sync"),
        CheckConstraint("espece IN ('LMC','NSE','MELANGE')", name="ck_crt_espece"),
        CheckConstraint(
            "population_type IN ('DIFFUSE','GROUPE','TACHE','BANDE')", name="ck_crt_population_type"
        ),
        CheckConstraint(
            "mode_traitement IN ('TOTAL','BARRIERE','IRREGULIER')", name="ck_crt_mode_traitement"
        ),
        CheckConstraint(
            "methode_evaluation IN ('VISUELLE','COMPTAGE')", name="ck_crt_methode_evaluation"
        ),
        CheckConstraint(
            "empoisonnement_type IN ('AGENT','POPULATION')", name="ck_crt_empoisonnement_type"
        ),
        CheckConstraint(
            "empoisonnement_mode IN ('INGESTION','INHALATION','CONTACT','AUTRE')",
            name="ck_crt_empoisonnement_mode",
        ),
    )


class CRTPersonnelModel(Base):
    __tablename__ = "crt_personnel"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crt.id", ondelete="CASCADE"), nullable=False
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    crt = relationship("CRTModel", back_populates="personnel")
    utilisateur = relationship("Utilisateur")

    __table_args__ = (
        CheckConstraint(
            "role IN ('AGENT_PERMANENT','AGENT_TEMPORAIRE','PERSONNEL_LOCAL')",
            name="ck_crt_personnel_role",
        ),
        UniqueConstraint("crt_id", "utilisateur_id", "role", name="uq_crt_personnel"),
    )


class CRTMaterielModel(Base):
    __tablename__ = "crt_materiel"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crt.id", ondelete="CASCADE"), nullable=False
    )
    type_materiel: Mapped[str] = mapped_column(String(100), nullable=False)
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)
    unite: Mapped[str] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )

    crt = relationship("CRTModel", back_populates="materiel")
