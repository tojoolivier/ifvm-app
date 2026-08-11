import uuid
from datetime import date, time

import pytest

from app.application.traitement_use_cases import (
    AddRotation,
    CreateTraitementAerien,
    CreateTraitementTerrestre,
    RemoveRotation,
    UpdateRotation,
)
from app.domain.prospection import Prospection, ProspectionPopulation
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    NumeroFicheConflitError,
    ProspectionIntrouvableError,
    Rotation,
    RotationIntrouvableError,
    Traitement,
    TraitementAerien,
    TraitementIntrouvableError,
    TraitementTerrestre,
    construire_cible,
    generer_numero_fiche,
)
from app.domain.utilisateur import UtilisateurRef

# ==========================================
# generer_numero_fiche
# ==========================================


def test_numero_fiche_format():
    assert generer_numero_fiche("Hery", date(2026, 8, 11)) == "Hery-Aerien-2026-08-11"


def test_numero_fiche_avec_suffixe():
    assert generer_numero_fiche("Hery", date(2026, 8, 11), suffixe=2) == "Hery-Aerien-2026-08-11-2"


def test_numero_fiche_terrestre():
    assert (
        generer_numero_fiche("Hery", date(2026, 8, 11), type_traitement="Terrestre")
        == "Hery-Terrestre-2026-08-11"
    )


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
    assert cible.surface_infestee_ha is None


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
async def test_rejette_numero_fiche_trop_long():
    chef_nom_long = UtilisateurRef(id=uuid.uuid4(), prenom="X" * 45, role="chef_de_base")
    use_case, _ = _use_case(prospection=_prospection(), chef=chef_nom_long)
    with pytest.raises(ValueError):
        await use_case.execute(**_args(chef_de_base_id=chef_nom_long.id))


@pytest.mark.asyncio
async def test_rejette_date_validation_anterieure():
    use_case, _ = _use_case(prospection=_prospection(), chef=_CHEF)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args(date_traitement=date(2026, 8, 11), date_validation=date(2026, 8, 10))
        )


# ==========================================
# TraitementAerien.recalculer_totaux
# ==========================================


def _rotation(**overrides) -> Rotation:
    args = dict(
        numero_cuve="C1",
        produit_id=uuid.uuid4(),
        quantite_l=10.0,
        temperature_debut_c=25.0,
        temperature_fin_c=27.0,
        vent_debut_ms=2.0,
        vent_fin_ms=3.0,
    )
    args.update(overrides)
    return Rotation(**args)


def test_recalculer_totaux_sans_rotation():
    aerien = TraitementAerien()
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 0
    assert aerien.total_pesticide_l is None


def test_recalculer_totaux_trois_rotations():
    aerien = TraitementAerien()
    aerien.rotations = [
        _rotation(numero=1, quantite_l=10.0),
        _rotation(numero=2, quantite_l=15.5),
        _rotation(numero=3, quantite_l=8.25),
    ]
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 3
    assert aerien.total_pesticide_l == 33.75


def test_recalculer_totaux_apres_suppression():
    aerien = TraitementAerien()
    r1, r2 = _rotation(numero=1, quantite_l=10.0), _rotation(numero=2, quantite_l=5.0)
    aerien.rotations = [r1, r2]
    aerien.recalculer_totaux()
    aerien.rotations.remove(r1)
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 1
    assert aerien.total_pesticide_l == 5.0


def test_recalculer_totaux_derniere_suppression_repasse_a_none():
    aerien = TraitementAerien()
    r1 = _rotation(numero=1, quantite_l=10.0)
    aerien.rotations = [r1]
    aerien.recalculer_totaux()
    aerien.rotations.remove(r1)
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 0
    assert aerien.total_pesticide_l is None


# ==========================================
# AddRotation / UpdateRotation / RemoveRotation (fakes en mémoire)
# ==========================================


class FakeTraitementRepoRotations:
    def __init__(self, traitement: Traitement | None):
        self.traitement = traitement

    async def get_by_id(self, traitement_id):
        return self.traitement

    async def list_by_filters(self, **kwargs):
        return []

    async def create(self, traitement):
        return traitement

    async def add_rotation(self, traitement_id, rotation, nb_rotations, total_pesticide_l):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        return self.traitement

    async def update_rotation(self, traitement_id, rotation, nb_rotations, total_pesticide_l):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        return self.traitement

    async def remove_rotation(self, traitement_id, rotation_id, nb_rotations, total_pesticide_l):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        return self.traitement


def _traitement_aerien(rotations: list[Rotation] | None = None) -> Traitement:
    aerien = TraitementAerien()
    aerien.rotations = rotations or []
    return Traitement(aerien=aerien)


