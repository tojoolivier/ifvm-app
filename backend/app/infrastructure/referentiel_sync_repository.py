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
from app.infrastructure.referentiel_model import CodeStadeModel, CultureModel, PesticideModel
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

    async def list_since(self, since: datetime | None) -> list[CodeStade]:
        stmt = select(CodeStadeModel).order_by(
            CodeStadeModel.categorie, CodeStadeModel.sexe, CodeStadeModel.ordre
        )
        if since is not None:
            stmt = stmt.where(CodeStadeModel.updated_at > since)
        result = await self.session.execute(stmt)
        return [
            CodeStade(
                id=m.id,
                code=m.code,
                categorie=m.categorie,
                sexe=m.sexe,
                espece=m.espece,
                libelle=m.libelle,
                ordre=m.ordre,
                actif=m.actif,
                updated_at=m.updated_at,
            )
            for m in result.scalars().all()
        ]
