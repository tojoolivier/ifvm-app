"""Soft-delete du référentiel (#674).

Toute table de référentiel synchronisée porte `deleted_at TIMESTAMPTZ NULL`. Un écouteur
de session ajoute `deleted_at IS NULL` à chaque SELECT ORM sur ces tables : les listes, les
`get_by_id` et les jointures ne voient donc jamais une ligne supprimée. Le pull incrémental
(`since=`) est la seule exception : il passe `include_deleted=True` pour que les téléphones
reçoivent la suppression et purgent leur cache local.
"""

from datetime import UTC, datetime

from sqlalchemy import event
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.models.base import Base

INCLURE_SUPPRIMES = {"include_deleted": True}


def _modeles_soft_delete() -> list[type]:
    return [m.class_ for m in Base.registry.mappers if hasattr(m.class_, "deleted_at")]


@event.listens_for(Session, "do_orm_execute")
def _exclure_supprimes(state: ORMExecuteState) -> None:
    if (
        not state.is_select
        or state.is_column_load
        or state.is_relationship_load
        or state.execution_options.get("include_deleted", False)
    ):
        return
    for modele in _modeles_soft_delete():
        state.statement = state.statement.options(
            with_loader_criteria(
                modele,
                lambda cls: cls.deleted_at.is_(None),
                include_aliases=True,
                track_closure_variables=False,
            )
        )


def maintenant() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # même convention que `updated_at`
