import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any

from app.domain.prospection import Prospection

# Matrice de signatures (CDG section 3) : rôle de signature -> champ de saisie dont le
# renseignement rend la signature obligatoire, par type de traitement. L'agent encadreur
# est volontairement absent des deux branches : il ne signe jamais, même renseigné — déjà
# garanti structurellement par la contrainte CHECK sur traitement_signature.role (migration
# 0010), qui n'énumère pas AGENT_ENCADREUR.
_MATRICE_SIGNATURES: dict[str, dict[str, str]] = {
    "AERIEN": {
        "PILOTE": "pilote",
        "MECANICIEN": "mecanicien",
        "CHEF_DE_BASE": "chef_de_base_id",
        "CONSULTANT_INTERNATIONAL": "consultant_international",
    },
    "TERRESTRE": {
        "CHEF_EQUIPE": "chef_equipe_id",
        "CONSULTANT_INTERNATIONAL": "consultant_international",
    },
}


class ProspectionIntrouvableError(LookupError):
    """La prospection liée au traitement n'existe pas."""


class ChefDeBaseInvalideError(PermissionError):
    """chef_de_base_id ne référence pas un utilisateur avec le rôle chef_de_base."""


class ChefEquipeInvalideError(PermissionError):
    """chef_equipe_id ne référence pas un utilisateur avec le rôle chef_equipe."""


class NumeroFicheConflitError(Exception):
    """Le numero_fiche viole la contrainte UNIQUE — l'appelant doit réessayer avec un suffixe."""


class RolesAerienNonDistinctsError(ValueError):
    """Chef de base, pilote et mécanicien (aérien) ne désignent pas trois personnes
    distinctes — migration 0048 (retour de pilote/mécanicien en texte libre)."""


class TraitementIntrouvableError(LookupError):
    """Le traitement référencé n'existe pas, ou n'est pas de type aérien."""


class RotationIntrouvableError(LookupError):
    """La rotation référencée n'existe pas pour ce traitement aérien."""


class BlocIntrouvableError(LookupError):
    """Le bloc référencé n'existe pas pour ce traitement aérien."""


class RotationBlocInvalideError(ValueError):
    """`bloc_id` d'une rotation ne référence pas un bloc du même traitement aérien."""


class BlocModeIncoherentError(ValueError):
    """`surface_traitee_ha`/`surface_protegee_ha` d'un bloc ne correspond pas au
    `mode_traitement` du traitement (#surface-bloc-mode-infestee) : TOTAL (produit
    de choc) renseigne `surface_traitee_ha` (et laisse `surface_protegee_ha` à
    zéro/vide) ; BARRIERE (produit de barrière) renseigne `surface_protegee_ha`
    (et laisse `surface_traitee_ha` à zéro/vide) — jamais les deux à la fois."""


class BlocSurfaceDepasseInfesteeError(ValueError):
    """La surface traitée/protégée d'un bloc dépasse la surface infestée de la
    prospection liée (`Traitement.cible.surface_infestee_ha`,
    #surface-bloc-mode-infestee)."""


class ProduitUtiliseIntrouvableError(LookupError):
    """Le produit utilisé référencé n'existe pas pour ce traitement terrestre."""


class TraitementOrigineIntrouvableError(LookupError):
    """traitement_origine_id ne référence pas un traitement terrestre existant."""


class TraitementOrigineDejaUtiliseeError(Exception):
    """La fiche d'origine est déjà désignée comme origine par une autre fiche (chaîne linéaire)."""


class TraitementVerrouilleError(PermissionError):
    """La fiche n'est plus `brouillon` — verrouillage post-validation."""


class TraitementNonValideeError(PermissionError):
    """Le PDF (#495) n'est disponible que pour un CRT validé — symétrique de
    `TraitementVerrouilleError`, côté lecture plutôt qu'écriture."""


class SignaturesManquantesError(ValueError):
    """Un ou plusieurs rôles renseignés n'ont pas de signature correspondante (CDG §9)."""


class MotifAbandonManquantError(ValueError):
    """surface_restante_abandonnee=True sans motif renseigné (CDG §9)."""


class TraitementValideeSyncRejeteError(Exception):
    """Fiche serveur déjà `validee` : rejet systématique de toute synchronisation entrante,
    avant même toute comparaison de contenu (ADR-002 / décision #60) — `statut_sync` reste
    `synced`, jamais `conflict`, sur une fiche verrouillée."""

    def __init__(self, traitement_serveur: "Traitement"):
        self.traitement_serveur = traitement_serveur
        super().__init__("La fiche est verrouillée (validée) — synchronisation rejetée")


class TraitementSyncConflitError(Exception):
    """Conflit de synchronisation (décision #60) : `updated_at` serveur postérieur au
    `base_updated_at` connu du client, et contenu divergent. La fiche entrante est
    rejetée, `statut_sync` passe à `conflict` côté serveur, jamais de résolution
    automatique."""

    def __init__(self, traitement_serveur: "Traitement"):
        self.traitement_serveur = traitement_serveur
        super().__init__("Conflit de synchronisation — la version serveur fait foi")


def _stock_pesticide_restant(
    recu: float | None, consomme: float | None, initial: float | None = None
) -> float | None:
    """« Stock final » = initial + reçu − consommé, plancher à 0 (même convention
    que `surface_restante_ha`, CDG §9). `None` tant que ni « initial » ni « reçu »
    ne sont renseignés — un stock ne se déduit pas d'une consommation seule.

    `initial` (« Stock initial », fiche CRT papier section 5 — Terrestre
    uniquement, cf. `TraitementTerrestre.stock_initial_l`) est optionnel : côté
    Aérien, qui n'a pas cette notion, l'appel reste `_stock_pesticide_restant(recu,
    consomme)` inchangé, équivalent à `initial=0`.
    """
    if recu is None and initial is None:
        return None
    return max((initial or 0.0) + (recu or 0.0) - (consomme or 0.0), 0.0)


