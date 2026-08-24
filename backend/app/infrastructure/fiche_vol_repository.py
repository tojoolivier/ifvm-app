import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.fiche_vol import (
    FicheVol,
    FicheVolIntrouvableError,
    NumeroFicheVolConflitError,
    ProspectionVolIntrouvableError,
    RotationDejaRapprocheeError,
    RotationVolIntrouvableError,
    SignatureVol,
    Vol,
)
from app.infrastructure.fiche_vol_model import (
    FicheVolModel,
    FicheVolSignatureModel,
    VolModel,
)


def _to_domain(model: FicheVolModel) -> FicheVol:
    return FicheVol(
        id=model.id,
        numero_fiche=model.numero_fiche,
        date_vol=model.date_vol,
        compagnie=model.compagnie,
        immatriculation=model.immatriculation,
        base_code=model.base_code,
        base_nom=model.base_nom,
        base_latitude=float(model.base_latitude) if model.base_latitude is not None else None,
        base_longitude=float(model.base_longitude) if model.base_longitude is not None else None,
        base_altitude=float(model.base_altitude) if model.base_altitude is not None else None,
        stand_nom=model.stand_nom,
        stand_latitude=float(model.stand_latitude) if model.stand_latitude is not None else None,
        stand_longitude=(
            float(model.stand_longitude) if model.stand_longitude is not None else None
        ),
        stand_altitude=float(model.stand_altitude) if model.stand_altitude is not None else None,
        pilote=model.pilote,
        mecanicien=model.mecanicien,
        chef_de_base_id=model.chef_de_base_id,
        consultant_international=model.consultant_international,
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

    async def get_by_id(self, fiche_vol_id: uuid.UUID) -> FicheVol | None:
        model = await self._charger(fiche_vol_id)
        return _to_domain(model) if model else None

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
        return [_to_domain(m) for m in result.scalars().unique().all()]

    async def create(self, fiche: FicheVol) -> FicheVol:
        """Raises NumeroFicheVolConflitError si `numero` existe déjà — l'appelant réessaie
        avec un suffixe (cf. CreateFicheVol)."""
        model = FicheVolModel(
            id=fiche.id,
            numero_fiche=fiche.numero_fiche,
            date_vol=fiche.date_vol,
            compagnie=fiche.compagnie,
            immatriculation=fiche.immatriculation,
            base_code=fiche.base_code,
            base_nom=fiche.base_nom,
            base_latitude=fiche.base_latitude,
            base_longitude=fiche.base_longitude,
            base_altitude=fiche.base_altitude,
            stand_nom=fiche.stand_nom,
            stand_latitude=fiche.stand_latitude,
            stand_longitude=fiche.stand_longitude,
            stand_altitude=fiche.stand_altitude,
            pilote=fiche.pilote,
            mecanicien=fiche.mecanicien,
            chef_de_base_id=fiche.chef_de_base_id,
            consultant_international=fiche.consultant_international,
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
        return _to_domain(await self._exiger(model.id))

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
        return _to_domain(await self._exiger(fiche_vol_id))

    async def remove_vol(self, fiche_vol_id: uuid.UUID, vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.vols = [v for v in model.vols if v.id != vol_id]
        await self.session.commit()
        return _to_domain(await self._exiger(fiche_vol_id))

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
        return _to_domain(await self._exiger(fiche_vol_id))

    async def valider(self, fiche_vol_id: uuid.UUID) -> FicheVol:
        model = await self._exiger(fiche_vol_id)
        model.statut = "validee"
        await self.session.commit()
        return _to_domain(await self._exiger(fiche_vol_id))


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
    if "vol_prospection_id_fkey" in message:
        return ProspectionVolIntrouvableError("la prospection référencée n'existe pas")
    if "fiche_vol" in message and "numero_fiche" in message:
        return NumeroFicheVolConflitError(message)
    return exc
