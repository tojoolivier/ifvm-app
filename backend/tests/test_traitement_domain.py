import copy
import uuid
from datetime import date, datetime, time

import pytest

from app.application.traitement_use_cases import (
    AddProduitUtilise,
    AddRotation,
    CreateTraitementAerien,
    CreateTraitementTerrestre,
    RemoveProduitUtilise,
    RemoveRotation,
    SyncPushTraitementTerrestre,
    UpdateRotation,
    ValiderTraitement,
)
from app.domain.prospection import Prospection, ProspectionPopulation
from app.domain.traitement import (
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    MotifAbandonManquantError,
    NumeroFicheConflitError,
    ProduitUtilise,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    Rotation,
    RotationIntrouvableError,
    SignaturesManquantesError,
    Traitement,
    TraitementAerien,
    TraitementIntrouvableError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementSyncConflitError,
    TraitementTerrestre,
    TraitementValideeSyncRejeteError,
    TraitementVerrouilleError,
    construire_cible,
    contenu_diverge,
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
    p = _prospection(surface_infestee=42.5)
    assert construire_cible(p).surface_infestee_ha == 42.5


# ==========================================
# CreateTraitementAerien (fakes en mémoire)
# ==========================================


class FakeTraitementRepo:
    def __init__(
        self,
        conflits: int = 0,
        traitements_par_id: dict | None = None,
        origines_deja_utilisees: set | None = None,
    ):
        self.conflits = conflits
        self.crees: list[Traitement] = []
        self.traitements_par_id = traitements_par_id or {}
        self.origines_deja_utilisees = origines_deja_utilisees or set()

    async def create(self, traitement: Traitement) -> Traitement:
        if self.conflits > 0:
            self.conflits -= 1
            raise NumeroFicheConflitError(traitement.numero_fiche)
        self.crees.append(traitement)
        return traitement

    async def get_by_id(self, traitement_id):
        return self.traitements_par_id.get(traitement_id)

    async def list_by_filters(self, **kwargs):
        return []

    async def origine_deja_utilisee(self, traitement_origine_id) -> bool:
        return traitement_origine_id in self.origines_deja_utilisees


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
        date_validation=date(2026, 8, 10),
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
        surface_infestee=100.0,
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
async def test_rejette_date_traitement_anterieure():
    use_case, _ = _use_case(prospection=_prospection(), chef=_CHEF)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args(date_traitement=date(2026, 8, 10), date_validation=date(2026, 8, 11))
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
    traitements_par_id: dict | None = None,
    origines_deja_utilisees: set | None = None,
) -> tuple[CreateTraitementTerrestre, FakeTraitementRepo]:
    repo = FakeTraitementRepo(
        conflits=conflits,
        traitements_par_id=traitements_par_id,
        origines_deja_utilisees=origines_deja_utilisees,
    )
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
        date_validation=date(2026, 8, 10),
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
    prospection = _prospection(surface_infestee=100.0)
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
async def test_terrestre_rejette_date_traitement_anterieure():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args_terrestre(date_traitement=date(2026, 8, 10), date_validation=date(2026, 8, 11))
        )


@pytest.mark.asyncio
async def test_terrestre_rejette_surface_restante_positive_sans_abandonnee():
    """surface_restante_abandonnee obligatoire dès que surface_restante_ha > 0 (contrainte DB)."""
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(**_args_terrestre(surface_atomiseur_ha=10.0))