@dataclass
class Cible:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    espece: str | None = None
    petites_larves: str | None = None
    grandes_larves: str | None = None
    vols_clairs_essaims: str | None = None
    repartition_population: str | None = None
    surface_infestee_ha: float | None = None
    # Detail par espece (migration 0066) : petites_larves/grandes_larves
    # ci-dessus restent les totaux toutes especes confondues (ecran Cibles,
    # Terrestre) ; ces 8 champs portent le detail LMC/NSE (ecran Synthese,
    # Aerien) — `None` pour une espece absente de la prospection liee.
    petites_larves_lmc: float | None = None
    petites_larves_nse: float | None = None
    grandes_larves_lmc: float | None = None
    grandes_larves_nse: float | None = None
    densite_diffuse_lmc: float | None = None
    densite_groupee_lmc: float | None = None
    densite_diffuse_nse: float | None = None
    densite_groupee_nse: float | None = None


@dataclass
class Bloc:
    """Subdivision de la surface infestée d'un traitement aérien (migration 0064).
    « Une surface prospectée peut se répartir en un ou plusieurs blocs » (cahier des
    charges). Espèce (LMC/NSE/MELANGE) non dupliquée ici : lue par jointure sur
    `Cible.espece` du même traitement."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_aerien_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    nom: str = ""
    localite: str | None = None
    surface_theorique_ha: float | None = None
    surface_reelle_ha: float | None = None
    # Renseignée si produit de barrière (mode_traitement BARRIERE) — corrigé le
    # 2026-09-17, ce commentaire (et celui de surface_traitee_ha ci-dessous)
    # étaient inversés depuis la migration 0064 (#surface-bloc-mode-infestee).
    surface_protegee_ha: float | None = None
    # Renseignée si produit de choc (mode_traitement TOTAL).
    surface_traitee_ha: float | None = None
    largeur_andain_m: float | None = None
    interpasse_m: float | None = None
    hauteur_vol_min_m: float | None = None
    hauteur_vol_max_m: float | None = None
    observation: str | None = None


def valider_surfaces_bloc(
    mode_traitement: str | None,
    cible: "Cible | None",
    surface_protegee_ha: float | None,
    surface_traitee_ha: float | None,
) -> None:
    """#surface-bloc-mode-infestee : TOTAL (produit de choc) attend
    `surface_traitee_ha`, avec `surface_protegee_ha` à zéro/vide ; BARRIERE
    (produit de barrière) attend l'inverse. IRREGULIER (ou mode absent)
    n'impose rien — même tolérance que `typeProduitAttendu` côté mobile
    (referentiel-db.ts), qui ne restreint le produit que pour TOTAL/BARRIERE.

    La valeur renseignée (quel que soit le champ) ne doit pas dépasser la
    surface infestée de la prospection liée (`cible.surface_infestee_ha`) —
    aucun contrôle si `cible`/`surface_infestee_ha` est inconnu (rien à
    borner)."""
    protegee = surface_protegee_ha or 0
    traitee = surface_traitee_ha or 0

    if mode_traitement == "TOTAL" and protegee > 0:
        raise BlocModeIncoherentError(
            "mode_traitement TOTAL (produit de choc) : surface_protegee_ha doit "
            "rester à zéro, seule surface_traitee_ha est attendue."
        )
    if mode_traitement == "BARRIERE" and traitee > 0:
        raise BlocModeIncoherentError(
            "mode_traitement BARRIERE (produit de barrière) : surface_traitee_ha "
            "doit rester à zéro, seule surface_protegee_ha est attendue."
        )

    surface_infestee = cible.surface_infestee_ha if cible is not None else None
    if surface_infestee is None:
        return
    for valeur in (protegee, traitee):
        if valeur > surface_infestee:
            raise BlocSurfaceDepasseInfesteeError(
                f"{valeur} ha dépasse la surface infestée de la prospection "
                f"({surface_infestee} ha)."
            )


@dataclass
class Rotation:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_aerien_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # Bloc traité par cette rotation — nullable, un bloc peut être traité par
    # plusieurs rotations (1 bloc -> N cuves, confirmé avec l'utilisateur).
    bloc_id: uuid.UUID | None = None
    numero: int = 0
    # Dérivé de `numero` (str(numero)) côté application — plus de saisie libre
    # (migration 0047) : le numéro de cuve s'incrémente automatiquement par
    # traitement, comme `numero`.
    numero_cuve: str = ""
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # quantite_l -> quantite + unite (migration 0047) : une seule quantité par
    # rotation avec son unité, jamais L et kg à la fois pour une même rotation.
    quantite: float = 0.0
    unite: str = "L"
    # Superficie couverte par cette rotation — traitement_aerien.surface_traitee_ha
    # en est la somme (cf. TraitementAerien.recalculer_totaux).
    surface_ha: float = 0.0
    temperature_debut_c: float = 0.0
    temperature_fin_c: float = 0.0
    vent_debut_ms: float = 0.0
    vent_fin_ms: float = 0.0
    # heure_debut/heure_fin bornent la rotation entière (mise en place +
    # application) ; heure_ouverture_vanne/heure_fermeture_vanne bornent
    # l'application seule — distinctes depuis la migration 0047. Durée
    # d'application, durée totale et durée de mise en place s'en dérivent côté
    # application, aucune des trois n'est stockée.
    heure_debut: time = time(0, 0)
    heure_ouverture_vanne: time = time(0, 0)
    heure_fermeture_vanne: time = time(0, 1)
    heure_fin: time = time(0, 1)
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: str | None = None


@dataclass
class TraitementAerien:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # pilote/mecanicien/consultant_international sont redevenus du texte libre
    # (migration 0048) : le passage en FK utilisateur (migration 0047) a été
    # défait à la demande — pilote/mécanicien restent obligatoires,
    # consultant_international facultatif, comme `TraitementTerrestre.
    # consultant_international` déjà. chef_de_base_id reste seul en FK
    # (référentiel utilisateur), donc seul comparable par id ; la distinction
    # avec pilote/mécanicien se fait par nom (cf. `valider_roles_aerien_distincts`),
    # le texte libre ne garantissant pas l'identité comme un id.
    pilote: str = ""
    mecanicien: str = ""
    chef_de_base_id: uuid.UUID = field(default_factory=uuid.uuid4)
    consultant_international: str | None = None
    # Bases aériennes/stands : texte libre (migration 0054, défait la partie
    # "lieux" de la migration 0047 — même retour en arrière que pilote/
    # mécanicien/consultant en 0048, cf. #traitement-aerien-base-texte-libre).
    # Base principale obligatoire pour tout traitement aérien (aucune
    # exception, contrairement à la prospection généralisée) ; stand facultatif
    # (vide = ravitaillement fait directement à une base) ; base secondaire
    # facultative.
    base_principale: str = ""
    stand: str | None = None
    base_secondaire: str | None = None
    # Date d'installation (migration 0056) — facultative et indépendante du
    # texte libre lui-même : un lieu peut être renseigné sans date connue, ou
    # inversement. Rien d'équivalent pour base_principale (hors périmètre,
    # #stand-base-secondaire-date-installation).
    stand_date_installation: date | None = None
    base_secondaire_date_installation: date | None = None
    immatricule_aeronef: str | None = None
    nb_rotations: int = 0
    # Deux cumuls distincts par unité (une rotation en L ne s'additionne jamais
    # à une rotation en kg) ; surface_traitee_ha n'est plus une saisie directe :
    # les trois sont dérivés des rotations, recalculés à chaque écriture sur
    # `traitement_rotation` — jamais None depuis la migration 0047 (NOT NULL,
    # défaut 0).
    total_pesticide_l: float = 0.0
    total_pesticide_kg: float = 0.0
    # Répartition de la somme des rotations selon le produit (migration 0081) : jamais
    # renseignées ensemble. Produit de choc (mode hors BARRIERE) → surface_traitee_ha ;
    # produit de barrière (BARRIERE) → surface_protegee_ha.
    surface_traitee_ha: float = 0.0
    surface_protegee_ha: float = 0.0
    surface_restante_ha: float | None = None
    # Chaînage de reprise (migration 0050) — mirroir de TraitementTerrestre,
    # généralisé à l'Aérien : une prospection partiellement traitée par une
    # première fiche aérienne peut être reprise par une fiche suivante.
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None
    # NOT NULL défaut 0, contrairement à son équivalent Terrestre (nullable) —
    # même choix que les autres champs dérivés ci-dessus.
    surface_cumulee_ha: float = 0.0
    # Stock de pesticide par fiche (pas de suivi cumulatif par aéronef/opération) :
    # « reçu » saisi, « consommé » = total_pesticide_l (dérivé des rotations),
    # « reste en stock » dérivé des deux.
    pesticide_recu_l: float | None = None
    pesticide_stock_restant_l: float | None = None
    # Surface restante abandonnée ? (migration 0086) — mirroir de TraitementTerrestre :
    # None = pas encore tranché, motif obligatoire à la validation si True (CDG §9).
    surface_restante_abandonnee: bool | None = None
    motif_surface_restante_abandonnee: str | None = None
    # Efficacité (fiche CRT papier, section "Traitement") : taux de mortalité
    # observé, quelques heures après le traitement — une seule évaluation par
    # fiche (après l'ensemble des rotations), pas par rotation individuelle,
    # même patron que TraitementTerrestre ci-dessous.
    taux_mortalite_pourcent: float | None = None
    evaluation_efficacite_heures_apres: float | None = None
    methode_evaluation_efficacite: str | None = None
    rotations: list[Rotation] = field(default_factory=list)
    blocs: list[Bloc] = field(default_factory=list)

    @property
    def surface_couverte_ha(self) -> float:
        """Surface traitée + protégée : ce que l'aéronef a couvert, quel que soit le produit.
        C'est elle qui alimente le cumul de reprise et la surface restante."""
        return self.surface_traitee_ha + self.surface_protegee_ha

    def repartir_surface(self, surface_couverte_ha: float, mode_traitement: str | None) -> None:
        """Seul endroit qui classe une surface couverte en « traitée » ou « protégée » :
        produit de barrière (BARRIERE) → protégée ; produit de choc, irrégulier ou mode
        absent → traitée. L'autre colonne est remise à zéro (jamais les deux à la fois)."""
        if mode_traitement == "BARRIERE":
            self.surface_protegee_ha = surface_couverte_ha
            self.surface_traitee_ha = 0.0
        else:
            self.surface_traitee_ha = surface_couverte_ha
            self.surface_protegee_ha = 0.0

    def recalculer_totaux(self, mode_traitement: str | None) -> None:
        """Seul chemin d'écriture pour nb_rotations/total_pesticide_l/
        total_pesticide_kg/surface_traitee_ha/surface_protegee_ha — jamais en lecture.

        `mode_traitement` est celui du `Traitement` porteur (il ne vit pas sur
        `TraitementAerien`) : il décide si la somme des surfaces de rotation est
        « traitée » (choc) ou « protégée » (barrière), cf. `repartir_surface`."""
        self.nb_rotations = len(self.rotations)
        self.total_pesticide_l = sum(r.quantite for r in self.rotations if r.unite == "L")
        self.total_pesticide_kg = sum(r.quantite for r in self.rotations if r.unite == "kg")
        self.repartir_surface(sum(r.surface_ha for r in self.rotations), mode_traitement)
        self.recalculer_stock_pesticide()

    def recalculer_surfaces(
        self, surface_infestee_ha: float | None, surface_cumulee_precedente: float = 0.0
    ) -> None:
        """Seul chemin d'écriture pour surface_cumulee_ha/surface_restante_ha — jamais
        en lecture.

        Doit être appelée après `recalculer_totaux()` (ou après un ré-épinglage de
        `surface_traitee_ha`/`surface_protegee_ha` en synchronisation) : c'est
        `self.surface_couverte_ha`, dérivée des rotations, qui alimente ce calcul.

        `surface_cumulee_precedente` (migration 0050) : chaînage de reprise,
        mirroir de `TraitementTerrestre.recalculer_surfaces` — 0.0 par défaut
        (fiche indépendante, pas de reprise), sinon `surface_cumulee_ha` de la
        fiche d'origine. Plancher à 0 (CDG §9).
        """
        self.surface_cumulee_ha = surface_cumulee_precedente + self.surface_couverte_ha
        self.surface_restante_ha = (
            max(surface_infestee_ha - self.surface_cumulee_ha, 0.0)
            if surface_infestee_ha is not None
            else None
        )

    def recalculer_stock_pesticide(self) -> None:
        """Seul chemin d'écriture pour pesticide_stock_restant_l — jamais en lecture.

        Basé sur `total_pesticide_l` déjà à jour, pas recalculé depuis les rotations
        directement : reste utilisable lors d'une synchronisation où les rotations
        existantes ne sont pas rechargées (elles ne font pas partie du corps du push).
        """
        # « Approvisionnement » est saisi dans l'unité du produit (L pour un liquide,
        # kg pour une poudre) : une fiche n'utilise en pratique qu'une seule des deux,
        # on déduit donc la consommation dans l'unité réellement employée.
        consomme = (
            self.total_pesticide_kg
            if self.total_pesticide_l == 0 and self.total_pesticide_kg > 0
            else self.total_pesticide_l
        )
        self.pesticide_stock_restant_l = _stock_pesticide_restant(self.pesticide_recu_l, consomme)


