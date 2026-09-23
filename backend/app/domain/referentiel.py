import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone


class StationNotFoundError(Exception):
    """station_id ne référence pas une station fixe existante."""

    pass


class CodeReferentielDejaPrisError(Exception):
    """Le `code` d'une entité de référentiel est unique : un doublon est refusé."""

    pass


class ZoneAntiAcridienIntrouvableError(Exception):
    """za_id ne référence pas une zone anti-acridienne existante."""

    pass


class PosteAcridienAvecStationsActivesError(Exception):
    """Désactiver un poste n'orpheline pas ses stations.

    La désactivation ne se propage pas — laisser des stations actives rattachées à un
    poste inactif rendrait la hiérarchie incohérente sur le terrain, sans qu'aucun
    écran ne le signale. On refuse donc tant que des stations actives y pendent.
    """

    pass


class ZoneAntiAcridienAvecPostesActifsError(Exception):
    """Désactiver une zone n'orpheline pas ses postes.

    Réciproque de `PosteAcridienAvecStationsActivesError`, un niveau plus haut dans la
    hiérarchie géographique : refuse tant que des postes actifs référencent la zone.
    """

    pass


class PosteAcridienIntrouvableError(Exception):
    """pa_id ne référence pas un poste acridien existant."""

    pass


class PosteAcridienInactifError(Exception):
    """Rattachement interdit : le poste est hors service.

    Réciproque de `PosteAcridienAvecStationsActivesError` — celle-ci empêche de fermer
    un poste sous des stations actives, celle-là d'accrocher une station vivante à un
    poste déjà fermé. Ensemble, elles gardent la hiérarchie atteignable du terrain.
    """

    pass


class CommuneInconnueError(Exception):
    """commune_id ne référence pas une commune existante."""

    pass


@dataclass
class ZoneAntiAcridien:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PosteAcridien:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    za_id: uuid.UUID = field(default_factory=uuid.uuid4)
    za_code: str = ""
    za_nom: str = ""
    # Rattachement à une équipe terrestre (migration 0073) : nullable, plusieurs
    # postes peuvent partager la même équipe (équipe mobile, pas de UNIQUE).
    equipe_terrestre_id: uuid.UUID | None = None
    equipe_terrestre_nom: str | None = None
    actif: bool = True
    # Dérivé : nombre de stations fixes actives rattachées. Jamais saisissable — c'est
    # la colonne « Stations » de l'écran Référentiels, et le garde-fou de désactivation.
    nb_stations: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Commune:
    """Feuille de la hiérarchie géographique, avec ses libellés remontés — de quoi
    peupler le sélecteur de commune du formulaire de station."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    district: str = ""
    region: str = ""


@dataclass
class StationFixe:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    pa_id: uuid.UUID = field(default_factory=uuid.uuid4)
    pa_code: str = ""
    pa_nom: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float | None = None
    # `commune_id` est la donnée écrite ; `commune`/`district`/`region` sont les
    # libellés joints, dérivés, jamais fournis par un appelant.
    commune_id: uuid.UUID = field(default_factory=uuid.uuid4)
    commune: str = ""
    district: str = ""
    region: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class UtilisateurEquipe:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    prenom: str = ""
    role: str = ""
    pa_id: uuid.UUID | None = None
    actif: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Pesticide:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    matiere_active: str | None = None
    dose_reference: str | None = None
    type_produit: str | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Culture:
    """Culture exposée aux dégâts acridiens.

    Jamais supprimée : le pull hors-ligne ne transporte que des upserts, une
    ligne effacée en base resterait indéfiniment dans le SQLite des téléphones
    déjà synchronisés. On la retire du terrain en passant `actif` à false.
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    nom: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CodeStade:
    """Place d'un code de stade dans une grille de saisie (catégorie, sexe, espèce)."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    code: str = ""
    categorie: str = ""
    sexe: str | None = None
    espece: str | None = None
    libelle: str = ""
    ordre: int = 0
    actif: bool = True
    updated_at: datetime = field(default_factory=datetime.utcnow)


class StadeInconnuError(Exception):
    """`code_stade.code` référence `stade.code` : le code n'est pas au vocabulaire."""

    pass


