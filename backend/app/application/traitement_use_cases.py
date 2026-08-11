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
    NumeroFicheConflitError,
    ProduitUtilise,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    Rotation,
    RotationIntrouvableError,
    Traitement,
    TraitementAerien,
    TraitementIntrouvableError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementTerrestre,
    construire_cible,
    generer_numero_fiche,
)

_MAX_TENTATIVES_NUMERO_FICHE = 50
_NUMERO_FICHE_MAX_LENGTH = 50  # doit rester aligné avec traitement.numero_fiche String(50)


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
    if date_validation < date_traitement:
        raise ValueError("date_validation doit être postérieure ou égale à date_traitement")


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
    kit_combinaison: bool,
    kit_gants: bool,
    kit_lunettes: bool,
    kit_masques: bool,
    kit_boite: bool,
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
) -> Traitement:
    """Construit le `Traitement` brouillon + snapshot `Cible`, commun aux deux spécialisations."""
    now = datetime.utcnow()
    traitement = Traitement(
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
        kit_boite=kit_boite,
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
        statut="brouillon",
        created_at=now,
        updated_at=now,
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
        consultant_international: str | None = None,
        numero_fiche: str | None = None,
        mode_traitement: str | None = None,
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        kit_combinaison: bool = False,
        kit_gants: bool = False,
        kit_lunettes: bool = False,
        kit_masques: bool = False,
        kit_boite: bool = False,
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
    ) -> Traitement:
        _valider_dates(date_traitement, date_validation)

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
            kit_boite=kit_boite,
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
        )

        traitement.aerien = TraitementAerien(
            traitement_id=traitement.id,
            pilote=pilote,
            mecanicien=mecanicien,
            chef_de_base_id=chef_de_base_id,
            consultant_international=consultant_international,
        )

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
        essence_litres: float | None = None,
        nb_piles: int | None = None,
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
        kit_combinaison: bool = False,
        kit_gants: bool = False,
        kit_lunettes: bool = False,
        kit_masques: bool = False,
        kit_boite: bool = False,
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
            kit_boite=kit_boite,
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
            essence_litres=essence_litres,
            nb_piles=nb_piles,
        )
        terrestre.recalculer_surfaces(cible.surface_infestee_ha, surface_cumulee_precedente)
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
    ) -> list[Traitement]:
        return await self.repository.list_by_filters(
            type_traitement=type_traitement,
            prospection_id=prospection_id,
            chef_equipe_id=chef_equipe_id,
            reprenable=reprenable,
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


class AddRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        numero_cuve: str,
        produit_id: uuid.UUID,
        quantite_l: float,
        temperature_debut_c: float,
        temperature_fin_c: float,
        vent_debut_ms: float,
        vent_fin_ms: float,
    ) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        aerien = traitement.aerien

        prochain_numero = max((r.numero for r in aerien.rotations), default=0) + 1
        rotation = Rotation(
            traitement_aerien_id=aerien.traitement_id,
            numero=prochain_numero,
            numero_cuve=numero_cuve,
            produit_id=produit_id,
            quantite_l=quantite_l,
            temperature_debut_c=temperature_debut_c,
            temperature_fin_c=temperature_fin_c,
            vent_debut_ms=vent_debut_ms,
            vent_fin_ms=vent_fin_ms,
        )
        aerien.rotations.append(rotation)
        aerien.recalculer_totaux()

        return await self.repository.add_rotation(
            traitement_id, rotation, aerien.nb_rotations, aerien.total_pesticide_l
        )


class UpdateRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(
        self,
        traitement_id: uuid.UUID,
        rotation_id: uuid.UUID,
        numero_cuve: str,
        produit_id: uuid.UUID,
        quantite_l: float,
        temperature_debut_c: float,
        temperature_fin_c: float,
        vent_debut_ms: float,
        vent_fin_ms: float,
    ) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        aerien = traitement.aerien
        rotation = _trouver_rotation(aerien, rotation_id)

        rotation.numero_cuve = numero_cuve
        rotation.produit_id = produit_id
        rotation.quantite_l = quantite_l
        rotation.temperature_debut_c = temperature_debut_c
        rotation.temperature_fin_c = temperature_fin_c
        rotation.vent_debut_ms = vent_debut_ms
        rotation.vent_fin_ms = vent_fin_ms
        aerien.recalculer_totaux()

        return await self.repository.update_rotation(
            traitement_id, rotation, aerien.nb_rotations, aerien.total_pesticide_l
        )


class RemoveRotation:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_id: uuid.UUID, rotation_id: uuid.UUID) -> Traitement:
        traitement = await _get_traitement_aerien(self.repository, traitement_id)
        aerien = traitement.aerien
        rotation = _trouver_rotation(aerien, rotation_id)

        aerien.rotations.remove(rotation)
        aerien.recalculer_totaux()

        return await self.repository.remove_rotation(
            traitement_id, rotation_id, aerien.nb_rotations, aerien.total_pesticide_l
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
    ) -> Traitement:
        traitement = await _get_traitement_terrestre(self.repository, traitement_id)
        terrestre = traitement.terrestre

        prochain_numero = max((p.numero for p in terrestre.produits), default=0) + 1
        produit = ProduitUtilise(
            traitement_terrestre_id=terrestre.traitement_id,
            numero=prochain_numero,
            produit_id=produit_id,
            quantite_l=quantite_l,
        )
        terrestre.produits.append(produit)
        terrestre.recalculer_total_pesticide()

        return await self.repository.add_produit(
            traitement_id, produit, terrestre.total_pesticide_l
        )


class RemoveProduitUtilise:
    def __init__(self, repository: TraitementRepository):
        self.repository = repository

    async def execute(self, traitement_id: uuid.UUID, produit_utilise_id: uuid.UUID) -> Traitement:
        traitement = await _get_traitement_terrestre(self.repository, traitement_id)
        terrestre = traitement.terrestre
        produit = _trouver_produit(terrestre, produit_utilise_id)

        terrestre.produits.remove(produit)
        terrestre.recalculer_total_pesticide()

        return await self.repository.remove_produit(
            traitement_id, produit_utilise_id, terrestre.total_pesticide_l
        )
