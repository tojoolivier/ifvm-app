import uuid
from datetime import date, datetime, time
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    computed_field,
    model_validator,
)

from app.models.users import FONCTIONS_EQUIPE


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
    # Rattachement à une équipe terrestre (migration 0073) : nullable, plusieurs
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


class MouvementPesticideCreate(BaseModel):
    """`site_destination_id` requis si et seulement si `type == 'transfert'` — même
    règle que le CHECK `ck_mouvement_pesticide_destination_coherente` (#606), vérifiée
    ici en amont pour un 422 lisible plutôt qu'une violation de contrainte brute."""

    type: Literal["approvisionnement", "transfert", "consommation"]
    pesticide_id: uuid.UUID
    site_id: uuid.UUID
    site_destination_id: uuid.UUID | None = None
    quantite: float = Field(gt=0)
    unite: Literal["L", "kg"]
    date_mouvement: date | None = None

    @model_validator(mode="after")
    def _valider_destination_coherente(self) -> "MouvementPesticideCreate":
        est_transfert = self.type == "transfert"
        if est_transfert and self.site_destination_id is None:
            raise ValueError("site_destination_id est requis pour un transfert")
        if not est_transfert and self.site_destination_id is not None:
            raise ValueError("site_destination_id ne doit être renseigné que pour un transfert")
        return self


class MouvementPesticideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    pesticide_id: uuid.UUID
    site_id: uuid.UUID
    site_destination_id: uuid.UUID | None
    quantite: float
    unite: str
    date_mouvement: date
    created_at: datetime
    # Fiche traitement aérien d'origine (migration 0093, #609) — None pour tout
    # mouvement manuel (approvisionnement, transfert).
    traitement_id: uuid.UUID | None


class SoldePesticideRead(BaseModel):
    site_id: uuid.UUID
    pesticide_id: uuid.UUID
    unite: str
    quantite: float


class VolCreate(BaseModel):
    """Les règles d'obligation par catégorie (site principal + stand pour
    mise_en_place/application, motif pour convoyage/divers, lieux pour convoyage —
    §6/§5.3/§5.5 du document de cadrage) sont vérifiées côté use case, pas ici : le
    message d'erreur y est plus précis qu'un `ValueError` de validateur Pydantic."""

    type: Literal["mise_en_place", "application", "convoyage", "prospection", "divers"]
    equipe_id: uuid.UUID
    aeronef_id: uuid.UUID
    date_vol: date
    heure_debut: time
    heure_fin: time
    site_principal_id: uuid.UUID | None = None
    stand_id: uuid.UUID | None = None
    base_secondaire_id: uuid.UUID | None = None
    motif: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    lieu_depart: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = (
        None
    )
    lieu_arrivee: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = (
        None
    )
    observations: str | None = None

    @model_validator(mode="after")
    def _valider_heures(self) -> "VolCreate":
        if self.heure_fin <= self.heure_debut:
            raise ValueError("heure_fin doit être postérieure à heure_debut")
        return self


class VolUpdate(BaseModel):
    """Rattachement différé d'un traitement aérien (#610) — seul champ mutable
    après création d'un vol."""

    traitement_id: uuid.UUID


class VolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    equipe_id: uuid.UUID
    aeronef_id: uuid.UUID
    site_principal_id: uuid.UUID | None
    stand_id: uuid.UUID | None
    base_secondaire_id: uuid.UUID | None
    traitement_id: uuid.UUID | None
    date_vol: date
    heure_debut: time
    heure_fin: time
    motif: str | None
    lieu_depart: str | None
    lieu_arrivee: str | None
    observations: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def duree_minutes(self) -> int:
        """Dérivée de heure_debut/heure_fin à la lecture, jamais stockée (#608)."""
        debut = datetime.combine(date.min, self.heure_debut)
        fin = datetime.combine(date.min, self.heure_fin)
        return int((fin - debut).total_seconds() // 60)


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
    # Résolus par jointure (migration 0074), jamais saisis. `equipe_aerienne_id` est
    # `None` pour un lieu créé avant cette évolution, non encore rattaché.
    equipe_aerienne_id: uuid.UUID | None = None
    equipe_aerienne_nom: str | None = None
    created_at: datetime
    updated_at: datetime


class LieuAerienCreate(BaseModel):
    type_lieu: Literal["principale", "secondaire", "stand"]
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude: float | None = None
    # Obligatoire pour toute nouvelle création (#lieu-aerien-equipe-aerienne) — les
    # lieux créés avant cette évolution restent nullables en base (migration 0074).
    equipe_aerienne_id: uuid.UUID


class LieuAerienUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    type_lieu: Literal["principale", "secondaire", "stand"] | None = None
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    altitude: float | None = None
    equipe_aerienne_id: uuid.UUID | None = None
    actif: bool | None = None


class AeronefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    immatriculation: str
    societe: str
    volume_cuve_l: float
    actif: bool
    created_at: datetime
    updated_at: datetime


class AeronefCreate(BaseModel):
    """Corps de `POST /aeronefs` (#621), et forme imbriquée de `EquipeCreate.aeronef`
    pour les formulaires qui saisissent l'appareil en même temps que l'équipe."""

    immatriculation: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)
    ]
    societe: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    volume_cuve_l: float = Field(gt=0, le=99999)


class AeronefUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    immatriculation: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)] | None
    ) = None
    societe: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
        | None
    ) = None
    volume_cuve_l: float | None = Field(default=None, gt=0, le=99999)
    actif: bool | None = None


class AffectationAeronefRead(BaseModel):
    """Période pendant laquelle un appareil a servi dans une équipe (#603).
    `date_fin: null` désigne l'affectation en cours."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    equipe_id: uuid.UUID
    aeronef_id: uuid.UUID
    date_debut: date
    date_fin: date | None = None
    aeronef: AeronefRead | None = None
    created_at: datetime


class AffectationAeronefCreate(BaseModel):
    """`date_debut` est explicite : une affectation est saisie après coup aussi souvent
    qu'en temps réel, et la dater du jour de la saisie fausserait l'historique."""

    aeronef_id: uuid.UUID
    date_debut: date
    date_fin: date | None = None


class AffectationAeronefCloture(BaseModel):
    """Retrait d'un appareil : on borne la période, on n'efface pas la ligne."""

    date_fin: date


class MembreEquipeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: uuid.UUID
    fonction: str
    # Résolus par jointure sur `utilisateur` : l'identité n'est plus stockée sur la
    # ligne de membre (ADR-018), elle est lue là où elle vit.
    nom: str | None = None
    prenom: str | None = None


class MembreEquipeCreate(BaseModel):
    """Membre désigné soit par son compte (`user_id`), soit par son identité — auquel
    cas un compte non authentifiable est créé à la volée (`ROLES_A_LA_VOLEE`)."""

    fonction: Literal[FONCTIONS_EQUIPE]  # type: ignore[valid-type]
    user_id: uuid.UUID | None = None
    nom: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
        | None
    ) = None
    prenom: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None = None

    @model_validator(mode="after")
    def _exiger_compte_ou_identite(self) -> "MembreEquipeCreate":
        if self.user_id is None and not self.nom:
            raise ValueError("un membre doit porter soit user_id, soit nom")
        if self.user_id is not None and self.nom:
            raise ValueError("user_id et nom sont exclusifs : le compte porte déjà l'identité")
        return self


class EquipeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    nom: str
    type: Literal["terrestre", "aerien"]
    # Appareil **en service** dans l'équipe — projection de l'affectation ouverte de
    # `equipe_aeronef` (#603), et non plus une colonne. `null` quand l'équipe est entre
    # deux appareils. L'historique complet se lit par `GET /equipes/{id}/aeronefs`.
    aeronef_id: uuid.UUID | None = None
    aeronef: AeronefRead | None = None
    membres: list[MembreEquipeRead] = Field(default_factory=list)
    actif: bool
    created_at: datetime
    updated_at: datetime


class EquipeCreate(BaseModel):
    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    type: Literal["terrestre", "aerien"]
    # Deux formes exclusives (#621) : l'appareil est saisi ici (création à la volée,
    # forme historique) ou désigné au référentiel par son identifiant.
    aeronef: AeronefCreate | None = None
    aeronef_id: uuid.UUID | None = None
    membres: list[MembreEquipeCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _exiger_un_chef_et_un_seul(self) -> "EquipeCreate":
        """Une équipe naît avec son chef, comme du temps où `chef_de_base_id` /
        `chef_equipe_id` étaient NOT NULL : l'unification en `equipe_membre` ne devait
        pas rendre le chef facultatif. Une équipe sans chef est d'ailleurs inutilisable
        — `_resoudre_equipe_creation` refuse ensuite la création de ses lieux.

        L'unicité, elle, est déjà tenue en base (`uq_equipe_membre_chef_par_equipe`) ;
        la vérifier ici n'en fait qu'un 422 explicite plutôt qu'un 409 de contrainte."""
        chefs = [m for m in self.membres if m.fonction == "chef"]
        if not chefs:
            raise ValueError("une équipe doit avoir un membre de fonction 'chef'")
        if len(chefs) > 1:
            raise ValueError("une équipe n'a qu'un seul chef")
        return self

    @model_validator(mode="after")
    def _aeronef_suit_le_type(self) -> "EquipeCreate":
        """L'aéronef suit exactement le type : exigé en aérien (règle inchangée depuis
        la migration 0078), interdit en terrestre (`ck_equipe_aeronef_reserve_aerien`).

        `aeronef` et `aeronef_id` sont exclusifs : l'un crée l'appareil, l'autre en
        désigne un du référentiel ; accepter les deux obligerait à trancher lequel
        l'emporte, sans qu'aucune réponse ne soit évidente pour l'appelant."""
        if self.aeronef is not None and self.aeronef_id is not None:
            raise ValueError("aeronef et aeronef_id sont exclusifs")
        designe = self.aeronef is not None or self.aeronef_id is not None
        if self.type == "aerien" and not designe:
            raise ValueError("une équipe aérienne doit avoir un aéronef")
        if self.type != "aerien" and designe:
            raise ValueError("un aéronef ne s'affecte qu'à une équipe aérienne")
        return self


