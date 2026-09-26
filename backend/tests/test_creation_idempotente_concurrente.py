"""Rejeu concurrent (#639) : deux envois du même `id` passent tous deux le
`get_by_id` (rien), le second `create` échoue sur la clé primaire. Le use case doit
relire et rendre la ressource existante, pas remonter une erreur (500)."""

import uuid
from types import SimpleNamespace

import pytest

from app.application.referentiel_use_cases import CreateMouvementPesticide
from app.domain.referentiel import IdentifiantDejaUtiliseError, MouvementPesticide


class _RepoConcurrent:
    """`get_by_id` ne voit rien au premier appel ; `create` perd la course."""

    def __init__(self, gagnant: MouvementPesticide):
        self.gagnant = gagnant
        self.appels_get = 0

    async def get_by_id(self, _id):
        self.appels_get += 1
        return None if self.appels_get == 1 else self.gagnant

    async def create(self, _mouvement):
        raise IdentifiantDejaUtiliseError(str(self.gagnant.id))


class _Trouve:
    """Site principal (pas de `parent_site_id`) ou pesticide : existe toujours."""

    async def get_by_id(self, _id):
        return SimpleNamespace(parent_site_id=None)


def _use_case(repo):
    return CreateMouvementPesticide(repo, _Trouve(), _Trouve())


def _gagnant(**overrides) -> MouvementPesticide:
    base = dict(
        id=uuid.uuid4(),
        type="approvisionnement",
        pesticide_id=uuid.uuid4(),
        site_id=uuid.uuid4(),
        quantite=100.0,
        unite="L",
    )
    return MouvementPesticide(**{**base, **overrides})


def _appel(gagnant: MouvementPesticide, **overrides) -> dict:
    base = dict(
        type=gagnant.type,
        pesticide_id=gagnant.pesticide_id,
        site_id=gagnant.site_id,
        quantite=gagnant.quantite,
        unite=gagnant.unite,
        date_mouvement=gagnant.date_mouvement,
        client_id=gagnant.id,
    )
    return {**base, **overrides}


@pytest.mark.asyncio
async def test_course_meme_contenu_rend_la_ressource_existante():
    gagnant = _gagnant()
    resultat = await _use_case(_RepoConcurrent(gagnant)).execute(**_appel(gagnant))
    assert resultat is gagnant


@pytest.mark.asyncio
async def test_course_contenu_different_leve_conflit():
    gagnant = _gagnant()
    with pytest.raises(IdentifiantDejaUtiliseError):
        await _use_case(_RepoConcurrent(gagnant)).execute(**_appel(gagnant, quantite=999.0))