@pytest.mark.asyncio
async def test_terrestre_accepte_surface_restante_nulle_sans_abandonnee():
    prospection = _prospection(surface_infestee=10.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(**_args_terrestre(surface_atomiseur_ha=25.0))
    assert traitement.terrestre.surface_restante_ha == 0.0


# ==========================================
# CreateTraitementTerrestre — reprise de traitement (issue #71)
# ==========================================


def _fiche_origine(surface_cumulee_ha: float = 40.0) -> Traitement:
    """Fiche terrestre existante, utilisable comme origine d'une reprise."""
    origine = Traitement(terrestre=TraitementTerrestre())
    origine.terrestre.surface_cumulee_ha = surface_cumulee_ha
    return origine


@pytest.mark.asyncio
async def test_reprise_lit_surface_cumulee_de_la_fiche_origine_un_seul_niveau():
    """CDG §9 : reprend surface_cumulee_ha déjà consolidé de l'origine, sans récursion."""
    origine = _fiche_origine(surface_cumulee_ha=40.0)
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(
        prospection=prospection,
        chef=_CHEF_EQUIPE,
        traitements_par_id={origine.id: origine},
    )
    traitement = await use_case.execute(
        **_args_terrestre(
            surface_atomiseur_ha=10.0,
            surface_restante_abandonnee=False,
            reprise_traitement=True,
            traitement_origine_id=origine.id,
        )
    )
    assert traitement.terrestre.reprise_traitement is True
    assert traitement.terrestre.traitement_origine_id == origine.id
    assert traitement.terrestre.surface_traitee_ha == 10.0
    assert traitement.terrestre.surface_cumulee_ha == 50.0
    assert traitement.terrestre.surface_restante_ha == 50.0


@pytest.mark.asyncio
async def test_reprise_sans_traitement_origine_id_rejetee():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(**_args_terrestre(reprise_traitement=True))


@pytest.mark.asyncio
async def test_traitement_origine_id_sans_reprise_rejete():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(ValueError):
        await use_case.execute(
            **_args_terrestre(reprise_traitement=False, traitement_origine_id=uuid.uuid4())
        )


@pytest.mark.asyncio
async def test_reprise_origine_introuvable():
    use_case, _ = _use_case_terrestre(prospection=_prospection(), chef=_CHEF_EQUIPE)
    with pytest.raises(TraitementOrigineIntrouvableError):
        await use_case.execute(
            **_args_terrestre(reprise_traitement=True, traitement_origine_id=uuid.uuid4())
        )


@pytest.mark.asyncio
async def test_reprise_origine_non_terrestre_introuvable():
    origine_aerienne = Traitement(aerien=TraitementAerien())
    use_case, _ = _use_case_terrestre(
        prospection=_prospection(),
        chef=_CHEF_EQUIPE,
        traitements_par_id={origine_aerienne.id: origine_aerienne},
    )
    with pytest.raises(TraitementOrigineIntrouvableError):
        await use_case.execute(
            **_args_terrestre(reprise_traitement=True, traitement_origine_id=origine_aerienne.id)
        )


@pytest.mark.asyncio
async def test_reprise_origine_deja_utilisee_rejetee():
    """Préserve le modèle 'chaîne linéaire' : une fiche ne peut être origine qu'une fois."""
    origine = _fiche_origine()
    use_case, _ = _use_case_terrestre(
        prospection=_prospection(surface_infestee=100.0),
        chef=_CHEF_EQUIPE,
        traitements_par_id={origine.id: origine},
        origines_deja_utilisees={origine.id},
    )
    with pytest.raises(TraitementOrigineDejaUtiliseeError):
        await use_case.execute(
            **_args_terrestre(reprise_traitement=True, traitement_origine_id=origine.id)
        )


# ==========================================
# TraitementTerrestre.recalculer_total_pesticide
# ==========================================


def _produit(**overrides) -> ProduitUtilise:
    args = dict(produit_id=uuid.uuid4(), quantite_l=10.0)
    args.update(overrides)
    return ProduitUtilise(**args)


def test_recalculer_total_pesticide_sans_produit():
    terrestre = TraitementTerrestre()
    terrestre.recalculer_total_pesticide()
    assert terrestre.total_pesticide_l is None


def test_recalculer_total_pesticide_trois_produits():
    terrestre = TraitementTerrestre()
    terrestre.produits = [
        _produit(numero=1, quantite_l=10.0),
        _produit(numero=2, quantite_l=15.5),
        _produit(numero=3, quantite_l=8.25),
    ]
    terrestre.recalculer_total_pesticide()
    assert terrestre.total_pesticide_l == 33.75


def test_recalculer_total_pesticide_apres_suppression():
    terrestre = TraitementTerrestre()
    p1, p2 = _produit(numero=1, quantite_l=10.0), _produit(numero=2, quantite_l=5.0)
    terrestre.produits = [p1, p2]
    terrestre.recalculer_total_pesticide()
    terrestre.produits.remove(p1)
    terrestre.recalculer_total_pesticide()
    assert terrestre.total_pesticide_l == 5.0


def test_recalculer_total_pesticide_derniere_suppression_repasse_a_none():
    terrestre = TraitementTerrestre()
    p1 = _produit(numero=1, quantite_l=10.0)
    terrestre.produits = [p1]
    terrestre.recalculer_total_pesticide()
    terrestre.produits.remove(p1)
    terrestre.recalculer_total_pesticide()
    assert terrestre.total_pesticide_l is None


# ==========================================
# AddProduitUtilise / RemoveProduitUtilise (fakes en mémoire)
# ==========================================


class FakeTraitementRepoProduits:
    def __init__(self, traitement: Traitement | None):
        self.traitement = traitement

    async def get_by_id(self, traitement_id):
        return self.traitement

    async def list_by_filters(self, **kwargs):
        return []

    async def create(self, traitement):
        return traitement

    async def add_produit(self, traitement_id, produit, total_pesticide_l):
        self.traitement.terrestre.total_pesticide_l = total_pesticide_l
        return self.traitement

    async def remove_produit(self, traitement_id, produit_id, total_pesticide_l):
        self.traitement.terrestre.total_pesticide_l = total_pesticide_l
        return self.traitement


def _traitement_terrestre(produits: list[ProduitUtilise] | None = None) -> Traitement:
    terrestre = TraitementTerrestre()
    terrestre.produits = produits or []
    return Traitement(terrestre=terrestre)


def _produit_args(**overrides):
    args = dict(produit_id=uuid.uuid4(), quantite_l=10.0)
    args.update(overrides)
    return args


@pytest.mark.asyncio
async def test_add_produit_recalcule_total():
    traitement = _traitement_terrestre()
    repo = FakeTraitementRepoProduits(traitement)
    use_case = AddProduitUtilise(repo)

    resultat = await use_case.execute(traitement_id=traitement.id, **_produit_args())

    assert resultat.terrestre.total_pesticide_l == 10.0


@pytest.mark.asyncio
async def test_add_produit_numero_auto_incremente():
    existant = _produit(numero=1, quantite_l=10.0)
    traitement = _traitement_terrestre([existant])
    repo = FakeTraitementRepoProduits(traitement)
    use_case = AddProduitUtilise(repo)

    await use_case.execute(traitement_id=traitement.id, **_produit_args(quantite_l=5.0))

    assert [p.numero for p in traitement.terrestre.produits] == [1, 2]
    assert traitement.terrestre.total_pesticide_l == 15.0


@pytest.mark.asyncio
async def test_add_produit_traitement_introuvable():
    repo = FakeTraitementRepoProduits(None)
    use_case = AddProduitUtilise(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(traitement_id=uuid.uuid4(), **_produit_args())


@pytest.mark.asyncio
async def test_add_produit_traitement_non_terrestre():
    traitement = Traitement(terrestre=None)
    repo = FakeTraitementRepoProduits(traitement)
    use_case = AddProduitUtilise(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(traitement_id=traitement.id, **_produit_args())


@pytest.mark.asyncio
async def test_remove_produit_recalcule_total():
    p1 = _produit(numero=1, quantite_l=10.0)
    p2 = _produit(numero=2, quantite_l=5.0)
    traitement = _traitement_terrestre([p1, p2])
    repo = FakeTraitementRepoProduits(traitement)
    use_case = RemoveProduitUtilise(repo)

    resultat = await use_case.execute(traitement_id=traitement.id, produit_utilise_id=p1.id)

    assert resultat.terrestre.total_pesticide_l == 5.0
    assert traitement.terrestre.produits == [p2]


@pytest.mark.asyncio
async def test_remove_produit_introuvable():
    traitement = _traitement_terrestre()
    repo = FakeTraitementRepoProduits(traitement)
    use_case = RemoveProduitUtilise(repo)
    with pytest.raises(ProduitUtiliseIntrouvableError):
        await use_case.execute(traitement_id=traitement.id, produit_utilise_id=uuid.uuid4())


# ==========================================
# Traitement.verifier_modifiable — verrouillage post-validation (garde commune, #64)
# ==========================================


def test_verifier_modifiable_brouillon_ne_leve_pas():
    Traitement(statut="brouillon").verifier_modifiable()


def test_verifier_modifiable_validee_leve_verrouille():
    with pytest.raises(TraitementVerrouilleError):
        Traitement(statut="validee").verifier_modifiable()


@pytest.mark.asyncio
async def test_add_rotation_sur_traitement_verrouille_leve_verrouille():
    aerien = TraitementAerien()
    traitement = Traitement(statut="validee", aerien=aerien)
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)
    with pytest.raises(TraitementVerrouilleError):
        await use_case.execute(traitement_id=traitement.id, **_rotation_args())


@pytest.mark.asyncio
async def test_add_produit_sur_traitement_verrouille_leve_verrouille():
    traitement = Traitement(statut="validee", terrestre=TraitementTerrestre())
    repo = FakeTraitementRepoProduits(traitement)
    use_case = AddProduitUtilise(repo)
    with pytest.raises(TraitementVerrouilleError):
        await use_case.execute(traitement_id=traitement.id, **_produit_args())


# ==========================================
# Traitement.valider — matrice de signatures (CDG §9)
# ==========================================


def _traitement_aerien_valide(**overrides) -> Traitement:
    args = dict(
        pilote="J. Dupont",
        mecanicien="M. Rabe",
        chef_de_base_id=uuid.uuid4(),
        consultant_international=None,
    )
    args.update({k: v for k, v in overrides.items() if k in args})
    aerien = TraitementAerien(**args)
    return Traitement(
        type_traitement="AERIEN",
        statut="brouillon",
        date_traitement=date(2026, 8, 13),
        aerien=aerien,
    )


def _traitement_terrestre_valide(**overrides) -> Traitement:
    args = dict(
        chef_equipe_id=uuid.uuid4(),
        agent_encadreur_id=None,
        consultant_international=None,
        surface_restante_abandonnee=None,
        motif_surface_restante_abandonnee=None,
    )
    args.update({k: v for k, v in overrides.items() if k in args})
    terrestre = TraitementTerrestre(**args)
    return Traitement(
        type_traitement="TERRESTRE",
        statut="brouillon",
        date_traitement=date(2026, 8, 13),
        terrestre=terrestre,
    )


def test_valider_aerien_toutes_signatures_presentes_transitionne_validee():
    traitement = _traitement_aerien_valide()
    signatures = traitement.valider(
        date(2026, 8, 12),
        [
            {"role": "PILOTE", "signataire_nom": "J. Dupont"},
            {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
            {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
        ],
    )
    assert traitement.statut == "validee"
    assert traitement.date_validation == date(2026, 8, 12)
    assert {s.role for s in signatures} == {"PILOTE", "MECANICIEN", "CHEF_DE_BASE"}
    assert traitement.signatures == signatures


def test_valider_aerien_signature_manquante_pilote_bloque():
    traitement = _traitement_aerien_valide()
    with pytest.raises(SignaturesManquantesError):
        traitement.valider(
            date(2026, 8, 12),
            [
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
            ],
        )


def test_valider_aerien_consultant_renseigne_sans_signature_bloque():
    traitement = _traitement_aerien_valide(consultant_international="Dr. Smith")
    with pytest.raises(SignaturesManquantesError):
        traitement.valider(
            date(2026, 8, 12),
            [
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
            ],
        )


def test_valider_aerien_consultant_absent_aucune_signature_requise():
    traitement = _traitement_aerien_valide(consultant_international=None)
    traitement.valider(
        date(2026, 8, 12),
        [
            {"role": "PILOTE", "signataire_nom": "J. Dupont"},
            {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
            {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
        ],
    )
    assert traitement.statut == "validee"


def test_valider_terrestre_sans_agent_encadreur_reste_validable():
    traitement = _traitement_terrestre_valide(agent_encadreur_id=None)
    traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])
    assert traitement.statut == "validee"


def test_valider_terrestre_agent_encadreur_renseigne_ne_signe_jamais():
    traitement = _traitement_terrestre_valide(agent_encadreur_id=uuid.uuid4())
    traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])
    assert traitement.statut == "validee"
    assert {s.role for s in traitement.signatures} == {"CHEF_EQUIPE"}


def test_valider_terrestre_consultant_renseigne_sans_signature_bloque():
    traitement = _traitement_terrestre_valide(consultant_international="Dr. Smith")
    with pytest.raises(SignaturesManquantesError):
        traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])