class EquipeUpdate(BaseModel):
    """Mise à jour partielle. `type` en est volontairement absent : le type d'une équipe
    n'est pas modifiable après création (ADR-018) — garanti ici, sans trigger en base.
    Pas de suppression non plus : `actif=False` est la seule sortie."""

    nom: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)] | (
        None
    ) = None
    actif: bool | None = None


class SiteAerienneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    parent_site_id: uuid.UUID | None
    # NOT NULL uniquement sur un site principal (#equipe-aerienne, migration
    # 0066) — un secondaire hérite de l'équipe de son principal via
    # `parent_site_id`, il n'a pas sa propre `equipe_id`.
    equipe_id: uuid.UUID | None
    numero: str
    localite: str
    actif: bool
    created_at: datetime
    updated_at: datetime


class SiteAerienneCreate(BaseModel):
    numero: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    parent_site_id: uuid.UUID | None = None
    # Requis si `parent_site_id` est absent (site principal), doit être absent
    # sinon (site secondaire) — validé par `CreateSiteAerienne` (message clair)
    # et par `ck_site_aerienne_equipe_coherente` (garde-fou base de données).
    equipe_id: uuid.UUID | None = None


class SiteAerienneUpdate(BaseModel):
    """Mise à jour partielle. Pas de suppression : `actif=False` est la seule sortie."""

    numero: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)] | None
    ) = None
    localite: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)] | None = None
    parent_site_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    actif: bool | None = None


class SiteAeriennePositionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    site_id: uuid.UUID
    latitude: float
    longitude: float
    altitude: float | None
    date_debut: date
    date_fin: date | None
    # Dérivée à la lecture, jamais stockée (AC #604) : `date_fin - date_debut`, ou
    # l'écart à `today()` si la position est encore active.
    duree_jours: int
    created_at: datetime


class SiteAeriennePositionInstaller(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude: float | None = None


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
    equipe_aerienne_id: uuid.UUID | None = None
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
    actif: bool
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