class GrilleDejaOccupeeError(Exception):
    """(code, categorie, sexe, espece) identifie une place de grille — elle est prise."""

    pass


TYPES_LIEU_AERIEN = ("principale", "secondaire", "stand")


class TypeLieuAerienInvalideError(Exception):
    """`type_lieu` n'appartient pas à `TYPES_LIEU_AERIEN`."""

    pass


@dataclass
class LieuAerien:
    """Base aérienne principale, base secondaire ou stand de remplissage.

    Table unique typée par `type_lieu` plutôt que trois entités séparées — même
    choix que `Prospection.type_prospection` (ADR-006). Durable, indépendant
    de la campagne. Jamais supprimé : on le retire du terrain en passant
    `actif` à false.
    """

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type_lieu: str = "principale"
    nom: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    # Rattachement à l'équipe aérienne propriétaire du lieu (migration 0074) —
    # nullable (lieux existants "sans équipe"), obligatoire côté application pour
    # toute nouvelle création (cf. CreateLieuAerien).
    equipe_aerienne_id: uuid.UUID | None = None
    # Dérivé par jointure à la lecture, jamais stocké (même statut que
    # `equipe_terrestre_nom` sur `PosteAcridien`).
    equipe_aerienne_nom: str | None = None


class NumeroSiteAerienneDejaPrisError(Exception):
    """`numero` d'un site_aerienne est déjà pris (contrainte UNIQUE)."""

    pass


class SiteAerienneParentInvalideError(Exception):
    """`parent_site_id` ne référence pas un site principal existant.

    Couvre deux cas : l'id ne référence aucun site_aerienne, ou il en référence un
    qui est lui-même secondaire (`parent_site_id` non nul) — la hiérarchie s'arrête à
    2 niveaux, pas de secondaire d'un secondaire.
    """

    pass


class SiteAerienneEquipeInvalideError(Exception):
    """`equipe_id` incohérent avec la hiérarchie (#equipe-aerienne, migration 0066).

    Deux cas : un site principal (`parent_site_id is None`) sans `equipe_id`, ou un
    site secondaire (`parent_site_id` non nul) auquel on tente d'assigner sa propre
    `equipe_id` — il hérite de celle de son principal, il n'en porte pas une à lui.
    """

    pass


class EquipeAerienneIntrouvableError(Exception):
    """`equipe_id` ne référence aucune `equipe` de type `aerien`."""

    pass


class EquipeAerienneDejaAssigneeError(Exception):
    """L'équipe référencée possède déjà un site aérien principal (UNIQUE
    `site_aerienne.equipe_id`, une équipe = un site principal)."""

    pass


class SiteAerienneIntrouvableError(Exception):
    """`site_id` ne référence aucun `site_aerienne` existant."""

    pass


class PositionDejaActiveError(Exception):
    """Le site a déjà une position active (`date_fin IS NULL`) — le démonter avant
    d'en installer une nouvelle."""

    pass


class PositionActiveIntrouvableError(Exception):
    """Le site n'a aucune position active à démonter."""

    pass


class ChefEquipeInvalideError(Exception):
    """Le membre désigné `fonction='chef'` n'a pas le rôle attendu par le type d'équipe :
    `chef_de_base` pour une équipe aérienne, `chef_equipe` pour une terrestre."""

    pass


class ChefDejaDansUneAutreEquipeError(Exception):
    """L'utilisateur dirige déjà une autre équipe (index partiel
    `uq_equipe_membre_chef_par_utilisateur`, un chef = une équipe)."""

    pass


class EquipeADejaUnChefError(Exception):
    """L'équipe a déjà un chef (index partiel `uq_equipe_membre_chef_par_equipe`)."""

    pass


