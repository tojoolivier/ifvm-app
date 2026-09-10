import uuid
from datetime import date, datetime, time
from typing import Any

from app.domain.prospection import Prospection
from app.domain.repositories import (
    ProspectionRepository,
    TraitementRepository,
    UtilisateurRepository,
)
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    EvaluationRisquePopulation,
    NumeroFicheConflitError,
    ProduitUtilise,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    Rotation,
    RotationIntrouvableError,
    SurfaceTraiteeDepasseeError,
    Traitement,
    TraitementAerien,
    TraitementIntrouvableError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementSyncConflitError,
    TraitementTerrestre,
    TraitementValideeSyncRejeteError,
    construire_cible,
    contenu_diverge,
    generer_numero_fiche,
    valider_roles_aerien_distincts,
)

_MAX_TENTATIVES_NUMERO_FICHE = 50
_NUMERO_FICHE_MAX_LENGTH = 50  # doit rester aligné avec traitement.numero_fiche String(50)
# Tolérance de comparaison en hectares — les surfaces sont des `Numeric(10,2)` en base
# (2 décimales), mais transitent en `float` côté Python : une tolérance plus fine que
# la précision réellement stockée évite qu'un artefact d'arrondi flottant (ex.
# 99.99999999999999 au lieu de 100.0) ne déclenche un rejet à tort.
_TOLERANCE_SURFACE_HA = 1e-6


async def _disponible_pour_prospection(
    traitement_repository: TraitementRepository,
    prospection_id: uuid.UUID,
    surface_infestee_ha: float | None,
    exclude_traitement_id: uuid.UUID | None = None,
) -> float | None:
    """Verrouille la prospection (`FOR UPDATE`, tient pour le reste de la transaction —
    §12.7, sérialise les créations/mises à jour concurrentes) puis retourne la surface
    encore disponible = `surface_infestee_ha` moins la somme des `surface_traitee_ha` de
    TOUTES les autres fiches déjà liées à cette prospection (`exclude_traitement_id`
    écarte la fiche elle-même lors d'une mise à jour/sync) — tous types de traitement et
    toutes chaînes de reprise confondus, pas seulement celle de la fiche en cours.

    Retourne `None` si `surface_infestee_ha` est inconnue : le plafond est alors
    incalculable, pas 0 — même convention que `recalculer_surfaces`, pour ne pas
    bloquer les prospections historiques sans cette donnée.
    """
    if surface_infestee_ha is None:
        return None
    await traitement_repository.verrouiller_prospection(prospection_id)
    deja_ailleurs = await traitement_repository.sommer_surface_traitee_prospection(
        prospection_id, exclude_traitement_id=exclude_traitement_id
    )
    return surface_infestee_ha - deja_ailleurs


def _verifier_surface_traitee(disponible: float | None, surface_traitee_ha: float) -> None:
    """Rejette (plutôt que le plancher silencieux à 0 de `recalculer_surfaces`) si
    `surface_traitee_ha` dépasse ce qui est réellement `disponible` (cf.
    `_disponible_pour_prospection`) — `None` = plafond inconnu, rien à vérifier."""
    if disponible is None:
        return
    if surface_traitee_ha > disponible + _TOLERANCE_SURFACE_HA:
        raise SurfaceTraiteeDepasseeError(
            "Impossible d'enregistrer cette surface. Il reste seulement "
            f"{max(round(disponible, 2), 0.0)} ha à traiter."
        )


def _verifier_prospection_traitable(disponible: float | None) -> None:
    """§6 : une prospection déjà entièrement traitée ne doit jamais recevoir de
    nouvelle fiche — y compris une fiche Aérien fraîchement créée, dont
    `surface_traitee_ha` démarre à 0 (rotations ajoutées après coup via
    `/rotations`) et ne déclencherait donc jamais `_verifier_surface_traitee` seule."""
    if disponible is not None and disponible <= _TOLERANCE_SURFACE_HA:
        raise SurfaceTraiteeDepasseeError(
            "Impossible de créer une nouvelle fiche : la surface infestée de cette "
            "prospection est déjà entièrement traitée."
        )


async def _persister_avec_numero_fiche_unique(
    repository: TraitementRepository,
    traitement: Traitement,
    base_numero: str,
    prenom_chef: str,
    date_traitement: date,
    type_libelle: str,
) -> Traitement:
    """Réessaie la création avec un suffixe incrémental tant que numero_fiche est en conflit."""
    for suffixe in range(2, _MAX_TENTATIVES_NUMERO_FICHE + 2):
        try:
            return await repository.create(traitement)
        except NumeroFicheConflitError:
            candidat = generer_numero_fiche(
                prenom_chef, date_traitement, suffixe=suffixe, type_traitement=type_libelle
            )
            if len(candidat) > _NUMERO_FICHE_MAX_LENGTH:
                raise ValueError(
                    f"numero_fiche '{candidat}' dépasse {_NUMERO_FICHE_MAX_LENGTH} caractères"
                ) from None
            traitement.numero_fiche = candidat
    raise NumeroFicheConflitError(
        f"Impossible de générer un numero_fiche unique à partir de '{base_numero}'"
    )


def _valider_dates(date_traitement: date, date_validation: date) -> None:
    if date_traitement < date_validation:
        raise ValueError("date_traitement doit être postérieure ou égale à date_validation")


def _sans_fuseau(instant: datetime) -> datetime:
    """Neutralise un datetime *aware* en le ramenant à un naïf (heure UTC conservée) —
    correctif ciblé, pas une migration de ce module vers des datetimes aware partout
    (hors périmètre ici, `datetime.utcnow()` — naïf — reste utilisé ailleurs, ex.
    `_construire_traitement_base`).

    `existant.updated_at`, relu depuis une colonne `TIMESTAMP(timezone=True)`, revient
    toujours *aware* via asyncpg ; `base_updated_at` (repoussé tel quel par le client
    après une première lecture de `updated_at` côté réponse JSON, elle-même construite
    à partir d'un `datetime.utcnow()` naïf jamais repassé par Postgres) revient, lui,
    naïf. Sans cette normalisation, comparer les deux lève `TypeError: can't compare
    offset-naive and offset-aware datetimes` à chaque synchronisation d'une fiche
    déjà existante."""
    return instant.replace(tzinfo=None) if instant.tzinfo is not None else instant