@dataclass
class ProduitUtilise:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_terrestre_id: uuid.UUID = field(default_factory=uuid.uuid4)
    numero: int = 0
    produit_id: uuid.UUID = field(default_factory=uuid.uuid4)
    quantite_l: float = 0.0
    # Dérivé côté client du nom du pesticide (migration 0043) — figé à la
    # saisie, jamais recalculé à la lecture.
    nom_commercial: str | None = None


@dataclass
class TraitementTerrestre:
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    heure_debut: time = field(default_factory=lambda: time(0, 0))
    heure_fin: time = field(default_factory=lambda: time(0, 0))
    vitesse_vent_ms: float = 0.0
    direction_vent: str | None = None
    temperature_c: float = 0.0
    # Efficacité (fiche CRT papier, section "Traitement" juste après Condition de
    # traitement) : taux de mortalité observé, quelques heures après le
    # traitement — jamais recalculé, jamais validé contre une source externe,
    # simple saisie terrain comme le reste de cette section. Les 3 champs sont
    # facultatifs indépendamment les uns des autres (une estimation visuelle
    # sans délai précis reste une saisie valide).
    taux_mortalite_pourcent: float | None = None
    evaluation_efficacite_heures_apres: float | None = None
    methode_evaluation_efficacite: str | None = None
    reprise_traitement: bool = False
    traitement_origine_id: uuid.UUID | None = None
    chef_equipe_id: uuid.UUID = field(default_factory=uuid.uuid4)
    # Texte libre (migration 0057, défait le passage en FK utilisateur) : jamais
    # validé contre le référentiel (aucune ChefEquipeInvalideError équivalente),
    # même patron que consultant_international ci-dessous.
    agent_encadreur: str | None = None
    consultant_international: str | None = None
    # Migration 0060 : "Atomiseur" -> "Atomiseur à dos" (renommage pur, colonne
    # inchangée) ; ULVAmast remplacé par "Atomiseur autoporté" (nouvelle
    # colonne, remap des valeurs déjà saisies en ULVAmast à la migration).
    surface_atomiseur_ha: float | None = None
    surface_disque_rotatif_ha: float | None = None
    surface_atomiseur_autoporte_ha: float | None = None
    # Répartition de la somme des 3 champs ci-dessus selon le produit (migration
    # 0083, généralise à l'Terrestre ce que la migration 0081 fait déjà pour
    # l'Aérien) : jamais renseignées ensemble. Produit de choc (mode hors
    # BARRIERE) → surface_traitee_ha ; produit de barrière (BARRIERE) →
    # surface_protegee_ha.
    surface_traitee_ha: float | None = None
    surface_protegee_ha: float | None = None
    surface_cumulee_ha: float | None = None
    surface_restante_ha: float | None = None
    surface_restante_abandonnee: bool | None = None
    motif_surface_restante_abandonnee: str | None = None
    essence_litres: float | None = None
    nb_piles: int | None = None
    # Unité choisie pour toute la section « Produits utilisés » (fiche CRT papier
    # section 5, #produits-unite-l-kg) : un seul choix pour toute la fiche (pas
    # par produit comme les rotations Aérien, `Rotation.unite` — confirmé avec
    # l'utilisateur) — gouverne le libellé et la sémantique de quantite_l (chaque
    # ProduitUtilise), total_pesticide_l, pesticide_recu_l, stock_initial_l et
    # pesticide_stock_restant_l ci-dessous. Les noms de colonnes historiques
    # (suffixe `_l`) restent inchangés même quand l'unité choisie est "kg" —
    # simple stockage numérique, la conversion d'affichage se fait à la lecture.
    pesticide_unite: str = "L"
    total_pesticide_l: float | None = None
    # Stock de pesticide par fiche — même patron que TraitementAerien.
    pesticide_recu_l: float | None = None
    # Stock avant approvisionnement (fiche CRT papier, section 5 — Terrestre
    # uniquement, pas d'équivalent Aérien) : saisi par l'agent, entre dans le
    # calcul de pesticide_stock_restant_l ci-dessous (« Stock final »).
    stock_initial_l: float | None = None
    pesticide_stock_restant_l: float | None = None
    produits: list[ProduitUtilise] = field(default_factory=list)

    def recalculer_total_pesticide(self) -> None:
        """Seul chemin d'écriture pour total_pesticide_l — jamais en lecture."""
        self.total_pesticide_l = sum(p.quantite_l for p in self.produits) if self.produits else None
        self.recalculer_stock_pesticide()

    def recalculer_stock_pesticide(self) -> None:
        """Seul chemin d'écriture pour pesticide_stock_restant_l — jamais en lecture.

        Voir `TraitementAerien.recalculer_stock_pesticide` : séparé de
        `recalculer_total_pesticide` pour rester appelable seul lors d'une
        synchronisation où les produits existants ne sont pas rechargés.
        """
        self.pesticide_stock_restant_l = _stock_pesticide_restant(
            self.pesticide_recu_l, self.total_pesticide_l, self.stock_initial_l
        )

    @property
    def surface_couverte_ha(self) -> float:
        """Surface traitée + protégée : ce que l'équipe au sol a couvert, quel que
        soit le produit — même rôle que `TraitementAerien.surface_couverte_ha`.
        C'est elle qui alimente le cumul de reprise et la surface restante."""
        return (self.surface_traitee_ha or 0.0) + (self.surface_protegee_ha or 0.0)

    def repartir_surface(self, surface_couverte_ha: float, mode_traitement: str | None) -> None:
        """Seul endroit qui classe une surface couverte en « traitée » ou « protégée » —
        même règle que `TraitementAerien.repartir_surface` (migration 0083) : produit de
        barrière (BARRIERE) → protégée ; produit de choc, irrégulier ou mode absent →
        traitée. L'autre colonne est remise à zéro (jamais les deux à la fois)."""
        if mode_traitement == "BARRIERE":
            self.surface_protegee_ha = surface_couverte_ha
            self.surface_traitee_ha = 0.0
        else:
            self.surface_traitee_ha = surface_couverte_ha
            self.surface_protegee_ha = 0.0

    def recalculer_surfaces(
        self,
        surface_infestee_ha: float | None,
        surface_cumulee_precedente: float = 0.0,
        mode_traitement: str | None = None,
    ) -> None:
        """Seul chemin d'écriture pour surface_traitee_ha/surface_protegee_ha/
        surface_cumulee_ha/surface_restante_ha.

        `mode_traitement` est celui du `Traitement` porteur (il ne vit pas sur
        `TraitementTerrestre`, même patron que `TraitementAerien.recalculer_totaux`) :
        il décide si la somme des 3 surfaces saisies est « traitée » (choc) ou
        « protégée » (barrière), cf. `repartir_surface`.

        surface_restante_ha est ramenée à 0 si négative (critère CDG §9).
        """
        somme = (
            (self.surface_atomiseur_ha or 0.0)
            + (self.surface_disque_rotatif_ha or 0.0)
            + (self.surface_atomiseur_autoporte_ha or 0.0)
        )
        self.repartir_surface(somme, mode_traitement)
        self.surface_cumulee_ha = surface_cumulee_precedente + self.surface_couverte_ha
        self.surface_restante_ha = (
            max(surface_infestee_ha - self.surface_cumulee_ha, 0.0)
            if surface_infestee_ha is not None
            else None
        )