class MembreDejaDansEquipeError(Exception):
    """L'utilisateur est déjà membre de cette équipe (PK `(equipe_id, user_id)`) — une
    personne n'y occupe qu'une fonction."""

    pass


class CompteALaVoleeInterditError(Exception):
    """Un membre sans `user_id` ne peut pas recevoir de compte créé à la volée.

    Seules les fonctions de `ROLES_A_LA_VOLEE` naissent d'un simple nom — un chef doit
    préexister (#319). L'argument porte le message complet : la liste des fonctions
    autorisées vit dans `ROLES_A_LA_VOLEE`, pas recopiée dans les couches au-dessus,
    où elle se périme sans que rien ne le signale."""

    pass


class UtilisateurMembreIntrouvableError(Exception):
    """`user_id` d'un membre ne référence aucun utilisateur existant."""

    pass


class EquipeIntrouvableError(Exception):
    """`equipe_id` ne référence aucune `equipe` existante."""

    pass


class ImmatriculationAeronefDejaPriseError(Exception):
    """`immatriculation` d'un aéronef est déjà prise (UNIQUE `aeronef.immatriculation`)."""

    pass


class AeronefIntrouvableError(Exception):
    """`aeronef_id` ne référence aucun `aeronef` existant."""

    pass


class AeronefDejaAffecteError(Exception):
    """L'aéronef est déjà affecté sur une période qui chevauche celle demandée (#603).

    La règle n'est pas « un aéronef = une équipe » mais « un aéronef sur une seule
    équipe *à la fois* » : elle porte sur le chevauchement des intervalles
    `[date_debut, date_fin)`, et se valide côté application — `EXCLUDE USING gist` est
    hors scope (ADR-018)."""

    pass


class EquipeDejaEquipeeError(Exception):
    """L'équipe a déjà un appareil affecté sur une période qui chevauche celle demandée.

    Symétrique de `AeronefDejaAffecteError` : les appareils d'une équipe se succèdent
    (#603), ils ne se cumulent pas. Sans cette règle l'« affectation active » n'aurait
    pas de sens, deux lignes pouvant être ouvertes en même temps."""

    pass


class AffectationDejaCloturee(Exception):
    """L'affectation est déjà bornée : la reclôturer déplacerait une borne passée.

    L'historique est l'objet même de `equipe_aeronef` (#603) ; le raccourcir après coup
    le falsifierait. Retirer un appareil est un geste qui ne se rejoue pas."""

    pass


class AffectationAeronefIntrouvableError(Exception):
    """`affectation_id` ne référence aucune affectation de cette équipe."""

    pass


class PeriodeAffectationInvalideError(ValueError):
    """`date_fin` est antérieure à `date_debut` (CHECK `ck_equipe_aeronef_periode`)."""

    pass


class EquipeNonAerienneError(Exception):
    """Un appareil ne s'affecte qu'à une équipe aérienne — ce que portait le CHECK
    `ck_equipe_aeronef_reserve_aerien`, et que porte désormais la FK composite
    `(equipe_id, equipe_type) -> equipe(id, type)`."""

    pass


class EquipeNonAutoriseeError(PermissionError):
    """L'utilisateur n'a pas le droit d'agir pour cette équipe aérienne : seul le chef de
    base de l'équipe (ou un admin) crée les lieux aériens de SON équipe."""

    pass


class EquipeRequiseError(ValueError):
    """Un admin agit pour le compte d'une équipe sans la désigner : contrairement au chef
    de base (qui n'en a qu'une, la sienne), rien ne permet de la déduire."""

    pass


