import uuid
from abc import ABC, abstractmethod
from datetime import date, datetime
from typing import Any

from app.domain.campagne import Campagne
from app.domain.prospection import AuditLog, Prospection
from app.domain.referentiel import (
    Aeronef,
    AffectationAeronef,
    CodeStade,
    Commune,
    Culture,
    Equipe,
    LieuAerien,
    MembreEquipe,
    MouvementPesticide,
    Pesticide,
    PosteAcridien,
    SiteAerienne,
    SiteAeriennePosition,
    SoldePesticide,
    StationFixe,
    UtilisateurEquipe,
    Vol,
    ZoneAntiAcridien,
)
from app.domain.traitement import Bloc, ProduitUtilise, Rotation, Traitement, TraitementSignature
from app.domain.utilisateur import UtilisateurRef


class CampagneRepository(ABC):
    @abstractmethod
    async def get_by_id(self, campagne_id: uuid.UUID) -> Campagne | None:
        pass

    @abstractmethod
    async def list_all(self) -> list[Campagne]:
        pass

    @abstractmethod
    async def create(self, campagne: Campagne) -> Campagne:
        pass

    @abstractmethod
    async def update(self, campagne: Campagne) -> Campagne:
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[Campagne]:
        pass


class ProspectionRepository(ABC):
    @abstractmethod
    async def get_by_id(self, prospection_id: uuid.UUID) -> Prospection | None:
        pass

    @abstractmethod
    async def list_by_filters(
        self,
        type_prospection: str | None = None,
        statut: str | None = None,
        campagne_id: uuid.UUID | None = None,
        station_id: uuid.UUID | None = None,
        prospecteur_id: uuid.UUID | None = None,
        equipe_id: uuid.UUID | None = None,
        vol_id: uuid.UUID | None = None,
        disponible_pour_traitement: bool = False,
        a_revalider: bool = False,
    ) -> list[Prospection]:
        pass

    @abstractmethod
    async def create(self, prospection: Prospection) -> Prospection:
        pass

    @abstractmethod
    async def update(self, prospection: Prospection) -> Prospection:
        pass

    @abstractmethod
    async def delete(self, prospection_id: uuid.UUID) -> bool:
        pass

    @abstractmethod
    async def stades_inconnus(self, codes: set[str]) -> set[str]:
        """Codes absents du référentiel des stades, parmi ceux fournis."""


