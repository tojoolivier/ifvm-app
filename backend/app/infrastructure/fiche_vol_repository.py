import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.fiche_vol import (
    BaseVolIntrouvableError,
    CampagneVolIntrouvableError,
    FicheVol,
    FicheVolIntrouvableError,
    NumeroFicheVolConflitError,
    ProspectionVolIntrouvableError,
    RotationDejaRapprocheeError,
    RotationVolIntrouvableError,
    SignatureVol,
    StandVolIntrouvableError,
    Vol,
    VolBlocDetail,
)
from app.infrastructure.fiche_vol_model import (
    FicheVolModel,
    FicheVolSignatureModel,
    VolModel,
)
from app.infrastructure.referentiel_model import BaseAerienneModel
from app.infrastructure.traitement_model import (
    RotationModel,
    TraitementAerienModel,
    TraitementBlocModel,
    TraitementModel,
)


def _borner_a_zero(valeur: float) -> float:
    return valeur if valeur > 0 else 0.0


def _bloc_detail(rotation: RotationModel) -> VolBlocDetail | None:
    bloc = rotation.bloc
    if bloc is None:
        return None
    cible = bloc.aerien.traitement.cible if bloc.aerien.traitement is not None else None
    return VolBlocDetail(
        numero=bloc.numero,
        nom=bloc.nom,
        localite=bloc.localite,
        surface_theorique_ha=(
            float(bloc.surface_theorique_ha) if bloc.surface_theorique_ha is not None else None
        ),
        surface_protegee_ha=(
            float(bloc.surface_protegee_ha) if bloc.surface_protegee_ha is not None else None
        ),
        surface_traitee_ha=(
            float(bloc.surface_traitee_ha) if bloc.surface_traitee_ha is not None else None
        ),
        largeur_andain_m=(
            float(bloc.largeur_andain_m) if bloc.largeur_andain_m is not None else None
        ),
        interpasse_m=float(bloc.interpasse_m) if bloc.interpasse_m is not None else None,
        hauteur_vol_min_m=(
            float(bloc.hauteur_vol_min_m) if bloc.hauteur_vol_min_m is not None else None
        ),
        hauteur_vol_max_m=(
            float(bloc.hauteur_vol_max_m) if bloc.hauteur_vol_max_m is not None else None
        ),
        observation=bloc.observation,
        espece=cible.espece if cible is not None else None,
        vols_clairs_essaims=cible.vols_clairs_essaims if cible is not None else None,
    )


