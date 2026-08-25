import uuid
from datetime import date, datetime
from typing import Any

from app.domain.prospection import (
    AuditLog,
    Prospection,
    ProspectionCapture,
    ProspectionInfestation,
    ProspectionPopulation,
    StadeInconnuError,
)
from app.domain.repositories import AuditLogRepository, ProspectionRepository


async def _verifier_stades(
    repository: ProspectionRepository, captures: list[ProspectionCapture] | None
) -> None:
    """Le référentiel des stades fait autorité — un code absent est refusé ici, en le
    nommant, plutôt que de remonter en violation de clé étrangère anonyme (#201)."""
    if not captures:
        return
    inconnus = await repository.stades_inconnus({c.stade for c in captures})
    if inconnus:
        raise StadeInconnuError(inconnus)


class CreateProspection:
    def __init__(self, repository: ProspectionRepository):
        self.repository = repository

    async def execute(
        self,
        type_prospection: str,
        campagne_id: uuid.UUID,
        prospecteur_id: uuid.UUID,
        date_prospection: date,
        station_id: uuid.UUID | None = None,
        n_releve: str | None = None,
        n_fiche: str | None = None,
        n_message: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        biotope: str | None = None,
        surface_station: float | None = None,
        surface_prospectee: float | None = None,
        surface_infestee: float | None = None,
        degats_cultures: str | None = None,
        derniere_pluie: date | None = None,
        intensite_pluie: str | None = None,
        vegetation: dict[str, Any] | None = None,
        sol: dict[str, Any] | None = None,
        verdissement: float | None = None,
        hauteur_strate: float | None = None,
        ennemis_naturels: str | None = None,
        observations: str | None = None,
        statut: str = "brouillon",
        populations: list[ProspectionPopulation] | None = None,
        captures: list[ProspectionCapture] | None = None,
        infestations: list[ProspectionInfestation] | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Références (A)
        # ==========================================
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        za: str | None = None,
        pa_code: str | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Observations (D)
        # ==========================================
        degats_cultures_pourcent: int | None = None,
        verdissement_pourcent: int | None = None,
        hauteur_herbe_cm: float | None = None,
        heure_observation_at: datetime | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif & Validation
        # ==========================================
        station_libre: str | None = None,
        type_station: str | None = None,
        verdure_strate: str | None = None,
        signalement_source: str | None = None,
        signalement_date: str | None = None,
        signalement_description: str | None = None,
        conclusion_validation: str | None = None,
        avertissements: list[str] | None = None,
    ) -> Prospection:
        if type_prospection == "intensive" and station_id is None:
            raise ValueError("station_id est obligatoire pour une prospection intensive")

        await _verifier_stades(self.repository, captures)

        now = datetime.utcnow()
        prospection = Prospection(
            type_prospection=type_prospection,
            campagne_id=campagne_id,
            prospecteur_id=prospecteur_id,
            station_id=station_id,
            date_prospection=date_prospection,
            n_releve=n_releve,
            n_fiche=n_fiche,
            n_message=n_message,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            biotope=biotope,
            surface_station=surface_station,
            surface_prospectee=surface_prospectee,
            surface_infestee=surface_infestee,
            degats_cultures=degats_cultures,
            derniere_pluie=derniere_pluie,
            intensite_pluie=intensite_pluie,
            vegetation=vegetation,
            sol=sol,
            verdissement=verdissement,
            hauteur_strate=hauteur_strate,
            ennemis_naturels=ennemis_naturels,
            observations=observations,
            statut=statut,
            created_at=now,
            updated_at=now,
            populations=populations or [],
            captures=captures or [],
            infestations=infestations or [],
            # ==========================================
            # NOUVEAUX CHAMPS - Références (A)
            # ==========================================
            region=region,
            district=district,
            commune=commune,
            za=za,
            pa_code=pa_code,
            # ==========================================
            # NOUVEAUX CHAMPS - Observations (D)
            # ==========================================
            degats_cultures_pourcent=degats_cultures_pourcent,
            verdissement_pourcent=verdissement_pourcent,
            hauteur_herbe_cm=hauteur_herbe_cm,
            heure_observation_at=heure_observation_at,
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif & Validation
            # ==========================================
            station_libre=station_libre,
            type_station=type_station,
            verdure_strate=verdure_strate,
            signalement_source=signalement_source,
            signalement_date=signalement_date,
            signalement_description=signalement_description,
            conclusion_validation=conclusion_validation,
            avertissements=avertissements or [],
        )

        for child in prospection.populations:
            child.prospection_id = prospection.id
        for child in prospection.captures:
            child.prospection_id = prospection.id
        for child in prospection.infestations:
            child.prospection_id = prospection.id

        # 👇 MODIFICATION ICI
        created = await self.repository.create(prospection)
        if created is None:
            raise ValueError("Impossible de récupérer la prospection créée")
        return created


