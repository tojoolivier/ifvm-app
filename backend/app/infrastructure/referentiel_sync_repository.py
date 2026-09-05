import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.referentiel import (
    CodeStade,
    Culture,
    LieuAerien,
    Pesticide,
    UtilisateurEquipe,
)
from app.domain.repositories import (
    CodeStadeRepository,
    CultureRepository,
    LieuAerienRepository,
    PesticideRepository,
    UtilisateurEquipeRepository,
)
from app.infrastructure.referentiel_model import (
    CodeStadeModel,
    CultureModel,
    LieuAerienModel,
    PesticideModel,
    StadeModel,
)
from app.models.users import Utilisateur


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

    async def list_since(self, since: datetime | None) -> list[LieuAerien]:
        stmt = select(LieuAerienModel).order_by(LieuAerienModel.nom)
        if since is not None:
            stmt = stmt.where(LieuAerienModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def list_all(
        self, type_lieu: str | None = None, actif: bool | None = True
    ) -> list[LieuAerien]:
        stmt = select(LieuAerienModel).order_by(LieuAerienModel.nom)
        if actif is not None:
            stmt = stmt.where(LieuAerienModel.actif == actif)
        if type_lieu is not None:
            stmt = stmt.where(LieuAerienModel.type_lieu == type_lieu)
        result = await self.session.execute(stmt)
        return [self._to_domain(m) for m in result.scalars().all()]

    async def get_by_id(self, lieu_id: uuid.UUID) -> LieuAerien | None:
        result = await self.session.execute(
            select(LieuAerienModel).where(LieuAerienModel.id == lieu_id)
        )
        model = result.scalar_one_or_none()
        return None if model is None else self._to_domain(model)

    async def create(self, lieu: LieuAerien) -> LieuAerien:
        model = LieuAerienModel(
            id=lieu.id,
            type_lieu=lieu.type_lieu,
            nom=lieu.nom,
            latitude=lieu.latitude,
            longitude=lieu.longitude,
            altitude=lieu.altitude,
            actif=lieu.actif,
            created_at=lieu.created_at,
            updated_at=lieu.updated_at,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

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
        model.updated_at = lieu.updated_at
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_domain(model)

    def _to_domain(self, model: LieuAerienModel) -> LieuAerien:
        return LieuAerien(
            id=model.id,
            type_lieu=model.type_lieu,
            nom=model.nom,
            latitude=float(model.latitude),
            longitude=float(model.longitude),
            altitude=float(model.altitude) if model.altitude is not None else None,
            actif=model.actif,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


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