def _generer_et_valider_numero_fiche(
    numero_fiche: str | None, prenom_chef: str, date_traitement: date, type_libelle: str
) -> str:
    base_numero = numero_fiche or generer_numero_fiche(
        prenom_chef, date_traitement, type_traitement=type_libelle
    )
    if len(base_numero) > _NUMERO_FICHE_MAX_LENGTH:
        raise ValueError(
            f"numero_fiche '{base_numero}' dépasse {_NUMERO_FICHE_MAX_LENGTH} caractères"
        )
    return base_numero


def _construire_traitement_base(
    *,
    prospection: Prospection,
    base_numero: str,
    traitement_id: uuid.UUID | None = None,
    type_traitement: str,
    mode_traitement: str | None,
    date_traitement: date,
    date_validation: date,
    localite: str,
    region: str | None,
    district: str | None,
    commune: str | None,
    latitude: float | None,
    longitude: float | None,
    altitude: float | None,
    kit_combinaison: int,
    kit_gants: int,
    kit_lunettes: int,
    kit_masques: int,
    kit_botte: int,
    zones_exposees: dict[str, Any] | None,
    hauteur_strate_herbeuse_m: float | None,
    hauteur_strate_arboree_m: float | None,
    recouvrement_percent: int | None,
    empoisonnement: bool,
    empoisonnement_type: str | None,
    empoisonnement_mode: str | None,
    empoisonnement_autre: str | None,
    evaluation_risque: dict[str, Any] | None,
    comportement_anormal: bool,
    comportement_non_cibles: dict[str, Any] | None,
    mortalite: bool,
    mortalite_familles: dict[str, Any] | None,
    observations: str | None,
    evaluations_risque_population: list[EvaluationRisquePopulation] | None = None,
) -> Traitement:
    """Construit le `Traitement` brouillon + snapshot `Cible`, commun aux deux spécialisations."""
    now = datetime.utcnow()
    traitement = Traitement(
        id=traitement_id if traitement_id is not None else uuid.uuid4(),
        prospection_id=prospection.id,
        numero_fiche=base_numero,
        type_traitement=type_traitement,
        mode_traitement=mode_traitement,
        date_traitement=date_traitement,
        date_validation=date_validation,
        localite=localite,
        region=region,
        district=district,
        commune=commune,
        latitude=latitude,
        longitude=longitude,
        altitude=altitude,
        kit_combinaison=kit_combinaison,
        kit_gants=kit_gants,
        kit_lunettes=kit_lunettes,
        kit_masques=kit_masques,
        kit_botte=kit_botte,
        zones_exposees=zones_exposees,
        hauteur_strate_herbeuse_m=hauteur_strate_herbeuse_m,
        hauteur_strate_arboree_m=hauteur_strate_arboree_m,
        recouvrement_percent=recouvrement_percent,
        empoisonnement=empoisonnement,
        empoisonnement_type=empoisonnement_type,
        empoisonnement_mode=empoisonnement_mode,
        empoisonnement_autre=empoisonnement_autre,
        evaluation_risque=evaluation_risque,
        comportement_anormal=comportement_anormal,
        comportement_non_cibles=comportement_non_cibles,
        mortalite=mortalite,
        mortalite_familles=mortalite_familles,
        observations=observations,
        statut="brouillon",
        created_at=now,
        updated_at=now,
        evaluations_risque_population=evaluations_risque_population or [],
    )

    cible = construire_cible(prospection)
    cible.traitement_id = traitement.id
    traitement.cible = cible

    return traitement