@dataclass
class TraitementSignature:
    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    role: str = ""
    signataire_nom: str = ""
    # Tracé du pavé de signature (mobile), sérialisé en chemin SVG — migration 0049.
    # `None` pour les lignes écrites avant cette migration (rétrocompatibilité) ;
    # le mobile exige désormais un tracé avant d'autoriser la validation d'un rôle.
    signature_image: str | None = None
    horodatage: datetime = field(default_factory=datetime.utcnow)


@dataclass
class EvaluationRisquePopulation:
    """« Impact et risque → Évaluation du risque pour la population » (migration
    0055). Liste dynamique liée à la fiche de traitement (Aérien et Terrestre
    identiques), remplacée en bloc à chaque enregistrement — cf. commentaire
    sur `EvaluationRisquePopulationModel`."""

    id: uuid.UUID = field(default_factory=uuid.uuid4)
    traitement_id: uuid.UUID = field(default_factory=uuid.uuid4)
    ordre: int = 0
    habitat_proche: str | None = None
    distance_km: float | None = None
    sensibilisation: bool | None = None


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
    # Moyens humains et matériels (fiche CRT papier §4.1/4.2, migration 0076) —
    # comblent un trou du gabarit PDF (traitement_pdf.py::_section_moyens,
    # cases "Nb agents permanents"/"Atomiseur"/... jamais alimentées jusqu'ici,
    # cf. issue #495). Communs à l'Aérien et au Terrestre, comme kit_combinaison
    # ci-dessous — saisis sur l'écran « Moyens & protection ».
    nb_agents_permanents: int | None = None
    nb_agents_temporaires: int | None = None
    nb_personnel_local: int | None = None
    # Comptage de matériel disponible sur le terrain — notion distincte des
    # champs Terrestre `surface_atomiseur_ha`/`surface_disque_rotatif_ha`
    # (surface traitée par équipement, écran Équipe) et `essence_litres`/
    # `nb_piles` (consommation, retirés de cet écran au profit de ceux-ci,
    # #moyens-humains-materiels).
    moyens_atomiseur_nb: int | None = None
    moyens_essence_litres: float | None = None
    moyens_disque_rotatif_nb: int | None = None
    moyens_piles_nb: int | None = None
    moyens_ulvamast_nb: int | None = None
    # Nombre de personnes équipées de chaque matériel de protection (toutes les
    # personnes à bord de l'hélicoptère/dans l'équipe doivent être équipées, pas
    # seulement « au moins une ») — plus des cases à cocher depuis la migration 0036.
    kit_combinaison: int = 0
    kit_gants: int = 0
    kit_lunettes: int = 0
    kit_masques: int = 0
    kit_botte: int = 0
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
    observations: str | None = None
    statut: str = "brouillon"
    statut_sync: str = "local"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    cible: Cible | None = None
    aerien: TraitementAerien | None = None
    terrestre: TraitementTerrestre | None = None
    signatures: list[TraitementSignature] = field(default_factory=list)
    evaluations_risque_population: list[EvaluationRisquePopulation] = field(default_factory=list)

    # ==========================================
    # Champ dérivé, non stocké (#numero-fiche-prospection-liee) — résolu par le
    # repository (jointure sur `prospection_id`, même pattern que
    # Prospection.prospecteur_nom) : le numéro métier (`prospection.n_fiche`,
    # déjà aligné sur n_message pour un signalement) de la fiche de prospection
    # d'origine, jamais recalculé/dupliqué en colonne — `prospection_id` reste
    # l'unique relation entre les deux fiches, ce champ n'en est qu'une lecture.
    # Même pattern (#495, retour utilisateur) : §1.4 "Date de validation" du
    # CRT papier référence la validation de la prospection liée, pas
    # `self.date_validation` (validation propre au CRT, distincte) — même
    # `prospection.validated_at` que `FicheVol.prospection_date_validation`.
    # ==========================================
    prospection_n_fiche: str | None = None
    prospection_date_validation: datetime | None = None

    def verifier_modifiable(self) -> None:
        """Garde commune, réutilisée par tous les writes (rotations, produits, validation).

        Un seul point de vérité pour le verrouillage post-validation (décision #64).
        """
        if self.statut != "brouillon":
            raise TraitementVerrouilleError("Seules les fiches en brouillon peuvent être modifiées")

    def verifier_disponible_pour_pdf(self) -> None:
        """Garde pour la génération du PDF (#495) : uniquement pour un CRT
        validé, symétrique de `verifier_modifiable` (verrouillage brouillon)."""
        if self.statut == "brouillon":
            raise TraitementNonValideeError("Le PDF n'est disponible que pour un CRT validé")

    def valider(
        self, date_validation: date, signatures: list[dict[str, str | None]]
    ) -> list[TraitementSignature]:
        """Applique la matrice de signatures puis transitionne vers `validee` (CDG §9).

        Dernier verrou avant verrouillage définitif — appelé juste avant la transition de
        statut et avant l'écriture des lignes `traitement_signature`, jamais après.
        """
        self.verifier_modifiable()

        if date_validation > self.date_traitement:
            raise ValueError("date_traitement doit être postérieure ou égale à date_validation")

        specialisation = self.aerien if self.type_traitement == "AERIEN" else self.terrestre
        matrice = _MATRICE_SIGNATURES[self.type_traitement]

        fournies = {s["role"]: s for s in signatures}

        roles_invalides = set(fournies) - set(matrice)
        if roles_invalides:
            raise ValueError(
                "Rôle(s) de signature invalide(s) pour ce type de traitement : "
                + ", ".join(sorted(roles_invalides))
            )

        manquants = [
            role
            for role, champ in matrice.items()
            if getattr(specialisation, champ) and role not in fournies
        ]
        if manquants:
            raise SignaturesManquantesError(
                "Signature(s) manquante(s) pour le(s) rôle(s) renseigné(s) : "
                + ", ".join(manquants)
            )

        specifique = self.terrestre if self.type_traitement == "TERRESTRE" else self.aerien
        if (
            specifique is not None
            and specifique.surface_restante_abandonnee
            and not specifique.motif_surface_restante_abandonnee
        ):
            raise MotifAbandonManquantError(
                "motif_surface_restante_abandonnee est obligatoire lorsque "
                "surface_restante_abandonnee=True"
            )

        now = datetime.utcnow()
        signature_objs = [
            TraitementSignature(
                traitement_id=self.id,
                role=role,
                signataire_nom=info["signataire_nom"],
                signature_image=info.get("signature_image"),
                horodatage=now,
            )
            for role, info in fournies.items()
        ]

        self.date_validation = date_validation
        self.statut = "validee"
        self.signatures = signature_objs
        return signature_objs


