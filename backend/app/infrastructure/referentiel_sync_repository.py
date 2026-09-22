import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.referentiel import (
    Aeronef,
    AeronefDejaAffecteError,
    BaseAerienne,
    BaseAerienneEquipeInvalideError,
    ChefDejaDansUneAutreEquipeError,
    CodeStade,
    Culture,
    Equipe,
    EquipeADejaUnChefError,
    EquipeAerienneDejaAssigneeError,
    EquipeAerienneIntrouvableError,
    ImmatriculationAeronefDejaPriseError,
    LieuAerien,
    MembreDejaDansEquipeError,
    MembreEquipe,
    NumeroBaseAerienneDejaPrisError,
    NumeroStandRemplissageDejaPrisError,
    Pesticide,
    StandRemplissage,
    UtilisateurEquipe,
)
from app.domain.repositories import (
    AeronefRepository,
    BaseAerienneRepository,
    CodeStadeRepository,
    CultureRepository,
    EquipeRepository,
    LieuAerienRepository,
    PesticideRepository,
    StandRemplissageRepository,
    UtilisateurEquipeRepository,
)
from app.infrastructure.referentiel_model import (
    AeronefModel,
    BaseAerienneModel,
    CodeStadeModel,
    CultureModel,
    EquipeMembreModel,
    EquipeModel,
    LieuAerienModel,
    PesticideModel,
    StadeModel,
    StandRemplissageModel,
)
from app.models.users import Utilisateur


def _contrainte_violee(exc: IntegrityError) -> str | None:
    """Nom de la contrainte violée — même mécanique que
    `prospection_repository._contrainte_violee`/`routers.users._contrainte_violee` :
    `exc.orig` est l'erreur asyncpg, qui porte `constraint_name` un cran plus bas."""
    erreur: BaseException | None = getattr(exc, "orig", None)
    while erreur is not None:
        nom = getattr(erreur, "constraint_name", None)
        if nom:
            return str(nom)
        erreur = erreur.__cause__
    return None


