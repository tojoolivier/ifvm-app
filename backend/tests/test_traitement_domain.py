import uuid
from datetime import date

import pytest

from app.application.traitement_use_cases import CreateTraitementAerien
from app.domain.prospection import Prospection, ProspectionPopulation
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    NumeroFicheConflitError,
    ProspectionIntrouvableError,
    Traitement,
    UtilisateurRef,
    construire_cible,
    generer_numero_fiche,
)

# ==========================================
# generer_numero_fiche
# ==========================================


def test_numero_fiche_format():
    assert generer_numero_fiche("Hery", date(2026, 8, 11)) == "Hery-Aerien-2026-08-11"


def test_numero_fiche_avec_suffixe():
    assert generer_numero_fiche("Hery", date(2026, 8, 11), suffixe=2) == "Hery-Aerien-2026-08-11-2"


# ==========================================
# construire_cible
# ==========================================


def _prospection(**kwargs) -> Prospection:
    return Prospection(date_prospection=date(2026, 8, 1), **kwargs)


def test_cible_prospection_vide_tout_absent():
    cible = construire_cible(_prospection())
    assert cible.espece is None
    assert cible.petites_larves is None
    assert cible.grandes_larves is None
    assert cible.vols_clairs_essaims is None
    assert cible.repartition_population is None
    assert cible.surface_infestee_ha == 0.0


def test_cible_espece_unique():
    p = _prospection(populations=[ProspectionPopulation(espece="LMC", categorie="imago")])
    assert construire_cible(p).espece == "LMC"


def test_cible_deux_especes_donne_melange():
    p = _prospection(
        populations=[
            ProspectionPopulation(espece="LMC", categorie="imago"),
            ProspectionPopulation(espece="NSE", categorie="larve"),
        ]
    )
    assert construire_cible(p).espece == "MELANGE"


def test_cible_larves_petites_et_grandes():
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC",
                categorie="larve",
                densites_larve={"L1": 10, "L2": 5, "L3": 7, "L5": 3},
            )
        ]
    )
    cible = construire_cible(p)
    assert cible.petites_larves == "15"
    assert cible.grandes_larves == "10"


def test_cible_repartition_groupee_prioritaire():
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC", categorie="imago", densite_diffuse=1.0, densite_groupee=2.0
            )
        ]
    )
    assert construire_cible(p).repartition_population == "GROUPEE"


def test_cible_essaim_observe():
    p = _prospection(
        populations=[ProspectionPopulation(espece="LMC", categorie="imago", essaim_observe=True)]
    )
    assert construire_cible(p).vols_clairs_essaims == "oui"


def test_cible_surface_infestee_reprise():
    p = _prospection(surf_infestee=42.5)
    assert construire_cible(p).surface_infestee_ha == 42.5


# ==========================================
# CreateTraitementAerien (fakes en mémoire)
# ==========================================


class FakeTraitementRepo:
    def __init__(self, conflits: int = 0):
        self.conflits = conflits
        self.crees: list[Traitement] = []

    async def create(self, traitement: Traitement) -> Traitement:
        if self.conflits > 0:
            self.conflits -= 1
            raise NumeroFicheConflitError(traitement.numero_fiche)
        self.crees.append(traitement)
        return traitement

    async def get_by_id(self, traitement_id):
        return None

    async def list_by_filters(self, **kwargs):
        return []


class FakeProspectionRepo:
    def __init__(self, prospection: Prospection | None):
        self.prospection = prospection

    async def get_by_id(self, prospection_id):
        return self.prospection


class FakeUtilisateurRepo:
    def __init__(self, user: UtilisateurRef | None):
        self.user = user

    async def get_by_id(self, utilisateur_id):
        return self.user


def _use_case(
    prospection: Prospection | None = None,
    chef: UtilisateurRef | None = None,
    conflits: int = 0,
) -> tuple[CreateTraitementAerien, FakeTraitementRepo]:
    repo = FakeTraitementRepo(conflits=conflits)
    return (
        CreateTraitementAerien(
            traitement_repository=repo,
            prospection_repository=FakeProspectionRepo(prospection),
            utilisateur_repository=FakeUtilisateurRepo(chef),
        ),
        repo,
    )


_CHEF = UtilisateurRef(id=uuid.uuid4(), prenom="Hery", role="chef_de_base")


def _args(**overrides):
    args = dict(
        prospection_id=uuid.uuid4(),
        date_traitement=date(2026, 8, 11),
        date_validation=date(2026, 8, 12),
        localite="Betioky",
        pilote="J. Dupont",
        mecanicien="M. Rabe",
        chef_de_base_id=_CHEF.id,
    )
    args.update(overrides)
    return args


@pytest.mark.asyncio
async def test_creation_genere_numero_fiche_et_snapshot():
    prospection = _prospection(
        surf_infestee=100.0,
        populations=[ProspectionPopulation(espece="LMC", categorie="imago")],
    )
    use_case, repo = _use_case(prospection=prospection, chef=_CHEF)
    traitement = await use_case.execute(**_args())

    assert traitement.numero_fiche == "Hery-Aerien-2026-08-11"
    assert traitement.statut == "brouillon"
    assert traitement.type_traitement == "AERIEN"
    assert traitement.cible is not None
    assert traitement.cible.espece == "LMC"
    assert traitement.cible.surface_infestee_ha == 100.0
    assert traitement.aerien is not None
    assert traitement.aerien.chef_de_base_id == _CHEF.id
    assert repo.crees == [traitement]


@pytest.mark.asyncio
async def test_conflit_numero_fiche_ajoute_suffixe_incremental():
    use_case, repo = _use_case(prospection=_prospection(), chef=_CHEF, conflits=2)
    traitement = await use_case.execute(**_args())
    assert traitement.numero_fiche == "Hery-Aerien-2026-08-11-3"


@pytest.mark.asyncio
async def test_rejette_chef_de_base_avec_mauvais_role():
    mauvais_chef = UtilisateurRef(id=uuid.uuid4(), prenom="Jean", role="pilote")
    use_case, _ = _use_case(prospection=_prospection(), chef=mauvais_chef)
    with pytest.raises(ChefDeBaseInvalideError):
        await use_case.execute(**_args(chef_de_base_id=mauvais_chef.id))


@pytest.mark.asyncio
async def test_rejette_chef_de_base_inconnu():
    use_case, _ = _use_case(prospection=_prospection(), chef=None)
    with pytest.raises(ChefDeBaseInvalideError):
        await use_case.execute(**_args())


@pytest.mark.asyncio
async def test_rejette_prospection_inexistante():
    use_case, _ = _use_case(prospection=None, chef=_CHEF)
    with pytest.raises(ProspectionIntrouvableError):
        await use_case.execute(**_args())


@pytest.mark.asyncio
async def test_rejette_date_validation_anterieure():
    use_case, _ = _use_case(prospection=_prospection(), chef=_CHEF)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args(date_traitement=date(2026, 8, 11), date_validation=date(2026, 8, 10))
        )
