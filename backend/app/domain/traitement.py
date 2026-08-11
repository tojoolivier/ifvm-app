import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from app.domain.prospection import Prospection


class ProspectionIntrouvableError(LookupError):
    """La prospection liée au traitement n'existe pas."""


class ChefDeBaseInvalideError(PermissionError):
    """chef_de_base_id ne référence pas un utilisateur avec le rôle chef_de_base."""


class NumeroFicheConflitError(Exception):
    """Le numero_fiche viole la contrainte UNIQUE — l'appelant doit réessayer avec un suffixe."""


@dataclass
class UtilisateurRef:
    """Projection minimale d'un utilisateur pour les besoins du domaine traitement."""

    id: uuid.UUID
    prenom: str
    role: str


@dataclass
class Cible:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str | None = None
    petites_larves: str | None = None
    grandes_larves: str | None = None
    vols_clairs_essaims: str | None = None
    repartition_population: str | None = None
    surface_infestee_ha: float = 0.0


@dataclass
class TraitementAerien:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    pilote: str = ""
    mecanicien: str = ""
    chef_de_base_id: uuid.UUID = field(default_factory=uuid.uuid4)
    consultant_international: str | None = None
    nb_rotations: int = 0
    total_pesticide_l: float | None = None


@dataclass
class Traitement:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    prospection_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero_fiche: str = ""
    type_traitement: str = "AERIEN"
    mode_traitement: str | None = None
    date_traitement: date = field(default_factory=date.today)
    date_validation: date = field(default_factory=date.today)
    localite: str = ""
    region: str | None = None
    district: str | None = None
    commune: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude: float | None = None
    kit_combinaison: bool = False
    kit_gants: bool = False
    kit_lunettes: bool = False
    kit_masques: bool = False
    kit_boite: bool = False
    zones_exposees: dict[str, Any] | None = None
    hauteur_strate_herbeuse_m: float | None = None
    hauteur_strate_arboree_m: float | None = None
    recouvrement_percent: int | None = None
    empoisonnement: bool = False
    empoisonnement_type: str | None = None
    empoisonnement_mode: str | None = None
    empoisonnement_autre: str | None = None
    evaluation_risque: dict[str, Any] | None = None
    comportement_anormal: bool = False
    comportement_non_cibles: dict[str, Any] | None = None
    mortalite: bool = False
    mortalite_familles: dict[str, Any] | None = None
    statut: str = "brouillon"
    statut_sync: str = "local"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    cible: Cible | None = None
    aerien: TraitementAerien | None = None


def generer_numero_fiche(
    prenom_chef: str, date_traitement: date, suffixe: int | None = None
) -> str:
    """Numéro de fiche lisible: [Prénom du chef]-[Aerien]-[Date], suffixe en cas de collision."""
    base = f"{prenom_chef}-Aerien-{date_traitement.isoformat()}"
    if suffixe is None:
        return base
    return f"{base}-{suffixe}"


def construire_cible(prospection: Prospection) -> Cible:
    """Snapshot en lecture seule de la cible depuis la fiche de prospection liée.

    Les champs absents côté prospection restent à None (affichés « non renseigné »
    côté présentation). surface_infestee_ha est NOT NULL en base: 0 si inconnue.
    """
    especes = {p.espece for p in prospection.populations if p.espece}
    especes |= {i.espece for i in prospection.infestations if i.espece}
    if not especes:
        espece = None
    elif len(especes) == 1:
        espece = especes.pop()
    else:
        espece = "MELANGE"

    petites_total = 0
    grandes_total = 0
    larves_renseignees = False
    for p in prospection.populations:
        if p.categorie != "larve" or not p.densites_larve:
            continue
        for stade, densite in p.densites_larve.items():
            larves_renseignees = True
            if stade.upper() in ("L1", "L2"):
                petites_total += densite
            else:
                grandes_total += densite

    essaims = [p.essaim_observe for p in prospection.populations if p.essaim_observe is not None]
    if any(essaims):
        vols_clairs_essaims = "oui"
    elif essaims:
        vols_clairs_essaims = "non"
    else:
        vols_clairs_essaims = None

    if any(p.densite_groupee is not None for p in prospection.populations):
        repartition = "GROUPEE"
    elif any(p.densite_diffuse is not None for p in prospection.populations):
        repartition = "DIFFUSE"
    else:
        repartition = None

    return Cible(
        espece=espece,
        petites_larves=str(petites_total) if larves_renseignees else None,
        grandes_larves=str(grandes_total) if larves_renseignees else None,
        vols_clairs_essaims=vols_clairs_essaims,
        repartition_population=repartition,
        surface_infestee_ha=prospection.surf_infestee
        if prospection.surf_infestee is not None
        else 0.0,
    )