class TraitementRepository(ABC):
    @abstractmethod
    async def get_by_id(self, traitement_id: uuid.UUID) -> Traitement | None:
        pass

    @abstractmethod
    async def list_by_filters(
        self,
        type_traitement: str | None = None,
        prospection_id: uuid.UUID | None = None,
        chef_equipe_id: uuid.UUID | None = None,
        reprenable: bool | None = None,
        statut: str | None = None,
    ) -> list[Traitement]:
        pass

    @abstractmethod
    async def create(self, traitement: Traitement) -> Traitement:
        """Raises NumeroFicheConflitError si numero_fiche existe déjà."""
        pass

    @abstractmethod
    async def origine_deja_utilisee(
        self, traitement_origine_id: uuid.UUID, exclude_traitement_id: uuid.UUID | None = None
    ) -> bool:
        """True si une fiche terrestre (autre que `exclude_traitement_id`) désigne déjà
        `traitement_origine_id` comme origine. `exclude_traitement_id` permet à la
        synchronisation de revalider une fiche déjà persistée sans se heurter à sa propre
        désignation d'origine."""
        pass

    @abstractmethod
    async def origine_deja_utilisee_aerien(
        self, traitement_origine_id: uuid.UUID, exclude_traitement_id: uuid.UUID | None = None
    ) -> bool:
        """Mirroir de `origine_deja_utilisee` (migration 0050) pour le chaînage de
        reprise généralisé à l'Aérien."""
        pass

    @abstractmethod
    async def add_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def update_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def remove_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation_id: uuid.UUID,
        nb_rotations: int,
        total_pesticide_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def add_bloc(self, traitement_id: uuid.UUID, bloc: Bloc) -> Traitement:
        """Aucun total à recalculer : un bloc ne nourrit aucun champ dérivé de
        `traitement_aerien` (contrairement à une rotation)."""
        pass

    @abstractmethod
    async def update_bloc(self, traitement_id: uuid.UUID, bloc: Bloc) -> Traitement:
        pass

    @abstractmethod
    async def remove_bloc(self, traitement_id: uuid.UUID, bloc_id: uuid.UUID) -> Traitement:
        pass

    @abstractmethod
    async def add_produit(
        self,
        traitement_id: uuid.UUID,
        produit: ProduitUtilise,
        total_pesticide_l: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def remove_produit(
        self,
        traitement_id: uuid.UUID,
        produit_utilise_id: uuid.UUID,
        total_pesticide_l: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        pass

    @abstractmethod
    async def valider(
        self,
        traitement_id: uuid.UUID,
        date_validation: date,
        signatures: list[TraitementSignature],
    ) -> Traitement:
        pass

    @abstractmethod
    async def update_sync(self, traitement: Traitement) -> Traitement:
        """Écrase le contenu métier d'une fiche existante (hors rotations/produits/
        signatures, gérés par leurs propres endpoints) et marque `statut_sync = 'synced'`."""
        pass

    @abstractmethod
    async def marquer_conflict(self, traitement_id: uuid.UUID) -> Traitement:
        """Flague `statut_sync = 'conflict'` sans modifier le contenu — la version serveur
        fait foi (décision #60), rien n'est écrasé."""
        pass


class UtilisateurRepository(ABC):
    @abstractmethod
    async def get_by_id(self, utilisateur_id: uuid.UUID) -> UtilisateurRef | None:
        pass

    @abstractmethod
    async def creer_a_la_volee(self, nom: str, prenom: str, role: str) -> UtilisateurRef:
        """Compte « identité seule » (`peut_se_connecter=False`) pour un membre
        d'équipe externe, sans écrire en base tant que l'équipe n'est pas commitée."""
        pass


class AuditLogRepository(ABC):
    @abstractmethod
    async def create(self, entry: AuditLog) -> AuditLog:
        pass

    @abstractmethod
    async def list_by_fiche(self, fiche_id: uuid.UUID) -> list[AuditLog]:
        pass

    @abstractmethod
    async def list_notifications(
        self, role: str, utilisateur_id: uuid.UUID, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Projection jointe (prospection, utilisateur) pour le centre de
        notifications — pas des `AuditLog` bruts, d'où le retour en dict plutôt
        que de forcer le domaine à porter des champs qui ne lui appartiennent
        pas (n_fiche, auteur_nom)."""
        pass


class ZoneAntiAcridienRepository(ABC):
    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[ZoneAntiAcridien]:
        """`actif=None` : les deux états (écran d'administration)."""
        pass

    @abstractmethod
    async def exists(self, za_id: uuid.UUID) -> bool:
        pass

    @abstractmethod
    async def get_by_id(self, za_id: uuid.UUID) -> ZoneAntiAcridien | None:
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[ZoneAntiAcridien]:
        pass

    @abstractmethod
    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        """`exclude_id` permet de réenregistrer une zone sans buter sur son propre code."""
        pass

    @abstractmethod
    async def a_des_postes_actifs(self, za_id: uuid.UUID) -> bool:
        """Garde-fou de désactivation (`ZoneAntiAcridienAvecPostesActifsError`)."""
        pass

    @abstractmethod
    async def create(self, zone: ZoneAntiAcridien) -> ZoneAntiAcridien:
        pass

    @abstractmethod
    async def update(self, zone: ZoneAntiAcridien) -> ZoneAntiAcridien:
        pass


class PosteAcridienRepository(ABC):
    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[PosteAcridien]:
        """`actif=None` : les deux états (écran d'administration)."""
        pass

    @abstractmethod
    async def get_by_id(self, pa_id: uuid.UUID) -> PosteAcridien | None:
        pass

    @abstractmethod
    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        """`exclude_id` permet de réenregistrer un poste sans buter sur son propre code."""
        pass

    @abstractmethod
    async def create(self, poste: PosteAcridien) -> PosteAcridien:
        pass

    @abstractmethod
    async def update(self, poste: PosteAcridien) -> PosteAcridien:
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[PosteAcridien]:
        pass


class StationFixeRepository(ABC):
    @abstractmethod
    async def list_by_filters(
        self,
        pa_id: uuid.UUID | None = None,
        q: str | None = None,
        actif: bool | None = True,
    ) -> list[StationFixe]:
        """`actif=None` : les deux états (écran d'administration)."""
        pass

    @abstractmethod
    async def get_by_id(self, station_id: uuid.UUID) -> StationFixe | None:
        pass

    @abstractmethod
    async def exists(self, station_id: uuid.UUID) -> bool:
        pass

    @abstractmethod
    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        """`exclude_id` : renvoyer son propre code inchangé n'est pas un conflit."""
        pass

    @abstractmethod
    async def create(self, station: StationFixe) -> StationFixe:
        pass

    @abstractmethod
    async def update(self, station: StationFixe) -> StationFixe:
        """Réécrit la ligne et avance `updated_at` — c'est le curseur du pull hors-ligne.

        Aucune contrepartie `delete` : `GET /referentiel/pull` ne transporte que des
        upserts, une suppression physique resterait sur les téléphones synchronisés.
        """
        pass

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[StationFixe]:
        pass


class CommuneRepository(ABC):
    @abstractmethod
    async def list_all(self) -> list[Commune]:
        pass

    @abstractmethod
    async def exists(self, commune_id: uuid.UUID) -> bool:
        pass


class UtilisateurEquipeRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[UtilisateurEquipe]:
        pass


class PesticideRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[Pesticide]:
        pass

    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[Pesticide]:
        pass

    @abstractmethod
    async def get_by_id(self, pesticide_id: uuid.UUID) -> Pesticide | None:
        pass

    @abstractmethod
    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        """`exclude_id` permet de réenregistrer un pesticide sans buter sur son propre code."""
        pass

    @abstractmethod
    async def create(self, pesticide: Pesticide) -> Pesticide:
        pass

    @abstractmethod
    async def update(self, pesticide: Pesticide) -> Pesticide:
        pass


class CultureRepository(ABC):
    """Aucune méthode de suppression : la sortie du référentiel est `actif=false`.

    Le pull hors-ligne ne transporte que des upserts — une suppression physique
    ne serait jamais répercutée sur les téléphones déjà synchronisés.
    """

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[Culture]:
        pass

    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[Culture]:
        pass

    @abstractmethod
    async def get_by_id(self, culture_id: uuid.UUID) -> Culture | None:
        pass

    @abstractmethod
    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        """`exclude_id` permet de réenregistrer une culture sans buter sur son propre code."""
        pass

    @abstractmethod
    async def create(self, culture: Culture) -> Culture:
        pass

    @abstractmethod
    async def update(self, culture: Culture) -> Culture:
        pass


class LieuAerienRepository(ABC):
    """Aucune méthode de suppression : la sortie du référentiel est `actif=false`."""

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[LieuAerien]:
        pass

    @abstractmethod
    async def list_all(
        self, type_lieu: str | None = None, actif: bool | None = True
    ) -> list[LieuAerien]:
        pass

    @abstractmethod
    async def get_by_id(self, lieu_id: uuid.UUID) -> LieuAerien | None:
        pass

    @abstractmethod
    async def create(self, lieu: LieuAerien) -> LieuAerien:
        pass

    @abstractmethod
    async def update(self, lieu: LieuAerien) -> LieuAerien:
        pass


class SiteAerienneRepository(ABC):
    """Aucune méthode de suppression : la sortie du référentiel est `actif=false`."""

    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[SiteAerienne]:
        pass

    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[SiteAerienne]:
        pass

    @abstractmethod
    async def get_by_id(self, site_id: uuid.UUID) -> SiteAerienne | None:
        pass

    @abstractmethod
    async def create(self, site: SiteAerienne) -> SiteAerienne:
        pass

    @abstractmethod
    async def update(self, site: SiteAerienne) -> SiteAerienne:
        pass


class SiteAeriennePositionRepository(ABC):
    """Historique des implantations d'un `site_aerienne` (migration 0088, #604)."""

    @abstractmethod
    async def list_par_site(self, site_id: uuid.UUID) -> list[SiteAeriennePosition]:
        pass

    @abstractmethod
    async def get_active(self, site_id: uuid.UUID) -> SiteAeriennePosition | None:
        pass

    @abstractmethod
    async def installer(self, position: SiteAeriennePosition) -> SiteAeriennePosition:
        pass

    @abstractmethod
    async def demonter(self, position: SiteAeriennePosition) -> SiteAeriennePosition:
        pass


class AeronefRepository(ABC):
    """Aucune méthode de suppression : la sortie du référentiel est `actif=false`."""

    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[Aeronef]:
        pass

    @abstractmethod
    async def get_by_id(self, aeronef_id: uuid.UUID) -> Aeronef | None:
        pass

    @abstractmethod
    async def create(self, aeronef: Aeronef) -> Aeronef:
        """Enregistre un appareil au référentiel, sans équipe (#621). Un aéronef n'est
        plus lié à une équipe pour exister : il peut arriver sur la campagne avant sa
        première affectation, et rester au parc entre deux (#603)."""
        pass

    @abstractmethod
    async def update(self, aeronef: Aeronef) -> Aeronef:
        pass


class EquipeAeronefRepository(ABC):
    """Affectations d'aéronefs à une équipe, bornées dans le temps (#603).

    Aucune méthode de suppression : retirer un appareil, c'est borner l'affectation
    (`date_fin`), pas effacer la ligne — tout l'intérêt de la table est l'historique."""

    @abstractmethod
    async def list_par_equipe(self, equipe_id: uuid.UUID) -> list[AffectationAeronef]:
        """Historique complet, affectation en cours d'abord (`date_debut` décroissante)."""
        pass

    @abstractmethod
    async def get_by_id(self, affectation_id: uuid.UUID) -> AffectationAeronef | None:
        pass

    @abstractmethod
    async def list_chevauchements(
        self,
        date_debut: date,
        date_fin: date | None,
        equipe_id: uuid.UUID | None = None,
        aeronef_id: uuid.UUID | None = None,
        sauf_id: uuid.UUID | None = None,
    ) -> list[AffectationAeronef]:
        """Affectations dont l'intervalle recoupe `[date_debut, date_fin)`, pour cette
        équipe et/ou cet appareil. `sauf_id` exclut l'affectation en cours de
        modification, qui se chevauche toujours elle-même."""
        pass

    @abstractmethod
    async def create(self, affectation: AffectationAeronef) -> AffectationAeronef:
        pass

    @abstractmethod
    async def update(self, affectation: AffectationAeronef) -> AffectationAeronef:
        """Seule `date_fin` est réécrite : borner une affectation, c'est la clôturer."""
        pass


class EquipeRepository(ABC):
    """Référentiel unique des équipes (ADR-018). Aucune méthode de suppression : la
    sortie du référentiel est `actif=false`."""

    @abstractmethod
    async def list_all(
        self, actif: bool | None = True, type_equipe: str | None = None
    ) -> list[Equipe]:
        pass

    @abstractmethod
    async def get_by_id(self, equipe_id: uuid.UUID) -> Equipe | None:
        pass

    @abstractmethod
    async def get_by_chef_id(self, user_id: uuid.UUID) -> Equipe | None:
        """L'équipe dirigée par cet utilisateur (index partiel
        `uq_equipe_membre_chef_par_utilisateur`), `None` s'il n'en dirige aucune —
        c'est ainsi qu'on déduit « son » équipe."""
        pass

    @abstractmethod
    async def create(self, equipe: Equipe) -> Equipe:
        """Crée l'équipe, ses membres et, si `equipe.aeronef` est fourni, son aéronef
        dans la même transaction."""
        pass

    @abstractmethod
    async def update(self, equipe: Equipe) -> Equipe:
        """Renommage / mise hors service uniquement : `type` n'est jamais réécrit."""
        pass

    @abstractmethod
    async def ajouter_membre(self, membre: MembreEquipe) -> MembreEquipe:
        pass


class CodeStadeRepository(ABC):
    @abstractmethod
    async def list_since(self, since: datetime | None) -> list[CodeStade]:
        pass

    @abstractmethod
    async def list_all(self, actif: bool | None = True) -> list[CodeStade]:
        pass

    @abstractmethod
    async def get_by_id(self, code_stade_id: uuid.UUID) -> CodeStade | None:
        pass

    @abstractmethod
    async def create(self, code_stade: CodeStade) -> CodeStade:
        pass

    @abstractmethod
    async def update(self, code_stade: CodeStade) -> CodeStade:
        pass

    @abstractmethod
    async def code_au_vocabulaire(self, code: str) -> bool:
        """`stade.code` fait autorité : une place de grille ne peut viser qu'un code connu."""
        pass

    @abstractmethod
    async def grille_occupee_par(
        self,
        code: str,
        categorie: str,
        sexe: str | None,
        espece: str | None,
    ) -> uuid.UUID | None:
        """Identifiant de la place occupant déjà cette grille, `None` si elle est libre."""
        pass


class MouvementPesticideRepository(ABC):
    """Aucune mise à jour ni suppression : un mouvement, une fois enregistré, est
    définitif (#606) — corriger une saisie passe par un mouvement compensatoire,
    pas par une modification de l'historique."""

    @abstractmethod
    async def create(self, mouvement: MouvementPesticide) -> MouvementPesticide:
        pass

    @abstractmethod
    async def get_by_id(self, mouvement_id: uuid.UUID) -> MouvementPesticide | None:
        pass

    @abstractmethod
    async def solde(
        self,
        site_id: uuid.UUID | None = None,
        pesticide_id: uuid.UUID | None = None,
    ) -> list[SoldePesticide]:
        """Solde agrégé par (site, pesticide, unité), calculé à la volée — pas de
        colonne dénormalisée (décision actée, #606)."""
        pass

    @abstractmethod
    async def regenerer_consommation(
        self,
        traitement_id: uuid.UUID,
        site_id: uuid.UUID | None,
        date_mouvement: date,
        consommations: list[tuple[uuid.UUID, str, float]],
    ) -> None:
        """Seule exception à l'immutabilité ci-dessus (#609) : remplace les mouvements
        `consommation` rattachés à `traitement_id` par `consommations` (un mouvement
        par couple (pesticide_id, unité)) — appelée à chaque écriture sur les
        rotations d'une fiche aérienne (ajout, modification, suppression), jamais
        depuis une saisie manuelle.

        `site_id=None` (fiche historique sans `site_principal_id` rapproché, #605)
        supprime les mouvements existants sans en recréer : pas de débit sans site
        connu, mais pas de résidu non plus si la fiche en avait déjà (cas impossible
        aujourd'hui, la validation à la création l'exclut, mais couvert par
        symétrie)."""
        pass


class VolRepository(ABC):
    """Lignes d'activité aérienne (#608). Aucune méthode de suppression dans ce
    ticket : hors scope, le vol saisi n'est pas corrigé après coup — seul le
    rattachement différé d'un traitement (#610, `update`) y échappe."""

    @abstractmethod
    async def create(self, vol: Vol) -> Vol:
        pass

    @abstractmethod
    async def update(self, vol: Vol) -> Vol:
        pass

    @abstractmethod
    async def get_by_id(self, vol_id: uuid.UUID) -> Vol | None:
        pass

    @abstractmethod
    async def list_all(self, equipe_id: uuid.UUID | None = None) -> list[Vol]:
        pass