class UtilisateurEquipeRepositoryImpl(UtilisateurEquipeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_since(self, since: datetime | None) -> list[UtilisateurEquipe]:
        stmt = select(Utilisateur).order_by(Utilisateur.nom)
        if since is not None:
            stmt = stmt.where(Utilisateur.updated_at > since)
        result = await self.session.execute(stmt)
        return [
            UtilisateurEquipe(
                id=m.id,
                nom=m.nom,
                prenom=m.prenom,
                role=m.role,
                pa_id=m.pa_id,
                actif=m.actif,
                updated_at=m.updated_at,
            )
            for m in result.scalars().all()
        ]


class PesticideRepositoryImpl(PesticideRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_since(self, since: datetime | None) -> list[Pesticide]:
        stmt = select(PesticideModel).order_by(PesticideModel.code)
        if since is not None:
            stmt = stmt.where(PesticideModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[Pesticide]:
        stmt = select(PesticideModel).order_by(PesticideModel.code)
        if actif is not None:
            stmt = stmt.where(PesticideModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(PesticideModel.id).where(PesticideModel.code == code)
        if exclude_id is not None:
            stmt = stmt.where(PesticideModel.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.first() is not None

    async def get_by_id(self, pesticide_id: uuid.UUID) -> Pesticide | None:
        result = await self.session.execute(
            select(PesticideModel).where(PesticideModel.id == pesticide_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, pesticide: Pesticide) -> Pesticide:
        model = PesticideModel(
            id=pesticide.id,
            code=pesticide.code,
            nom=pesticide.nom,
            matiere_active=pesticide.matiere_active,
            dose_reference=pesticide.dose_reference,
            type_produit=pesticide.type_produit,
            actif=pesticide.actif,
            created_at=pesticide.created_at,
            updated_at=pesticide.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def update(self, pesticide: Pesticide) -> Pesticide:
        result = await self.session.execute(
            select(PesticideModel).where(PesticideModel.id == pesticide.id)
        )
        model = result.scalar_one()
        model.code = pesticide.code
        model.nom = pesticide.nom
        model.matiere_active = pesticide.matiere_active
        model.dose_reference = pesticide.dose_reference
        model.type_produit = pesticide.type_produit
        model.actif = pesticide.actif
        model.updated_at = pesticide.updated_at
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    def _to_domain(self, model: PesticideModel) -> Pesticide:
        return Pesticide(
            id=model.id,
            code=model.code,
            nom=model.nom,
            matiere_active=model.matiere_active,
            dose_reference=model.dose_reference,
            type_produit=model.type_produit,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class CultureRepositoryImpl(CultureRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_since(self, since: datetime | None) -> list[Culture]:
        stmt = select(CultureModel).order_by(CultureModel.code)
        if since is not None:
            stmt = stmt.where(CultureModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[Culture]:
        stmt = select(CultureModel).order_by(CultureModel.code)
        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(CultureModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def code_pris_par_un_autre(self, code: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(CultureModel.id).where(CultureModel.code == code)
        if exclude_id is not None:
            stmt = stmt.where(CultureModel.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.first() is not None

    async def get_by_id(self, culture_id: uuid.UUID) -> Culture | None:
        result = await self.session.execute(
            select(CultureModel).where(CultureModel.id == culture_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, culture: Culture) -> Culture:
        model = CultureModel(
            id=culture.id,
            code=culture.code,
            nom=culture.nom,
            actif=culture.actif,
            created_at=culture.created_at,
            updated_at=culture.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def update(self, culture: Culture) -> Culture:
        result = await self.session.execute(
            select(CultureModel).where(CultureModel.id == culture.id)
        )
        model = result.scalar_one()
        model.code = culture.code
        model.nom = culture.nom
        model.actif = culture.actif
        model.updated_at = culture.updated_at
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    def _to_domain(self, model: CultureModel) -> Culture:
        return Culture(
            id=model.id,
            code=model.code,
            nom=model.nom,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class LieuAerienRepositoryImpl(LieuAerienRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _select_with_equipe(self):
        return select(
            LieuAerienModel,
            EquipeModel.nom.label("equipe_aerienne_nom"),
        ).outerjoin(
            # LEFT JOIN : equipe_aerienne_id est nullable, un lieu sans équipe
            # rattachée reste listable (cf. migration 0074).
            EquipeModel,
            LieuAerienModel.equipe_aerienne_id == EquipeModel.id,
        )

    def _to_domain(self, row) -> LieuAerien:
        model = row[0]
        return LieuAerien(
            id=model.id,
            type_lieu=model.type_lieu,
            nom=model.nom,
            latitude=float(model.latitude),
            longitude=float(model.longitude),
            altitude=float(model.altitude) if model.altitude is not None else None,
            actif=model.actif,
            equipe_aerienne_id=model.equipe_aerienne_id,
            equipe_aerienne_nom=row.equipe_aerienne_nom,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_since(self, since: datetime | None) -> list[LieuAerien]:
        stmt = self._select_with_equipe().order_by(LieuAerienModel.nom)
        if since is not None:
            stmt = stmt.where(LieuAerienModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(row) for row in result.all()]

    async def list_all(
        self, type_lieu: str | None = None, actif: bool | None = True
    ) -> list[LieuAerien]:
        stmt = self._select_with_equipe().order_by(LieuAerienModel.nom)
        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(LieuAerienModel.actif == actif)
        if type_lieu is not None:
            stmt = stmt.where(LieuAerienModel.type_lieu == type_lieu)
        result = await self.session.execute(stmt)
        return [self._to_domain(row) for row in result.all()]

    async def get_by_id(self, lieu_id: uuid.UUID) -> LieuAerien | None:
        result = await self.session.execute(
            self._select_with_equipe().where(LieuAerienModel.id == lieu_id)
        )
        row = result.first()
        return None if row is None else self._to_domain(row)

    async def create(self, lieu: LieuAerien) -> LieuAerien:
        model = LieuAerienModel(
            id=lieu.id,
            type_lieu=lieu.type_lieu,
            nom=lieu.nom,
            latitude=lieu.latitude,
            longitude=lieu.longitude,
            altitude=lieu.altitude,
            actif=lieu.actif,
            equipe_aerienne_id=lieu.equipe_aerienne_id,
            created_at=lieu.created_at,
            updated_at=lieu.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        return await self._relire(model.id)

    async def update(self, lieu: LieuAerien) -> LieuAerien:
        result = await self.session.execute(
            select(LieuAerienModel).where(LieuAerienModel.id == lieu.id)
        )
        model = result.scalar_one()
        model.type_lieu = lieu.type_lieu
        model.nom = lieu.nom
        model.latitude = lieu.latitude
        model.longitude = lieu.longitude
        model.altitude = lieu.altitude
        model.actif = lieu.actif
        model.equipe_aerienne_id = lieu.equipe_aerienne_id
        model.updated_at = lieu.updated_at
        await self.session.commit()
        return await self._relire(model.id)

    async def _relire(self, lieu_id: uuid.UUID) -> LieuAerien:
        """Une écriture ne renvoie jamais l'entité écrite telle quelle :
        `equipe_aerienne_nom` est une jointure, absente du modèle ORM."""
        lieu = await self.get_by_id(lieu_id)
        if lieu is None:  # pragma: no cover — on vient de l'écrire dans cette session
            raise RuntimeError(f"Lieu aérien {lieu_id} introuvable juste après écriture")
        return lieu


class BaseAerienneRepositoryImpl(BaseAerienneRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: BaseAerienneModel) -> BaseAerienne:
        return BaseAerienne(
            id=model.id,
            parent_base_id=model.parent_base_id,
            equipe_id=model.equipe_id,
            numero=model.numero,
            localite=model.localite,
            longitude=float(model.longitude) if model.longitude is not None else None,
            latitude=float(model.latitude) if model.latitude is not None else None,
            altitude=float(model.altitude) if model.altitude is not None else None,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_since(self, since: datetime | None) -> list[BaseAerienne]:
        stmt = select(BaseAerienneModel).order_by(BaseAerienneModel.numero)
        if since is not None:
            stmt = stmt.where(BaseAerienneModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[BaseAerienne]:
        stmt = select(BaseAerienneModel).order_by(BaseAerienneModel.numero)
        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(BaseAerienneModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, base_id: uuid.UUID) -> BaseAerienne | None:
        result = await self.session.execute(
            select(BaseAerienneModel).where(BaseAerienneModel.id == base_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, base: BaseAerienne) -> BaseAerienne:
        model = BaseAerienneModel(
            id=base.id,
            parent_base_id=base.parent_base_id,
            equipe_id=base.equipe_id,
            numero=base.numero,
            localite=base.localite,
            longitude=base.longitude,
            latitude=base.latitude,
            altitude=base.altitude,
            actif=base.actif,
            created_at=base.created_at,
            updated_at=base.updated_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, base) from exc
        await self.session.refresh(model)
        return self._to_domain(model)

    def _traduire_integrite(self, exc: IntegrityError, base: BaseAerienne) -> Exception:
        """Traduit l'IntegrityError en erreur domaine actionnable — sans ça, une
        équipe déjà assignée ou inexistante remontait comme un doublon de `numero`
        (message trompeur pour l'agent qui remplit le formulaire)."""
        contrainte = _contrainte_violee(exc)
        if contrainte == "ck_base_aerienne_equipe_coherente":
            return BaseAerienneEquipeInvalideError(str(base.equipe_id))
        if contrainte == "uq_base_aerienne_equipe_id":
            return EquipeAerienneDejaAssigneeError(str(base.equipe_id))
        if contrainte == "fk_base_aerienne_equipe_id":
            return EquipeAerienneIntrouvableError(str(base.equipe_id))
        return NumeroBaseAerienneDejaPrisError(base.numero)

    async def update(self, base: BaseAerienne) -> BaseAerienne:
        result = await self.session.execute(
            select(BaseAerienneModel).where(BaseAerienneModel.id == base.id)
        )
        model = result.scalar_one()
        model.parent_base_id = base.parent_base_id
        model.equipe_id = base.equipe_id
        model.numero = base.numero
        model.localite = base.localite
        model.longitude = base.longitude
        model.latitude = base.latitude
        model.altitude = base.altitude
        model.actif = base.actif
        model.updated_at = base.updated_at
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, base) from exc
        await self.session.refresh(model)
        return self._to_domain(model)


class EquipeRepositoryImpl(EquipeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    _CHARGEMENT = (
        selectinload(EquipeModel.membres).joinedload(EquipeMembreModel.utilisateur),
        selectinload(EquipeModel.aeronef),
    )

    def _to_domain(self, model: EquipeModel) -> Equipe:
        return Equipe(
            id=model.id,
            nom=model.nom,
            type=model.type,
            aeronef_id=model.aeronef_id,
            aeronef=_aeronef_to_domain(model.aeronef) if model.aeronef is not None else None,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
            membres=[_membre_to_domain(m) for m in model.membres],
        )

    async def list_all(
        self, actif: bool | None = True, type_equipe: str | None = None
    ) -> list[Equipe]:
        stmt = (
            select(EquipeModel)
            .options(*self._CHARGEMENT)
            .order_by(EquipeModel.nom)
            .execution_options(populate_existing=True)
        )
        if actif is not None:
            stmt = stmt.where(EquipeModel.actif == actif)
        if type_equipe is not None:
            stmt = stmt.where(EquipeModel.type == type_equipe)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().unique().all()]

    async def get_by_id(self, equipe_id: uuid.UUID) -> Equipe | None:
        # `populate_existing` : sans lui, une équipe déjà chargée dans la session garde
        # sa collection `membres` telle quelle — un membre ajouté juste avant resterait
        # invisible à la relecture.
        result = await self.session.execute(
            select(EquipeModel)
            .options(*self._CHARGEMENT)
            .where(EquipeModel.id == equipe_id)
            .execution_options(populate_existing=True)
        )
        model = result.unique().scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def get_by_chef_id(self, user_id: uuid.UUID) -> Equipe | None:
        result = await self.session.execute(
            select(EquipeModel)
            .options(*self._CHARGEMENT)
            .join(EquipeMembreModel, EquipeMembreModel.equipe_id == EquipeModel.id)
            .where(EquipeMembreModel.user_id == user_id, EquipeMembreModel.fonction == "chef")
        )
        model = result.unique().scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, equipe: Equipe) -> Equipe:
        aeronef = equipe.aeronef
        model = EquipeModel(
            id=equipe.id,
            nom=equipe.nom,
            type=equipe.type,
            aeronef_id=aeronef.id if aeronef is not None else equipe.aeronef_id,
            actif=equipe.actif,
            created_at=equipe.created_at,
            updated_at=equipe.updated_at,
            membres=[
                EquipeMembreModel(user_id=m.user_id, fonction=m.fonction, created_at=m.created_at)
                for m in equipe.membres
            ],
        )
        if aeronef is not None:
            # Même transaction que l'équipe : un échec (immatriculation déjà prise,
            # chef déjà affecté) n'écrit ni l'un ni l'autre — jamais d'aéronef orphelin.
            model.aeronef = AeronefModel(
                id=aeronef.id,
                immatriculation=aeronef.immatriculation,
                societe=aeronef.societe,
                volume_cuve_l=aeronef.volume_cuve_l,
                actif=aeronef.actif,
                created_at=aeronef.created_at,
                updated_at=aeronef.updated_at,
            )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite_equipe(exc, aeronef) from exc
        await self.session.refresh(model, attribute_names=["membres", "aeronef"])
        return await self.get_by_id(model.id)

    async def update(self, equipe: Equipe) -> Equipe:
        result = await self.session.execute(select(EquipeModel).where(EquipeModel.id == equipe.id))
        model = result.scalar_one()
        # `type` n'est délibérément pas réécrit : il n'existe pas dans `EquipeUpdate`.
        model.nom = equipe.nom
        model.actif = equipe.actif
        model.updated_at = equipe.updated_at
        await self.session.commit()
        return await self.get_by_id(equipe.id)

    async def ajouter_membre(self, membre: MembreEquipe) -> MembreEquipe:
        model = EquipeMembreModel(
            equipe_id=membre.equipe_id,
            user_id=membre.user_id,
            fonction=membre.fonction,
            created_at=membre.created_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite_equipe(exc, None) from exc
        await self.session.refresh(model)
        utilisateur = await self.session.get(Utilisateur, membre.user_id)
        return MembreEquipe(
            equipe_id=model.equipe_id,
            user_id=model.user_id,
            fonction=model.fonction,
            nom=utilisateur.nom if utilisateur is not None else None,
            prenom=utilisateur.prenom if utilisateur is not None else None,
            created_at=model.created_at,
        )


def _membre_to_domain(model: EquipeMembreModel) -> MembreEquipe:
    return MembreEquipe(
        equipe_id=model.equipe_id,
        user_id=model.user_id,
        fonction=model.fonction,
        nom=model.utilisateur.nom if model.utilisateur is not None else None,
        prenom=model.utilisateur.prenom if model.utilisateur is not None else None,
        created_at=model.created_at,
    )


def _traduire_integrite_equipe(exc: IntegrityError, aeronef: Aeronef | None) -> Exception:
    """Traduit une violation d'intégrité en erreur métier, par *nom de contrainte*.

    Les noms lus ici sont ceux de la migration 0082 et des `__table_args__` : un
    renommage des deux côtés est obligatoire, sans quoi toute violation retomberait
    silencieusement sur l'erreur générique."""
    contrainte = _contrainte_violee(exc)
    if contrainte == "uq_aeronef_immatriculation":
        return ImmatriculationAeronefDejaPriseError(
            aeronef.immatriculation if aeronef is not None else ""
        )
    if contrainte == "uq_equipe_aeronef_id":
        return AeronefDejaAffecteError(str(aeronef.id) if aeronef is not None else "")
    if contrainte == "uq_equipe_membre_chef_par_equipe":
        return EquipeADejaUnChefError(contrainte)
    if contrainte == "uq_equipe_membre_chef_par_utilisateur":
        return ChefDejaDansUneAutreEquipeError(contrainte)
    if contrainte == "equipe_membre_pkey":
        return MembreDejaDansEquipeError(contrainte)
    return exc


def _aeronef_to_domain(model: AeronefModel) -> Aeronef:
    return Aeronef(
        id=model.id,
        immatriculation=model.immatriculation,
        societe=model.societe,
        volume_cuve_l=float(model.volume_cuve_l),
        actif=model.actif,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class AeronefRepositoryImpl(AeronefRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self, actif: bool | None = True) -> list[Aeronef]:
        stmt = select(AeronefModel).order_by(AeronefModel.immatriculation)
        if actif is not None:
            stmt = stmt.where(AeronefModel.actif == actif)
        result = await self.session.execute(stmt)
        return [_aeronef_to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, aeronef_id: uuid.UUID) -> Aeronef | None:
        result = await self.session.execute(
            select(AeronefModel).where(AeronefModel.id == aeronef_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else _aeronef_to_domain(model)

    async def update(self, aeronef: Aeronef) -> Aeronef:
        result = await self.session.execute(
            select(AeronefModel).where(AeronefModel.id == aeronef.id)
        )
        model = result.scalar_one()
        model.immatriculation = aeronef.immatriculation
        model.societe = aeronef.societe
        model.volume_cuve_l = aeronef.volume_cuve_l
        model.actif = aeronef.actif
        model.updated_at = aeronef.updated_at
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise ImmatriculationAeronefDejaPriseError(aeronef.immatriculation) from exc
        await self.session.refresh(model)
        return _aeronef_to_domain(model)


class StandRemplissageRepositoryImpl(StandRemplissageRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: StandRemplissageModel) -> StandRemplissage:
        return StandRemplissage(
            id=model.id,
            numero=model.numero,
            localite=model.localite,
            longitude=float(model.longitude) if model.longitude is not None else None,
            latitude=float(model.latitude) if model.latitude is not None else None,
            altitude=float(model.altitude) if model.altitude is not None else None,
            equipe_aerienne_id=model.equipe_aerienne_id,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_since(self, since: datetime | None) -> list[StandRemplissage]:
        stmt = select(StandRemplissageModel).order_by(StandRemplissageModel.numero)
        if since is not None:
            stmt = stmt.where(StandRemplissageModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[StandRemplissage]:
        stmt = select(StandRemplissageModel).order_by(StandRemplissageModel.numero)
        if actif is not None:
            stmt = stmt.where(StandRemplissageModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, stand_id: uuid.UUID) -> StandRemplissage | None:
        result = await self.session.execute(
            select(StandRemplissageModel).where(StandRemplissageModel.id == stand_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, stand: StandRemplissage) -> StandRemplissage:
        model = StandRemplissageModel(
            id=stand.id,
            numero=stand.numero,
            localite=stand.localite,
            longitude=stand.longitude,
            latitude=stand.latitude,
            altitude=stand.altitude,
            equipe_aerienne_id=stand.equipe_aerienne_id,
            actif=stand.actif,
            created_at=stand.created_at,
            updated_at=stand.updated_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, stand) from exc
        await self.session.refresh(model)
        return self._to_domain(model)

    @staticmethod
    def _traduire_integrite(exc: IntegrityError, stand: StandRemplissage) -> Exception:
        """Une équipe inexistante ne doit pas remonter comme un doublon de `numero`."""
        if _contrainte_violee(exc) == "fk_stand_remplissage_equipe_aerienne_id":
            return EquipeAerienneIntrouvableError(str(stand.equipe_aerienne_id))
        return NumeroStandRemplissageDejaPrisError(stand.numero)

    async def update(self, stand: StandRemplissage) -> StandRemplissage:
        result = await self.session.execute(
            select(StandRemplissageModel).where(StandRemplissageModel.id == stand.id)
        )
        model = result.scalar_one()
        model.numero = stand.numero
        model.localite = stand.localite
        model.longitude = stand.longitude
        model.latitude = stand.latitude
        model.altitude = stand.altitude
        model.equipe_aerienne_id = stand.equipe_aerienne_id
        model.actif = stand.actif
        model.updated_at = stand.updated_at
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, stand) from exc
        await self.session.refresh(model)
        return self._to_domain(model)


class CodeStadeRepositoryImpl(CodeStadeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _select_ordonne(self):
        return select(CodeStadeModel).order_by(
            CodeStadeModel.categorie, CodeStadeModel.sexe, CodeStadeModel.ordre
        )

    async def list_since(self, since: datetime | None) -> list[CodeStade]:
        stmt = self._select_ordonne()
        if since is not None:
            stmt = stmt.where(CodeStadeModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[CodeStade]:
        stmt = self._select_ordonne()
        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(CodeStadeModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, code_stade_id: uuid.UUID) -> CodeStade | None:
        result = await self.session.execute(
            select(CodeStadeModel).where(CodeStadeModel.id == code_stade_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, code_stade: CodeStade) -> CodeStade:
        model = CodeStadeModel(
            id=code_stade.id,
            code=code_stade.code,
            categorie=code_stade.categorie,
            sexe=code_stade.sexe,
            espece=code_stade.espece,
            libelle=code_stade.libelle,
            ordre=code_stade.ordre,
            actif=code_stade.actif,
            updated_at=code_stade.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def update(self, code_stade: CodeStade) -> CodeStade:
        result = await self.session.execute(
            select(CodeStadeModel).where(CodeStadeModel.id == code_stade.id)
        )
        model = result.scalar_one()
        model.code = code_stade.code
        model.categorie = code_stade.categorie
        model.sexe = code_stade.sexe
        model.espece = code_stade.espece
        model.libelle = code_stade.libelle
        model.ordre = code_stade.ordre
        model.actif = code_stade.actif
        model.updated_at = code_stade.updated_at
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def code_au_vocabulaire(self, code: str) -> bool:
        result = await self.session.execute(select(StadeModel.code).where(StadeModel.code == code))
        return result.scalar_one_or_none() is not None

    async def grille_occupee_par(
        self,
        code: str,
        categorie: str,
        sexe: str | None,
        espece: str | None,
    ) -> uuid.UUID | None:
        # `is_(None)` et non `== None` : l'index unique traite les NULL comme égaux
        # (postgresql_nulls_not_distinct), pas la comparaison SQL.
        stmt = select(CodeStadeModel.id).where(
            CodeStadeModel.code == code,
            CodeStadeModel.categorie == categorie,
            CodeStadeModel.sexe.is_(sexe) if sexe is None else CodeStadeModel.sexe == sexe,
            CodeStadeModel.espece.is_(espece)
            if espece is None
            else CodeStadeModel.espece == espece,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _to_domain(self, model: CodeStadeModel) -> CodeStade:
        return CodeStade(
            id=model.id,
            code=model.code,
            categorie=model.categorie,
            sexe=model.sexe,
            espece=model.espece,
            libelle=model.libelle,
            ordre=model.ordre,
            actif=model.actif,
            updated_at=model.updated_at,
        )
