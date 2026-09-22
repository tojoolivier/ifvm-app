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
    # Membre d'équipe sans rôle fonctionnel nommé : une identité, aucun droit
    # applicatif. Ajouté avec `equipe_membre` (ADR-018) pour accueillir les membres
    # qui n'étaient jusque-là qu'un `nom` en texte libre dans
    # `equipe_*_membre` — il leur fallait un rôle pour devenir des comptes.
    "membre",
    "admin",
)

# Rôles créables "à la volée" (identité seule, compte non-authentifiable) depuis
# le formulaire de traitement aérien. `chef_de_base` en est exclu à dessein :
# il doit préexister (voir issue #319).
ROLES_A_LA_VOLEE = ("pilote", "mecanicien", "consultant_international", "membre")

# Fonctions occupables dans une `equipe` (ADR-018) : le vocabulaire des rôles, plus
# `chef` — la fonction de direction, commune aux deux types d'équipe, là où `ROLES`
# la décline en `chef_de_base` (aérien) et `chef_equipe` (terrestre). C'est cette
# fonction-là, et elle seule, que les index partiels de `equipe_membre` contraignent.
FONCTIONS_EQUIPE = ("chef", *ROLES)


class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    # Identifiant court (ex. "ADM") inséré dans le numéro de fiche généré côté
    # mobile pour toute fiche créée par cet utilisateur — facultatif, non
    # unique (migration 0065).
    sigle: Mapped[str | None] = mapped_column(String(10), nullable=True)
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
    # `onupdate` est indispensable : la synchro du référentiel (`utilisateurs_equipe`) est un
    # delta sur `updated_at > curseur`. Sans lui, un changement de rôle/`actif` n'atteignait
    # jamais les téléphones déjà synchronisés — ils continuaient de proposer un ancien
    # `chef_equipe` que le serveur refuse ensuite à l'envoi de la fiche de traitement.
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
    # Curseur du centre de notifications (mobile : statut de mes fiches ; web :
    # nouvelles fiches / actions) — cf. migration 0052. `NULL` = jamais consulté,
    # tout est alors non-lu.
    notifications_lues_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