@dataclass
class Aeronef:
    """Hélicoptère d'une équipe aérienne (migration 0078). `immatriculation` est sa clé
    candidate : `societe` (exploitant) et `volume_cuve_l` en dépendent, d'où une entité à
    part plutôt que des colonnes de `EquipeAerienne`. Jamais supprimé : `actif=false`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    immatriculation: str = ""
    societe: str = ""
    volume_cuve_l: float = 0.0
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AffectationAeronef:
    """Période pendant laquelle un aéronef est affecté à une équipe (#603, migration
    0085).

    Remplace la FK 1:1 `equipe.aeronef_id` : une équipe dispose de 2 à 3 appareils
    qu'elle utilise l'un après l'autre, et on veut pouvoir dire lequel était en service
    à quelle date. L'intervalle est semi-ouvert `[date_debut, date_fin)` ;
    `date_fin is None` désigne l'affectation en cours.

    `aeronef` est résolu par jointure à la lecture — l'historique d'une équipe se lit
    avec les immatriculations, pas avec des identifiants nus."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    aeronef_id: uuid.UUID = field(default_factory=uuid.uuid4)
    date_debut: date = field(default_factory=lambda: datetime.now(timezone.utc).date())
    date_fin: date | None = None
    aeronef: Aeronef | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class MembreEquipe:
    """Appartenance d'un utilisateur à une équipe, avec sa fonction (ADR-018).

    `nom`/`prenom` sont résolus par jointure à la lecture — l'identité vit sur
    `Utilisateur`, pas ici : c'est tout l'intérêt d'avoir remplacé le texte libre des
    anciennes tables de membres par un `user_id`."""

    equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    user_id: uuid.UUID = field(default_factory=uuid.uuid4)
    fonction: str = ""
    nom: str | None = None
    prenom: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Equipe:
    """Équipe terrestre ou aérienne (ADR-018, migration 0086).

    Fusion de `EquipeAerienne` et `EquipeTerrestre` : un `type` discriminant, et des
    membres génériques porteurs de leur `fonction` à la place des rôles nommés en dur.
    `type` n'est pas modifiable après création — garanti par son absence de
    `EquipeUpdate`, pas par un trigger.

    `aeronef_id` / `aeronef` ne sont plus des colonnes depuis #603 : ce sont les champs
    *dérivés* de l'affectation en cours (`equipe_aeronef` avec `date_fin IS NULL`), et
    ils valent `None` pour une équipe momentanément sans appareil. Ils survivent sous ce
    nom pour que le contrat lu par le mobile et le web ne bouge pas ; l'historique
    complet, lui, se lit par `GET /equipes/{id}/aeronefs`.

    En écriture (`EquipeRepository.create` uniquement), `aeronef` demande la création de
    l'appareil et `aeronef_id` en désigne un du référentiel ; dans les deux cas une
    affectation ouverte est posée dans la même transaction."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    nom: str = ""
    type: str = "terrestre"
    aeronef_id: uuid.UUID | None = None
    aeronef: Aeronef | None = None
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    membres: list[MembreEquipe] = field(default_factory=list)

    def chef(self) -> MembreEquipe | None:
        return next((m for m in self.membres if m.fonction == "chef"), None)


@dataclass
class SiteAerienne:
    """Site aérien principal (`parent_site_id is None`) ou secondaire (référence son
    principal) — base ou stand de remplissage, indistinguables en base depuis la fusion
    de migration 0088 (#604) : le rôle est contextuel, porté par l'appelant. Référentiel
    dédié à la gestion d'équipe aérienne, distinct de `LieuAerien` — décision produit du
    2026-09-15 maintenue malgré le précédent `lieu_aerien` (cf. migration `0064`).

    `equipe_id` (migration 0066) n'est renseigné que sur un site principal — un site
    secondaire hérite de l'équipe de son principal via `parent_site_id`, il ne porte pas
    sa propre `equipe_id` (cf. `SiteAerienneEquipeInvalideError`).

    La position GPS n'est plus portée ici depuis la migration 0088 : elle s'historise
    dans `SiteAeriennePosition`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    parent_site_id: uuid.UUID | None = None
    equipe_id: uuid.UUID | None = None
    numero: str = ""
    localite: str = ""
    actif: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SiteAeriennePosition:
    """Implantation d'un `SiteAerienne` sur une période (migration 0088, #604) —
    même patron que `AffectationAeronef` (équipe/aéronef, migration 0087).
    `date_fin is None` : position active (« installée », non démontée)."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    site_id: uuid.UUID = field(default_factory=uuid.uuid4)
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float | None = None
    date_debut: date = field(default_factory=lambda: datetime.now(timezone.utc).date())
    date_fin: date | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)

    def duree_jours(self, aujourdhui: date | None = None) -> int:
        """Durée d'implantation dérivée : jamais stockée (AC #604)."""
        fin = self.date_fin or aujourdhui or datetime.now(timezone.utc).date()
        return (fin - self.date_debut).days


class EquipeTerrestreIntrouvableError(Exception):
    """`equipe_terrestre_id` ne référence aucune `equipe` de type `terrestre`."""

    pass


TYPES_MOUVEMENT_PESTICIDE = ("approvisionnement", "transfert", "consommation")
# Reprend le vocabulaire de `traitement_rotation.unite` (ck_traitement_rotation_unite) —
# une quantité de pesticide ne se compte jamais en un nombre unique (#606).
UNITES_MOUVEMENT_PESTICIDE = ("L", "kg")


class PesticideIntrouvableError(Exception):
    """`pesticide_id` ne référence aucun `pesticide` existant."""

    pass


class SiteDestinationIncoherentError(Exception):
    """`site_destination_id` doit être renseigné si et seulement si `type='transfert'`
    (CHECK `ck_mouvement_pesticide_destination_coherente`) — vérifiée ici en amont pour
    un message d'erreur explicite plutôt qu'une violation de contrainte brute."""

    pass


class SiteNonPrincipalError(Exception):
    """Le stock de pesticides est rattaché au site aérien **principal** (#606) : un
    mouvement visant un site secondaire/stand (`parent_site_id IS NOT NULL`) est
    refusé — pas de garde-fou SQL possible (`site_aerienne.parent_site_id` n'est
    pas visible depuis `mouvement_pesticide` sans jointure), validée côté
    application."""

    pass


@dataclass
class MouvementPesticide:
    """Entrée (`approvisionnement`, origine hors système), sortie (`consommation`) ou
    déplacement (`transfert`, entre deux sites principaux) de pesticide (#606).

    Pas de colonne « stock actuel » dénormalisée : le solde par (site, pesticide,
    unité) se calcule par agrégation de ces mouvements, source de vérité unique
    (décision produit actée, cf. ticket #606)."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type: str = "approvisionnement"
    pesticide_id: uuid.UUID = field(default_factory=uuid.uuid4)
    site_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # Renseigné si et seulement si `type == 'transfert'`.
    site_destination_id: uuid.UUID | None = None
    quantite: float = 0.0
    unite: str = "L"
    date_mouvement: date = field(default_factory=lambda: datetime.now(timezone.utc).date())
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Fiche traitement aérien d'origine (migration 0093, #609) : renseigné si et
    # seulement si `type == 'consommation'` généré automatiquement depuis les
    # rotations d'une fiche — `None` pour tout mouvement saisi à la main
    # (approvisionnement, transfert). Seul moyen de retrouver, et régénérer, les
    # mouvements produits par une fiche donnée.
    traitement_id: uuid.UUID | None = None


@dataclass
class SoldePesticide:
    """Solde agrégé par (site, pesticide, unité) — jamais un nombre unique, une
    quantité en L ne s'additionne jamais à une quantité en kg (#606)."""

    site_id: uuid.UUID
    pesticide_id: uuid.UUID
    unite: str
    quantite: float


TYPES_VOL = ("mise_en_place", "application", "convoyage", "prospection", "divers")
# Catégories dont le document de cadrage impose site principal + stand (§6, règle dure).
TYPES_VOL_SITE_OBLIGATOIRE = ("mise_en_place", "application")
# Catégories dont `motif` est obligatoire (§5.3/§5.5).
TYPES_VOL_MOTIF_REQUIS = ("convoyage", "divers")


class AeronefNonAffecteError(Exception):
    """`aeronef_id` n'est pas affecté à `equipe_id` à `date_vol` (via `equipe_aeronef`) —
    le document de cadrage n'exige pas cette cohérence noir sur blanc, mais sans elle
    le suivi des heures de vol ne peut pas être ventilé par appareil (#608). Pas de
    CHECK SQL possible : la vérification suppose une jointure temporelle."""

    pass


class SiteHorsBaseError(Exception):
    """`stand_id` ou `base_secondaire_id` d'un vol doit être rattaché, par son
    `parent_site_id`, au `site_principal_id` de ce même vol (§9 du document de
    cadrage) — pas de CHECK SQL possible (`site_aerienne.parent_site_id` n'est pas
    visible depuis `vol` sans jointure), validée côté application (#608)."""

    pass


class VolSiteObligatoireError(Exception):
    """`site_principal_id` et `stand_id` sont obligatoires pour `mise_en_place` et
    `application` (§6 du document de cadrage, `ck_vol_site_mise_en_place_application`)
    — vérifiée ici en amont pour un 422 lisible plutôt qu'une violation de contrainte
    brute."""

    pass


class VolMotifRequisError(Exception):
    """`motif` est obligatoire pour `convoyage` et `divers` (§5.3, `ck_vol_motif_requis`)."""

    pass


class VolLieuxConvoyageRequisError(Exception):
    """`lieu_depart` et `lieu_arrivee` sont obligatoires pour `convoyage` (§5.3/§5.5,
    `ck_vol_lieux_convoyage`)."""

    pass


class IdentifiantDejaUtiliseError(Exception):
    """`id` client déjà utilisé par une ressource au contenu différent (#639) — un
    rejeu identique est idempotent, un même `id` avec un autre contenu est un
    conflit (409), jamais un écrasement silencieux."""

    pass


class VolIntrouvableError(Exception):
    """`vol_id` ne référence aucun vol (#610)."""

    pass


class VolTypeNonApplicationError(Exception):
    """Seul un vol de type `application` peut porter un traitement aérien
    (§Décisions actées, `ck_vol_traitement_type`, #610)."""

    pass


class TraitementAerienIntrouvableError(Exception):
    """`traitement_id` ne référence aucun traitement aérien — soit la fiche
    `traitement` n'existe pas, soit elle existe mais n'est pas de type
    `AERIEN` (#610). La cohérence de type est inter-tables, hors CHECK SQL."""

    pass


@dataclass
class Vol:
    """Ligne d'activité aérienne : un type, une équipe, un aéronef, une date, et ses
    rattachements de site (ADR-018, #608).

    Réintroduite après la suppression de l'ancienne `vol` (migration 0080, ADR-017) :
    ce n'est pas le même objet — pas de carnet de bord, de signatures, de cumuls
    d'heures ni de `rotation_id`. `equipe_id` est obligatoire pour toutes les
    catégories, y compris convoyage et divers, qui n'ont ni traitement ni
    prospection pour porter la trace de l'équipe autrement.

    La durée de vol (`heure_fin - heure_debut`) est dérivée à la lecture, jamais
    stockée — même choix que `duree_jours` sur `SiteAeriennePosition`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    type: str = "divers"
    equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    aeronef_id: uuid.UUID = field(default_factory=uuid.uuid4)
    site_principal_id: uuid.UUID | None = None
    stand_id: uuid.UUID | None = None
    base_secondaire_id: uuid.UUID | None = None
    # Traitement aérien réalisé par ce vol (#610) — 0..1, jamais renseigné à la
    # création, rattaché plus tard via UpdateVol. Cf. VolModel.traitement_id.
    traitement_id: uuid.UUID | None = None
    date_vol: date = field(default_factory=lambda: datetime.now(timezone.utc).date())
    heure_debut: time = field(default_factory=lambda: time(0, 0))
    heure_fin: time = field(default_factory=lambda: time(0, 0))
    motif: str | None = None
    lieu_depart: str | None = None
    lieu_arrivee: str | None = None
    observations: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