class CreateTraitementAerien:
    def __init__(
        self,
        traitement_repository: TraitementRepository,
        prospection_repository: ProspectionRepository,
        utilisateur_repository: UtilisateurRepository,
    ):
        self.traitement_repository = traitement_repository
        self.prospection_repository = prospection_repository
        self.utilisateur_repository = utilisateur_repository

    async def execute(
        self,
        prospection_id: uuid.UUID,
        date_traitement: date,
        date_validation: date,
        localite: str,
        pilote: str,
        mecanicien: str,
        chef_de_base_id: uuid.UUID,
        base_principale: str,
        immatricule_aeronef: str,
        consultant_international: str | None = None,
        stand: str | None = None,
        stand_date_installation: date | None = None,
        base_secondaire: str | None = None,
        base_secondaire_date_installation: date | None = None,
        pesticide_recu_l: float | None = None,
        reprise_traitement: bool = False,
        traitement_origine_id: uuid.UUID | None = None,
        numero_fiche: str | None = None,
        mode_traitement: str | None = None,
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        kit_combinaison: int = 0,
        kit_gants: int = 0,
        kit_lunettes: int = 0,
        kit_masques: int = 0,
        kit_botte: int = 0,
        zones_exposees: dict[str, Any] | None = None,
        hauteur_strate_herbeuse_m: float | None = None,
        hauteur_strate_arboree_m: float | None = None,
        recouvrement_percent: int | None = None,
        empoisonnement: bool = False,
        empoisonnement_type: str | None = None,
        empoisonnement_mode: str | None = None,
        empoisonnement_autre: str | None = None,
        evaluation_risque: dict[str, Any] | None = None,
        comportement_anormal: bool = False,
        comportement_non_cibles: dict[str, Any] | None = None,
        mortalite: bool = False,
        mortalite_familles: dict[str, Any] | None = None,
        observations: str | None = None,
        evaluations_risque_population: list[EvaluationRisquePopulation] | None = None,
    ) -> Traitement:
        _valider_dates(date_traitement, date_validation)

        # Chaînage de reprise (migration 0050) — mirroir exact de
        # CreateTraitementTerrestre : une prospection partiellement traitée par
        # une première fiche aérienne peut être reprise par une fiche suivante.
        surface_cumulee_precedente = 0.0
        if reprise_traitement:
            if traitement_origine_id is None:
                raise ValueError(
                    "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
                )
            origine = await self.traitement_repository.get_by_id(traitement_origine_id)
            if origine is None or origine.aerien is None:
                raise TraitementOrigineIntrouvableError(
                    f"Fiche d'origine {traitement_origine_id} introuvable ou non aérienne"
                )
            if await self.traitement_repository.origine_deja_utilisee_aerien(traitement_origine_id):
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement_origine_id} est déjà désignée comme origine "
                    "par une autre fiche"
                )
            surface_cumulee_precedente = origine.aerien.surface_cumulee_ha or 0.0
        elif traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )

        prospection = await self.prospection_repository.get_by_id(prospection_id)
        if prospection is None:
            raise ProspectionIntrouvableError(
                f"Prospection {prospection_id} introuvable — impossible de créer le traitement"
            )

        chef = await self.utilisateur_repository.get_by_id(chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseInvalideError(
                f"chef_de_base_id {chef_de_base_id} ne référence pas un utilisateur "
                "avec le rôle 'chef_de_base'"
            )
        valider_roles_aerien_distincts(f"{chef.prenom} {chef.nom}", pilote, mecanicien)

        base_numero = _generer_et_valider_numero_fiche(
            numero_fiche, chef.prenom, date_traitement, "Aerien"
        )

        traitement = _construire_traitement_base(
            prospection=prospection,
            base_numero=base_numero,
            type_traitement="AERIEN",
            mode_traitement=mode_traitement,
            date_traitement=date_traitement,
            date_validation=date_validation,
            localite=localite,
            region=region,
            district=district,
            commune=commune,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            kit_combinaison=kit_combinaison,
            kit_gants=kit_gants,
            kit_lunettes=kit_lunettes,
            kit_masques=kit_masques,
            kit_botte=kit_botte,
            zones_exposees=zones_exposees,
            hauteur_strate_herbeuse_m=hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=hauteur_strate_arboree_m,
            recouvrement_percent=recouvrement_percent,
            empoisonnement=empoisonnement,
            empoisonnement_type=empoisonnement_type,
            empoisonnement_mode=empoisonnement_mode,
            empoisonnement_autre=empoisonnement_autre,
            evaluation_risque=evaluation_risque,
            comportement_anormal=comportement_anormal,
            comportement_non_cibles=comportement_non_cibles,
            mortalite=mortalite,
            mortalite_familles=mortalite_familles,
            observations=observations,
            evaluations_risque_population=evaluations_risque_population,
        )

        traitement.aerien = TraitementAerien(
            traitement_id=traitement.id,
            pilote=pilote,
            mecanicien=mecanicien,
            chef_de_base_id=chef_de_base_id,
            consultant_international=consultant_international,
            base_principale=base_principale,
            stand=stand,
            stand_date_installation=stand_date_installation,
            base_secondaire=base_secondaire,
            base_secondaire_date_installation=base_secondaire_date_installation,
            immatricule_aeronef=immatricule_aeronef,
            pesticide_recu_l=pesticide_recu_l,
            reprise_traitement=reprise_traitement,
            traitement_origine_id=traitement_origine_id,
        )
        # surface_traitee_ha est désormais dérivé des rotations (migration 0047) :
        # aucune à la création, recalculer_totaux() avant recalculer_surfaces()
        # (qui en dépend).
        traitement.aerien.recalculer_totaux()
        traitement.aerien.recalculer_surfaces(
            traitement.cible.surface_infestee_ha, surface_cumulee_precedente
        )

        # §6/§12 : garde-fou backend, indépendant du filtre `disponible_pour_traitement`
        # côté sélecteur mobile — une fiche fraîche démarre à 0 rotation, donc seul le
        # gate "plus rien à traiter du tout" s'applique ici (les rotations, ajoutées
        # ensuite via /rotations, revérifient le plafond réel à chaque écriture).
        disponible = await _disponible_pour_prospection(
            self.traitement_repository, prospection_id, traitement.cible.surface_infestee_ha
        )
        _verifier_prospection_traitable(disponible)

        return await _persister_avec_numero_fiche_unique(
            self.traitement_repository,
            traitement,
            base_numero,
            chef.prenom,
            date_traitement,
            "Aerien",
        )


class CreateTraitementTerrestre:
    def __init__(
        self,
        traitement_repository: TraitementRepository,
        prospection_repository: ProspectionRepository,
        utilisateur_repository: UtilisateurRepository,
    ):
        self.traitement_repository = traitement_repository
        self.prospection_repository = prospection_repository
        self.utilisateur_repository = utilisateur_repository

    async def execute(
        self,
        prospection_id: uuid.UUID,
        date_traitement: date,
        date_validation: date,
        localite: str,
        heure_debut: time,
        heure_fin: time,
        vitesse_vent_ms: float,
        temperature_c: float,
        chef_equipe_id: uuid.UUID,
        direction_vent: str | None = None,
        agent_encadreur_id: uuid.UUID | None = None,
        consultant_international: str | None = None,
        surface_atomiseur_ha: float | None = None,
        surface_disque_rotatif_ha: float | None = None,
        surface_ulvamast_ha: float | None = None,
        surface_restante_abandonnee: bool | None = None,
        motif_surface_restante_abandonnee: str | None = None,
        essence_litres: float | None = None,
        nb_piles: int | None = None,
        pesticide_recu_l: float | None = None,
        reprise_traitement: bool = False,
        traitement_origine_id: uuid.UUID | None = None,
        numero_fiche: str | None = None,
        mode_traitement: str | None = None,
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        kit_combinaison: int = 0,
        kit_gants: int = 0,
        kit_lunettes: int = 0,
        kit_masques: int = 0,
        kit_botte: int = 0,
        zones_exposees: dict[str, Any] | None = None,
        hauteur_strate_herbeuse_m: float | None = None,
        hauteur_strate_arboree_m: float | None = None,
        recouvrement_percent: int | None = None,
        empoisonnement: bool = False,
        empoisonnement_type: str | None = None,
        empoisonnement_mode: str | None = None,
        empoisonnement_autre: str | None = None,
        evaluation_risque: dict[str, Any] | None = None,
        comportement_anormal: bool = False,
        comportement_non_cibles: dict[str, Any] | None = None,
        mortalite: bool = False,
        mortalite_familles: dict[str, Any] | None = None,
        observations: str | None = None,
        evaluations_risque_population: list[EvaluationRisquePopulation] | None = None,
    ) -> Traitement:
        _valider_dates(date_traitement, date_validation)
        if heure_fin <= heure_debut:
            raise ValueError("heure_fin doit être postérieure à heure_debut")

        surface_cumulee_precedente = 0.0
        if reprise_traitement:
            if traitement_origine_id is None:
                raise ValueError(
                    "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
                )
            origine = await self.traitement_repository.get_by_id(traitement_origine_id)
            if origine is None or origine.terrestre is None:
                raise TraitementOrigineIntrouvableError(
                    f"Fiche d'origine {traitement_origine_id} introuvable ou non terrestre"
                )
            if await self.traitement_repository.origine_deja_utilisee(traitement_origine_id):
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement_origine_id} est déjà désignée comme origine "
                    "par une autre fiche"
                )
            surface_cumulee_precedente = origine.terrestre.surface_cumulee_ha or 0.0
        elif traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )

        prospection = await self.prospection_repository.get_by_id(prospection_id)
        if prospection is None:
            raise ProspectionIntrouvableError(
                f"Prospection {prospection_id} introuvable — impossible de créer le traitement"
            )

        chef = await self.utilisateur_repository.get_by_id(chef_equipe_id)
        if chef is None or chef.role != "chef_equipe":
            raise ChefEquipeInvalideError(
                f"chef_equipe_id {chef_equipe_id} ne référence pas un utilisateur "
                "avec le rôle 'chef_equipe'"
            )

        base_numero = _generer_et_valider_numero_fiche(
            numero_fiche, chef.prenom, date_traitement, "Terrestre"
        )

        traitement = _construire_traitement_base(
            prospection=prospection,
            base_numero=base_numero,
            type_traitement="TERRESTRE",
            mode_traitement=mode_traitement,
            date_traitement=date_traitement,
            date_validation=date_validation,
            localite=localite,
            region=region,
            district=district,
            commune=commune,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            kit_combinaison=kit_combinaison,
            kit_gants=kit_gants,
            kit_lunettes=kit_lunettes,
            kit_masques=kit_masques,
            kit_botte=kit_botte,
            zones_exposees=zones_exposees,
            hauteur_strate_herbeuse_m=hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=hauteur_strate_arboree_m,
            recouvrement_percent=recouvrement_percent,
            empoisonnement=empoisonnement,
            empoisonnement_type=empoisonnement_type,
            empoisonnement_mode=empoisonnement_mode,
            empoisonnement_autre=empoisonnement_autre,
            evaluation_risque=evaluation_risque,
            comportement_anormal=comportement_anormal,
            comportement_non_cibles=comportement_non_cibles,
            mortalite=mortalite,
            mortalite_familles=mortalite_familles,
            observations=observations,
            evaluations_risque_population=evaluations_risque_population,
        )
        cible = traitement.cible

        terrestre = TraitementTerrestre(
            traitement_id=traitement.id,
            heure_debut=heure_debut,
            heure_fin=heure_fin,
            vitesse_vent_ms=vitesse_vent_ms,
            direction_vent=direction_vent,
            temperature_c=temperature_c,
            reprise_traitement=reprise_traitement,
            traitement_origine_id=traitement_origine_id,
            chef_equipe_id=chef_equipe_id,
            agent_encadreur_id=agent_encadreur_id,
            consultant_international=consultant_international,
            surface_atomiseur_ha=surface_atomiseur_ha,
            surface_disque_rotatif_ha=surface_disque_rotatif_ha,
            surface_ulvamast_ha=surface_ulvamast_ha,
            surface_restante_abandonnee=surface_restante_abandonnee,
            motif_surface_restante_abandonnee=motif_surface_restante_abandonnee,
            essence_litres=essence_litres,
            nb_piles=nb_piles,
            pesticide_recu_l=pesticide_recu_l,
        )
        terrestre.recalculer_surfaces(cible.surface_infestee_ha, surface_cumulee_precedente)
        terrestre.recalculer_total_pesticide()

        # §3/§12 : garde-fou backend — contrairement à l'Aérien (surface dérivée des
        # rotations, ajoutées après coup), la surface Terrestre est connue dès la
        # création (atomiseur/disque rotatif/ulvamast) : le plafond se vérifie donc ici,
        # sur la valeur définitive.
        disponible = await _disponible_pour_prospection(
            self.traitement_repository, prospection_id, cible.surface_infestee_ha
        )
        _verifier_surface_traitee(disponible, terrestre.surface_traitee_ha)

        if (
            terrestre.surface_restante_ha
            and terrestre.surface_restante_ha > 0
            and (terrestre.surface_restante_abandonnee is None)
        ):
            raise ValueError(
                "surface_restante_abandonnee doit être renseigné (true/false) lorsque "
                "surface_restante_ha > 0"
            )
        traitement.terrestre = terrestre

        return await _persister_avec_numero_fiche_unique(
            self.traitement_repository,
            traitement,
            base_numero,
            chef.prenom,
            date_traitement,
            "Terrestre",
        )


