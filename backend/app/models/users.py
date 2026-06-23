import uuid
from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

ROLES = ("prospecteur", "chef_equipe", "agent_encadreur", "pilote", "mecanicien", "chef_de_base", "admin")


class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    pa_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("poste_acridien.id"))
    actif: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=datetime.utcnow)
