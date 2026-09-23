import asyncio
from datetime import datetime, timezone

import pytest

from app.application.referentiel_use_cases import PullReferentiel, ReferentielSinceCursors


class SlowPosteRepository:
    """Simule une requête lente pour prouver que server_time est capturé avant les requêtes."""

    async def list_since(self, since):
        await asyncio.sleep(0.05)
        return []


class InstantRepository:
    async def list_since(self, *args):
        return []

    async def list_membres_since(self, *args):
        return []


@pytest.mark.asyncio
async def test_server_time_is_captured_before_issuing_any_query():
    started_at = datetime.now(timezone.utc)

    use_case = PullReferentiel(
        zone_repository=InstantRepository(),
        poste_repository=SlowPosteRepository(),
        station_repository=InstantRepository(),
        equipe_repository=InstantRepository(),
        pesticide_repository=InstantRepository(),
        culture_repository=InstantRepository(),
        code_stade_repository=InstantRepository(),
        campagne_repository=InstantRepository(),
        lieu_aerien_repository=InstantRepository(),
        site_aerien_repository=InstantRepository(),
        equipe_unifiee_repository=InstantRepository(),
        aeronef_repository=InstantRepository(),
        affectation_aeronef_repository=InstantRepository(),
    )
    result = await use_case.execute(cursors=ReferentielSinceCursors())

    elapsed_before_server_time = (result.server_time - started_at).total_seconds()
    assert elapsed_before_server_time < 0.03