_CHAMPS_CONTENU_COMMUNS = (
    "prospection_id",
    "numero_fiche",
    "mode_traitement",
    "date_traitement",
    "date_validation",
    "localite",
    "region",
    "district",
    "commune",
    "latitude",
    "longitude",
    "altitude",
    "nb_agents_permanents",
    "nb_agents_temporaires",
    "nb_personnel_local",
    "moyens_atomiseur_nb",
    "moyens_essence_litres",
    "moyens_disque_rotatif_nb",
    "moyens_piles_nb",
    "moyens_ulvamast_nb",
    "kit_combinaison",
    "kit_gants",
    "kit_lunettes",
    "kit_masques",
    "kit_botte",
    "zones_exposees",
    "hauteur_strate_herbeuse_m",
    "hauteur_strate_arboree_m",
    "recouvrement_percent",
    "empoisonnement",
    "empoisonnement_type",
    "empoisonnement_mode",
    "empoisonnement_autre",
    "evaluation_risque",
    "comportement_anormal",
    "comportement_non_cibles",
    "mortalite",
    "mortalite_familles",
)


def _normaliser_nom(valeur: str) -> str:
    """Espaces superflus et casse ignorés — le texte libre ne garantit pas
    l'identité comme un id, mais « Jean RAKOTO » et « jean   rakoto » doivent
    être reconnus comme la même personne."""
    return " ".join(valeur.split()).casefold()


