import uuid
from datetime import date

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.repositories import TraitementRepository
from app.domain.traitement import (
    Cible,
    EvaluationRisquePopulation,
    NumeroFicheConflitError,
    ProduitUtilise,
    Rotation,
    Traitement,
    TraitementAerien,
    TraitementOrigineDejaUtiliseeError,
    TraitementSignature,
    TraitementTerrestre,
)
from app.infrastructure.prospection_model import ProspectionModel
from app.infrastructure.traitement_model import (
    CibleModel,
    EvaluationRisquePopulationModel,
    ProduitUtiliseModel,
    RotationModel,
    TraitementAerienModel,
    TraitementModel,
    TraitementSignatureModel,
    TraitementTerrestreModel,
)


class TraitementRepositoryImpl(TraitementRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, traitement_id: uuid.UUID) -> Traitement | None:
        result = await self.session.execute(
            select(TraitementModel)
            .where(TraitementModel.id == traitement_id)
            .options(
                selectinload(TraitementModel.cible),
                selectinload(TraitementModel.aerien).selectinload(TraitementAerienModel.rotations),
                selectinload(TraitementModel.terrestre).selectinload(
                    TraitementTerrestreModel.produits
                ),
                selectinload(TraitementModel.signatures),
                selectinload(TraitementModel.evaluations_risque_population),
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        traitement = self._to_domain(model)
        await self._resoudre_prospection_n_fiche([traitement])
        return traitement

    async def list_by_filters(
        self,
        type_traitement: str | None = None,
        prospection_id: uuid.UUID | None = None,
        chef_equipe_id: uuid.UUID | None = None,
        reprenable: bool | None = None,
        statut: str | None = None,
    ) -> list[Traitement]:
        stmt = select(TraitementModel).options(
            selectinload(TraitementModel.cible),
            selectinload(TraitementModel.aerien).selectinload(TraitementAerienModel.rotations),
            selectinload(TraitementModel.terrestre).selectinload(TraitementTerrestreModel.produits),
            selectinload(TraitementModel.signatures),
            selectinload(TraitementModel.evaluations_risque_population),
        )
        if type_traitement is not None:
            stmt = stmt.where(TraitementModel.type_traitement == type_traitement)
        if prospection_id is not None:
            stmt = stmt.where(TraitementModel.prospection_id == prospection_id)
        if statut is not None:
            stmt = stmt.where(TraitementModel.statut == statut)
        if chef_equipe_id is not None or reprenable:
            # outerjoin (pas join) dès `reprenable` : une fiche AERIEN n'a pas de
            # ligne traitement_terrestre — un join simple l'exclurait avant même
            # d'atteindre le OR type-aware ci-dessous.
            join_terrestre = stmt.outerjoin if reprenable else stmt.join
            stmt = join_terrestre(
                TraitementTerrestreModel,
                TraitementTerrestreModel.traitement_id == TraitementModel.id,
            )
        if chef_equipe_id is not None:
            stmt = stmt.where(TraitementTerrestreModel.chef_equipe_id == chef_equipe_id)
        if reprenable:
            # Migration 0050 : le chaînage de reprise, jusqu'ici Terrestre
            # uniquement, est généralisé à l'Aérien — chaque type a sa propre
            # chaîne (traitement_origine_id sur sa propre table), jamais mélangées.
            stmt = stmt.outerjoin(
                TraitementAerienModel,
                TraitementAerienModel.traitement_id == TraitementModel.id,
            )
            origines_utilisees_terrestre = select(
                TraitementTerrestreModel.traitement_origine_id
            ).where(TraitementTerrestreModel.traitement_origine_id.is_not(None))
            origines_utilisees_aerien = select(TraitementAerienModel.traitement_origine_id).where(
                TraitementAerienModel.traitement_origine_id.is_not(None)
            )
            stmt = stmt.where(
                or_(
                    and_(
                        TraitementModel.type_traitement == "TERRESTRE",
                        or_(
                            TraitementTerrestreModel.surface_restante_ha.is_(None),
                            TraitementTerrestreModel.surface_restante_ha > 0,
                        ),
                        TraitementModel.id.not_in(origines_utilisees_terrestre),
                    ),
                    and_(
                        TraitementModel.type_traitement == "AERIEN",
                        or_(
                            TraitementAerienModel.surface_restante_ha.is_(None),
                            TraitementAerienModel.surface_restante_ha > 0,
                        ),
                        TraitementModel.id.not_in(origines_utilisees_aerien),
                    ),
                )
            )
        stmt = stmt.order_by(TraitementModel.date_traitement.desc())
        result = await self.session.execute(stmt)
        traitements = [self._to_domain(m) for m in result.scalars().all()]
        await self._resoudre_prospection_n_fiche(traitements)
        return traitements

    async def _resoudre_prospection_n_fiche(self, traitements: list[Traitement]) -> None:
        """Peuple `Traitement.prospection_n_fiche` par une seule requête groupée
        (#numero-fiche-prospection-liee), même pattern que
        `ProspectionRepositoryImpl._resoudre_noms` : `prospection_id` reste
        l'unique relation entre les deux fiches, ce champ n'en est qu'une
        lecture dérivée, jamais une seconde relation ni une colonne dupliquée.
        Fallback n_message si n_fiche n'est pas encore renseigné, même ordre
        de priorité que l'écran mobile « Consulter une fiche validée »
        (prospection-picker.tsx)."""
        ids = {t.prospection_id for t in traitements}
        if not ids:
            return
        result = await self.session.execute(
            select(
                ProspectionModel.id,
                ProspectionModel.n_fiche,
                ProspectionModel.n_message,
            ).where(ProspectionModel.id.in_(ids))
        )
        numeros = {row.id: row.n_fiche or row.n_message for row in result.all()}
        for t in traitements:
            t.prospection_n_fiche = numeros.get(t.prospection_id)

    async def origine_deja_utilisee(
        self, traitement_origine_id: uuid.UUID, exclude_traitement_id: uuid.UUID | None = None
    ) -> bool:
        stmt = select(TraitementTerrestreModel.traitement_id).where(
            TraitementTerrestreModel.traitement_origine_id == traitement_origine_id
        )
        if exclude_traitement_id is not None:
            stmt = stmt.where(TraitementTerrestreModel.traitement_id != exclude_traitement_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def origine_deja_utilisee_aerien(
        self, traitement_origine_id: uuid.UUID, exclude_traitement_id: uuid.UUID | None = None
    ) -> bool:
        """Mirroir de `origine_deja_utilisee` (migration 0050), pour le chaînage de
        reprise généralisé à l'Aérien."""
        stmt = select(TraitementAerienModel.traitement_id).where(
            TraitementAerienModel.traitement_origine_id == traitement_origine_id
        )
        if exclude_traitement_id is not None:
            stmt = stmt.where(TraitementAerienModel.traitement_id != exclude_traitement_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def create(self, traitement: Traitement) -> Traitement:
        model = TraitementModel(
            id=traitement.id,
            prospection_id=traitement.prospection_id,
            numero_fiche=traitement.numero_fiche,
            type_traitement=traitement.type_traitement,
            mode_traitement=traitement.mode_traitement,
            date_traitement=traitement.date_traitement,
            date_validation=traitement.date_validation,
            localite=traitement.localite,
            region=traitement.region,
            district=traitement.district,
            commune=traitement.commune,
            latitude=traitement.latitude,
            longitude=traitement.longitude,
            altitude=traitement.altitude,
            kit_combinaison=traitement.kit_combinaison,
            kit_gants=traitement.kit_gants,
            kit_lunettes=traitement.kit_lunettes,
            kit_masques=traitement.kit_masques,
            kit_botte=traitement.kit_botte,
            zones_exposees=traitement.zones_exposees,
            hauteur_strate_herbeuse_m=traitement.hauteur_strate_herbeuse_m,
            hauteur_strate_arboree_m=traitement.hauteur_strate_arboree_m,
            recouvrement_percent=traitement.recouvrement_percent,
            empoisonnement=traitement.empoisonnement,
            empoisonnement_type=traitement.empoisonnement_type,
            empoisonnement_mode=traitement.empoisonnement_mode,
            empoisonnement_autre=traitement.empoisonnement_autre,
            evaluation_risque=traitement.evaluation_risque,
            comportement_anormal=traitement.comportement_anormal,
            comportement_non_cibles=traitement.comportement_non_cibles,
            mortalite=traitement.mortalite,
            mortalite_familles=traitement.mortalite_familles,
            observations=traitement.observations,
            statut=traitement.statut,
            statut_sync=traitement.statut_sync,
            created_at=traitement.created_at,
            updated_at=traitement.updated_at,
        )

        if traitement.cible is not None:
            model.cible = CibleModel(
                espece=traitement.cible.espece,
                petites_larves=traitement.cible.petites_larves,
                grandes_larves=traitement.cible.grandes_larves,
                vols_clairs_essaims=traitement.cible.vols_clairs_essaims,
                repartition_population=traitement.cible.repartition_population,
                surface_infestee_ha=traitement.cible.surface_infestee_ha,
            )

        if traitement.aerien is not None:
            model.aerien = TraitementAerienModel(
                pilote=traitement.aerien.pilote,
                mecanicien=traitement.aerien.mecanicien,
                chef_de_base_id=traitement.aerien.chef_de_base_id,
                consultant_international=traitement.aerien.consultant_international,
                base_principale=traitement.aerien.base_principale,
                stand=traitement.aerien.stand,
                stand_date_installation=traitement.aerien.stand_date_installation,
                base_secondaire=traitement.aerien.base_secondaire,
                base_secondaire_date_installation=(
                    traitement.aerien.base_secondaire_date_installation
                ),
                immatricule_aeronef=traitement.aerien.immatricule_aeronef,
                nb_rotations=traitement.aerien.nb_rotations,
                total_pesticide_l=traitement.aerien.total_pesticide_l,
                total_pesticide_kg=traitement.aerien.total_pesticide_kg,
                surface_traitee_ha=traitement.aerien.surface_traitee_ha,
                reprise_traitement=traitement.aerien.reprise_traitement,
                traitement_origine_id=traitement.aerien.traitement_origine_id,
                surface_cumulee_ha=traitement.aerien.surface_cumulee_ha,
                surface_restante_ha=traitement.aerien.surface_restante_ha,
                pesticide_recu_l=traitement.aerien.pesticide_recu_l,
                pesticide_stock_restant_l=traitement.aerien.pesticide_stock_restant_l,
                taux_mortalite_pourcent=traitement.aerien.taux_mortalite_pourcent,
                evaluation_efficacite_heures_apres=(
                    traitement.aerien.evaluation_efficacite_heures_apres
                ),
                methode_evaluation_efficacite=traitement.aerien.methode_evaluation_efficacite,
            )

        if traitement.terrestre is not None:
            model.terrestre = TraitementTerrestreModel(
                heure_debut=traitement.terrestre.heure_debut,
                heure_fin=traitement.terrestre.heure_fin,
                vitesse_vent_ms=traitement.terrestre.vitesse_vent_ms,
                direction_vent=traitement.terrestre.direction_vent,
                temperature_c=traitement.terrestre.temperature_c,
                taux_mortalite_pourcent=traitement.terrestre.taux_mortalite_pourcent,
                evaluation_efficacite_heures_apres=(
                    traitement.terrestre.evaluation_efficacite_heures_apres
                ),
                methode_evaluation_efficacite=traitement.terrestre.methode_evaluation_efficacite,
                reprise_traitement=traitement.terrestre.reprise_traitement,
                traitement_origine_id=traitement.terrestre.traitement_origine_id,
                chef_equipe_id=traitement.terrestre.chef_equipe_id,
                agent_encadreur=traitement.terrestre.agent_encadreur,
                consultant_international=traitement.terrestre.consultant_international,
                surface_atomiseur_ha=traitement.terrestre.surface_atomiseur_ha,
                surface_disque_rotatif_ha=traitement.terrestre.surface_disque_rotatif_ha,
                surface_atomiseur_autoporte_ha=traitement.terrestre.surface_atomiseur_autoporte_ha,
                surface_traitee_ha=traitement.terrestre.surface_traitee_ha,
                surface_cumulee_ha=traitement.terrestre.surface_cumulee_ha,
                surface_restante_ha=traitement.terrestre.surface_restante_ha,
                surface_restante_abandonnee=traitement.terrestre.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=(
                    traitement.terrestre.motif_surface_restante_abandonnee
                ),
                essence_litres=traitement.terrestre.essence_litres,
                nb_piles=traitement.terrestre.nb_piles,
                total_pesticide_l=traitement.terrestre.total_pesticide_l,
                pesticide_recu_l=traitement.terrestre.pesticide_recu_l,
                pesticide_stock_restant_l=traitement.terrestre.pesticide_stock_restant_l,
            )

        model.evaluations_risque_population = [
            EvaluationRisquePopulationModel(
                traitement_id=model.id,
                ordre=e.ordre,
                habitat_proche=e.habitat_proche,
                distance_km=e.distance_km,
                sensibilisation=e.sensibilisation,
            )
            for e in traitement.evaluations_risque_population
        ]

        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            # asyncpg enveloppe l'erreur pilote d'origine (avec .constraint_name) dans
            # un wrapper SQLAlchemy minimal ; l'original reste accessible via __cause__.
            constraint_name = getattr(e.orig, "constraint_name", None) or getattr(
                e.orig.__cause__, "constraint_name", None
            )
            if constraint_name == "traitement_numero_fiche_key":
                raise NumeroFicheConflitError(
                    f"numero_fiche '{traitement.numero_fiche}' déjà utilisé"
                ) from e
            if constraint_name == "uq_traitement_terrestre_origine_id":
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement.terrestre.traitement_origine_id} est déjà "
                    "désignée comme origine par une autre fiche"
                ) from e
            if constraint_name == "uq_traitement_aerien_origine_id":
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement.aerien.traitement_origine_id} est déjà "
                    "désignée comme origine par une autre fiche"
                ) from e
            raise
        return await self.get_by_id(model.id)

    async def add_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float,
        total_pesticide_kg: float,
        surface_traitee_ha: float,
        surface_cumulee_ha: float,
        surface_restante_ha: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        self.session.add(
            RotationModel(
                id=rotation.id,
                traitement_aerien_id=traitement_id,
                numero=rotation.numero,
                numero_cuve=rotation.numero_cuve,
                produit_id=rotation.produit_id,
                quantite=rotation.quantite,
                unite=rotation.unite,
                surface_ha=rotation.surface_ha,
                temperature_debut_c=rotation.temperature_debut_c,
                temperature_fin_c=rotation.temperature_fin_c,
                vent_debut_ms=rotation.vent_debut_ms,
                vent_fin_ms=rotation.vent_fin_ms,
                heure_debut=rotation.heure_debut,
                heure_ouverture_vanne=rotation.heure_ouverture_vanne,
                heure_fermeture_vanne=rotation.heure_fermeture_vanne,
                heure_fin=rotation.heure_fin,
                nom_commercial=rotation.nom_commercial,
            )
        )
        await self._persister_totaux(
            traitement_id,
            nb_rotations,
            total_pesticide_l,
            total_pesticide_kg,
            surface_traitee_ha,
            surface_cumulee_ha,
            surface_restante_ha,
            pesticide_stock_restant_l,
        )
        return await self.get_by_id(traitement_id)

    async def update_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation: Rotation,
        nb_rotations: int,
        total_pesticide_l: float,
        total_pesticide_kg: float,
        surface_traitee_ha: float,
        surface_cumulee_ha: float,
        surface_restante_ha: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        rotation_model = await self.session.get(RotationModel, rotation.id)
        rotation_model.numero_cuve = rotation.numero_cuve
        rotation_model.produit_id = rotation.produit_id
        rotation_model.quantite = rotation.quantite
        rotation_model.unite = rotation.unite
        rotation_model.surface_ha = rotation.surface_ha
        rotation_model.temperature_debut_c = rotation.temperature_debut_c
        rotation_model.temperature_fin_c = rotation.temperature_fin_c
        rotation_model.vent_debut_ms = rotation.vent_debut_ms
        rotation_model.vent_fin_ms = rotation.vent_fin_ms
        rotation_model.heure_debut = rotation.heure_debut
        rotation_model.heure_ouverture_vanne = rotation.heure_ouverture_vanne
        rotation_model.heure_fermeture_vanne = rotation.heure_fermeture_vanne
        rotation_model.heure_fin = rotation.heure_fin
        rotation_model.nom_commercial = rotation.nom_commercial

        await self._persister_totaux(
            traitement_id,
            nb_rotations,
            total_pesticide_l,
            total_pesticide_kg,
            surface_traitee_ha,
            surface_cumulee_ha,
            surface_restante_ha,
            pesticide_stock_restant_l,
        )
        return await self.get_by_id(traitement_id)

    async def remove_rotation(
        self,
        traitement_id: uuid.UUID,
        rotation_id: uuid.UUID,
        nb_rotations: int,
        total_pesticide_l: float,
        total_pesticide_kg: float,
        surface_traitee_ha: float,
        surface_cumulee_ha: float,
        surface_restante_ha: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        rotation_model = await self.session.get(RotationModel, rotation_id)
        await self.session.delete(rotation_model)

        await self._persister_totaux(
            traitement_id,
            nb_rotations,
            total_pesticide_l,
            total_pesticide_kg,
            surface_traitee_ha,
            surface_cumulee_ha,
            surface_restante_ha,
            pesticide_stock_restant_l,
        )
        return await self.get_by_id(traitement_id)

    async def add_produit(
        self,
        traitement_id: uuid.UUID,
        produit: ProduitUtilise,
        total_pesticide_l: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        self.session.add(
            ProduitUtiliseModel(
                id=produit.id,
                traitement_terrestre_id=traitement_id,
                numero=produit.numero,
                produit_id=produit.produit_id,
                quantite_l=produit.quantite_l,
                nom_commercial=produit.nom_commercial,
            )
        )
        await self._persister_total_pesticide(
            traitement_id, total_pesticide_l, pesticide_stock_restant_l
        )
        return await self.get_by_id(traitement_id)

    async def remove_produit(
        self,
        traitement_id: uuid.UUID,
        produit_utilise_id: uuid.UUID,
        total_pesticide_l: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> Traitement:
        produit_model = await self.session.get(ProduitUtiliseModel, produit_utilise_id)
        await self.session.delete(produit_model)

        await self._persister_total_pesticide(
            traitement_id, total_pesticide_l, pesticide_stock_restant_l
        )
        return await self.get_by_id(traitement_id)

    async def valider(
        self,
        traitement_id: uuid.UUID,
        date_validation: date,
        signatures: list[TraitementSignature],
    ) -> Traitement:
        model = await self.session.get(TraitementModel, traitement_id)
        model.date_validation = date_validation
        model.statut = "validee"
        for signature in signatures:
            self.session.add(
                TraitementSignatureModel(
                    id=signature.id,
                    traitement_id=traitement_id,
                    role=signature.role,
                    signataire_nom=signature.signataire_nom,
                    signature_image=signature.signature_image,
                    horodatage=signature.horodatage,
                )
            )
        await self.session.commit()
        self.session.expire(model, ["signatures"])
        return await self.get_by_id(traitement_id)

    async def update_sync(self, traitement: Traitement) -> Traitement:
        # `options=` explicite (même jeu que `get_by_id`) : `cible`/`aerien`/
        # `terrestre` n'ont pas de `lazy="selectin"` au niveau du mapping,
        # donc un `session.get()` nu laisse ces relations en lazy-load
        # `select` (synchrone) par défaut. Lu ci-dessous sans `await`
        # (`model.cible is not None`, etc.) : sans le chargement explicite,
        # cet accès ne tenait que par un effet de bord — la même identité
        # d'objet éventuellement déjà en cache dans la session depuis un
        # `get_by_id()` antérieur du même appelant (`existant`, cf.
        # traitement_use_cases.py) — jamais garanti par ce module lui-même,
        # et source de `sqlalchemy.exc.MissingGreenlet` dès que ce n'est pas
        # le cas.
        model = await self.session.get(
            TraitementModel,
            traitement.id,
            options=[
                selectinload(TraitementModel.cible),
                selectinload(TraitementModel.aerien),
                selectinload(TraitementModel.terrestre),
            ],
        )
        model.prospection_id = traitement.prospection_id
        model.numero_fiche = traitement.numero_fiche
        model.mode_traitement = traitement.mode_traitement
        model.date_traitement = traitement.date_traitement
        model.date_validation = traitement.date_validation
        model.localite = traitement.localite
        model.region = traitement.region
        model.district = traitement.district
        model.commune = traitement.commune
        model.latitude = traitement.latitude
        model.longitude = traitement.longitude
        model.altitude = traitement.altitude
        model.kit_combinaison = traitement.kit_combinaison
        model.kit_gants = traitement.kit_gants
        model.kit_lunettes = traitement.kit_lunettes
        model.kit_masques = traitement.kit_masques
        model.kit_botte = traitement.kit_botte
        model.zones_exposees = traitement.zones_exposees
        model.hauteur_strate_herbeuse_m = traitement.hauteur_strate_herbeuse_m
        model.hauteur_strate_arboree_m = traitement.hauteur_strate_arboree_m
        model.recouvrement_percent = traitement.recouvrement_percent
        model.empoisonnement = traitement.empoisonnement
        model.empoisonnement_type = traitement.empoisonnement_type
        model.empoisonnement_mode = traitement.empoisonnement_mode
        model.empoisonnement_autre = traitement.empoisonnement_autre
        model.evaluation_risque = traitement.evaluation_risque
        model.comportement_anormal = traitement.comportement_anormal
        model.comportement_non_cibles = traitement.comportement_non_cibles
        model.mortalite = traitement.mortalite
        model.mortalite_familles = traitement.mortalite_familles
        model.observations = traitement.observations
        model.statut_sync = "synced"
        model.updated_at = traitement.updated_at

        if traitement.cible is not None and model.cible is not None:
            model.cible.espece = traitement.cible.espece
            model.cible.petites_larves = traitement.cible.petites_larves
            model.cible.grandes_larves = traitement.cible.grandes_larves
            model.cible.vols_clairs_essaims = traitement.cible.vols_clairs_essaims
            model.cible.repartition_population = traitement.cible.repartition_population
            model.cible.surface_infestee_ha = traitement.cible.surface_infestee_ha

        if traitement.aerien is not None and model.aerien is not None:
            model.aerien.pilote = traitement.aerien.pilote
            model.aerien.mecanicien = traitement.aerien.mecanicien
            model.aerien.chef_de_base_id = traitement.aerien.chef_de_base_id
            model.aerien.consultant_international = traitement.aerien.consultant_international
            model.aerien.base_principale = traitement.aerien.base_principale
            model.aerien.stand = traitement.aerien.stand
            model.aerien.stand_date_installation = traitement.aerien.stand_date_installation
            model.aerien.base_secondaire = traitement.aerien.base_secondaire
            model.aerien.base_secondaire_date_installation = (
                traitement.aerien.base_secondaire_date_installation
            )
            model.aerien.immatricule_aeronef = traitement.aerien.immatricule_aeronef
            # nb_rotations/total_pesticide_l/total_pesticide_kg/surface_traitee_ha n'y
            # figurent pas : sous-ressource distincte (rotations), jamais écrasés par
            # cette synchronisation — même philosophie déjà en place pour les deux
            # premiers avant la migration 0047, désormais étendue aux deux derniers.
            model.aerien.surface_restante_ha = traitement.aerien.surface_restante_ha
            model.aerien.pesticide_recu_l = traitement.aerien.pesticide_recu_l
            model.aerien.pesticide_stock_restant_l = traitement.aerien.pesticide_stock_restant_l
            model.aerien.taux_mortalite_pourcent = traitement.aerien.taux_mortalite_pourcent
            model.aerien.evaluation_efficacite_heures_apres = (
                traitement.aerien.evaluation_efficacite_heures_apres
            )
            model.aerien.methode_evaluation_efficacite = (
                traitement.aerien.methode_evaluation_efficacite
            )

        if traitement.terrestre is not None and model.terrestre is not None:
            t, src = model.terrestre, traitement.terrestre
            t.heure_debut = src.heure_debut
            t.heure_fin = src.heure_fin
            t.vitesse_vent_ms = src.vitesse_vent_ms
            t.direction_vent = src.direction_vent
            t.temperature_c = src.temperature_c
            t.taux_mortalite_pourcent = src.taux_mortalite_pourcent
            t.evaluation_efficacite_heures_apres = src.evaluation_efficacite_heures_apres
            t.methode_evaluation_efficacite = src.methode_evaluation_efficacite
            t.reprise_traitement = src.reprise_traitement
            t.traitement_origine_id = src.traitement_origine_id
            t.chef_equipe_id = src.chef_equipe_id
            t.agent_encadreur = src.agent_encadreur
            t.consultant_international = src.consultant_international
            t.surface_atomiseur_ha = src.surface_atomiseur_ha
            t.surface_disque_rotatif_ha = src.surface_disque_rotatif_ha
            t.surface_atomiseur_autoporte_ha = src.surface_atomiseur_autoporte_ha
            t.surface_traitee_ha = src.surface_traitee_ha
            t.surface_cumulee_ha = src.surface_cumulee_ha
            t.surface_restante_ha = src.surface_restante_ha
            t.surface_restante_abandonnee = src.surface_restante_abandonnee
            t.motif_surface_restante_abandonnee = src.motif_surface_restante_abandonnee
            t.essence_litres = src.essence_litres
            t.nb_piles = src.nb_piles
            t.pesticide_recu_l = src.pesticide_recu_l
            t.pesticide_stock_restant_l = src.pesticide_stock_restant_l

        # Liste dynamique remplacée en bloc à chaque enregistrement (ajout/
        # modification/suppression indifférenciés côté client) — même
        # sémantique que `ProspectionModel.populations`, cf. commentaire sur
        # `EvaluationRisquePopulationModel`. Vidée puis flushée avant
        # réinsertion : sans ce flush intermédiaire, SQLAlchemy peut émettre
        # les INSERT de la nouvelle liste avant les DELETE des anciennes
        # lignes dans le même flush, violant la contrainte UNIQUE
        # (traitement_id, ordre) dès qu'un même `ordre` réapparaît (ex. 0/1
        # à chaque resynchronisation).
        model.evaluations_risque_population = []
        await self.session.flush()
        model.evaluations_risque_population = [
            EvaluationRisquePopulationModel(
                traitement_id=model.id,
                ordre=e.ordre,
                habitat_proche=e.habitat_proche,
                distance_km=e.distance_km,
                sensibilisation=e.sensibilisation,
            )
            for e in traitement.evaluations_risque_population
        ]

        try:
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            constraint_name = getattr(e.orig, "constraint_name", None) or getattr(
                e.orig.__cause__, "constraint_name", None
            )
            if constraint_name == "traitement_numero_fiche_key":
                raise NumeroFicheConflitError(
                    f"numero_fiche '{traitement.numero_fiche}' déjà utilisé"
                ) from e
            if constraint_name == "uq_traitement_terrestre_origine_id":
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement.terrestre.traitement_origine_id} est déjà "
                    "désignée comme origine par une autre fiche"
                ) from e
            if constraint_name == "uq_traitement_aerien_origine_id":
                raise TraitementOrigineDejaUtiliseeError(
                    f"La fiche {traitement.aerien.traitement_origine_id} est déjà "
                    "désignée comme origine par une autre fiche"
                ) from e
            raise
        return await self.get_by_id(traitement.id)

    async def marquer_conflict(self, traitement_id: uuid.UUID) -> Traitement:
        model = await self.session.get(TraitementModel, traitement_id)
        model.statut_sync = "conflict"
        await self.session.commit()
        return await self.get_by_id(traitement_id)

    async def _persister_total_pesticide(
        self,
        traitement_id: uuid.UUID,
        total_pesticide_l: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> None:
        terrestre_model = await self.session.get(TraitementTerrestreModel, traitement_id)
        terrestre_model.total_pesticide_l = total_pesticide_l
        terrestre_model.pesticide_stock_restant_l = pesticide_stock_restant_l
        await self.session.commit()
        self.session.expire(terrestre_model, ["produits"])

    async def _persister_totaux(
        self,
        traitement_id: uuid.UUID,
        nb_rotations: int,
        total_pesticide_l: float,
        total_pesticide_kg: float,
        surface_traitee_ha: float,
        surface_cumulee_ha: float,
        surface_restante_ha: float | None,
        pesticide_stock_restant_l: float | None,
    ) -> None:
        aerien_model = await self.session.get(TraitementAerienModel, traitement_id)
        aerien_model.nb_rotations = nb_rotations
        aerien_model.total_pesticide_l = total_pesticide_l
        aerien_model.total_pesticide_kg = total_pesticide_kg
        aerien_model.surface_traitee_ha = surface_traitee_ha
        # Chaînage de reprise (migration 0050) : surface_cumulee_ha suit le même
        # sort que surface_traitee_ha dont elle dérive — seul chemin d'écriture,
        # recalculée à chaque mutation de rotation.
        aerien_model.surface_cumulee_ha = surface_cumulee_ha
        aerien_model.surface_restante_ha = surface_restante_ha
        aerien_model.pesticide_stock_restant_l = pesticide_stock_restant_l
        await self.session.commit()
        self.session.expire(aerien_model, ["rotations"])

    def _to_domain(self, model: TraitementModel) -> Traitement:
        return Traitement(
            id=model.id,
            prospection_id=model.prospection_id,
            numero_fiche=model.numero_fiche,
            type_traitement=model.type_traitement,
            mode_traitement=model.mode_traitement,
            date_traitement=model.date_traitement,
            date_validation=model.date_validation,
            localite=model.localite,
            region=model.region,
            district=model.district,
            commune=model.commune,
            latitude=float(model.latitude) if model.latitude is not None else None,
            longitude=float(model.longitude) if model.longitude is not None else None,
            altitude=float(model.altitude) if model.altitude is not None else None,
            kit_combinaison=model.kit_combinaison,
            kit_gants=model.kit_gants,
            kit_lunettes=model.kit_lunettes,
            kit_masques=model.kit_masques,
            kit_botte=model.kit_botte,
            zones_exposees=model.zones_exposees,
            hauteur_strate_herbeuse_m=float(model.hauteur_strate_herbeuse_m)
            if model.hauteur_strate_herbeuse_m is not None
            else None,
            hauteur_strate_arboree_m=float(model.hauteur_strate_arboree_m)
            if model.hauteur_strate_arboree_m is not None
            else None,
            recouvrement_percent=model.recouvrement_percent,
            empoisonnement=model.empoisonnement,
            empoisonnement_type=model.empoisonnement_type,
            empoisonnement_mode=model.empoisonnement_mode,
            empoisonnement_autre=model.empoisonnement_autre,
            evaluation_risque=model.evaluation_risque,
            comportement_anormal=model.comportement_anormal,
            comportement_non_cibles=model.comportement_non_cibles,
            mortalite=model.mortalite,
            mortalite_familles=model.mortalite_familles,
            observations=model.observations,
            statut=model.statut,
            statut_sync=model.statut_sync,
            created_at=model.created_at,
            updated_at=model.updated_at,
            cible=Cible(
                traitement_id=model.cible.traitement_id,
                espece=model.cible.espece,
                petites_larves=model.cible.petites_larves,
                grandes_larves=model.cible.grandes_larves,
                vols_clairs_essaims=model.cible.vols_clairs_essaims,
                repartition_population=model.cible.repartition_population,
                surface_infestee_ha=float(model.cible.surface_infestee_ha)
                if model.cible.surface_infestee_ha is not None
                else None,
            )
            if model.cible is not None
            else None,
            aerien=TraitementAerien(
                traitement_id=model.aerien.traitement_id,
                pilote=model.aerien.pilote,
                mecanicien=model.aerien.mecanicien,
                chef_de_base_id=model.aerien.chef_de_base_id,
                consultant_international=model.aerien.consultant_international,
                base_principale=model.aerien.base_principale,
                stand=model.aerien.stand,
                stand_date_installation=model.aerien.stand_date_installation,
                base_secondaire=model.aerien.base_secondaire,
                base_secondaire_date_installation=(model.aerien.base_secondaire_date_installation),
                immatricule_aeronef=model.aerien.immatricule_aeronef,
                nb_rotations=model.aerien.nb_rotations,
                total_pesticide_l=float(model.aerien.total_pesticide_l),
                total_pesticide_kg=float(model.aerien.total_pesticide_kg),
                surface_traitee_ha=float(model.aerien.surface_traitee_ha),
                reprise_traitement=model.aerien.reprise_traitement,
                traitement_origine_id=model.aerien.traitement_origine_id,
                surface_cumulee_ha=float(model.aerien.surface_cumulee_ha),
                surface_restante_ha=float(model.aerien.surface_restante_ha)
                if model.aerien.surface_restante_ha is not None
                else None,
                pesticide_recu_l=float(model.aerien.pesticide_recu_l)
                if model.aerien.pesticide_recu_l is not None
                else None,
                pesticide_stock_restant_l=float(model.aerien.pesticide_stock_restant_l)
                if model.aerien.pesticide_stock_restant_l is not None
                else None,
                taux_mortalite_pourcent=float(model.aerien.taux_mortalite_pourcent)
                if model.aerien.taux_mortalite_pourcent is not None
                else None,
                evaluation_efficacite_heures_apres=(
                    float(model.aerien.evaluation_efficacite_heures_apres)
                    if model.aerien.evaluation_efficacite_heures_apres is not None
                    else None
                ),
                methode_evaluation_efficacite=model.aerien.methode_evaluation_efficacite,
                rotations=[
                    Rotation(
                        id=r.id,
                        traitement_aerien_id=r.traitement_aerien_id,
                        numero=r.numero,
                        numero_cuve=r.numero_cuve,
                        produit_id=r.produit_id,
                        quantite=float(r.quantite),
                        unite=r.unite,
                        surface_ha=float(r.surface_ha),
                        temperature_debut_c=float(r.temperature_debut_c),
                        temperature_fin_c=float(r.temperature_fin_c),
                        vent_debut_ms=float(r.vent_debut_ms),
                        vent_fin_ms=float(r.vent_fin_ms),
                        heure_debut=r.heure_debut,
                        heure_ouverture_vanne=r.heure_ouverture_vanne,
                        heure_fermeture_vanne=r.heure_fermeture_vanne,
                        heure_fin=r.heure_fin,
                        nom_commercial=r.nom_commercial,
                    )
                    for r in model.aerien.rotations
                ],
            )
            if model.aerien is not None
            else None,
            terrestre=TraitementTerrestre(
                traitement_id=model.terrestre.traitement_id,
                heure_debut=model.terrestre.heure_debut,
                heure_fin=model.terrestre.heure_fin,
                vitesse_vent_ms=float(model.terrestre.vitesse_vent_ms),
                direction_vent=model.terrestre.direction_vent,
                temperature_c=float(model.terrestre.temperature_c),
                reprise_traitement=model.terrestre.reprise_traitement,
                traitement_origine_id=model.terrestre.traitement_origine_id,
                chef_equipe_id=model.terrestre.chef_equipe_id,
                agent_encadreur=model.terrestre.agent_encadreur,
                consultant_international=model.terrestre.consultant_international,
                surface_atomiseur_ha=float(model.terrestre.surface_atomiseur_ha)
                if model.terrestre.surface_atomiseur_ha is not None
                else None,
                surface_disque_rotatif_ha=float(model.terrestre.surface_disque_rotatif_ha)
                if model.terrestre.surface_disque_rotatif_ha is not None
                else None,
                surface_atomiseur_autoporte_ha=float(model.terrestre.surface_atomiseur_autoporte_ha)
                if model.terrestre.surface_atomiseur_autoporte_ha is not None
                else None,
                surface_traitee_ha=float(model.terrestre.surface_traitee_ha)
                if model.terrestre.surface_traitee_ha is not None
                else None,
                surface_cumulee_ha=float(model.terrestre.surface_cumulee_ha)
                if model.terrestre.surface_cumulee_ha is not None
                else None,
                surface_restante_ha=float(model.terrestre.surface_restante_ha)
                if model.terrestre.surface_restante_ha is not None
                else None,
                surface_restante_abandonnee=model.terrestre.surface_restante_abandonnee,
                motif_surface_restante_abandonnee=(
                    model.terrestre.motif_surface_restante_abandonnee
                ),
                essence_litres=float(model.terrestre.essence_litres)
                if model.terrestre.essence_litres is not None
                else None,
                nb_piles=model.terrestre.nb_piles,
                total_pesticide_l=float(model.terrestre.total_pesticide_l)
                if model.terrestre.total_pesticide_l is not None
                else None,
                pesticide_recu_l=float(model.terrestre.pesticide_recu_l)
                if model.terrestre.pesticide_recu_l is not None
                else None,
                pesticide_stock_restant_l=float(model.terrestre.pesticide_stock_restant_l)
                if model.terrestre.pesticide_stock_restant_l is not None
                else None,
                taux_mortalite_pourcent=float(model.terrestre.taux_mortalite_pourcent)
                if model.terrestre.taux_mortalite_pourcent is not None
                else None,
                evaluation_efficacite_heures_apres=(
                    float(model.terrestre.evaluation_efficacite_heures_apres)
                    if model.terrestre.evaluation_efficacite_heures_apres is not None
                    else None
                ),
                methode_evaluation_efficacite=model.terrestre.methode_evaluation_efficacite,
                produits=[
                    ProduitUtilise(
                        id=p.id,
                        traitement_terrestre_id=p.traitement_terrestre_id,
                        numero=p.numero,
                        produit_id=p.produit_id,
                        quantite_l=float(p.quantite_l),
                        nom_commercial=p.nom_commercial,
                    )
                    for p in model.terrestre.produits
                ],
            )
            if model.terrestre is not None
            else None,
            signatures=[
                TraitementSignature(
                    id=s.id,
                    traitement_id=s.traitement_id,
                    role=s.role,
                    signataire_nom=s.signataire_nom,
                    signature_image=s.signature_image,
                    horodatage=s.horodatage,
                )
                for s in model.signatures
            ],
            evaluations_risque_population=[
                EvaluationRisquePopulation(
                    id=e.id,
                    traitement_id=e.traitement_id,
                    ordre=e.ordre,
                    habitat_proche=e.habitat_proche,
                    distance_km=e.distance_km,
                    sensibilisation=e.sensibilisation,
                )
                for e in model.evaluations_risque_population
            ],
        )
