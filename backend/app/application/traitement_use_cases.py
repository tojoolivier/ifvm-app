import uuid
from datetime import date, datetime
from typing import Any

from app.domain.repositories import (
    ProspectionRepository,
    TraitementRepository,
    UtilisateurRepository,
)
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    NumeroFicheConflitError,
    ProspectionIntrouvableError,
    Traitement,
    TraitementAerien,
    construire_cible,
    generer_numero_fiche,
)

_MAX_TENTATIVES_NUMERO_FICHE = 50


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
        if date_validation < date_traitement:
            raise ValueError("date_validation doit être postérieure ou égale à date_traitement")

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

        base_numero = numero_fiche or generer_numero_fiche(chef.prenom, date_traitement)

        now = datetime.utcnow()
        traitement = Traitement(
            prospection_id=prospection_id,
            numero_fiche=base_numero,
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
            statut="brouillon",
            created_at=now,
            updated_at=now,
        )

        cible = construire_cible(prospection)
        cible.traitement_id = traitement.id
        traitement.cible = cible

        traitement.aerien = TraitementAerien(
            traitement_id=traitement.id,
            pilote=pilote,
            mecanicien=mecanicien,
            chef_de_base_id=chef_de_base_id,
            consultant_international=consultant_international,
        )

        for suffixe in range(2, _MAX_TENTATIVES_NUMERO_FICHE + 2):
            try:
                return await self.traitement_repository.create(traitement)
            except NumeroFicheConflitError:
                traitement.numero_fiche = f"{base_numero}-{suffixe}"
        raise NumeroFicheConflitError(
            f"Impossible de générer un numero_fiche unique à partir de '{base_numero}'"
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
    ) -> list[Traitement]:
        return await self.repository.list_by_filters(
            type_traitement=type_traitement,
            prospection_id=prospection_id,
        )