def valider_roles_aerien_distincts(chef_nom: str, pilote: str, mecanicien: str) -> None:
    """Chef de base, pilote et mécanicien doivent désigner trois personnes
    distinctes (migration 0048) — le consultant est exempté (facultatif, rôle
    non structurant, cf. spec #equipe-slide-aerien)."""
    roles = {"chef de base": chef_nom, "pilote": pilote, "mécanicien": mecanicien}
    normalises = {role: _normaliser_nom(nom) for role, nom in roles.items()}
    noms = list(normalises.items())
    for i in range(len(noms)):
        for j in range(i + 1, len(noms)):
            if noms[i][1] == noms[j][1]:
                raise RolesAerienNonDistinctsError(
                    "Cette personne est déjà affectée à un autre rôle. "
                    "Veuillez sélectionner une personne différente."
                )


_CHAMPS_CONTENU_AERIEN = (
    "pilote",
    "mecanicien",
    "chef_de_base_id",
    "consultant_international",
    "base_principale",
    "stand",
    "stand_date_installation",
    "base_secondaire",
    "base_secondaire_date_installation",
    "immatricule_aeronef",
    # surface_traitee_ha n'y figure plus (migration 0047) : dérivée des rotations
    # (sous-ressource distincte, absente du payload de synchronisation), au même
    # titre que nb_rotations/total_pesticide_l/total_pesticide_kg déjà exclus.
    "pesticide_recu_l",
    "surface_restante_abandonnee",
    "motif_surface_restante_abandonnee",
    "taux_mortalite_pourcent",
    "evaluation_efficacite_heures_apres",
    "methode_evaluation_efficacite",
)