def _to_domain(
    model: FicheVolModel,
    pesticide_quantite_utilisee: float | None = None,
    rotations_detail: dict[uuid.UUID, RotationModel] | None = None,
) -> FicheVol:
    rotations_detail = rotations_detail or {}
    disponible = (
        float(model.pesticide_quantite_disponible)
        if model.pesticide_quantite_disponible is not None
        else None
    )
    restante = (
        _borner_a_zero(disponible - pesticide_quantite_utilisee)
        if disponible is not None and pesticide_quantite_utilisee is not None
        else None
    )
    return FicheVol(
        id=model.id,
        numero_fiche=model.numero_fiche,
        date_vol=model.date_vol,
        compagnie=model.compagnie,
        immatriculation=model.immatriculation,
        campagne_id=model.campagne_id,
        compteur=model.compteur,
        base_id=model.base_id,
        stand_id=model.stand_id,
        base_numero=model.base.numero,
        base_localite=model.base.localite,
        base_latitude=float(model.base.latitude) if model.base.latitude is not None else None,
        base_longitude=float(model.base.longitude) if model.base.longitude is not None else None,
        base_altitude=float(model.base.altitude) if model.base.altitude is not None else None,
        stand_numero=model.stand.numero,
        stand_localite=model.stand.localite,
        stand_latitude=float(model.stand.latitude) if model.stand.latitude is not None else None,
        stand_longitude=(
            float(model.stand.longitude) if model.stand.longitude is not None else None
        ),
        stand_altitude=float(model.stand.altitude) if model.stand.altitude is not None else None,
        pilote=model.pilote,
        mecanicien=model.mecanicien,
        chef_de_base_id=model.chef_de_base_id,
        prospection_id=model.prospection_id,
        prospection_numero_fiche=model.prospection.n_fiche if model.prospection else None,
        prospection_date_validation=(model.prospection.validated_at if model.prospection else None),
        consultant_international=model.consultant_international,
        pesticide_nom_commercial=model.pesticide_nom_commercial,
        pesticide_quantite_disponible=disponible,
        pesticide_quantite_recue=(
            float(model.pesticide_quantite_recue)
            if model.pesticide_quantite_recue is not None
            else None
        ),
        pesticide_quantite_utilisee=pesticide_quantite_utilisee,
        pesticide_quantite_restante=restante,
        futs_disponible=model.futs_disponible,
        futs_recues=model.futs_recues,
        futs_pleins=model.futs_pleins,
        futs_vides=model.futs_vides,
        observations=model.observations,
        statut=model.statut,
        statut_sync=model.statut_sync,
        created_at=model.created_at,
        updated_at=model.updated_at,
        vols=[
            Vol(
                id=v.id,
                fiche_vol_id=v.fiche_vol_id,
                numero=v.numero,
                type_vol=v.type_vol,
                heure_debut=v.heure_debut,
                heure_fin=v.heure_fin,
                rotation_id=v.rotation_id,
                prospection_id=v.prospection_id,
                observations=v.observations,
                numero_cuve=(
                    rotations_detail[v.rotation_id].numero_cuve
                    if v.rotation_id in rotations_detail
                    else None
                ),
                produit_nom=(
                    rotations_detail[v.rotation_id].nom_commercial
                    if v.rotation_id in rotations_detail
                    else None
                ),
                bloc=(
                    _bloc_detail(rotations_detail[v.rotation_id])
                    if v.rotation_id in rotations_detail
                    else None
                ),
            )
            for v in sorted(model.vols, key=lambda v: v.numero)
        ],
        signatures=[
            SignatureVol(
                id=s.id,
                role=s.role,
                signataire_nom=s.signataire_nom,
                signature_image=s.signature_image,
                horodatage=s.horodatage,
            )
            for s in model.signatures
        ],
    )


