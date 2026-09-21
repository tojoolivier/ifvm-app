import uuid
from datetime import date, datetime
from typing import Any

from app.domain.prospection import (
    AuditLog,
    Prospection,
    ProspectionCapture,
    ProspectionInfestation,
    ProspectionOperationAerienne,
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


def _calculer_duree_minutes(debut_heure: str, fin_heure: str) -> int:
    """Durée entre deux `HH:MM`, jamais saisie côté client — recalculée ici pour
    ne jamais lui faire confiance. Franchissement de minuit : fin < début ⇒ +24h."""
    heure_debut, minute_debut = (int(p) for p in debut_heure.split(":"))
    heure_fin, minute_fin = (int(p) for p in fin_heure.split(":"))
    debut = heure_debut * 60 + minute_debut
    fin = heure_fin * 60 + minute_fin
    if fin < debut:
        fin += 24 * 60
    return fin - debut


class CreateProspection:
    def __init__(
        self,
        repository: ProspectionRepository,
        audit_repo: AuditLogRepository | None = None,
    ):
        self.repository = repository
        # Optionnel, rétrocompatible : seule la route l'a toujours fourni en
        # pratique. `None` reste accepté pour ne pas casser un appelant qui ne
        # se soucierait pas des notifications (ex. import de masse).
        self.audit_repo = audit_repo

    async def execute(
        self,
        type_prospection: str,
        campagne_id: uuid.UUID,
        prospecteur_id: uuid.UUID,
        date_prospection: date,
        station_id: uuid.UUID | None = None,
        n_fiche: str | None = None,
        n_message: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        biotope: list[str] | None = None,
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
        type_station: list[str] | None = None,
        verdure_strate: str | None = None,
        signalement_source: str | None = None,
        signalement_date: str | None = None,
        signalement_description: str | None = None,
        conclusion_validation: str | None = None,
        avertissements: list[str] | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif : mode aérien
        # ==========================================
        mode_extensif: str | None = None,
        societe: str | None = None,
        immatricule_aeronef: str | None = None,
        pilote: str | None = None,
        mecanicien: str | None = None,
        chef_de_base: str | None = None,
        base: str | None = None,
        base_numero: int | None = None,
        base_date_installation: date | None = None,
        base_latitude: float | None = None,
        base_longitude: float | None = None,
        base_secondaire: str | None = None,
        base_secondaire_date_installation: date | None = None,
        base_secondaire_latitude: float | None = None,
        base_secondaire_longitude: float | None = None,
        operations_aeriennes: list[ProspectionOperationAerienne] | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
        # ==========================================
        pesticides_embarques: bool | None = None,
        pesticide_nom_commercial: str | None = None,
        pesticide_quantite_disponible: float | None = None,
        pesticide_quantite_recue: float | None = None,
        futs_disponible: int | None = None,
        futs_pleins: int | None = None,
        futs_vides: int | None = None,
        futs_recues: int | None = None,
        signature_visa_nom: str | None = None,
        signature_visa_horodatage: datetime | None = None,
        signature_consultant_fao_nom: str | None = None,
        signature_consultant_fao_horodatage: datetime | None = None,
        signature_consultant_fao_image: str | None = None,
        signature_pilote_nom: str | None = None,
        signature_pilote_horodatage: datetime | None = None,
        signature_pilote_image: str | None = None,
        signature_chef_base_nom: str | None = None,
        signature_chef_base_horodatage: datetime | None = None,
        signature_chef_base_image: str | None = None,
        # #revalidation-prospection : renseigné uniquement quand cette fiche
        # revalide une fiche périmée (extensive/validation, cf. domain/
        # prospection.py) — jamais décidé côté serveur, toujours transmis
        # explicitement par le client.
        revalide_de_id: uuid.UUID | None = None,
    ) -> Prospection:
        if type_prospection == "intensive" and station_id is None:
            raise ValueError("station_id est obligatoire pour une prospection intensive")

        await _verifier_stades(self.repository, captures)

        now = datetime.utcnow()
        # Une fiche de validation / signalisation est exploitable pour le
        # traitement dès sa synchronisation : elle ne passe pas par la chaîne
        # administrative en_attente -> verifiee -> validee réservée aux
        # prospections intensive et extensive (`apply_transition`, jamais
        # appelée ici). Le client ne décide donc pas de ce statut métier. Son
        # numéro visible est celui du message créé à la référence, jamais un
        # second numéro généré au serveur. `validated_at` est stampé ici pour
        # la même raison qu'`apply_transition` le stampe pour les deux autres
        # types : #revalidation-prospection en a besoin (délai de 5 jours
        # depuis la validation) et ne doit pas dépendre du type pour trouver
        # une valeur non-NULL.
        validated_at = None
        if type_prospection == "validation":
            statut = "validee"
            n_fiche = n_message
            validated_at = now
        elif revalide_de_id is not None:
            # #revalidation-prospection : une fiche qui revalide une prospection
            # périmée documente une situation terrain qui vient d'être
            # revérifiée sur le moment — la refaire passer par la chaîne
            # administrative en_attente -> verifiee -> validee de sa fiche
            # d'origine la laisserait invisible du sélecteur de traitement
            # pendant potentiellement plusieurs jours de plus, ce qui
            # réintroduirait exactement le problème que la revalidation sert à
            # résoudre. `validated_at` reçoit une date fraîche (maintenant),
            # jamais celle de la fiche source : c'est elle qui fait courir à
            # nouveau le délai de péremption de 5 jours.
            statut = "validee"
            validated_at = now

        prospection = Prospection(
            type_prospection=type_prospection,
            campagne_id=campagne_id,
            prospecteur_id=prospecteur_id,
            station_id=station_id,
            date_prospection=date_prospection,
            n_fiche=n_fiche,
            n_message=n_message,
            latitude=latitude,
            longitude=longitude,
            altitude=altitude,
            biotope=biotope or [],
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
            validated_at=validated_at,
            revalide_de_id=revalide_de_id,
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
            type_station=type_station or [],
            verdure_strate=verdure_strate,
            signalement_source=signalement_source,
            signalement_date=signalement_date,
            signalement_description=signalement_description,
            conclusion_validation=conclusion_validation,
            avertissements=avertissements or [],
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif : mode aérien
            # ==========================================
            mode_extensif=mode_extensif,
            societe=societe,
            immatricule_aeronef=immatricule_aeronef,
            pilote=pilote,
            mecanicien=mecanicien,
            chef_de_base=chef_de_base,
            base=base,
            base_numero=base_numero,
            base_date_installation=base_date_installation,
            base_latitude=base_latitude,
            base_longitude=base_longitude,
            base_secondaire=base_secondaire,
            base_secondaire_date_installation=base_secondaire_date_installation,
            base_secondaire_latitude=base_secondaire_latitude,
            base_secondaire_longitude=base_secondaire_longitude,
            operations_aeriennes=operations_aeriennes or [],
            # ==========================================
            # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
            # ==========================================
            pesticides_embarques=pesticides_embarques,
            pesticide_nom_commercial=pesticide_nom_commercial,
            pesticide_quantite_disponible=pesticide_quantite_disponible,
            pesticide_quantite_recue=pesticide_quantite_recue,
            futs_disponible=futs_disponible,
            futs_pleins=futs_pleins,
            futs_vides=futs_vides,
            futs_recues=futs_recues,
            signature_visa_nom=signature_visa_nom,
            signature_visa_horodatage=signature_visa_horodatage,
            signature_consultant_fao_nom=signature_consultant_fao_nom,
            signature_consultant_fao_horodatage=signature_consultant_fao_horodatage,
            signature_consultant_fao_image=signature_consultant_fao_image,
            signature_pilote_nom=signature_pilote_nom,
            signature_pilote_horodatage=signature_pilote_horodatage,
            signature_pilote_image=signature_pilote_image,
            signature_chef_base_nom=signature_chef_base_nom,
            signature_chef_base_horodatage=signature_chef_base_horodatage,
            signature_chef_base_image=signature_chef_base_image,
        )

        for child in prospection.populations:
            child.prospection_id = prospection.id
        for child in prospection.captures:
            child.prospection_id = prospection.id
        for child in prospection.infestations:
            child.prospection_id = prospection.id
        # `numero` (séquence par fiche) et `duree_minutes` sont assignés ici, jamais
        # fait confiance à une valeur du client — cf. OperationAerienneCreate qui ne
        # porte ni l'un ni l'autre.
        for index, child in enumerate(prospection.operations_aeriennes, start=1):
            child.prospection_id = prospection.id
            child.numero = index
            child.duree_minutes = _calculer_duree_minutes(child.debut_heure, child.fin_heure)

        # 👇 MODIFICATION ICI
        created = await self.repository.create(prospection)
        if created is None:
            raise ValueError("Impossible de récupérer la prospection créée")

        # « Nouvelle fiche » côté centre de notifications web (#toutes-les-donnees) :
        # `ActionAudit.CREATION` existait déjà dans l'énumération mais n'était
        # écrit nulle part — une fiche fraîchement créée était invisible du
        # centre de notifications tant qu'aucune transition de statut n'avait
        # eu lieu.
        if self.audit_repo is not None:
            await self.audit_repo.create(
                AuditLog(
                    fiche_type=created.type_prospection,
                    fiche_id=created.id,
                    auteur_id=created.prospecteur_id,
                    action="creation",
                )
            )
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
        disponible_pour_traitement: bool = False,
        a_revalider: bool = False,
        date_prospection: date | None = None,
    ) -> list[Prospection]:
        return await self.repository.list_by_filters(
            type_prospection=type_prospection,
            statut=statut,
            campagne_id=campagne_id,
            station_id=station_id,
            prospecteur_id=prospecteur_id,
            disponible_pour_traitement=disponible_pour_traitement,
            a_revalider=a_revalider,
            date_prospection=date_prospection,
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
        n_fiche: str | None = None,
        n_message: str | None = None,
        date_prospection: date | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        altitude: float | None = None,
        biotope: list[str] | None = None,
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
        type_station: list[str] | None = None,
        verdure_strate: str | None = None,
        signalement_source: str | None = None,
        signalement_date: str | None = None,
        signalement_description: str | None = None,
        conclusion_validation: str | None = None,
        avertissements: list[str] | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif : mode aérien
        # ==========================================
        mode_extensif: str | None = None,
        societe: str | None = None,
        immatricule_aeronef: str | None = None,
        pilote: str | None = None,
        mecanicien: str | None = None,
        chef_de_base: str | None = None,
        base: str | None = None,
        base_numero: int | None = None,
        base_date_installation: date | None = None,
        base_latitude: float | None = None,
        base_longitude: float | None = None,
        base_secondaire: str | None = None,
        base_secondaire_date_installation: date | None = None,
        base_secondaire_latitude: float | None = None,
        base_secondaire_longitude: float | None = None,
        # ==========================================
        # NOUVEAUX CHAMPS - Extensif : pesticides embarqués + signatures
        # ==========================================
        pesticides_embarques: bool | None = None,
        pesticide_nom_commercial: str | None = None,
        pesticide_quantite_disponible: float | None = None,
        pesticide_quantite_recue: float | None = None,
        futs_disponible: int | None = None,
        futs_pleins: int | None = None,
        futs_vides: int | None = None,
        futs_recues: int | None = None,
        signature_visa_nom: str | None = None,
        signature_visa_horodatage: datetime | None = None,
        signature_consultant_fao_nom: str | None = None,
        signature_consultant_fao_horodatage: datetime | None = None,
        signature_consultant_fao_image: str | None = None,
        signature_pilote_nom: str | None = None,
        signature_pilote_horodatage: datetime | None = None,
        signature_pilote_image: str | None = None,
        signature_chef_base_nom: str | None = None,
        signature_chef_base_horodatage: datetime | None = None,
        signature_chef_base_image: str | None = None,
    ) -> Prospection | None:
        prospection = await self.repository.get_by_id(prospection_id)
        if prospection is None:
            return None

        if prospection.statut != "brouillon":
            raise PermissionError("Seules les fiches en brouillon peuvent être modifiées")

        if station_id is not None:
            prospection.station_id = station_id
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

        # ==========================================
        # Mise à jour des nouveaux champs - Extensif : mode aérien
        # ==========================================
        if mode_extensif is not None:
            prospection.mode_extensif = mode_extensif
        if societe is not None:
            prospection.societe = societe
        if immatricule_aeronef is not None:
            prospection.immatricule_aeronef = immatricule_aeronef
        if pilote is not None:
            prospection.pilote = pilote
        if mecanicien is not None:
            prospection.mecanicien = mecanicien
        if chef_de_base is not None:
            prospection.chef_de_base = chef_de_base
        if base is not None:
            prospection.base = base
        if base_numero is not None:
            prospection.base_numero = base_numero
        if base_date_installation is not None:
            prospection.base_date_installation = base_date_installation
        if base_latitude is not None:
            prospection.base_latitude = base_latitude
        if base_longitude is not None:
            prospection.base_longitude = base_longitude
        if base_secondaire is not None:
            prospection.base_secondaire = base_secondaire
        if base_secondaire_date_installation is not None:
            prospection.base_secondaire_date_installation = base_secondaire_date_installation
        if base_secondaire_latitude is not None:
            prospection.base_secondaire_latitude = base_secondaire_latitude
        if base_secondaire_longitude is not None:
            prospection.base_secondaire_longitude = base_secondaire_longitude

        # ==========================================
        # Mise à jour des nouveaux champs - Extensif : pesticides embarqués + signatures
        # ==========================================
        if pesticides_embarques is not None:
            prospection.pesticides_embarques = pesticides_embarques
        if pesticide_nom_commercial is not None:
            prospection.pesticide_nom_commercial = pesticide_nom_commercial
        if pesticide_quantite_disponible is not None:
            prospection.pesticide_quantite_disponible = pesticide_quantite_disponible
        if pesticide_quantite_recue is not None:
            prospection.pesticide_quantite_recue = pesticide_quantite_recue
        if futs_disponible is not None:
            prospection.futs_disponible = futs_disponible
        if futs_pleins is not None:
            prospection.futs_pleins = futs_pleins
        if futs_vides is not None:
            prospection.futs_vides = futs_vides
        if futs_recues is not None:
            prospection.futs_recues = futs_recues
        if signature_visa_nom is not None:
            prospection.signature_visa_nom = signature_visa_nom
        if signature_visa_horodatage is not None:
            prospection.signature_visa_horodatage = signature_visa_horodatage
        if signature_consultant_fao_nom is not None:
            prospection.signature_consultant_fao_nom = signature_consultant_fao_nom
        if signature_consultant_fao_horodatage is not None:
            prospection.signature_consultant_fao_horodatage = signature_consultant_fao_horodatage
        if signature_consultant_fao_image is not None:
            prospection.signature_consultant_fao_image = signature_consultant_fao_image
        if signature_pilote_nom is not None:
            prospection.signature_pilote_nom = signature_pilote_nom
        if signature_pilote_horodatage is not None:
            prospection.signature_pilote_horodatage = signature_pilote_horodatage
        if signature_pilote_image is not None:
            prospection.signature_pilote_image = signature_pilote_image
        if signature_chef_base_nom is not None:
            prospection.signature_chef_base_nom = signature_chef_base_nom
        if signature_chef_base_horodatage is not None:
            prospection.signature_chef_base_horodatage = signature_chef_base_horodatage
        if signature_chef_base_image is not None:
            prospection.signature_chef_base_image = signature_chef_base_image

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
        commentaire: str | None = None,
    ) -> Prospection:
        prospection = await self.prospection_repo.get_by_id(prospection_id)
        if prospection is None:
            raise LookupError("Prospection non trouvée")

        statut_precedent = prospection.statut
        action = prospection.apply_transition(nouveau_statut, acteur_role, acteur_id)

        updated = await self.prospection_repo.update(prospection)

        details: dict[str, Any] = {
            "statut_precedent": statut_precedent,
            "nouveau_statut": nouveau_statut,
        }
        # Le motif de rejet (et tout commentaire accompagnant une vérification/
        # validation) transitait déjà par `StatutChange.commentaire` côté web
        # (modale « Rejeter avec motif ») mais n'était jamais lu ici : la fiche
        # changeait bien de statut, mais le motif saisi disparaissait — le
        # centre de notifications ne peut afficher que ce qui est stocké.
        if commentaire:
            details["commentaire"] = commentaire

        await self.audit_repo.create(
            AuditLog(
                fiche_type=prospection.type_prospection,
                fiche_id=prospection_id,
                auteur_id=acteur_id,
                action=action,
                details=details,
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