_CHAMPS_CONTENU_TERRESTRE = (
    "heure_debut",
    "heure_fin",
    "vitesse_vent_ms",
    "direction_vent",
    "temperature_c",
    "taux_mortalite_pourcent",
    "evaluation_efficacite_heures_apres",
    "methode_evaluation_efficacite",
    "reprise_traitement",
    "traitement_origine_id",
    "chef_equipe_id",
    "agent_encadreur",
    "consultant_international",
    "surface_atomiseur_ha",
    "surface_disque_rotatif_ha",
    "surface_atomiseur_autoporte_ha",
    "surface_restante_abandonnee",
    "motif_surface_restante_abandonnee",
    "essence_litres",
    "nb_piles",
    "pesticide_unite",
    "pesticide_recu_l",
    "stock_initial_l",
)


def contenu_diverge(existant: "Traitement", entrant: "Traitement") -> bool:
    """Compare le contenu métier de deux fiches, hors champs techniques (`statut`,
    `statut_sync`, `created_at`, `updated_at`) et hors champs dérivés en lecture seule
    (`cible`, surfaces calculées, rotations/produits/signatures — gérés par leurs propres
    endpoints, absents du payload de synchronisation).

    Un renvoi réseau (même contenu) doit être traité `synced` sans jamais être vu comme un
    conflit (décision #60) — cette fonction est le point de vérité unique pour "diverge".
    """
    if any(
        getattr(existant, champ) != getattr(entrant, champ) for champ in _CHAMPS_CONTENU_COMMUNS
    ):
        return True
    if existant.type_traitement == "AERIEN":
        return any(
            getattr(existant.aerien, champ) != getattr(entrant.aerien, champ)
            for champ in _CHAMPS_CONTENU_AERIEN
        )
    return any(
        getattr(existant.terrestre, champ) != getattr(entrant.terrestre, champ)
        for champ in _CHAMPS_CONTENU_TERRESTRE
    )


def generer_numero_fiche(
    prenom_chef: str,
    date_traitement: date,
    suffixe: int | None = None,
    type_traitement: str = "Aerien",
) -> str:
    """Numéro de fiche lisible: [Prénom du chef]-[Aerien|Terrestre]-[Date], suffixe si collision."""
    base = f"{prenom_chef}-{type_traitement}-{date_traitement.isoformat()}"
    if suffixe is None:
        return base
    return f"{base}-{suffixe}"