class ListProspections:
    def __init__(self, repository: ProspectionRepository):
        self.repository = repository

    async def execute(
        self,
        type_prospection: str | None = None,
        statut: str | None = None,
        campagne_id: uuid.UUID | None = None,
        station_id: uuid.UUID | None = None,
        prospecteur_id: uuid.UUID | None = None,
    ) -> list[Prospection]:
        return await self.repository.list_by_filters(
            type_prospection=type_prospection,
            statut=statut,
            campagne_id=campagne_id,
            station_id=station_id,
            prospecteur_id=prospecteur_id,
        )


class GetProspection:
    def __init__(self, repository: ProspectionRepository):
        self.repository = repository

    async def execute(self, prospection_id: uuid.UUID) -> Prospection | None:
        return await self.repository.get_by_id(prospection_id)


class UpdateProspection:
    def __init__(self, repository: ProspectionRepository):
        self.repository = repository

    async def execute(
        self,
        prospection_id: uuid.UUID,
        station_id: uuid.UUID | None = None,
        n_releve: str | None = None,
        n_fiche: str | None = None,
        n_message: str | None = None,
        date_prospection: date | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        biotope: str | None = None,
        surface_station: float | None = None,
        surface_prospectee: float | None = None,
        surface_infestee: float | None = None,
        degats_cultures: str | None = None,
        derniere_pluie: date | None = None,
        intensite_pluie: str | None = None,
        vegetation: dict[str, Any] | None = None,
        sol: dict[str, Any] | None = None,
        verdissement: float | None = None,
        hauteur_strate: float | None = None,
        ennemis_naturels: str | None = None,
        observations: str | None = None,
        statut: str | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Références (A)
        # ==========================================
        region: str | None = None,
        district: str | None = None,
        commune: str | None = None,
        za: str | None = None,
        pa_code: str | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Observations (D)
        # ==========================================
        degats_cultures_pourcent: int | None = None,
        verdissement_pourcent: int | None = None,
        hauteur_herbe_cm: float | None = None,
        heure_observation_at: datetime | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif & Validation
        # ==========================================
        station_libre: str | None = None,
        type_station: str | None = None,
        verdure_strate: str | None = None,
        signalement_source: str | None = None,
        signalement_date: str | None = None,
        signalement_description: str | None = None,
        conclusion_validation: str | None = None,
        avertissements: list[str] | None = None,
    ) -> Prospection | None:
        prospection = await self.repository.get_by_id(prospection_id)
        if prospection is None:
            return None

        if prospection.statut != "brouillon":
            raise PermissionError("Seules les fiches en brouillon peuvent être modifiées")

        if station_id is not None:
            prospection.station_id = station_id
        if n_releve is not None:
            prospection.n_releve = n_releve
        if n_fiche is not None:
            prospection.n_fiche = n_fiche
        if n_message is not None:
            prospection.n_message = n_message
        if date_prospection is not None:
            prospection.date_prospection = date_prospection
        if latitude is not None:
            prospection.latitude = latitude
        if longitude is not None:
            prospection.longitude = longitude
        if altitude is not None:
            prospection.altitude = altitude
        if biotope is not None:
            prospection.biotope = biotope
        if surface_station is not None:
            prospection.surface_station = surface_station
        if surface_prospectee is not None:
            prospection.surface_prospectee = surface_prospectee
        if surface_infestee is not None:
            prospection.surface_infestee = surface_infestee
        if degats_cultures is not None:
            prospection.degats_cultures = degats_cultures
        if derniere_pluie is not None:
            prospection.derniere_pluie = derniere_pluie
        if intensite_pluie is not None:
            prospection.intensite_pluie = intensite_pluie
        if vegetation is not None:
            prospection.vegetation = vegetation
        if sol is not None:
            prospection.sol = sol
        if verdissement is not None:
            prospection.verdissement = verdissement
        if hauteur_strate is not None:
            prospection.hauteur_strate = hauteur_strate
        if ennemis_naturels is not None:
            prospection.ennemis_naturels = ennemis_naturels
        if observations is not None:
            prospection.observations = observations
        if statut is not None:
            prospection.statut = statut

        # ==========================================
        # Mise à jour des nouveaux champs - Références (A)
        # ==========================================
        if region is not None:
            prospection.region = region
        if district is not None:
            prospection.district = district
        if commune is not None:
            prospection.commune = commune
        if za is not None:
            prospection.za = za
        if pa_code is not None:
            prospection.pa_code = pa_code

        # ==========================================
        # Mise à jour des nouveaux champs - Observations (D)
        # ==========================================
        if degats_cultures_pourcent is not None:
            prospection.degats_cultures_pourcent = degats_cultures_pourcent
        if verdissement_pourcent is not None:
            prospection.verdissement_pourcent = verdissement_pourcent
        if hauteur_herbe_cm is not None:
            prospection.hauteur_herbe_cm = hauteur_herbe_cm
        if heure_observation_at is not None:
            prospection.heure_observation_at = heure_observation_at

        # ==========================================
        # Mise à jour des nouveaux champs - Extensif & Validation
        # ==========================================
        if station_libre is not None:
            prospection.station_libre = station_libre
        if type_station is not None:
            prospection.type_station = type_station
        if verdure_strate is not None:
            prospection.verdure_strate = verdure_strate
        if signalement_source is not None:
            prospection.signalement_source = signalement_source
        if signalement_date is not None:
            prospection.signalement_date = signalement_date
        if signalement_description is not None:
            prospection.signalement_description = signalement_description
        if conclusion_validation is not None:
            prospection.conclusion_validation = conclusion_validation
        if avertissements is not None:
            prospection.avertissements = avertissements

        prospection.updated_at = datetime.utcnow()

        return await self.repository.update(prospection)


