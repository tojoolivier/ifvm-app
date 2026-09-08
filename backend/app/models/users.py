import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

ROLES = (
    "prospecteur",
    "verificateur",
    "validation_finale",
    "chef_equipe",
    "agent_encadreur",
    "pilote",
    "mecanicien",
    "chef_de_base",
    "consultant_international",
    "admin",
)

# Rôles créables "à la volée" (identité seule, compte non-authentifiable) depuis
# le formulaire de traitement aérien. `chef_de_base` en est exclu à dessein :
# il doit préexister (voir issue #319).
ROLES_A_LA_VOLEE = ("pilote", "mecanicien", "consultant_international")


class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    pa_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("poste_acridien.id"), nullable=True
    )
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # False = compte créé à la volée depuis une fiche de traitement (pilote,
    # mécanicien, consultant) pour identifier une personne sans lui ouvrir
    # d'accès applicatif — email/password_hash restent renseignés (générés,
    # inexploitables) pour satisfaire les contraintes existantes de la table.
    peut_se_connecter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    # Curseur du centre de notifications (mobile : statut de mes fiches ; web :
    # nouvelles fiches / actions) — cf. migration 0052. `NULL` = jamais consulté,
    # tout est alors non-lu.
    notifications_lues_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