class GetTraitement:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_id: uuid.UUID) -> Traitement | None:
        return await self.repository.get_by_id(traitement_id)


class ListTraitements:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        type_traitement: str | None = None,
        prospection_id: uuid.UUID | None = None,
        chef_equipe_id: uuid.UUID | None = None,
        reprenable: bool | None = None,
        statut: str | None = None,
    ) -> list[Traitement]:
        return await self.repository.list_by_filters(
            type_traitement=type_traitement,
            prospection_id=prospection_id,
            chef_equipe_id=chef_equipe_id,
            reprenable=reprenable,
            statut=statut,
        )


async def _get_traitement_aerien(
    repository: TraitementRepository, traitement_id: uuid.UUID
) -> Traitement:
    traitement = await repository.get_by_id(traitement_id)
    if traitement is None or traitement.aerien is None:
        raise TraitementIntrouvableError(f"Traitement aérien {traitement_id} introuvable")
    return traitement


def _trouver_rotation(aerien: TraitementAerien, rotation_id: uuid.UUID) -> Rotation:
    rotation = next((r for r in aerien.rotations if r.id == rotation_id), None)
    if rotation is None:
        raise RotationIntrouvableError(
            f"Rotation {rotation_id} introuvable pour le traitement {aerien.traitement_id}"
        )
    return rotation


def _surface_infestee_ha(traitement: Traitement) -> float | None:
    """`traitement.cible` est toujours renseigné pour une fiche réellement persistée
    (construite via `construire_cible`) — `None` seulement pour un `Traitement`
    fabriqué à la main (tests unitaires du domaine), d'où cette garde plutôt qu'un
    accès direct."""
    return traitement.cible.surface_infestee_ha if traitement.cible is not None else None


def _valider_heures_vanne(
    heure_debut: time, heure_ouverture_vanne: time, heure_fermeture_vanne: time, heure_fin: time
) -> None:
    """Même règle que ck_traitement_rotation_vanne_ordre (migration 0047) : la
    phase d'épandage (vanne) est comprise dans la rotation entière."""
    if not (heure_debut <= heure_ouverture_vanne <= heure_fermeture_vanne <= heure_fin):
        raise ValueError(
            "Les heures de vanne doivent respecter heure_debut <= heure_ouverture_vanne "
            "<= heure_fermeture_vanne <= heure_fin"
        )


class AddRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        produit_id: uuid.UUID,
        quantite: float,
        unite: str,
        surface_ha: float,
        temperature_debut_c: float,
        temperature_fin_c: float,
        vent_debut_ms: float,
        vent_fin_ms: float,
        heure_debut: time,
        heure_ouverture_vanne: time,
        heure_fermeture_vanne: time,
        heure_fin: time,
        nom_commercial: str | None = None,
    ) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        traitement.verifier_modifiable()
        aerien = traitement.aerien

        if heure_fin <= heure_debut:
            raise ValueError("heure_fin doit être postérieure à heure_debut")
        _valider_heures_vanne(heure_debut, heure_ouverture_vanne, heure_fermeture_vanne, heure_fin)

        prochain_numero = max((r.numero for r in aerien.rotations), default=0) + 1
        rotation = Rotation(
            traitement_aerien_id=aerien.traitement_id,
            numero=prochain_numero,
            # Dérivé de numero, jamais saisi par le client (migration 0047).
            numero_cuve=str(prochain_numero),
            produit_id=produit_id,
            quantite=quantite,
            unite=unite,
            surface_ha=surface_ha,
            temperature_debut_c=temperature_debut_c,
            temperature_fin_c=temperature_fin_c,
            vent_debut_ms=vent_debut_ms,
            vent_fin_ms=vent_fin_ms,
            heure_debut=heure_debut,
            heure_ouverture_vanne=heure_ouverture_vanne,
            heure_fermeture_vanne=heure_fermeture_vanne,
            heure_fin=heure_fin,
            nom_commercial=nom_commercial,
        )
        # Chaînage de reprise (migration 0050) : la part cumulée héritée de la
        # fiche d'origine (0.0 si fiche indépendante) se déduit de l'invariant
        # surface_cumulee_ha == precedente + surface_traitee_ha, valable avant
        # que recalculer_totaux() ne change surface_traitee_ha ci-dessous.
        surface_cumulee_precedente = aerien.surface_cumulee_ha - aerien.surface_traitee_ha
        aerien.rotations.append(rotation)
        aerien.recalculer_totaux()
        aerien.recalculer_surfaces(_surface_infestee_ha(traitement), surface_cumulee_precedente)

        # §3/§12 : point d'écriture réel de surface_traitee_ha côté Aérien — c'est ici,
        # pas à la création de la fiche (0 rotation), que le plafond se vérifie.
        disponible = await _disponible_pour_prospection(
            self.repository,
            traitement.prospection_id,
            _surface_infestee_ha(traitement),
            exclude_traitement_id=traitement_id,
        )
        _verifier_surface_traitee(disponible, aerien.surface_traitee_ha)

        return await self.repository.add_rotation(
            traitement_id,
            rotation,
            aerien.nb_rotations,
            aerien.total_pesticide_l,
            aerien.total_pesticide_kg,
            aerien.surface_traitee_ha,
            aerien.surface_cumulee_ha,
            aerien.surface_restante_ha,
            aerien.pesticide_stock_restant_l,
        )


class UpdateRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        rotation_id: uuid.UUID,
        produit_id: uuid.UUID,
        quantite: float,
        unite: str,
        surface_ha: float,
        temperature_debut_c: float,
        temperature_fin_c: float,
        vent_debut_ms: float,
        vent_fin_ms: float,
        heure_debut: time,
        heure_ouverture_vanne: time,
        heure_fermeture_vanne: time,
        heure_fin: time,
        nom_commercial: str | None = None,
    ) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        traitement.verifier_modifiable()
        aerien = traitement.aerien
        rotation = _trouver_rotation(aerien, rotation_id)

        if heure_fin <= heure_debut:
            raise ValueError("heure_fin doit être postérieure à heure_debut")
        _valider_heures_vanne(heure_debut, heure_ouverture_vanne, heure_fermeture_vanne, heure_fin)

        # numero_cuve redérivé de numero (inchangé par une mise à jour) — jamais saisi.
        rotation.numero_cuve = str(rotation.numero)
        rotation.produit_id = produit_id
        rotation.quantite = quantite
        rotation.unite = unite
        rotation.surface_ha = surface_ha
        rotation.temperature_debut_c = temperature_debut_c
        rotation.temperature_fin_c = temperature_fin_c
        rotation.vent_debut_ms = vent_debut_ms
        rotation.vent_fin_ms = vent_fin_ms
        rotation.heure_debut = heure_debut
        rotation.heure_ouverture_vanne = heure_ouverture_vanne
        rotation.heure_fermeture_vanne = heure_fermeture_vanne
        rotation.heure_fin = heure_fin
        rotation.nom_commercial = nom_commercial
        surface_cumulee_precedente = aerien.surface_cumulee_ha - aerien.surface_traitee_ha
        aerien.recalculer_totaux()
        aerien.recalculer_surfaces(_surface_infestee_ha(traitement), surface_cumulee_precedente)

        # §3/§12 — cf. AddRotation.
        disponible = await _disponible_pour_prospection(
            self.repository,
            traitement.prospection_id,
            _surface_infestee_ha(traitement),
            exclude_traitement_id=traitement_id,
        )
        _verifier_surface_traitee(disponible, aerien.surface_traitee_ha)

        return await self.repository.update_rotation(
            traitement_id,
            rotation,
            aerien.nb_rotations,
            aerien.total_pesticide_l,
            aerien.total_pesticide_kg,
            aerien.surface_traitee_ha,
            aerien.surface_cumulee_ha,
            aerien.surface_restante_ha,
            aerien.pesticide_stock_restant_l,
        )


class RemoveRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_id: uuid.UUID, rotation_id: uuid.UUID) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        traitement.verifier_modifiable()
        aerien = traitement.aerien
        rotation = _trouver_rotation(aerien, rotation_id)

        surface_cumulee_precedente = aerien.surface_cumulee_ha - aerien.surface_traitee_ha
        aerien.rotations.remove(rotation)
        aerien.recalculer_totaux()
        aerien.recalculer_surfaces(_surface_infestee_ha(traitement), surface_cumulee_precedente)

        return await self.repository.remove_rotation(
            traitement_id,
            rotation_id,
            aerien.nb_rotations,
            aerien.total_pesticide_l,
            aerien.total_pesticide_kg,
            aerien.surface_traitee_ha,
            aerien.surface_cumulee_ha,
            aerien.surface_restante_ha,
            aerien.pesticide_stock_restant_l,
        )


async def _get_traitement_terrestre(
    repository: TraitementRepository, traitement_id: uuid.UUID
) -> Traitement:
    traitement = await repository.get_by_id(traitement_id)
    if traitement is None or traitement.terrestre is None:
        raise TraitementIntrouvableError(f"Traitement terrestre {traitement_id} introuvable")
    return traitement