def _rotation_args(**overrides):
    args = dict(
        numero_cuve="C1",
        produit_id=uuid.uuid4(),
        quantite_l=10.0,
        temperature_debut_c=25.0,
        temperature_fin_c=27.0,
        vent_debut_ms=2.0,
        vent_fin_ms=3.0,
    )
    args.update(overrides)
    return args


@pytest.mark.asyncio
async def test_add_rotation_incremente_totaux():
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)

    resultat = await use_case.execute(traitement_id=traitement.id, **_rotation_args())

    assert resultat.aerien.nb_rotations == 1
    assert resultat.aerien.total_pesticide_l == 10.0


@pytest.mark.asyncio
async def test_add_rotation_numero_auto_incremente():
    existante = _rotation(numero=1, quantite_l=10.0)
    traitement = _traitement_aerien([existante])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)

    await use_case.execute(traitement_id=traitement.id, **_rotation_args(quantite_l=5.0))

    assert [r.numero for r in traitement.aerien.rotations] == [1, 2]
    assert traitement.aerien.nb_rotations == 2
    assert traitement.aerien.total_pesticide_l == 15.0


@pytest.mark.asyncio
async def test_add_rotation_traitement_introuvable():
    repo = FakeTraitementRepoRotations(None)
    use_case = AddRotation(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(traitement_id=uuid.uuid4(), **_rotation_args())


@pytest.mark.asyncio
async def test_add_rotation_traitement_non_aerien():
    traitement = Traitement(aerien=None)
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(traitement_id=traitement.id, **_rotation_args())


@pytest.mark.asyncio
async def test_update_rotation_recalcule_totaux():
    existante = _rotation(numero=1, quantite_l=10.0)
    traitement = _traitement_aerien([existante])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = UpdateRotation(repo)

    resultat = await use_case.execute(
        traitement_id=traitement.id,
        rotation_id=existante.id,
        **_rotation_args(quantite_l=20.0),
    )

    assert resultat.aerien.nb_rotations == 1
    assert resultat.aerien.total_pesticide_l == 20.0
    assert existante.quantite_l == 20.0


@pytest.mark.asyncio
async def test_update_rotation_introuvable():
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = UpdateRotation(repo)
    with pytest.raises(RotationIntrouvableError):
        await use_case.execute(
            traitement_id=traitement.id, rotation_id=uuid.uuid4(), **_rotation_args()
        )


@pytest.mark.asyncio
async def test_remove_rotation_recalcule_totaux():
    r1 = _rotation(numero=1, quantite_l=10.0)
    r2 = _rotation(numero=2, quantite_l=5.0)
    traitement = _traitement_aerien([r1, r2])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = RemoveRotation(repo)

    resultat = await use_case.execute(traitement_id=traitement.id, rotation_id=r1.id)

    assert resultat.aerien.nb_rotations == 1
    assert resultat.aerien.total_pesticide_l == 5.0
    assert traitement.aerien.rotations == [r2]


@pytest.mark.asyncio
async def test_remove_rotation_introuvable():
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = RemoveRotation(repo)
    with pytest.raises(RotationIntrouvableError):
        await use_case.execute(traitement_id=traitement.id, rotation_id=uuid.uuid4())


# ==========================================
# TraitementTerrestre.recalculer_surfaces
# ==========================================


def test_recalculer_surfaces_somme_trois_materiels():
    terrestre = TraitementTerrestre(
        surface_atomiseur_ha=10.0, surface_disque_rotatif_ha=5.5, surface_ulvamast_ha=2.25
    )
    terrestre.recalculer_surfaces(surface_infestee_ha=100.0)
    assert terrestre.surface_traitee_ha == 17.75
    assert terrestre.surface_cumulee_ha == 17.75
    assert terrestre.surface_restante_ha == 82.25


def test_recalculer_surfaces_aucun_materiel_traite_zero():
    terrestre = TraitementTerrestre()
    terrestre.recalculer_surfaces(surface_infestee_ha=50.0)
    assert terrestre.surface_traitee_ha == 0.0
    assert terrestre.surface_restante_ha == 50.0


def test_recalculer_surfaces_restante_plancher_zero_cdg_9():
    """Critère d'acceptation CDG §9 : surface_restante_ha ne descend jamais sous 0."""
    terrestre = TraitementTerrestre(surface_atomiseur_ha=80.0)
    terrestre.recalculer_surfaces(surface_infestee_ha=50.0)
    assert terrestre.surface_traitee_ha == 80.0
    assert terrestre.surface_restante_ha == 0.0


def test_recalculer_surfaces_infestee_none_restante_none():
    terrestre = TraitementTerrestre(surface_atomiseur_ha=10.0)
    terrestre.recalculer_surfaces(surface_infestee_ha=None)
    assert terrestre.surface_traitee_ha == 10.0
    assert terrestre.surface_restante_ha is None


def test_recalculer_surfaces_avec_cumul_precedent():
    terrestre = TraitementTerrestre(surface_atomiseur_ha=10.0)
    terrestre.recalculer_surfaces(surface_infestee_ha=100.0, surface_cumulee_precedente=30.0)
    assert terrestre.surface_traitee_ha == 10.0
    assert terrestre.surface_cumulee_ha == 40.0
    assert terrestre.surface_restante_ha == 60.0


# ==========================================
# CreateTraitementTerrestre (fakes en mémoire)
# ==========================================


_CHEF_EQUIPE = UtilisateurRef(id=uuid.uuid4(), prenom="Hery", role="chef_equipe")


def _use_case_terrestre(
    prospection: Prospection | None = None,
    chef: UtilisateurRef | None = None,
    conflits: int = 0,
) -> tuple[CreateTraitementTerrestre, FakeTraitementRepo]:
    repo = FakeTraitementRepo(conflits=conflits)
    return (
        CreateTraitementTerrestre(
            traitement_repository=repo,
            prospection_repository=FakeProspectionRepo(prospection),
            utilisateur_repository=FakeUtilisateurRepo(chef),
        ),
        repo,
    )


def _args_terrestre(**overrides):
    args = dict(
        prospection_id=uuid.uuid4(),
        date_traitement=date(2026, 8, 11),
        date_validation=date(2026, 8, 12),
        localite="Betioky",
        heure_debut=time(6, 0),
        heure_fin=time(9, 0),
        vitesse_vent_ms=1.5,
        temperature_c=24.0,
        chef_equipe_id=_CHEF_EQUIPE.id,
    )
    args.update(overrides)
    return args


@pytest.mark.asyncio
async def test_creation_terrestre_genere_numero_fiche_et_recalcule_surfaces():
    prospection = _prospection(surf_infestee=100.0)
    use_case, repo = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(
        **_args_terrestre(
            surface_atomiseur_ha=10.0,
            surface_disque_rotatif_ha=5.0,
            surface_restante_abandonnee=False,
        )
    )

    assert traitement.numero_fiche == "Hery-Terrestre-2026-08-11"
    assert traitement.statut == "brouillon"
    assert traitement.type_traitement == "TERRESTRE"
    assert traitement.terrestre is not None
    assert traitement.terrestre.chef_equipe_id == _CHEF_EQUIPE.id
    assert traitement.terrestre.surface_traitee_ha == 15.0
    assert traitement.terrestre.surface_restante_ha == 85.0
    assert repo.crees == [traitement]


@pytest.mark.asyncio
async def test_terrestre_conflit_numero_fiche_ajoute_suffixe_incremental():
    use_case, repo = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE, conflits=2)
    traitement = await use_case.execute(**_args_terrestre())
    assert traitement.numero_fiche == "Hery-Terrestre-2026-08-11-3"


