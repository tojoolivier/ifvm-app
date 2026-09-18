import uuid
from datetime import date, datetime
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class ZoneAntiAcridienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    created_at: datetime
    updated_at: datetime


class ZoneAntiAcridienCreate(BaseModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ZoneAntiAcridienUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    actif: bool | None = None


class PosteAcridienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    za_id: uuid.UUID
    za_code: str
    za_nom: str
    # Rattachement à une équipe terrestre (migration 0072) : nullable, plusieurs
    # postes peuvent partager la même équipe.
    equipe_terrestre_id: uuid.UUID | None = None
    equipe_terrestre_nom: str | None = None
    actif: bool
    # Dérivé (stations actives rattachées) : lecture seule, absent des schémas d'écriture.
    nb_stations: int
    created_at: datetime
    updated_at: datetime


class PosteAcridienCreate(BaseModel):
    # `nb_stations` n'apparaît pas ici : c'est un agrégat calculé, pas une saisie.
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    za_id: uuid.UUID
    equipe_terrestre_id: uuid.UUID | None = None


class PosteAcridienUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    za_id: uuid.UUID | None = None
    # Nullable : seul `model_fields_set` (transmis en `champs_fournis`) distingue
    # « absent » de « détacher le poste de son équipe » (mis à NULL).
    equipe_terrestre_id: uuid.UUID | None = None
    actif: bool | None = None


class CommuneRead(BaseModel):
    """Sélecteur du formulaire de station : `station_fixe.commune_id` est NOT NULL,
    l'UI a besoin de la liste pour le renseigner."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    district: str
    region: str


class StationFixeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    pa_id: uuid.UUID
    pa_code: str
    pa_nom: str
    latitude: float
    longitude: float
    altitude: float | None
    # FK écrite, en plus des libellés joints : le panneau « Modifier » doit pouvoir
    # présélectionner la commune courante.
    commune_id: uuid.UUID
    commune: str
    district: str
    region: str
    actif: bool
    created_at: datetime
    updated_at: datetime


class StationFixeCreate(BaseModel):
    """Bornes reprises du domaine géographique : un 422 lisible plutôt qu'une station
    posée au large de Madagascar."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    pa_id: uuid.UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude: float | None = None
    commune_id: uuid.UUID


class StationFixeUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    pa_id: uuid.UUID | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    altitude: float | None = None
    commune_id: uuid.UUID | None = None
    actif: bool | None = None


class ZoneAntiAcridienSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    updated_at: datetime


class PosteAcridienSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    za_id: uuid.UUID
    actif: bool
    updated_at: datetime


class StationFixeSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    pa_id: uuid.UUID
    latitude: float
    longitude: float
    altitude: float | None
    commune: str
    district: str
    region: str
    actif: bool
    updated_at: datetime


class UtilisateurEquipeSyncRead(BaseModel):
    """L'email n'est pas transporté vers le terrain : il ne sert qu'à l'authentification
    backend, aucun écran mobile ne l'affiche, et le pull le poussait dans le cache
    hors-ligne de tous les téléphones sans usage (cf. ADR-015, #136)."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    prenom: str
    role: str
    pa_id: uuid.UUID | None
    actif: bool
    updated_at: datetime


class PesticideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    matiere_active: str | None
    dose_reference: str | None
    type_produit: str | None
    actif: bool
    created_at: datetime
    updated_at: datetime


class PesticideCreate(BaseModel):
    """`type_produit` reprend le CHECK de `pesticide` (migration 0044) : un 422
    lisible plutôt qu'une IntegrityError."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    matiere_active: str | None = None
    dose_reference: str | None = None
    type_produit: Literal["produit_choc", "produit_barriere"] | None = None


class PesticideUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    matiere_active: str | None = None
    dose_reference: str | None = None
    type_produit: Literal["produit_choc", "produit_barriere"] | None = None
    actif: bool | None = None


class PesticideSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    matiere_active: str | None
    dose_reference: str | None
    type_produit: str | None
    actif: bool
    updated_at: datetime


class CultureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    created_at: datetime
    updated_at: datetime


class CultureCreate(BaseModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CultureUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    actif: bool | None = None


class LieuAerienRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type_lieu: Literal["principale", "secondaire", "stand"]
    nom: str
    latitude: float
    longitude: float
    altitude: float | None
    actif: bool
    created_at: datetime
    updated_at: datetime


class LieuAerienCreate(BaseModel):
    type_lieu: Literal["principale", "secondaire", "stand"]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude: float | None = None


class LieuAerienUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    type_lieu: Literal["principale", "secondaire", "stand"] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    altitude: float | None = None
    actif: bool | None = None


class MembreEquipeAerienneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str


class MembreEquipeAerienneCreate(BaseModel):
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class EquipeAerienneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    chef_de_base_id: uuid.UUID
    # Nullable : équipes créées avant la migration 0071. Toujours renseignés pour
    # une équipe créée depuis (EquipeAerienneCreate les exige).
    pilote: str | None = None
    mecanicien: str | None = None
    consultant_international: str | None = None
    membres: list[MembreEquipeAerienneRead] = Field(default_factory=list)
    actif: bool
    created_at: datetime
    updated_at: datetime


class EquipeAerienneCreate(BaseModel):
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    chef_de_base_id: uuid.UUID
    pilote: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    mecanicien: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    consultant_international: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)] | None
    ) = None
    membres: list[MembreEquipeAerienneCreate] = Field(default_factory=list)


class MembreEquipeTerrestreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str


class MembreEquipeTerrestreCreate(BaseModel):
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class EquipeTerrestreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    chef_equipe_id: uuid.UUID
    membres: list[MembreEquipeTerrestreRead] = Field(default_factory=list)
    actif: bool
    created_at: datetime
    updated_at: datetime


class EquipeTerrestreCreate(BaseModel):
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    chef_equipe_id: uuid.UUID
    membres: list[MembreEquipeTerrestreCreate] = Field(default_factory=list)


class BaseAerienneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    parent_base_id: uuid.UUID | None
    # NOT NULL uniquement sur une base principale (#equipe-aerienne, migration
    # 0066) — une secondaire hérite de l'équipe de sa principale via
    # `parent_base_id`, elle n'a pas sa propre `equipe_id`.
    equipe_id: uuid.UUID | None
    numero: str
    localite: str
    longitude: float | None
    latitude: float | None
    altitude: float | None
    actif: bool
    created_at: datetime
    updated_at: datetime


class BaseAerienneCreate(BaseModel):
    numero: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    parent_base_id: uuid.UUID | None = None
    # Requis si `parent_base_id` est absent (base principale), doit être absent
    # sinon (base secondaire) — validé par `CreateBaseAerienne` (message clair)
    # et par `ck_base_aerienne_equipe_coherente` (garde-fou base de données).
    equipe_id: uuid.UUID | None = None
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    altitude: float | None = None


class BaseAerienneUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    numero: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)] | None
    ) = None
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    parent_base_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    altitude: float | None = None
    actif: bool | None = None


class StandRemplissageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    numero: str
    localite: str
    longitude: float | None
    latitude: float | None
    altitude: float | None
    actif: bool
    created_at: datetime
    updated_at: datetime


class StandRemplissageCreate(BaseModel):
    numero: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    altitude: float | None = None


class StandRemplissageUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    numero: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)] | None
    ) = None
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    longitude: float | None = Field(default=None, ge=-180, le=180)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    altitude: float | None = None
    actif: bool | None = None


class CultureSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    nom: str
    actif: bool
    updated_at: datetime


class LieuAerienSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type_lieu: Literal["principale", "secondaire", "stand"]
    nom: str
    latitude: float
    longitude: float
    altitude: float | None
    actif: bool
    updated_at: datetime


class CodeStadeSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    categorie: str
    # NULL : stade larvaire (non sexé) / applicable aux deux espèces.
    sexe: str | None
    espece: str | None
    libelle: str
    ordre: int
    actif: bool
    updated_at: datetime


class CodeStadeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    categorie: str
    sexe: str | None
    espece: str | None
    libelle: str
    ordre: int
    actif: bool
    updated_at: datetime


class CodeStadeCreate(BaseModel):
    """`categorie` et `sexe` reprennent les CHECK de `code_stade` : un 422 lisible
    plutôt qu'une IntegrityError."""

    code: str = Field(min_length=1)
    categorie: Literal["imago", "larve"]
    sexe: Literal["F", "M"] | None = None
    espece: str | None = None
    libelle: str = Field(min_length=1)
    ordre: int = 0


class CodeStadeUpdate(BaseModel):
    """Mise à jour partielle. Aucun champ de suppression : `actif=False` désactive."""

    code: str | None = Field(default=None, min_length=1)
    categorie: Literal["imago", "larve"] | None = None
    sexe: Literal["F", "M"] | None = None
    espece: str | None = None
    libelle: str | None = Field(default=None, min_length=1)
    ordre: int | None = None
    actif: bool | None = None


class CampagneSyncRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    start_date: date
    end_date: date | None
    updated_at: datetime


T = TypeVar("T")


class EntityPull(BaseModel, Generic[T]):
    upserts: list[T]
    server_time: datetime


class ReferentielPullResponse(BaseModel):
    zones_anti_acridiennes: EntityPull[ZoneAntiAcridienSyncRead]
    postes_acridiens: EntityPull[PosteAcridienSyncRead]
    stations_fixes: EntityPull[StationFixeSyncRead]
    utilisateurs_equipe: EntityPull[UtilisateurEquipeSyncRead]
    pesticides: EntityPull[PesticideSyncRead]
    cultures: EntityPull[CultureSyncRead]
    codes_stades: EntityPull[CodeStadeSyncRead]
    campagnes: EntityPull[CampagneSyncRead]
    lieux_aeriens: EntityPull[LieuAerienSyncRead]