def test_valider_terrestre_surface_restante_abandonnee_sans_motif_bloque():
    traitement = _traitement_terrestre_valide(
        surface_restante_abandonnee=True, motif_surface_restante_abandonnee=None
    )
    with pytest.raises(MotifAbandonManquantError):
        traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])


def test_valider_terrestre_surface_restante_abandonnee_avec_motif_ok():
    traitement = _traitement_terrestre_valide(
        surface_restante_abandonnee=True,
        motif_surface_restante_abandonnee="Zone inaccessible (crue)",
    )
    traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])
    assert traitement.statut == "validee"


def test_valider_role_signature_invalide_pour_type_traitement():
    traitement = _traitement_terrestre_valide()
    with pytest.raises(ValueError):
        traitement.valider(
            date(2026, 8, 12),
            [
                {"role": "CHEF_EQUIPE", "signataire_nom": "Hery"},
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
            ],
        )


def test_valider_date_validation_posterieure_bloque():
    traitement = _traitement_aerien_valide()
    with pytest.raises(ValueError):
        traitement.valider(
            date(2026, 8, 14),
            [
                {"role": "PILOTE", "signataire_nom": "J. Dupont"},
                {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
                {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
            ],
        )


def test_valider_fiche_deja_validee_leve_verrouille():
    traitement = _traitement_aerien_valide()
    traitement.statut = "validee"
    with pytest.raises(TraitementVerrouilleError):
        traitement.valider(date(2026, 8, 12), [])


# ==========================================
# ValiderTraitement (use case, fake repo)
# ==========================================


class FakeTraitementRepoValidation:
    def __init__(self, traitement: Traitement | None):
        self.traitement = traitement
        self.appels_valider: list[tuple] = []

    async def get_by_id(self, traitement_id):
        return self.traitement

    async def valider(self, traitement_id, date_validation, signatures):
        self.appels_valider.append((traitement_id, date_validation, signatures))
        self.traitement.date_validation = date_validation
        self.traitement.statut = "validee"
        self.traitement.signatures = signatures
        return self.traitement


@pytest.mark.asyncio
async def test_valider_traitement_use_case_persiste_et_retourne():
    traitement = _traitement_aerien_valide()
    repo = FakeTraitementRepoValidation(traitement)
    use_case = ValiderTraitement(repo)

    resultat = await use_case.execute(
        traitement_id=traitement.id,
        date_validation=date(2026, 8, 12),
        signatures=[
            {"role": "PILOTE", "signataire_nom": "J. Dupont"},
            {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
            {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
        ],
    )

    assert resultat.statut == "validee"
    assert len(repo.appels_valider) == 1


@pytest.mark.asyncio
async def test_valider_traitement_use_case_introuvable():
    repo = FakeTraitementRepoValidation(None)
    use_case = ValiderTraitement(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(
            traitement_id=uuid.uuid4(), date_validation=date(2026, 8, 12), signatures=[]
        )


# ==========================================
# contenu_diverge (synchronisation — décision #60)
# ==========================================


def _traitement_terrestre_sync(**overrides) -> Traitement:
    """Traitement TERRESTRE avec tous les champs de contenu explicites, pour tests
    de comparaison à deux versions (existant/entrant) — chaque champ doit être fixé
    pour éviter que default_factory(uuid4) crée une divergence artificielle."""
    args = dict(
        id=uuid.uuid4(),
        prospection_id=uuid.uuid4(),
        numero_fiche="Hery-Terrestre-2026-08-11",
        mode_traitement=None,
        date_traitement=date(2026, 8, 11),
        date_validation=date(2026, 8, 10),
        localite="Betioky",
        region=None,
        district=None,
        commune=None,
        latitude=None,
        longitude=None,
        altitude=None,
        kit_combinaison=False,
        kit_gants=False,
        kit_lunettes=False,
        kit_masques=False,
        kit_boite=False,
        zones_exposees=None,
        hauteur_strate_herbeuse_m=None,
        hauteur_strate_arboree_m=None,
        recouvrement_percent=None,
        empoisonnement=False,
        empoisonnement_type=None,
        empoisonnement_mode=None,
        empoisonnement_autre=None,
        evaluation_risque=None,
        comportement_anormal=False,
        comportement_non_cibles=None,
        mortalite=False,
        mortalite_familles=None,
        statut="brouillon",
        statut_sync="local",
        created_at=datetime(2026, 8, 11, 7, 0),
        updated_at=datetime(2026, 8, 11, 7, 0),
    )
    terrestre_args = dict(
        heure_debut=time(6, 0),
        heure_fin=time(9, 0),
        vitesse_vent_ms=1.5,
        direction_vent=None,
        temperature_c=24.0,
        reprise_traitement=False,
        traitement_origine_id=None,
        chef_equipe_id=uuid.uuid4(),
        agent_encadreur_id=None,
        consultant_international=None,
        surface_atomiseur_ha=10.0,
        surface_disque_rotatif_ha=None,
        surface_ulvamast_ha=None,
        surface_restante_abandonnee=None,
        motif_surface_restante_abandonnee=None,
        essence_litres=None,
        nb_piles=None,
    )
    for cle, valeur in overrides.items():
        if cle in terrestre_args:
            terrestre_args[cle] = valeur
        elif cle in args:
            args[cle] = valeur
    return Traitement(
        type_traitement="TERRESTRE", terrestre=TraitementTerrestre(**terrestre_args), **args
    )


def test_contenu_diverge_identique_renvoi_reseau():
    existant = _traitement_terrestre_sync()
    entrant = copy.deepcopy(existant)
    assert contenu_diverge(existant, entrant) is False


def test_contenu_diverge_champ_commun_different():
    existant = _traitement_terrestre_sync()
    entrant = _traitement_terrestre_sync(localite="Ampanihy")
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_champ_terrestre_different():
    existant = _traitement_terrestre_sync()
    entrant = _traitement_terrestre_sync(surface_atomiseur_ha=99.0)
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_champ_aerien_different():
    existant = _traitement_aerien_valide(pilote="J. Dupont")
    entrant = _traitement_aerien_valide(pilote="Autre Pilote")
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_ignore_statut_sync_et_updated_at():
    existant = _traitement_terrestre_sync(statut_sync="local")
    entrant = copy.deepcopy(existant)
    entrant.statut_sync = "synced"
    entrant.updated_at = existant.updated_at.replace(year=existant.updated_at.year + 1)
    assert contenu_diverge(existant, entrant) is False


# ==========================================
# SyncPushTraitementTerrestre (synchronisation offline — décision #60)
# ==========================================


class FakeTraitementRepoSync:
    def __init__(self, existant: Traitement | None = None):
        self.existant = existant
        self.crees: list[Traitement] = []
        self.synced: list[Traitement] = []
        self.conflicts_marques: list[uuid.UUID] = []

    async def get_by_id(self, traitement_id):
        if self.existant is not None and traitement_id == self.existant.id:
            return self.existant
        return None

    async def create(self, traitement: Traitement) -> Traitement:
        self.crees.append(traitement)
        return traitement

    async def list_by_filters(self, **kwargs):
        return []

    async def origine_deja_utilisee(self, traitement_origine_id, exclude_traitement_id=None):
        return False

    async def update_sync(self, traitement: Traitement) -> Traitement:
        traitement.statut_sync = "synced"
        self.synced.append(traitement)
        return traitement

    async def marquer_conflict(self, traitement_id):
        self.conflicts_marques.append(traitement_id)
        self.existant.statut_sync = "conflict"
        return self.existant


_CHEF_EQUIPE = UtilisateurRef(id=uuid.uuid4(), prenom="Hery", role="chef_equipe")
_PROSPECTION_ID_SYNC = uuid.uuid4()


def _sync_terrestre_args(fiche_id, base_updated_at, **overrides):
    args = dict(
        traitement_id=fiche_id,
        base_updated_at=base_updated_at,
        prospection_id=_PROSPECTION_ID_SYNC,
        date_traitement=date(2026, 8, 11),
        date_validation=date(2026, 8, 10),
        localite="Betioky",
        heure_debut=time(6, 0),
        heure_fin=time(9, 0),
        vitesse_vent_ms=1.5,
        temperature_c=24.0,
        chef_equipe_id=_CHEF_EQUIPE.id,
        surface_atomiseur_ha=10.0,
        surface_restante_abandonnee=False,
        numero_fiche="Hery-Terrestre-2026-08-11",
    )
    args.update(overrides)
    return args


def _sync_use_case(existant: Traitement | None = None):
    repo = FakeTraitementRepoSync(existant=existant)
    return (
        SyncPushTraitementTerrestre(
            traitement_repository=repo,
            prospection_repository=FakeProspectionRepo(
                _prospection(id=_PROSPECTION_ID_SYNC, surface_infestee=100.0)
            ),
            utilisateur_repository=FakeUtilisateurRepo(_CHEF_EQUIPE),
        ),
        repo,
    )


@pytest.mark.asyncio
async def test_sync_push_terrestre_creation_id_inconnu():
    fiche_id = uuid.uuid4()
    use_case, repo = _sync_use_case(existant=None)

    traitement, cree = await use_case.execute(
        **_sync_terrestre_args(fiche_id, base_updated_at=datetime.utcnow())
    )

    assert cree is True
    assert traitement.statut_sync == "synced"
    assert repo.crees == [traitement]


@pytest.mark.asyncio
async def test_sync_push_terrestre_resync_sans_numero_fiche_regenere_a_l_identique():
    """Une resync sans `numero_fiche` fourni le régénère de façon déterministe
    (prénom+date+type, sans suffixe) — ne doit jamais provoquer un faux conflit tant que
    chef_equipe_id/date_traitement n'ont pas changé."""
    fiche_id = uuid.uuid4()
    ancien_updated_at = datetime(2026, 8, 11, 8, 0)
    updated_at_serveur = datetime(2026, 8, 11, 9, 0)
    args = _sync_terrestre_args(fiche_id, base_updated_at=ancien_updated_at)
    args.pop("numero_fiche")

    existant = _traitement_terrestre_sync(
        id=fiche_id,
        prospection_id=args["prospection_id"],
        numero_fiche="Hery-Terrestre-2026-08-11",
        localite=args["localite"],
        chef_equipe_id=args["chef_equipe_id"],
        surface_atomiseur_ha=args["surface_atomiseur_ha"],
        surface_restante_abandonnee=args["surface_restante_abandonnee"],
        statut_sync="synced",
        updated_at=updated_at_serveur,
    )
    use_case, repo = _sync_use_case(existant=existant)

    traitement, cree = await use_case.execute(**args)

    assert cree is False
    assert traitement.statut_sync == "synced"
    assert repo.conflicts_marques == []


@pytest.mark.asyncio
async def test_sync_push_terrestre_renvoi_reseau_sans_conflit():
    """Contenu identique, updated_at serveur postérieur au updated_at connu du client :
    simple renvoi réseau (décision #60), traité `synced` sans conflit."""
    fiche_id = uuid.uuid4()
    ancien_updated_at = datetime(2026, 8, 11, 8, 0)
    updated_at_serveur = datetime(2026, 8, 11, 9, 0)
    args = _sync_terrestre_args(fiche_id, base_updated_at=ancien_updated_at)

    existant = _traitement_terrestre_sync(
        id=fiche_id,
        prospection_id=args["prospection_id"],
        numero_fiche=args["numero_fiche"],
        localite=args["localite"],
        chef_equipe_id=args["chef_equipe_id"],
        surface_atomiseur_ha=args["surface_atomiseur_ha"],
        surface_restante_abandonnee=args["surface_restante_abandonnee"],
        statut_sync="synced",
        updated_at=updated_at_serveur,
    )
    use_case, repo = _sync_use_case(existant=existant)

    traitement, cree = await use_case.execute(**args)

    assert cree is False
    assert traitement.statut_sync == "synced"
    assert repo.conflicts_marques == []


@pytest.mark.asyncio
async def test_sync_push_terrestre_conflit_contenu_divergent():
    """updated_at serveur postérieur ET contenu divergent -> 409, statut_sync=conflict."""
    fiche_id = uuid.uuid4()
    ancien_updated_at = datetime(2026, 8, 11, 8, 0)
    updated_at_serveur = datetime(2026, 8, 11, 9, 0)
    args = _sync_terrestre_args(fiche_id, base_updated_at=ancien_updated_at)

    existant = _traitement_terrestre_sync(
        id=fiche_id,
        prospection_id=args["prospection_id"],
        numero_fiche=args["numero_fiche"],
        localite="Modifiee par le superviseur",
        chef_equipe_id=args["chef_equipe_id"],
        surface_atomiseur_ha=args["surface_atomiseur_ha"],
        statut_sync="synced",
        updated_at=updated_at_serveur,
    )
    use_case, repo = _sync_use_case(existant=existant)

    with pytest.raises(TraitementSyncConflitError) as exc_info:
        await use_case.execute(**args)

    assert repo.conflicts_marques == [fiche_id]
    assert exc_info.value.traitement_serveur.statut_sync == "conflict"


@pytest.mark.asyncio
async def test_sync_push_terrestre_fiche_validee_rejetee_sans_comparaison():
    """Une fiche déjà `validee` rejette systématiquement, sans jamais passer par conflict."""
    fiche_id = uuid.uuid4()
    args = _sync_terrestre_args(fiche_id, base_updated_at=datetime.utcnow())

    existant = _traitement_terrestre_sync(
        id=fiche_id,
        prospection_id=args["prospection_id"],
        numero_fiche=args["numero_fiche"],
        localite="Autre chose",
        chef_equipe_id=args["chef_equipe_id"],
        statut="validee",
        statut_sync="synced",
        updated_at=datetime(2026, 8, 11, 9, 0),
    )
    use_case, repo = _sync_use_case(existant=existant)

    with pytest.raises(TraitementValideeSyncRejeteError):
        await use_case.execute(**args)

    assert repo.conflicts_marques == []
    assert existant.statut_sync == "synced"