def _trouver_produit(
    terrestre: TraitementTerrestre, produit_utilise_id: uuid.UUID
) -> ProduitUtilise:
    produit = next((p for p in terrestre.produits if p.id == produit_utilise_id), None)
    if produit is None:
        raise ProduitUtiliseIntrouvableError(
            f"Produit utilisé {produit_utilise_id} introuvable pour le traitement "
            f"{terrestre.traitement_id}"
        )
    return produit


class AddProduitUtilise:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        produit_id: uuid.UUID,
        quantite_l: float,
        nom_commercial: str | None = None,
    ) -> Traitement:
        traitement = await _get_traitement_terrestre(self.repository, traitement_id)
        traitement.verifier_modifiable()
        terrestre = traitement.terrestre

        prochain_numero = max((p.numero for p in terrestre.produits), default=0) + 1
        produit = ProduitUtilise(
            traitement_terrestre_id=terrestre.traitement_id,
            numero=prochain_numero,
            produit_id=produit_id,
            quantite_l=quantite_l,
            nom_commercial=nom_commercial,
        )
        terrestre.produits.append(produit)
        terrestre.recalculer_total_pesticide()

        return await self.repository.add_produit(
            traitement_id,
            produit,
            terrestre.total_pesticide_l,
            terrestre.pesticide_stock_restant_l,
        )


class RemoveProduitUtilise:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_id: uuid.UUID, produit_utilise_id: uuid.UUID) -> Traitement:
        traitement = await _get_traitement_terrestre(self.repository, traitement_id)
        traitement.verifier_modifiable()
        terrestre = traitement.terrestre
        produit = _trouver_produit(terrestre, produit_utilise_id)

        terrestre.produits.remove(produit)
        terrestre.recalculer_total_pesticide()

        return await self.repository.remove_produit(
            traitement_id,
            produit_utilise_id,
            terrestre.total_pesticide_l,
            terrestre.pesticide_stock_restant_l,
        )


class ValiderTraitement:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        date_validation: date,
        signatures: list[dict[str, str]],
    ) -> Traitement:
        traitement = await self.repository.get_by_id(traitement_id)
        if traitement is None:
            raise TraitementIntrouvableError(f"Traitement {traitement_id} introuvable")

        signature_objs = traitement.valider(date_validation, signatures)

        return await self.repository.valider(
            traitement_id, traitement.date_validation, signature_objs
        )


class SyncPushTraitementAerien:
    """Synchronisation offline (ADR-002 / décision #60) d'une fiche AERIEN créée hors-ligne.

    Retourne `(traitement, cree)` — `cree=True` pour un push initial (id inconnu du
    serveur), `cree=False` pour une mise à jour synchronisée sans conflit.
    """

    def __init__(
        self,
        traitement_repository: TraitementRepository,
        prospection_repository: ProspectionRepository,
        utilisateur_repository: UtilisateurRepository,
    ):
        self.traitement_repository = traitement_repository
        self.prospection_repository = prospection_repository
        self.utilisateur_repository = utilisateur_repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        base_updated_at: datetime,
        prospection_id: uuid.UUID,
        date_traitement: date,
        date_validation: date,
        localite: str,
        pilote: str,
        mecanicien: str,
        chef_de_base_id: uuid.UUID,
        base_principale: str,
        immatricule_aeronef: str,
        consultant_international: str | None = None,
        stand: str | None = None,
        stand_date_installation: date | None = None,
        base_secondaire: str | None = None,
        base_secondaire_date_installation: date | None = None,
        pesticide_recu_l: float | None = None,
        reprise_traitement: bool = False,
        traitement_origine_id: uuid.UUID | None = None,
        numero_fiche: str | None = None,
        mode_traitement: str | None = None,
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        kit_combinaison: int = 0,
        kit_gants: int = 0,
        kit_lunettes: int = 0,
        kit_masques: int = 0,
        kit_botte: int = 0,
        zones_exposees: dict[str, Any] | None = None,
        hauteur_strate_herbeuse_m: float | None = None,
        hauteur_strate_arboree_m: float | None = None,
        recouvrement_percent: int | None = None,
        empoisonnement: bool = False,
        empoisonnement_type: str | None = None,
        empoisonnement_mode: str | None = None,
        empoisonnement_autre: str | None = None,
        evaluation_risque: dict[str, Any] | None = None,
        comportement_anormal: bool = False,
        comportement_non_cibles: dict[str, Any] | None = None,
        mortalite: bool = False,
        mortalite_familles: dict[str, Any] | None = None,
        observations: str | None = None,
        evaluations_risque_population: list[EvaluationRisquePopulation] | None = None,
    ) -> tuple[Traitement, bool]:
        _valider_dates(date_traitement, date_validation)

        existant = await self.traitement_repository.get_by_id(traitement_id)
        if existant is not None and existant.statut != "brouillon":
            raise TraitementValideeSyncRejeteError(existant)

        # Chaînage de reprise (migration 0050) — revalidé à chaque push (création
        # ou mise à jour), mirroir exact de SyncPushTraitementTerrestre :
        # `exclude_traitement_id` évite qu'une fiche déjà elle-même désignée comme
        # utilisant cette origine ne se voie rejetée en se resynchronisant.
        surface_cumulee_precedente = 0.0
        if reprise_traitement:
            if traitement_origine_id is None:
                raise ValueError(
                    "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
                )
            origine = await self.traitement_repository.get_by_id(traitement_origine_id)
            if origine is None or origine.aerien is None:
                raise TraitementOrigineIntrouvableError(
                    f"Fiche d'origine {traitement_origine_id} introuvable ou non aérienne"
                )
            if await self.traitement_repository.origine_deja_utilisee_aerien(
                traitement_origine_id, exclude_traitement_id=traitement_id
            ):
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement_origine_id} est déjà désignée comme origine "
                    "par une autre fiche"
                )
            surface_cumulee_precedente = origine.aerien.surface_cumulee_ha or 0.0
        elif traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )

        prospection = await self.prospection_repository.get_by_id(prospection_id)
        if prospection is None:
            raise ProspectionIntrouvableError(
                f"Prospection {prospection_id} introuvable — impossible de synchroniser"
            )

        chef = await self.utilisateur_repository.get_by_id(chef_de_base_id)
        if chef is None or chef.role != "chef_de_base":
            raise ChefDeBaseInvalideError(
                f"chef_de_base_id {chef_de_base_id} ne référence pas un utilisateur "
                "avec le rôle 'chef_de_base'"
            )
        valider_roles_aerien_distincts(f"{chef.prenom} {chef.nom}", pilote, mecanicien)

        base_numero = _generer_et_valider_numero_fiche(
            numero_fiche, chef.prenom, date_traitement, "Aerien"
        )

        candidat = _construire_traitement_base(
            traitement_id=traitement_id,
            prospection=prospection,
            base_numero=base_numero,
            type_traitement="AERIEN",
            mode_traitement=mode_traitement,
            date_traitement=date_traitement,
            date_validation=date_validation,
            localite=localite,
            region=region,
            district=district,
            commune=commune,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            kit_combinaison=kit_combinaison,
            kit_gants=kit_gants,
            kit_lunettes=kit_lunettes,
            kit_masques=kit_masques,
            kit_botte=kit_botte,
            zones_exposees=zones_exposees,
            hauteur_strate_herbeuse_m=hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=hauteur_strate_arboree_m,
            recouvrement_percent=recouvrement_percent,
            empoisonnement=empoisonnement,
            empoisonnement_type=empoisonnement_type,
            empoisonnement_mode=empoisonnement_mode,
            empoisonnement_autre=empoisonnement_autre,
            evaluation_risque=evaluation_risque,
            comportement_anormal=comportement_anormal,
            comportement_non_cibles=comportement_non_cibles,
            mortalite=mortalite,
            mortalite_familles=mortalite_familles,
            observations=observations,
            evaluations_risque_population=evaluations_risque_population,
        )
        candidat.aerien = TraitementAerien(
            traitement_id=traitement_id,
            pilote=pilote,
            mecanicien=mecanicien,
            chef_de_base_id=chef_de_base_id,
            consultant_international=consultant_international,
            base_principale=base_principale,
            stand=stand,
            stand_date_installation=stand_date_installation,
            base_secondaire=base_secondaire,
            base_secondaire_date_installation=base_secondaire_date_installation,
            immatricule_aeronef=immatricule_aeronef,
            pesticide_recu_l=pesticide_recu_l,
            reprise_traitement=reprise_traitement,
            traitement_origine_id=traitement_origine_id,
        )

        if existant is None:
            # Rotations pas encore poussées (sous-ressource distincte) : le total
            # consommé est nul, comme à la création — surface_traitee_ha aussi
            # (migration 0047, dérivée des rotations). recalculer_totaux() avant
            # recalculer_surfaces() (qui en dépend).
            candidat.aerien.recalculer_totaux()
            candidat.aerien.recalculer_surfaces(
                candidat.cible.surface_infestee_ha, surface_cumulee_precedente
            )

            # §6/§12 — cf. CreateTraitementAerien : fiche fraîche, 0 rotation encore
            # poussée, seul le gate "plus rien à traiter du tout" s'applique ici.
            disponible = await _disponible_pour_prospection(
                self.traitement_repository, prospection_id, candidat.cible.surface_infestee_ha
            )
            _verifier_prospection_traitable(disponible)

            candidat.statut_sync = "synced"
            cree = await _persister_avec_numero_fiche_unique(
                self.traitement_repository,
                candidat,
                base_numero,
                chef.prenom,
                date_traitement,
                "Aerien",
            )
            return cree, True

        if _sans_fuseau(existant.updated_at) > _sans_fuseau(base_updated_at) and contenu_diverge(
            existant, candidat
        ):
            marque = await self.traitement_repository.marquer_conflict(traitement_id)
            raise TraitementSyncConflitError(marque)

        # nb_rotations/total_pesticide_l/total_pesticide_kg/surface_traitee_ha
        # existants ne sont pas renvoyés par ce push (rotations = sous-ressource
        # distincte) : on les reprend tels quels, sans jamais les écraser
        # (update_sync ne les touche pas), puis on recalcule ce qui en dépend
        # (surface_restante_ha, stock de pesticide).
        candidat.aerien.nb_rotations = existant.aerien.nb_rotations
        candidat.aerien.total_pesticide_l = existant.aerien.total_pesticide_l
        candidat.aerien.total_pesticide_kg = existant.aerien.total_pesticide_kg
        candidat.aerien.surface_traitee_ha = existant.aerien.surface_traitee_ha
        candidat.aerien.recalculer_surfaces(
            candidat.cible.surface_infestee_ha, surface_cumulee_precedente
        )
        candidat.aerien.recalculer_stock_pesticide()

        candidat.created_at = existant.created_at
        synced = await self.traitement_repository.update_sync(candidat)
        return synced, False