@pytest.mark.asyncio
async def test_terrestre_rejette_chef_equipe_avec_mauvais_role():
    mauvais_chef = UtilisateurRef(id=uuid.uuid4(), prenom="Jean", role="prospecteur")
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=mauvais_chef)
    with pytest.raises(ChefEquipeInvalideError):
        await use_case.execute(**_args_terrestre(chef_equipe_id=mauvais_chef.id))


@pytest.mark.asyncio
async def test_terrestre_rejette_chef_equipe_inconnu():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=None)
    with pytest.raises(ChefEquipeInvalideError):
        await use_case.execute(**_args_terrestre())


@pytest.mark.asyncio
async def test_terrestre_rejette_prospection_inexistante():
    use_case, _ = _use_case_terrestre(prospection=None, chef=_CHEF_EQUIPE)
    with pytest.raises(ProspectionIntrouvableError):
        await use_case.execute(**_args_terrestre())


@pytest.mark.asyncio
async def test_terrestre_rejette_heure_fin_anterieure_ou_egale():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(**_args_terrestre(heure_debut=time(9, 0), heure_fin=time(9, 0)))


@pytest.mark.asyncio
async def test_terrestre_rejette_date_validation_anterieure():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args_terrestre(date_traitement=date(2026, 8, 11), date_validation=date(2026, 8, 10))
        )


@pytest.mark.asyncio
async def test_terrestre_rejette_surface_restante_positive_sans_abandonnee():
    """surface_restante_abandonnee obligatoire dès que surface_restante_ha > 0 (contrainte DB)."""
    prospection = _prospection(surf_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(**_args_terrestre(surface_atomiseur_ha=10.0))


@pytest.mark.asyncio
async def test_terrestre_accepte_surface_restante_nulle_sans_abandonnee():
    prospection = _prospection(surf_infestee=10.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(**_args_terrestre(surface_atomiseur_ha=25.0))
    assert traitement.terrestre.surface_restante_ha == 0.0
