"""Routes DELETE du référentiel — soft-delete `deleted_at` (#674, ADR-010).

Une suppression physique resterait sur les téléphones déjà synchronisés (le pull ne
transporte que des upserts) et casserait les FK RESTRICT depuis l'historique. La route pose
donc `deleted_at` + `updated_at` : la ligne sort des listes normales (filtre de session,
cf. `infrastructure/soft_delete.py`) mais `GET /referentiel/pull` la renvoie avec
`deleted_at`, ce qui permet au mobile de la purger.

`actif=false` garde son sens « désactivé, restaurable » ; `deleted_at` est irréversible
côté API.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.infrastructure.soft_delete import maintenant
from app.models.users import Utilisateur


async def charger_ligne_vivante(db: AsyncSession, modele, item_id: uuid.UUID, libelle: str):
    """Charge la ligne `item_id`, 404 si absente. Une ligne déjà supprimée est absente :
    le filtre de session (`soft_delete.py`) la masque."""
    ligne = (await db.execute(select(modele).where(modele.id == item_id))).scalar_one_or_none()
    if ligne is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{libelle} non trouvé(e)")
    return ligne


async def marquer_supprime(db: AsyncSession, ligne) -> None:
    """`deleted_at` et `updated_at` au même instant : `updated_at` est le curseur de `since=`."""
    instant = maintenant()
    ligne.deleted_at = instant
    ligne.updated_at = instant
    await db.commit()


def ajouter_route_suppression(
    router: APIRouter,
    chemin: str,
    modele,
    libelle: str,
    enfants: tuple[tuple[type, str, str], ...] = (),
) -> None:
    """`enfants` : (modèle enfant, nom de la colonne FK, libellé pluriel) — la suppression
    est refusée (409) tant qu'un enfant vivant référence la ligne."""

    async def supprimer(
        item_id: uuid.UUID,
        db: Annotated[AsyncSession, Depends(get_db)],
        _: Annotated[Utilisateur, Depends(require_admin)],
    ) -> Response:
        ligne = await charger_ligne_vivante(db, modele, item_id, libelle)
        for enfant, colonne, libelle_enfants in enfants:
            a_des_enfants = (
                await db.execute(
                    select(enfant.id).where(getattr(enfant, colonne) == item_id).limit(1)
                )
            ).first()
            if a_des_enfants:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    detail=f"Des {libelle_enfants} sont encore rattachés : supprimez-les d'abord.",
                )
        await marquer_supprime(db, ligne)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    supprimer.__name__ = f"supprimer_{modele.__tablename__}"
    router.add_api_route(chemin, supprimer, methods=["DELETE"], status_code=204)