class DeleteProspection:
    def __init__(self, repository: ProspectionRepository):
        self.repository = repository

    async def execute(self, prospection_id: uuid.UUID) -> bool:
        prospection = await self.repository.get_by_id(prospection_id)
        if prospection is None:
            return False
        if prospection.statut != "brouillon":
            raise PermissionError("Seules les fiches en brouillon peuvent être supprimées")
        return await self.repository.delete(prospection_id)


class ChangerStatut:
    def __init__(
        self,
        prospection_repo: ProspectionRepository,
        audit_repo: AuditLogRepository,
    ):
        self.prospection_repo = prospection_repo
        self.audit_repo = audit_repo

    async def execute(
        self,
        prospection_id: uuid.UUID,
        nouveau_statut: str,
        acteur_id: uuid.UUID,
        acteur_role: str,
    ) -> Prospection:
        prospection = await self.prospection_repo.get_by_id(prospection_id)
        if prospection is None:
            raise LookupError("Prospection non trouvée")

        statut_precedent = prospection.statut
        action = prospection.apply_transition(nouveau_statut, acteur_role)

        updated = await self.prospection_repo.update(prospection)

        await self.audit_repo.create(
            AuditLog(
                fiche_type=prospection.type_prospection,
                fiche_id=prospection_id,
                auteur_id=acteur_id,
                action=action,
                details={"statut_precedent": statut_precedent, "nouveau_statut": nouveau_statut},
            )
        )

        return updated


class AjouterCommentaire:
    def __init__(
        self,
        prospection_repo: ProspectionRepository,
        audit_repo: AuditLogRepository,
    ):
        self.prospection_repo = prospection_repo
        self.audit_repo = audit_repo

    async def execute(
        self,
        prospection_id: uuid.UUID,
        auteur_id: uuid.UUID,
        texte: str,
    ) -> AuditLog:
        prospection = await self.prospection_repo.get_by_id(prospection_id)
        if prospection is None:
            raise LookupError("Prospection non trouvée")

        return await self.audit_repo.create(
            AuditLog(
                fiche_type=prospection.type_prospection,
                fiche_id=prospection_id,
                auteur_id=auteur_id,
                action="commentaire",
                details={"texte": texte},
            )
        )


class GetAuditLog:
    def __init__(
        self,
        prospection_repo: ProspectionRepository,
        audit_repo: AuditLogRepository,
    ):
        self.prospection_repo = prospection_repo
        self.audit_repo = audit_repo

    async def execute(self, prospection_id: uuid.UUID) -> list[AuditLog]:
        prospection = await self.prospection_repo.get_by_id(prospection_id)
        if prospection is None:
            raise LookupError("Prospection non trouvée")
        return await self.audit_repo.list_by_fiche(prospection_id)
