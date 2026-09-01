import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.referentiel import CodeStade, Culture, Pesticide, UtilisateurEquipe
from app.domain.repositories import (
    CodeStadeRepository,
    CultureRepository,
    PesticideRepository,
    UtilisateurEquipeRepository,
)
from app.infrastructure.referentiel_model import (
    CodeStadeModel,
    CultureModel,
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
                email=m.email,
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
        return [
            Pesticide(id=m.id, code=m.code, nom=m.nom, actif=m.actif, updated_at=m.updated_at)
            for m in result.scalars().all()
        ]


class CultureRepositoryImpl(CultureRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_since(self, since: datetime | None) -> list[Culture]:
        stmt = select(CultureModel).order_by(CultureModel.code)
        if since is not None:
            stmt = stmt.where(CultureModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [
            Culture(id=m.id, code=m.code, nom=m.nom, actif=m.actif, updated_at=m.updated_at)
            for m in result.scalars().all()
        ]


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
