import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, func, or_, select, union_all
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.domain.referentiel import (
    Aeronef,
    AeronefDejaAffecteError,
    AffectationAeronef,
    ChefDejaDansUneAutreEquipeError,
    CodeStade,
    Culture,
    Equipe,
    EquipeADejaUnChefError,
    EquipeAerienneDejaAssigneeError,
    EquipeAerienneIntrouvableError,
    EquipeDejaEquipeeError,
    ImmatriculationAeronefDejaPriseError,
    LieuAerien,
    MembreDejaDansEquipeError,
    MembreEquipe,
    MouvementPesticide,
    NumeroSiteAerienneDejaPrisError,
    PeriodeAffectationInvalideError,
    Pesticide,
    PositionActiveIntrouvableError,
    PositionDejaActiveError,
    SiteAerienne,
    SiteAerienneEquipeInvalideError,
    SiteAeriennePosition,
    SoldePesticide,
    UtilisateurEquipe,
    Vol,
)
from app.domain.repositories import (
    AeronefRepository,
    CodeStadeRepository,
    CultureRepository,
    EquipeAeronefRepository,
    EquipeRepository,
    LieuAerienRepository,
    MouvementPesticideRepository,
    PesticideRepository,
    SiteAeriennePositionRepository,
    SiteAerienneRepository,
    UtilisateurEquipeRepository,
    VolRepository,
)
from app.infrastructure.referentiel_model import (
    AeronefModel,
    CodeStadeModel,
    CultureModel,
    EquipeAeronefModel,
    EquipeMembreModel,
    EquipeModel,
    LieuAerienModel,
    MouvementPesticideModel,
    PesticideModel,
    SiteAerienneModel,
    SiteAeriennePositionModel,
    StadeModel,
    VolModel,
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


class SiteAerienneRepositoryImpl(SiteAerienneRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: SiteAerienneModel) -> SiteAerienne:
        return SiteAerienne(
            id=model.id,
            parent_site_id=model.parent_site_id,
            equipe_id=model.equipe_id,
            numero=model.numero,
            localite=model.localite,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_since(self, since: datetime | None) -> list[SiteAerienne]:
        stmt = select(SiteAerienneModel).order_by(SiteAerienneModel.numero)
        if since is not None:
            stmt = stmt.where(SiteAerienneModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(self, actif: bool | None = True) -> list[SiteAerienne]:
        stmt = select(SiteAerienneModel).order_by(SiteAerienneModel.numero)
        # `actif=None` = pas de filtre : l'administration a besoin des deux états.
        if actif is not None:
            stmt = stmt.where(SiteAerienneModel.actif == actif)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, site_id: uuid.UUID) -> SiteAerienne | None:
        result = await self.session.execute(
            select(SiteAerienneModel).where(SiteAerienneModel.id == site_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, site: SiteAerienne) -> SiteAerienne:
        model = SiteAerienneModel(
            id=site.id,
            parent_site_id=site.parent_site_id,
            equipe_id=site.equipe_id,
            numero=site.numero,
            localite=site.localite,
            actif=site.actif,
            created_at=site.created_at,
            updated_at=site.updated_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, site) from exc
        await self.session.refresh(model)
        return self._to_domain(model)

    def _traduire_integrite(self, exc: IntegrityError, site: SiteAerienne) -> Exception:
        """Traduit l'IntegrityError en erreur domaine actionnable — sans ça, une
        équipe déjà assignée ou inexistante remontait comme un doublon de `numero`
        (message trompeur pour l'agent qui remplit le formulaire)."""
        contrainte = _contrainte_violee(exc)
        if contrainte == "ck_site_aerienne_equipe_coherente":
            return SiteAerienneEquipeInvalideError(str(site.equipe_id))
        if contrainte == "uq_site_aerienne_equipe_id":
            return EquipeAerienneDejaAssigneeError(str(site.equipe_id))
        if contrainte == "fk_site_aerienne_equipe_id":
            return EquipeAerienneIntrouvableError(str(site.equipe_id))
        return NumeroSiteAerienneDejaPrisError(site.numero)

    async def update(self, site: SiteAerienne) -> SiteAerienne:
        result = await self.session.execute(
            select(SiteAerienneModel).where(SiteAerienneModel.id == site.id)
        )
        model = result.scalar_one()
        model.parent_site_id = site.parent_site_id
        model.equipe_id = site.equipe_id
        model.numero = site.numero
        model.localite = site.localite
        model.actif = site.actif
        model.updated_at = site.updated_at
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise self._traduire_integrite(exc, site) from exc
        await self.session.refresh(model)
        return self._to_domain(model)


class SiteAeriennePositionRepositoryImpl(SiteAeriennePositionRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: SiteAeriennePositionModel) -> SiteAeriennePosition:
        return SiteAeriennePosition(
            id=model.id,
            site_id=model.site_id,
            latitude=float(model.latitude),
            longitude=float(model.longitude),
            altitude=float(model.altitude) if model.altitude is not None else None,
            date_debut=model.date_debut,
            date_fin=model.date_fin,
            created_at=model.created_at,
        )

    async def list_par_site(self, site_id: uuid.UUID) -> list[SiteAeriennePosition]:
        stmt = (
            select(SiteAeriennePositionModel)
            .where(SiteAeriennePositionModel.site_id == site_id)
            .order_by(SiteAeriennePositionModel.date_debut.desc())
        )
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_active(self, site_id: uuid.UUID) -> SiteAeriennePosition | None:
        stmt = select(SiteAeriennePositionModel).where(
            SiteAeriennePositionModel.site_id == site_id,
            SiteAeriennePositionModel.date_fin.is_(None),
        )
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def installer(self, position: SiteAeriennePosition) -> SiteAeriennePosition:
        model = SiteAeriennePositionModel(
            id=position.id,
            site_id=position.site_id,
            latitude=position.latitude,
            longitude=position.longitude,
            altitude=position.altitude,
            date_debut=position.date_debut,
            date_fin=position.date_fin,
            created_at=position.created_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            traduite = self._traduire_integrite(exc, position)
            raise (traduite if traduite is not None else exc) from exc
        await self.session.refresh(model)
        return self._to_domain(model)

    def _traduire_integrite(
        self, exc: IntegrityError, position: SiteAeriennePosition
    ) -> Exception | None:
        """`None` : contrainte non reconnue, l'IntegrityError d'origine remonte telle
        quelle plutôt que d'inventer une erreur domaine trompeuse."""
        if _contrainte_violee(exc) == "uq_site_aerienne_position_ouverte_par_site":
            return PositionDejaActiveError(str(position.site_id))
        return None

    async def demonter(self, position: SiteAeriennePosition) -> SiteAeriennePosition:
        result = await self.session.execute(
            select(SiteAeriennePositionModel).where(SiteAeriennePositionModel.id == position.id)
        )
        model = result.scalar_one_or_none()
        if model is None or model.date_fin is not None:
            raise PositionActiveIntrouvableError(str(position.site_id))
        model.date_fin = position.date_fin
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)


class EquipeRepositoryImpl(EquipeRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    _CHARGEMENT = (
        selectinload(EquipeModel.membres).joinedload(EquipeMembreModel.utilisateur),
        selectinload(EquipeModel.affectations_aeronef).joinedload(EquipeAeronefModel.aeronef),
    )

    def _to_domain(self, model: EquipeModel) -> Equipe:
        # `aeronef_id` / `aeronef` ne sont plus des colonnes (#603) : ils projettent
        # l'affectation en cours, celle dont `date_fin IS NULL`. Une équipe entre deux
        # appareils les voit à `None`, ce que le 1:1 ne savait pas exprimer.
        active = next((a for a in model.affectations_aeronef if a.date_fin is None), None)
        return Equipe(
            id=model.id,
            nom=model.nom,
            type=model.type,
            aeronef_id=active.aeronef_id if active is not None else None,
            aeronef=_aeronef_to_domain(active.aeronef) if active is not None else None,
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
            self.session.add(
                AeronefModel(
                    id=aeronef.id,
                    immatriculation=aeronef.immatriculation,
                    societe=aeronef.societe,
                    volume_cuve_l=aeronef.volume_cuve_l,
                    actif=aeronef.actif,
                    created_at=aeronef.created_at,
                    updated_at=aeronef.updated_at,
                )
            )
        aeronef_id = aeronef.id if aeronef is not None else equipe.aeronef_id
        if aeronef_id is not None:
            # L'équipe naît avec son appareil en service : affectation ouverte, qui
            # commence le jour de la création — la seule date que l'appelant fournisse.
            model.affectations_aeronef = [
                EquipeAeronefModel(
                    id=uuid.uuid4(),
                    aeronef_id=aeronef_id,
                    date_debut=equipe.created_at.date(),
                    date_fin=None,
                    created_at=equipe.created_at,
                )
            ]
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite_equipe(exc, aeronef, aeronef_id) from exc
        await self.session.refresh(model, attribute_names=["membres", "affectations_aeronef"])
        return await self._relire(model.id)

    async def update(self, equipe: Equipe) -> Equipe:
        result = await self.session.execute(select(EquipeModel).where(EquipeModel.id == equipe.id))
        model = result.scalar_one()
        # `type` n'est délibérément pas réécrit : il n'existe pas dans `EquipeUpdate`.
        model.nom = equipe.nom
        model.actif = equipe.actif
        model.updated_at = equipe.updated_at
        await self.session.commit()
        return await self._relire(equipe.id)

    async def _relire(self, equipe_id: uuid.UUID) -> Equipe:
        """Une écriture relit l'équipe complète : `membres` porte les nom/prénom, qui
        vivent sur `utilisateur` et non sur la ligne de membre."""
        equipe = await self.get_by_id(equipe_id)
        if equipe is None:  # pragma: no cover — on vient de l'écrire dans cette session
            raise RuntimeError(f"Équipe {equipe_id} introuvable juste après écriture")
        return equipe

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


def _affectation_to_domain(model: EquipeAeronefModel) -> AffectationAeronef:
    return AffectationAeronef(
        id=model.id,
        equipe_id=model.equipe_id,
        aeronef_id=model.aeronef_id,
        date_debut=model.date_debut,
        date_fin=model.date_fin,
        aeronef=_aeronef_to_domain(model.aeronef) if model.aeronef is not None else None,
        created_at=model.created_at,
    )


class EquipeAeronefRepositoryImpl(EquipeAeronefRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_par_equipe(self, equipe_id: uuid.UUID) -> list[AffectationAeronef]:
        result = await self.session.execute(
            select(EquipeAeronefModel)
            .options(joinedload(EquipeAeronefModel.aeronef))
            .where(EquipeAeronefModel.equipe_id == equipe_id)
            .order_by(EquipeAeronefModel.date_debut.desc(), EquipeAeronefModel.created_at.desc())
            .execution_options(populate_existing=True)
        )
        return [_affectation_to_domain(m) for m in result.scalars().unique().all()]

    async def get_by_id(self, affectation_id: uuid.UUID) -> AffectationAeronef | None:
        result = await self.session.execute(
            select(EquipeAeronefModel)
            .options(joinedload(EquipeAeronefModel.aeronef))
            .where(EquipeAeronefModel.id == affectation_id)
            .execution_options(populate_existing=True)
        )
        model = result.unique().scalar_one_or_none()
        return None if model is None else _affectation_to_domain(model)

    async def list_chevauchements(
        self,
        date_debut: date,
        date_fin: date | None,
        equipe_id: uuid.UUID | None = None,
        aeronef_id: uuid.UUID | None = None,
        sauf_id: uuid.UUID | None = None,
    ) -> list[AffectationAeronef]:
        # Deux intervalles semi-ouverts se recoupent si chacun commence avant que
        # l'autre ne finisse ; `date_fin IS NULL` vaut « pas de fin », donc la moitié
        # correspondante de la condition tombe.
        stmt = (
            select(EquipeAeronefModel)
            .options(joinedload(EquipeAeronefModel.aeronef))
            .where(
                or_(
                    EquipeAeronefModel.date_fin.is_(None),
                    EquipeAeronefModel.date_fin > date_debut,
                )
            )
            .order_by(EquipeAeronefModel.date_debut)
        )
        if date_fin is not None:
            stmt = stmt.where(EquipeAeronefModel.date_debut < date_fin)
        cibles = [
            c
            for c in (
                EquipeAeronefModel.equipe_id == equipe_id if equipe_id is not None else None,
                EquipeAeronefModel.aeronef_id == aeronef_id if aeronef_id is not None else None,
            )
            if c is not None
        ]
        if not cibles:  # pragma: no cover — garde-fou : un appel sans cible balaierait tout
            raise ValueError("list_chevauchements exige une equipe_id et/ou un aeronef_id")
        stmt = stmt.where(or_(*cibles))
        if sauf_id is not None:
            stmt = stmt.where(EquipeAeronefModel.id != sauf_id)
        result = await self.session.execute(stmt)
        return [_affectation_to_domain(m) for m in result.scalars().unique().all()]

    async def create(self, affectation: AffectationAeronef) -> AffectationAeronef:
        model = EquipeAeronefModel(
            id=affectation.id,
            equipe_id=affectation.equipe_id,
            aeronef_id=affectation.aeronef_id,
            date_debut=affectation.date_debut,
            date_fin=affectation.date_fin,
            created_at=affectation.created_at,
        )
        self.session.add(model)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite_affectation(exc, affectation) from exc
        relue = await self.get_by_id(affectation.id)
        assert relue is not None  # noqa: S101 — on vient de l'écrire dans cette session
        return relue

    async def update(self, affectation: AffectationAeronef) -> AffectationAeronef:
        result = await self.session.execute(
            select(EquipeAeronefModel).where(EquipeAeronefModel.id == affectation.id)
        )
        model = result.scalar_one()
        # Seule `date_fin` bouge : rouvrir une période close ou déplacer son début
        # réécrirait l'histoire, ce que cette table existe précisément pour empêcher.
        model.date_fin = affectation.date_fin
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise _traduire_integrite_affectation(exc, affectation) from exc
        relue = await self.get_by_id(affectation.id)
        assert relue is not None  # noqa: S101 — on vient de l'écrire dans cette session
        return relue


def _traduire_integrite_affectation(
    exc: IntegrityError, affectation: AffectationAeronef
) -> Exception:
    """Filet de sécurité derrière la validation applicative : les index partiels de la
    migration 0087 ne couvrent que les affectations *ouvertes*, et la règle complète est
    vérifiée en amont. Ce qui passe ici est donc une course entre deux requêtes."""
    contrainte = _contrainte_violee(exc)
    if contrainte == "uq_equipe_aeronef_ouverte_par_aeronef":
        return AeronefDejaAffecteError(str(affectation.aeronef_id))
    if contrainte == "uq_equipe_aeronef_ouverte_par_equipe":
        return EquipeDejaEquipeeError(str(affectation.equipe_id))
    if contrainte == "ck_equipe_aeronef_periode":
        return PeriodeAffectationInvalideError(str(affectation.id))
    return exc


def _membre_to_domain(model: EquipeMembreModel) -> MembreEquipe:
    return MembreEquipe(
        equipe_id=model.equipe_id,
        user_id=model.user_id,
        fonction=model.fonction,
        nom=model.utilisateur.nom if model.utilisateur is not None else None,
        prenom=model.utilisateur.prenom if model.utilisateur is not None else None,
        created_at=model.created_at,
    )


def _traduire_integrite_equipe(
    exc: IntegrityError, aeronef: Aeronef | None, aeronef_id: uuid.UUID | None = None
) -> Exception:
    """Traduit une violation d'intégrité en erreur métier, par *nom de contrainte*.

    Les noms lus ici sont ceux des migrations 0086/0087 et des `__table_args__` : un
    renommage des deux côtés est obligatoire, sans quoi toute violation retomberait
    silencieusement sur l'erreur générique.

    `aeronef_id` est passé à part : sur le chemin « appareil déjà au référentiel »
    (#621) il n'y a pas d'objet `Aeronef` à créer, et c'est pourtant le seul chemin qui
    puisse violer l'index partiel — sans lui le message sortait vide."""
    contrainte = _contrainte_violee(exc)
    if contrainte == "uq_aeronef_immatriculation":
        return ImmatriculationAeronefDejaPriseError(
            aeronef.immatriculation if aeronef is not None else ""
        )
    if contrainte == "uq_equipe_aeronef_ouverte_par_aeronef":
        vise = aeronef.id if aeronef is not None else aeronef_id
        return AeronefDejaAffecteError(str(vise) if vise is not None else "")
    if contrainte == "uq_equipe_aeronef_ouverte_par_equipe":
        return EquipeDejaEquipeeError(contrainte)
    if contrainte == "uq_equipe_membre_chef_par_equipe":
        return EquipeADejaUnChefError(contrainte)
    if contrainte == "uq_equipe_membre_chef_par_utilisateur":
        return ChefDejaDansUneAutreEquipeError(contrainte)
    if contrainte == "equipe_membre_pkey":
        return MembreDejaDansEquipeError(contrainte)
    # Contrainte non reconnue : on rend l'erreur d'origine telle quelle plutôt que de la
    # déguiser en erreur métier — le 500 qui suit est la bonne réponse.
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

    async def create(self, aeronef: Aeronef) -> Aeronef:
        model = AeronefModel(
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
            # Seule contrainte possible ici : l'appareil n'a aucune FK sortante.
            raise ImmatriculationAeronefDejaPriseError(aeronef.immatriculation) from exc
        await self.session.refresh(model)
        return _aeronef_to_domain(model)

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


class MouvementPesticideRepositoryImpl(MouvementPesticideRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_domain(self, model: MouvementPesticideModel) -> MouvementPesticide:
        return MouvementPesticide(
            id=model.id,
            type=model.type,
            pesticide_id=model.pesticide_id,
            site_id=model.site_id,
            site_destination_id=model.site_destination_id,
            quantite=float(model.quantite),
            unite=model.unite,
            date_mouvement=model.date_mouvement,
            created_at=model.created_at,
            traitement_id=model.traitement_id,
        )

    async def create(self, mouvement: MouvementPesticide) -> MouvementPesticide:
        model = MouvementPesticideModel(
            id=mouvement.id,
            type=mouvement.type,
            pesticide_id=mouvement.pesticide_id,
            site_id=mouvement.site_id,
            site_destination_id=mouvement.site_destination_id,
            quantite=mouvement.quantite,
            unite=mouvement.unite,
            date_mouvement=mouvement.date_mouvement,
            created_at=mouvement.created_at,
            traitement_id=mouvement.traitement_id,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    async def regenerer_consommation(
        self,
        traitement_id: uuid.UUID,
        site_id: uuid.UUID | None,
        date_mouvement: date,
        consommations: list[tuple[uuid.UUID, str, float]],
    ) -> None:
        await self.session.execute(
            delete(MouvementPesticideModel).where(
                MouvementPesticideModel.traitement_id == traitement_id,
                MouvementPesticideModel.type == "consommation",
            )
        )
        if site_id is not None:
            maintenant = datetime.now(timezone.utc)
            for pesticide_id, unite, quantite in consommations:
                if quantite <= 0:
                    continue
                self.session.add(
                    MouvementPesticideModel(
                        type="consommation",
                        pesticide_id=pesticide_id,
                        site_id=site_id,
                        quantite=quantite,
                        unite=unite,
                        date_mouvement=date_mouvement,
                        created_at=maintenant,
                        traitement_id=traitement_id,
                    )
                )
        await self.session.commit()

    async def solde(
        self,
        site_id: uuid.UUID | None = None,
        pesticide_id: uuid.UUID | None = None,
    ) -> list[SoldePesticide]:
        """Agrège les mouvements en trois branches signées, unifiées par UNION ALL puis
        sommées par (site, pesticide, unité) — un `transfert` débite `site_id` et
        crédite `site_destination_id` dans le même calcul (AC #606)."""
        m = MouvementPesticideModel
        entrees = select(
            m.site_id.label("site_id"),
            m.pesticide_id.label("pesticide_id"),
            m.unite.label("unite"),
            m.quantite.label("delta"),
        ).where(m.type == "approvisionnement")
        sorties = select(
            m.site_id.label("site_id"),
            m.pesticide_id.label("pesticide_id"),
            m.unite.label("unite"),
            (-m.quantite).label("delta"),
        ).where(m.type.in_(("transfert", "consommation")))
        credits_transfert = select(
            m.site_destination_id.label("site_id"),
            m.pesticide_id.label("pesticide_id"),
            m.unite.label("unite"),
            m.quantite.label("delta"),
        ).where(m.type == "transfert")

        mouvements = union_all(entrees, sorties, credits_transfert).subquery()
        stmt = select(
            mouvements.c.site_id,
            mouvements.c.pesticide_id,
            mouvements.c.unite,
            func.sum(mouvements.c.delta).label("quantite"),
        )
        if site_id is not None:
            stmt = stmt.where(mouvements.c.site_id == site_id)
        if pesticide_id is not None:
            stmt = stmt.where(mouvements.c.pesticide_id == pesticide_id)
        stmt = stmt.group_by(mouvements.c.site_id, mouvements.c.pesticide_id, mouvements.c.unite)

        result = await self.session.execute(stmt)
        return [
            SoldePesticide(
                site_id=row.site_id,
                pesticide_id=row.pesticide_id,
                unite=row.unite,
                quantite=float(row.quantite),
            )
            for row in result.all()
        ]


def _vol_to_domain(model: VolModel) -> Vol:
    return Vol(
        id=model.id,
        type=model.type,
        equipe_id=model.equipe_id,
        aeronef_id=model.aeronef_id,
        site_principal_id=model.site_principal_id,
        stand_id=model.stand_id,
        base_secondaire_id=model.base_secondaire_id,
        date_vol=model.date_vol,
        heure_debut=model.heure_debut,
        heure_fin=model.heure_fin,
        motif=model.motif,
        lieu_depart=model.lieu_depart,
        lieu_arrivee=model.lieu_arrivee,
        observations=model.observations,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _vol_to_model(vol: Vol) -> VolModel:
    """Mapping inverse de `_vol_to_domain` — les deux se lisent champ à champ l'un en
    face de l'autre plutôt que de relister les 14 champs une troisième fois dans
    `VolRepositoryImpl.create`."""
    return VolModel(
        id=vol.id,
        type=vol.type,
        equipe_id=vol.equipe_id,
        aeronef_id=vol.aeronef_id,
        site_principal_id=vol.site_principal_id,
        stand_id=vol.stand_id,
        base_secondaire_id=vol.base_secondaire_id,
        date_vol=vol.date_vol,
        heure_debut=vol.heure_debut,
        heure_fin=vol.heure_fin,
        motif=vol.motif,
        lieu_depart=vol.lieu_depart,
        lieu_arrivee=vol.lieu_arrivee,
        observations=vol.observations,
        created_at=vol.created_at,
        updated_at=vol.updated_at,
    )


class VolRepositoryImpl(VolRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, vol: Vol) -> Vol:
        model = _vol_to_model(vol)
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return _vol_to_domain(model)

    async def get_by_id(self, vol_id: uuid.UUID) -> Vol | None:
        result = await self.session.execute(select(VolModel).where(VolModel.id == vol_id))
        model = result.scalar_one_or_none()
        return None if model is None else _vol_to_domain(model)

    async def list_all(self, equipe_id: uuid.UUID | None = None) -> list[Vol]:
        stmt = select(VolModel).order_by(VolModel.date_vol.desc(), VolModel.created_at.desc())
        if equipe_id is not None:
            stmt = stmt.where(VolModel.equipe_id == equipe_id)
        result = await self.session.execute(stmt)
        return [_vol_to_domain(m) for m in result.scalars().all()]