class SyncPushTraitementTerrestre:
    """Synchronisation offline (ADR-002 / décision #60) d'une fiche TERRESTRE créée
    hors-ligne. Retourne `(traitement, cree)`, voir `SyncPushTraitementAerien`."""

    def __init__(
        self,
        traitement_repository: TraitementRepository,
        prospection_repository: ProspectionRepository,
        utilisateur_repository: UtilisateurRepository,
    ):
        self.traitement_repository = traitement_repository
        self.prospection_repository = prospection_repository
        self.utilisateur_repository = utilisateur_repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        base_updated_at: datetime,
        prospection_id: uuid.UUID,
        date_traitement: date,
        date_validation: date,
        localite: str,
        heure_debut: time,
        heure_fin: time,
        vitesse_vent_ms: float,
        temperature_c: float,
        chef_equipe_id: uuid.UUID,
        direction_vent: str | None = None,
        agent_encadreur_id: uuid.UUID | None = None,
        consultant_international: str | None = None,
        surface_atomiseur_ha: float | None = None,
        surface_disque_rotatif_ha: float | None = None,
        surface_ulvamast_ha: float | None = None,
        surface_restante_abandonnee: bool | None = None,
        motif_surface_restante_abandonnee: str | None = None,
        essence_litres: float | None = None,
        nb_piles: int | None = None,
        pesticide_recu_l: float | None = None,
        reprise_traitement: bool = False,
        traitement_origine_id: uuid.UUID | None = None,
        numero_fiche: str | None = None,
        mode_traitement: str | None = None,
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        kit_combinaison: int = 0,
        kit_gants: int = 0,
        kit_lunettes: int = 0,
        kit_masques: int = 0,
        kit_botte: int = 0,
        zones_exposees: dict[str, Any] | None = None,
        hauteur_strate_herbeuse_m: float | None = None,
        hauteur_strate_arboree_m: float | None = None,
        recouvrement_percent: int | None = None,
        empoisonnement: bool = False,
        empoisonnement_type: str | None = None,
        empoisonnement_mode: str | None = None,
        empoisonnement_autre: str | None = None,
        evaluation_risque: dict[str, Any] | None = None,
        comportement_anormal: bool = False,
        comportement_non_cibles: dict[str, Any] | None = None,
        mortalite: bool = False,
        mortalite_familles: dict[str, Any] | None = None,
        observations: str | None = None,
        evaluations_risque_population: list[EvaluationRisquePopulation] | None = None,
    ) -> tuple[Traitement, bool]:
        _valider_dates(date_traitement, date_validation)
        if heure_fin <= heure_debut:
            raise ValueError("heure_fin doit être postérieure à heure_debut")

        existant = await self.traitement_repository.get_by_id(traitement_id)
        if existant is not None and existant.statut != "brouillon":
            raise TraitementValideeSyncRejeteError(existant)

        surface_cumulee_precedente = 0.0
        if reprise_traitement:
            if traitement_origine_id is None:
                raise ValueError(
                    "traitement_origine_id est obligatoire lorsque reprise_traitement=True"
                )
            origine = await self.traitement_repository.get_by_id(traitement_origine_id)
            if origine is None or origine.terrestre is None:
                raise TraitementOrigineIntrouvableError(
                    f"Fiche d'origine {traitement_origine_id} introuvable ou non terrestre"
                )
            if await self.traitement_repository.origine_deja_utilisee(
                traitement_origine_id, exclude_traitement_id=traitement_id
            ):
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement_origine_id} est déjà désignée comme origine "
                    "par une autre fiche"
                )
            surface_cumulee_precedente = origine.terrestre.surface_cumulee_ha or 0.0
        elif traitement_origine_id is not None:
            raise ValueError(
                "traitement_origine_id ne peut être renseigné que si reprise_traitement=True"
            )

        prospection = await self.prospection_repository.get_by_id(prospection_id)
        if prospection is None:
            raise ProspectionIntrouvableError(
                f"Prospection {prospection_id} introuvable — impossible de synchroniser"
            )

        chef = await self.utilisateur_repository.get_by_id(chef_equipe_id)
        if chef is None or chef.role != "chef_equipe":
            raise ChefEquipeInvalideError(
                f"chef_equipe_id {chef_equipe_id} ne référence pas un utilisateur "
                "avec le rôle 'chef_equipe'"
            )

        base_numero = _generer_et_valider_numero_fiche(
            numero_fiche, chef.prenom, date_traitement, "Terrestre"
        )

        candidat = _construire_traitement_base(
            traitement_id=traitement_id,
            prospection=prospection,
            base_numero=base_numero,
            type_traitement="TERRESTRE",
            mode_traitement=mode_traitement,
            date_traitement=date_traitement,
            date_validation=date_validation,
            localite=localite,
            region=region,
            district=district,
            commune=commune,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            kit_combinaison=kit_combinaison,
            kit_gants=kit_gants,
            kit_lunettes=kit_lunettes,
            kit_masques=kit_masques,
            kit_botte=kit_botte,
            zones_exposees=zones_exposees,
            hauteur_strate_herbeuse_m=hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=hauteur_strate_arboree_m,
            recouvrement_percent=recouvrement_percent,
            empoisonnement=empoisonnement,
            empoisonnement_type=empoisonnement_type,
            empoisonnement_mode=empoisonnement_mode,
            empoisonnement_autre=empoisonnement_autre,
            evaluation_risque=evaluation_risque,
            comportement_anormal=comportement_anormal,
            comportement_non_cibles=comportement_non_cibles,
            mortalite=mortalite,
            mortalite_familles=mortalite_familles,
            observations=observations,
            evaluations_risque_population=evaluations_risque_population,
        )
        cible = candidat.cible

        terrestre = TraitementTerrestre(
            traitement_id=traitement_id,
            heure_debut=heure_debut,
            heure_fin=heure_fin,
            vitesse_vent_ms=vitesse_vent_ms,
            direction_vent=direction_vent,
            temperature_c=temperature_c,
            reprise_traitement=reprise_traitement,
            traitement_origine_id=traitement_origine_id,
            chef_equipe_id=chef_equipe_id,
            agent_encadreur_id=agent_encadreur_id,
            consultant_international=consultant_international,
            surface_atomiseur_ha=surface_atomiseur_ha,
            surface_disque_rotatif_ha=surface_disque_rotatif_ha,
            surface_ulvamast_ha=surface_ulvamast_ha,
            surface_restante_abandonnee=surface_restante_abandonnee,
            motif_surface_restante_abandonnee=motif_surface_restante_abandonnee,
            essence_litres=essence_litres,
            nb_piles=nb_piles,
            pesticide_recu_l=pesticide_recu_l,
        )
        terrestre.recalculer_surfaces(cible.surface_infestee_ha, surface_cumulee_precedente)

        # §3/§12 — cf. CreateTraitementTerrestre. `exclude_traitement_id=traitement_id`
        # est un no-op pour un push de création (aucune ligne n'existe encore sous cet
        # id) et exclut correctement la fiche elle-même pour un push de mise à jour.
        disponible = await _disponible_pour_prospection(
            self.traitement_repository,
            prospection_id,
            cible.surface_infestee_ha,
            exclude_traitement_id=traitement_id,
        )
        _verifier_surface_traitee(disponible, terrestre.surface_traitee_ha)

        if (
            terrestre.surface_restante_ha
            and terrestre.surface_restante_ha > 0
            and (terrestre.surface_restante_abandonnee is None)
        ):
            raise ValueError(
                "surface_restante_abandonnee doit être renseigné (true/false) lorsque "
                "surface_restante_ha > 0"
            )
        candidat.terrestre = terrestre

        if existant is None:
            # Produits pas encore poussés (sous-ressource distincte) : le total
            # consommé est nul, comme à la création.
            candidat.terrestre.recalculer_total_pesticide()
            candidat.statut_sync = "synced"
            cree = await _persister_avec_numero_fiche_unique(
                self.traitement_repository,
                candidat,
                base_numero,
                chef.prenom,
                date_traitement,
                "Terrestre",
            )
            return cree, True

        if _sans_fuseau(existant.updated_at) > _sans_fuseau(base_updated_at) and contenu_diverge(
            existant, candidat
        ):
            marque = await self.traitement_repository.marquer_conflict(traitement_id)
            raise TraitementSyncConflitError(marque)

        # total_pesticide_l existant n'est pas renvoyé par ce push (produits =
        # sous-ressource distincte) : repris tel quel pour calculer le stock, sans
        # jamais l'écraser (update_sync ne le touche pas).
        candidat.terrestre.total_pesticide_l = existant.terrestre.total_pesticide_l
        candidat.terrestre.recalculer_stock_pesticide()

        candidat.created_at = existant.created_at
        synced = await self.traitement_repository.update_sync(candidat)
        return synced, False