def construire_cible(prospection: Prospection) -> Cible:
    """Snapshot en lecture seule de la cible depuis la fiche de prospection liée.

    Extensif et Signalement (`type_prospection` "extensive"/"validation") : une
    prospection validée y est toujours conclusive (y compris "rien trouvé", un
    résultat légitime et fréquent) — les champs sans donnée y prennent donc un
    défaut neutre (0, "non", "DIFFUSE") plutôt que None, pour ne jamais afficher
    « non renseigné » sur une fiche de traitement qui en découle. Intensif
    inchangé : `infestation.tsx` y porte sa propre notion, plus riche, de cible
    (surface/taille/densité par `type_cible`) — None reste le signal légitime
    « pas encore évalué » pour ce type-là, jamais recalculé ici en 0.
    """
    defauts_zero = prospection.type_prospection in ("extensive", "validation")

    especes = {p.espece for p in prospection.populations if p.espece}
    especes |= {i.espece for i in prospection.infestations if i.espece}
    # `next(iter(...))` plutôt que `.pop()` : `especes` est réutilisé plus bas
    # pour scoper le défaut à 0 par espèce (`defauts_zero`) — `.pop()` l'aurait
    # vidé ici même pour une prospection à une seule espèce.
    if not especes:
        espece = None
    elif len(especes) == 1:
        espece = next(iter(especes))
    else:
        espece = "MELANGE"

    # Petites larves = stades L1 a L3 cumules ; grandes larves = le reste des
    # stades larvaires cumules (L4-L5 pour LMC qui n'en compte que 5, L4-L7
    # pour NSE qui en compte 7 — la regle "L1/L2/L3 vs le reste" les couvre
    # les deux sans distinction explicite du plafond, chaque espece n'ayant
    # de toute facon pas de stade au-dela du sien).
    petites_total = 0
    grandes_total = 0
    larves_renseignees = False
    petites_par_espece: dict[str, float] = {"LMC": 0, "NSE": 0}
    grandes_par_espece: dict[str, float] = {"LMC": 0, "NSE": 0}
    larves_renseignees_par_espece: dict[str, bool] = {"LMC": False, "NSE": False}
    for p in prospection.populations:
        if p.categorie != "larve" or not p.densites_larve:
            continue
        for stade, densite in p.densites_larve.items():
            larves_renseignees = True
            petite = stade.upper() in ("L1", "L2", "L3")
            if petite:
                petites_total += densite
            else:
                grandes_total += densite
            if p.espece in petites_par_espece:
                larves_renseignees_par_espece[p.espece] = True
                if petite:
                    petites_par_espece[p.espece] += densite
                else:
                    grandes_par_espece[p.espece] += densite

    # Intensif (fusion des écrans B/C, cf. intensive-imagos.tsx/intensive-larves.tsx) :
    # les effectifs larvaires par stade ne sont plus posés sur densites_larve
    # (propre à l'Extensif) mais dans des lignes ProspectionCapture distinctes
    # (categorie="larve", stade, effectif) — jamais lues ici jusqu'à ce
    # correctif, d'où "Cibles"/"Synthèse" affichant "non renseigné" pour les
    # larves sur toute fiche de traitement dérivée d'une prospection Intensive.
    # Les deux sources ne se recouvrent jamais pour une même prospection
    # (l'Extensif n'écrit jamais dans ProspectionCapture, l'Intensif jamais
    # dans densites_larve) : les additionner est donc sans risque de doublon.
    for c in prospection.captures:
        if c.categorie != "larve" or not c.stade:
            continue
        larves_renseignees = True
        petite = c.stade.upper() in ("L1", "L2", "L3")
        if petite:
            petites_total += c.effectif
        else:
            grandes_total += c.effectif
        if c.espece in petites_par_espece:
            larves_renseignees_par_espece[c.espece] = True
            if petite:
                petites_par_espece[c.espece] += c.effectif
            else:
                grandes_par_espece[c.espece] += c.effectif

    # Repartition (diffuse/groupee) par espece : somme des densites de toutes
    # les lignes de cette espece (imago + larve), meme logique additive que
    # les larves ci-dessus — une espece peut avoir une densite saisie sur sa
    # ligne imago ET sa ligne larve.
    #
    # Le defaut a 0 (defauts_zero) ne s'applique qu'aux especes reellement en
    # scope (`especes`, calcule plus haut) — jamais aux deux a la fois sur une
    # prospection "rien trouve" (aucune ligne population/infestation du tout) :
    # LMC ET NSE y resteraient `None`, comme pour l'Intensif, pour ne pas
    # laisser croire que les deux especes ont ete surveillees.
    densite_diffuse_par_espece: dict[str, float | None] = {
        "LMC": 0 if defauts_zero and "LMC" in especes else None,
        "NSE": 0 if defauts_zero and "NSE" in especes else None,
    }
    densite_groupee_par_espece: dict[str, float | None] = {
        "LMC": 0 if defauts_zero and "LMC" in especes else None,
        "NSE": 0 if defauts_zero and "NSE" in especes else None,
    }
    for p in prospection.populations:
        if p.espece not in densite_diffuse_par_espece:
            continue
        if p.densite_diffuse is not None:
            densite_diffuse_par_espece[p.espece] = (
                densite_diffuse_par_espece[p.espece] or 0
            ) + p.densite_diffuse
        if p.densite_groupee is not None:
            densite_groupee_par_espece[p.espece] = (
                densite_groupee_par_espece[p.espece] or 0
            ) + p.densite_groupee

    # `essaim_observe` (booléen à 2 états) reste lu pour les prospections
    # antérieures à la migration 0033 ; pour l'Extensif Imagos (0033+), il a été
    # remplacé par essaim_en_vol/essaim_pose (cf. le même commentaire côté
    # PopulationCreate) — jamais renseigné pour ces fiches-là, d'où
    # "Vols/essaims" toujours "non renseigné" en Synthèse de traitement avant
    # ce correctif, alors même que l'essaim était bien saisi (État Repos/
    # Déplacement). Pas de "non" explicite dans le nouveau modèle (aucun bouton
    # ne le permet) : une ligne sans essaim_observe ni essaim_en_vol/pose reste
    # exclue, comme avant.
    essaims: list[bool] = []
    for p in prospection.populations:
        if p.essaim_observe is not None:
            essaims.append(p.essaim_observe)
        elif p.essaim_en_vol or p.essaim_pose:
            essaims.append(True)
    if any(essaims):
        vols_clairs_essaims = "oui"
    elif essaims or defauts_zero:
        vols_clairs_essaims = "non"
    else:
        vols_clairs_essaims = None

    if any(p.densite_groupee is not None for p in prospection.populations):
        repartition = "GROUPEE"
    elif any(p.densite_diffuse is not None for p in prospection.populations) or defauts_zero:
        repartition = "DIFFUSE"
    else:
        repartition = None

    return Cible(
        espece=espece,
        petites_larves=str(petites_total) if larves_renseignees or defauts_zero else None,
        grandes_larves=str(grandes_total) if larves_renseignees or defauts_zero else None,
        vols_clairs_essaims=vols_clairs_essaims,
        repartition_population=repartition,
        surface_infestee_ha=(
            prospection.surface_infestee
            if prospection.surface_infestee is not None
            else (0.0 if defauts_zero else None)
        ),
        # Le défaut à 0 par espèce n'est appliqué que pour une espèce
        # réellement en scope (`especes`) — jamais aux deux (LMC et NSE) sur
        # une prospection "rien trouvé", cf. commentaire sur les densités.
        petites_larves_lmc=(
            petites_par_espece["LMC"]
            if larves_renseignees_par_espece["LMC"] or (defauts_zero and "LMC" in especes)
            else None
        ),
        petites_larves_nse=(
            petites_par_espece["NSE"]
            if larves_renseignees_par_espece["NSE"] or (defauts_zero and "NSE" in especes)
            else None
        ),
        grandes_larves_lmc=(
            grandes_par_espece["LMC"]
            if larves_renseignees_par_espece["LMC"] or (defauts_zero and "LMC" in especes)
            else None
        ),
        grandes_larves_nse=(
            grandes_par_espece["NSE"]
            if larves_renseignees_par_espece["NSE"] or (defauts_zero and "NSE" in especes)
            else None
        ),
        densite_diffuse_lmc=densite_diffuse_par_espece["LMC"],
        densite_groupee_lmc=densite_groupee_par_espece["LMC"],
        densite_diffuse_nse=densite_diffuse_par_espece["NSE"],
        densite_groupee_nse=densite_groupee_par_espece["NSE"],
    )
