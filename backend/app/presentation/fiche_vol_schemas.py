import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TypeVol = Literal["PROSPECTION", "MEP", "APPLICATION", "CONVOYAGE", "DIVERS"]
RoleSignatureVol = Literal["PILOTE", "MECANICIEN", "CHEF_DE_BASE", "CONSULTANT_INTERNATIONAL"]


class VolCreate(BaseModel):
    numero: int = Field(ge=1)
    type_vol: TypeVol
    heure_debut: time
    heure_fin: time
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None


class VolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    numero: int
    type_vol: str
    heure_debut: time
    heure_fin: time
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None
    # Dérivée de heure_fin - heure_debut, jamais stockée.
    duree_minutes: int


class VolSyncPush(BaseModel):
    """Pendant de `VolCreate` pour la synchronisation hors-ligne (#fiche-vol-sync-hors-
    ligne) : `id` fourni par le client (généré à la capture, hors-ligne), stable d'une
    synchronisation à l'autre — c'est lui qui permet un remplacement en bloc idempotent
    de la liste `vols` de la fiche plutôt qu'un ajout un par un (cf. VolCreate, réservé
    à POST /{id}/vols, en ligne uniquement)."""

    id: uuid.UUID
    numero: int = Field(ge=1)
    type_vol: TypeVol
    heure_debut: time
    heure_fin: time
    rotation_id: uuid.UUID | None = None
    prospection_id: uuid.UUID | None = None
    observations: str | None = None


class SignatureVolUpsert(BaseModel):
    role: RoleSignatureVol
    signataire_nom: str = Field(min_length=1, max_length=255)
    # Tracé manuscrit (data URI). Facultatif : la fiche est enregistrable avant signature.
    signature_image: str | None = None


class SignatureVolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    signataire_nom: str
    signature_image: str | None = None
    horodatage: datetime | None = None


class FicheVolCreate(BaseModel):
    date_vol: date
    compagnie: str = Field(min_length=1, max_length=255)
    immatriculation: str = Field(min_length=1, max_length=20)
    campagne_id: uuid.UUID
    base_id: uuid.UUID
    stand_id: uuid.UUID
    pilote: str = Field(min_length=1, max_length=255)
    mecanicien: str = Field(min_length=1, max_length=255)
    chef_de_base_id: uuid.UUID
    # Prospection "principale" affichée en en-tête (Référence, migration 0070) —
    # facultative, distincte du rattachement par vol (VolCreate.prospection_id).
    prospection_id: uuid.UUID | None = None
    consultant_international: str | None = None
    # Un seul produit assumé par fiche et par jour (même forme que
    # Prospection.pesticide_* en mode extensif aérien).
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = None
    pesticide_quantite_recue: float | None = None
    futs_disponible: int | None = None
    futs_recues: int | None = None
    futs_pleins: int | None = None
    futs_vides: int | None = None
    observations: str | None = None
    vols: list[VolCreate] = Field(default_factory=list)


class FicheVolSyncPush(BaseModel):
    """Push de synchronisation offline (#fiche-vol-sync-hors-ligne, même patron que
    `TraitementSyncPush`) : `id` généré côté client à la capture — hors-ligne, une
    fiche de vol se remplit vol après vol tout au long de la journée avant toute
    connexion — et `base_updated_at`, dernier `updated_at` serveur connu du client,
    pour la détection de conflit (première synchronisation : la date de création
    locale, plus ancienne que tout `updated_at` serveur réel, ne peut donc que
    déclencher un conflit détecté trop tôt — jamais un écrasement silencieux)."""

    id: uuid.UUID
    base_updated_at: datetime
    date_vol: date
    compagnie: str = Field(min_length=1, max_length=255)
    immatriculation: str = Field(min_length=1, max_length=20)
    campagne_id: uuid.UUID
    base_id: uuid.UUID
    stand_id: uuid.UUID
    pilote: str = Field(min_length=1, max_length=255)
    mecanicien: str = Field(min_length=1, max_length=255)
    chef_de_base_id: uuid.UUID
    prospection_id: uuid.UUID | None = None
    consultant_international: str | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = None
    pesticide_quantite_recue: float | None = None
    futs_disponible: int | None = None
    futs_recues: int | None = None
    futs_pleins: int | None = None
    futs_vides: int | None = None
    observations: str | None = None
    vols: list[VolSyncPush] = Field(default_factory=list)


class FicheVolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # [Compteur 3 chiffres]-[Date]-[Équipe]-[Immatriculation], compteur continu par
    # campagne (jamais réinitialisé, jamais suffixé).
    numero_fiche: str
    date_vol: date
    compagnie: str
    immatriculation: str
    campagne_id: uuid.UUID
    compteur: int
    base_id: uuid.UUID
    stand_id: uuid.UUID
    # Résolus par jointure (base_aerienne/stand_remplissage), jamais saisis.
    base_numero: str | None = None
    base_localite: str | None = None
    base_latitude: float | None = None
    base_longitude: float | None = None
    base_altitude: float | None = None
    stand_numero: str | None = None
    stand_localite: str | None = None
    stand_latitude: float | None = None
    stand_longitude: float | None = None
    stand_altitude: float | None = None
    pilote: str
    mecanicien: str
    chef_de_base_id: uuid.UUID
    prospection_id: uuid.UUID | None = None
    # Dérivés par jointure sur prospection_id, jamais saisis (cf. domaine :
    # numero_fiche_validation = même document que numero_fiche_prospection).
    prospection_numero_fiche: str | None = None
    prospection_date_validation: datetime | None = None
    consultant_international: str | None = None
    pesticide_nom_commercial: str | None = None
    pesticide_quantite_disponible: float | None = None
    pesticide_quantite_recue: float | None = None
    # Dérivées (somme des rotations rattachées aux vols de la fiche), jamais stockées.
    pesticide_quantite_utilisee: float | None = None
    pesticide_quantite_restante: float | None = None
    futs_disponible: int | None = None
    futs_recues: int | None = None
    futs_pleins: int | None = None
    futs_vides: int | None = None
    observations: str | None = None
    statut: str
    statut_sync: str
    vols: list[VolRead] = Field(default_factory=list)
    signatures: list[SignatureVolRead] = Field(default_factory=list)
    duree_totale_minutes: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CumulsRead(BaseModel):
    jour: int
    semaine: int
    mois: int
    total: int