class FicheVolRepositoryImpl:
    """Accès Postgres aux fiches de vol.

    Rien de dérivé n'est persisté : durées et cumuls sont recalculés par le domaine à
    chaque lecture (cf. app/domain/fiche_vol.py).
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    _CHARGEMENT = (
        selectinload(FicheVolModel.vols),
        selectinload(FicheVolModel.signatures),
        selectinload(FicheVolModel.base),
        selectinload(FicheVolModel.stand),
        selectinload(FicheVolModel.prospection),
    )

    async def _charger(self, fiche_vol_id: uuid.UUID) -> FicheVolModel | None:
        result = await self.session.execute(
            select(FicheVolModel).options(*self._CHARGEMENT).where(FicheVolModel.id == fiche_vol_id)
        )
        return result.scalar_one_or_none()

    async def _exiger(self, fiche_vol_id: uuid.UUID) -> FicheVolModel:
        model = await self._charger(fiche_vol_id)
        if model is None:
            raise FicheVolIntrouvableError(str(fiche_vol_id))
        return model

    async def _domaine(self, fiche_vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        return _to_domain(
            model, await self._pesticide_utilisee(model), await self._rotations_detail(model)
        )

    async def _rotations_detail(self, model: FicheVolModel) -> dict[uuid.UUID, RotationModel]:
        """Rotation → Bloc → Cible pour chaque vol rattaché, pour la vue imprimable A4
        (#fiche-vol-impression). Requête séparée plutôt qu'une relation ORM sur
        `VolModel` : même patron que `_pesticide_utilisee` ci-dessus, un vol n'a besoin
        de naviguer vers sa rotation qu'en lecture, jamais en écriture.
        """
        rotation_ids = {v.rotation_id for v in model.vols if v.rotation_id is not None}
        if not rotation_ids:
            return {}
        result = await self.session.execute(
            select(RotationModel)
            .options(
                selectinload(RotationModel.bloc)
                .selectinload(TraitementBlocModel.aerien)
                .selectinload(TraitementAerienModel.traitement)
                .selectinload(TraitementModel.cible)
            )
            .where(RotationModel.id.in_(rotation_ids))
        )
        return {r.id: r for r in result.scalars().all()}

    async def _pesticide_utilisee(self, model: FicheVolModel) -> float | None:
        """Somme des rotations couvertes par les vols de la fiche (déduplique les
        rotations : un MEP et une APPLICATION du même vol.rotation_id ne comptent
        qu'une fois). None si aucun vol n'est rattaché à une rotation.

        Mélange d'unités (L/kg) non arbitré ici — même simplification que
        `Prospection.pesticide_*`, qui n'a pas non plus de colonne d'unité.
        """
        rotation_ids = {v.rotation_id for v in model.vols if v.rotation_id is not None}
        if not rotation_ids:
            return None
        result = await self.session.execute(
            select(func.sum(RotationModel.quantite)).where(RotationModel.id.in_(rotation_ids))
        )
        total = result.scalar_one_or_none()
        return float(total) if total is not None else None

    async def get_by_id(self, fiche_vol_id: uuid.UUID) -> FicheVol | None:
        model = await self._charger(fiche_vol_id)
        if model is None:
            return None
        return _to_domain(
            model, await self._pesticide_utilisee(model), await self._rotations_detail(model)
        )

    async def list_by_filters(
        self,
        date_vol: date | None = None,
        immatriculation: str | None = None,
        chef_de_base_id: uuid.UUID | None = None,
    ) -> list[FicheVol]:
        query = select(FicheVolModel).options(*self._CHARGEMENT)
        if date_vol is not None:
            query = query.where(FicheVolModel.date_vol == date_vol)
        if immatriculation is not None:
            query = query.where(FicheVolModel.immatriculation == immatriculation)
        if chef_de_base_id is not None:
            query = query.where(FicheVolModel.chef_de_base_id == chef_de_base_id)
        result = await self.session.execute(query.order_by(FicheVolModel.date_vol.desc()))
        modeles = result.scalars().unique().all()
        return [_to_domain(m, await self._pesticide_utilisee(m)) for m in modeles]

    async def get_base_numero(self, base_id: uuid.UUID) -> str:
        """Résout `base_aerienne.numero` — c'est le fragment "équipe" du numéro de
        fiche (composer_numero_fiche), avant même que la fiche existe en base."""
        result = await self.session.execute(
            select(BaseAerienneModel.numero).where(BaseAerienneModel.id == base_id)
        )
        numero = result.scalar_one_or_none()
        if numero is None:
            raise BaseVolIntrouvableError(str(base_id))
        return numero

    async def next_compteur(self, campagne_id: uuid.UUID) -> int:
        """Incrément atomique de `campagne_fiche_vol_compteur` (upsert en une requête) :
        deux fiches créées en même temps, y compris depuis deux sessions différentes,
        n'obtiennent jamais le même compteur — c'est Postgres qui arbitre, pas une
        lecture puis une écriture séparées. N'effectue pas de COMMIT : fait partie de
        la même transaction que l'insertion de la fiche (cf. create), pour qu'un échec
        de l'insertion annule aussi l'incrément et ne laisse pas de trou évitable dans
        la numérotation.
        """
        result = await self.session.execute(
            text(
                "INSERT INTO campagne_fiche_vol_compteur (campagne_id, dernier_compteur) "
                "VALUES (:campagne_id, 1) "
                "ON CONFLICT (campagne_id) DO UPDATE "
                "SET dernier_compteur = campagne_fiche_vol_compteur.dernier_compteur + 1 "
                "RETURNING dernier_compteur"
            ),
            {"campagne_id": campagne_id},
        )
        return result.scalar_one()

    async def create(self, fiche: FicheVol) -> FicheVol:
        """`fiche.compteur`/`fiche.numero_fiche` doivent déjà être posés par l'appelant
        (cf. CreateFicheVol.execute, qui enchaîne next_compteur puis
        composer_numero_fiche dans la même transaction)."""
        model = FicheVolModel(
            id=fiche.id,
            numero_fiche=fiche.numero_fiche,
            date_vol=fiche.date_vol,
            compagnie=fiche.compagnie,
            immatriculation=fiche.immatriculation,
            campagne_id=fiche.campagne_id,
            compteur=fiche.compteur,
            base_id=fiche.base_id,
            stand_id=fiche.stand_id,
            pilote=fiche.pilote,
            mecanicien=fiche.mecanicien,
            chef_de_base_id=fiche.chef_de_base_id,
            prospection_id=fiche.prospection_id,
            consultant_international=fiche.consultant_international,
            pesticide_nom_commercial=fiche.pesticide_nom_commercial,
            pesticide_quantite_disponible=fiche.pesticide_quantite_disponible,
            pesticide_quantite_recue=fiche.pesticide_quantite_recue,
            futs_disponible=fiche.futs_disponible,
            futs_recues=fiche.futs_recues,
            futs_pleins=fiche.futs_pleins,
            futs_vides=fiche.futs_vides,
            observations=fiche.observations,
            statut=fiche.statut,
            statut_sync=fiche.statut_sync,
        )
        model.vols = [
            VolModel(
                id=v.id,
                numero=v.numero,
                type_vol=v.type_vol,
                heure_debut=v.heure_debut,
                heure_fin=v.heure_fin,
                rotation_id=v.rotation_id,
                prospection_id=v.prospection_id,
                observations=v.observations,
            )
            for v in fiche.vols
        ]
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite(exc) from exc
        return await self._domaine(model.id)

    async def add_vol(self, fiche_vol_id: uuid.UUID, vol: Vol) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.vols.append(
            VolModel(
                id=vol.id,
                numero=vol.numero,
                type_vol=vol.type_vol,
                heure_debut=vol.heure_debut,
                heure_fin=vol.heure_fin,
                rotation_id=vol.rotation_id,
                prospection_id=vol.prospection_id,
                observations=vol.observations,
            )
        )
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite(exc) from exc
        return await self._domaine(fiche_vol_id)

    async def remove_vol(self, fiche_vol_id: uuid.UUID, vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.vols = [v for v in model.vols if v.id != vol_id]
        await self.session.commit()
        return await self._domaine(fiche_vol_id)

    async def upsert_signature(self, fiche_vol_id: uuid.UUID, signature: SignatureVol) -> FicheVol:
        """Une signature est remplaçable tant que la fiche est brouillon : le verrouillage
        est la responsabilité du cas d'usage, pas du dépôt."""
        model = await self._exiger(fiche_vol_id)
        existante = next((s for s in model.signatures if s.role == signature.role), None)
        if existante is not None:
            existante.signataire_nom = signature.signataire_nom
            existante.signature_image = signature.signature_image
            # Resigner, c'est réattester : l'horodatage suit le tracé. Le figer à la
            # première signature ferait mentir la pièce justificative.
            existante.horodatage = datetime.now(UTC)
        else:
            model.signatures.append(
                FicheVolSignatureModel(
                    id=signature.id,
                    role=signature.role,
                    signataire_nom=signature.signataire_nom,
                    signature_image=signature.signature_image,
                )
            )
        await self.session.commit()
        return await self._domaine(fiche_vol_id)

    async def valider(self, fiche_vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.statut = "validee"
        await self.session.commit()
        return await self._domaine(fiche_vol_id)

    async def update_sync(self, fiche: FicheVol) -> FicheVol:
        """Point d'entrée hors-ligne (#fiche-vol-sync-hors-ligne) — suppose que la
        fiche existe déjà (branche création : cf. `create`, appelé directement par
        `SyncPushFicheVol.execute`). `fiche.numero_fiche`/`compteur`/`created_at`
        doivent déjà être repris de l'existant par l'appelant : cette méthode ne les
        touche jamais.

        `model` provient de `self._exiger` (via `_charger`, qui précharge vols/
        signatures/base/stand) : contrairement à `session.get()` nu, aucun risque de
        `MissingGreenlet` sur un accès synchrone à une relation non chargée (cf.
        historique de ce bug sur `TraitementRepositoryImpl.update_sync`).
        """
        model = await self._exiger(fiche.id)
        model.date_vol = fiche.date_vol
        model.compagnie = fiche.compagnie
        model.immatriculation = fiche.immatriculation
        model.campagne_id = fiche.campagne_id
        model.base_id = fiche.base_id
        model.stand_id = fiche.stand_id
        model.pilote = fiche.pilote
        model.mecanicien = fiche.mecanicien
        model.chef_de_base_id = fiche.chef_de_base_id
        model.prospection_id = fiche.prospection_id
        model.consultant_international = fiche.consultant_international
        model.pesticide_nom_commercial = fiche.pesticide_nom_commercial
        model.pesticide_quantite_disponible = fiche.pesticide_quantite_disponible
        model.pesticide_quantite_recue = fiche.pesticide_quantite_recue
        model.futs_disponible = fiche.futs_disponible
        model.futs_recues = fiche.futs_recues
        model.futs_pleins = fiche.futs_pleins
        model.futs_vides = fiche.futs_vides
        model.observations = fiche.observations
        model.statut_sync = "synced"
        # Pas d'`onupdate` côté mapping (fiche_vol_model.py) : sans cette écriture
        # explicite, `updated_at` resterait figé à sa valeur de création et la
        # détection de conflit (`existant.updated_at > base_updated_at`) ne pourrait
        # plus jamais se déclencher après le premier renvoi.
        model.updated_at = fiche.updated_at

        # vols : remplacés en bloc plutôt que diffés (même patron que
        # evaluations_risque_population côté traitement) — un flush intermédiaire est
        # nécessaire : sans lui, SQLAlchemy peut émettre les INSERT de la nouvelle
        # liste avant les DELETE de l'ancienne dans le même flush, violant
        # `uq_vol_numero`/`uq_vol_rotation_type` dès qu'un même numero/rotation
        # réapparaît (cas courant : la fiche du jour se resynchronise à l'identique).
        model.vols = []
        await self.session.flush()
        model.vols = [
            VolModel(
                id=v.id,
                numero=v.numero,
                type_vol=v.type_vol,
                heure_debut=v.heure_debut,
                heure_fin=v.heure_fin,
                rotation_id=v.rotation_id,
                prospection_id=v.prospection_id,
                observations=v.observations,
            )
            for v in fiche.vols
        ]
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite(exc) from exc
        return await self._domaine(fiche.id)

    async def marquer_conflict(self, fiche_vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.statut_sync = "conflict"
        await self.session.commit()
        return await self._domaine(fiche_vol_id)


def _traduire_integrite(exc: IntegrityError) -> Exception:
    """Traduit une violation de contrainte en erreur de domaine.

    Sans cette traduction, un `rotation_id` inventé — le cas courant d'une tablette qui
    synchronise en retard une rotation supprimée entre-temps — remonterait en 500 au lieu
    du 404 qu'il est réellement.
    """
    message = str(exc.orig)
    if "uq_vol_rotation_type" in message:
        return RotationDejaRapprocheeError(
            "cette rotation a déjà un vol de ce type : une rotation vaut une mise en "
            "place et une application"
        )
    if "vol_rotation_id_fkey" in message:
        return RotationVolIntrouvableError("la rotation référencée n'existe pas")
    if "vol_prospection_id_fkey" in message or "fk_fiche_vol_prospection_id" in message:
        return ProspectionVolIntrouvableError("la prospection référencée n'existe pas")
    if "fk_fiche_vol_base_id" in message:
        return BaseVolIntrouvableError("la base référencée n'existe pas")
    if "fk_fiche_vol_stand_id" in message:
        return StandVolIntrouvableError("le stand référencé n'existe pas")
    if "fk_fiche_vol_campagne_id" in message:
        return CampagneVolIntrouvableError("la campagne référencée n'existe pas")
    if "uq_fiche_vol_campagne_compteur" in message:
        # Ne devrait jamais se produire : next_compteur alloue de façon atomique. Un
        # conflit ici signalerait un bug (compteur réutilisé), pas une course normale.
        return NumeroFicheVolConflitError(message)
    if "fiche_vol" in message and "numero_fiche" in message:
        return NumeroFicheVolConflitError(message)
    return exc
