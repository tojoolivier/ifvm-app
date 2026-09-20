import copy
import uuid
from datetime import date, datetime, time

import pytest

from app.application.traitement_use_cases import (
    AddProduitUtilise,
    AddRotation,
    CreateTraitementAerien,
    CreateTraitementTerrestre,
    GenererTraitementPdf,
    RemoveProduitUtilise,
    RemoveRotation,
    SyncPushTraitementTerrestre,
    UpdateRotation,
    ValiderTraitement,
)
from app.domain.prospection import Prospection, ProspectionCapture, ProspectionPopulation
from app.domain.traitement import (
    BlocModeIncoherentError,
    BlocSurfaceDepasseInfesteeError,
    ChefDeBaseInvalideError,
    ChefEquipeInvalideError,
    Cible,
    MotifAbandonManquantError,
    NumeroFicheConflitError,
    ProduitUtilise,
    ProduitUtiliseIntrouvableError,
    ProspectionIntrouvableError,
    RolesAerienNonDistinctsError,
    Rotation,
    RotationIntrouvableError,
    SignaturesManquantesError,
    Traitement,
    TraitementAerien,
    TraitementIntrouvableError,
    TraitementNonValideeError,
    TraitementOrigineDejaUtiliseeError,
    TraitementOrigineIntrouvableError,
    TraitementSyncConflitError,
    TraitementTerrestre,
    TraitementValideeSyncRejeteError,
    TraitementVerrouilleError,
    construire_cible,
    contenu_diverge,
    generer_numero_fiche,
    valider_surfaces_bloc,
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
    # Petites larves = L1 a L3 cumules (pas seulement L1/L2) ; grandes larves
    # = le reste (L4 et au-dela).
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
    assert cible.petites_larves == "22"
    assert cible.grandes_larves == "3"


def test_cible_detail_par_espece_petites_grandes_larves():
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC",
                categorie="larve",
                densites_larve={"L1": 10, "L2": 5, "L3": 7, "L5": 3},
            ),
            ProspectionPopulation(
                espece="NSE",
                categorie="larve",
                densites_larve={"L1": 2, "L4": 1, "L7": 4},
            ),
        ]
    )
    cible = construire_cible(p)
    assert cible.petites_larves_lmc == 22
    assert cible.grandes_larves_lmc == 3
    assert cible.petites_larves_nse == 2
    assert cible.grandes_larves_nse == 5
    # Totaux agreges (ecran Cibles, Terrestre) inchanges : somme des 2 especes.
    assert cible.petites_larves == "24"
    assert cible.grandes_larves == "8"


def test_cible_detail_par_espece_absente_reste_non_renseigne():
    p = _prospection(
        populations=[
            ProspectionPopulation(espece="LMC", categorie="larve", densites_larve={"L1": 10})
        ]
    )
    cible = construire_cible(p)
    assert cible.petites_larves_lmc == 10
    assert cible.petites_larves_nse is None
    assert cible.grandes_larves_nse is None


def test_cible_larves_via_prospection_capture_intensif():
    """Intensif (fusion des écrans B/C, cf. intensive-imagos.tsx/intensive-
    larves.tsx) : les effectifs larvaires par stade sont posés sur des lignes
    ProspectionCapture (categorie="larve"), jamais sur densites_larve (propre
    à l'Extensif) — avant ce correctif, "Cibles"/"Synthèse" affichaient
    toujours "non renseigné" pour les larves d'une fiche de traitement issue
    d'une prospection Intensive (#cible-intensif-larves-non-renseigne)."""
    p = _prospection(
        captures=[
            ProspectionCapture(
                espece="LMC", categorie="larve", phase="gregaire", stade="L1", effectif=10
            ),
            ProspectionCapture(
                espece="LMC", categorie="larve", phase="gregaire", stade="L5", effectif=3
            ),
            # Une capture imago ne doit jamais être comptée comme larve.
            ProspectionCapture(
                espece="LMC", categorie="imago", phase="gregaire", stade="F", effectif=99
            ),
        ]
    )
    cible = construire_cible(p)
    assert cible.petites_larves == "10"
    assert cible.grandes_larves == "3"
    assert cible.petites_larves_lmc == 10
    assert cible.grandes_larves_lmc == 3
    assert cible.petites_larves_nse is None


def test_cible_larves_cumule_densites_larve_et_prospection_capture():
    """Les deux sources ne se recouvrent jamais pour une même prospection
    (l'Extensif n'écrit jamais dans ProspectionCapture, l'Intensif jamais dans
    densites_larve) : vérifie qu'elles s'additionnent sans s'écraser si les
    deux sont présentes (garde-fou défensif, pas un scénario réel)."""
    p = _prospection(
        populations=[
            ProspectionPopulation(espece="NSE", categorie="larve", densites_larve={"L1": 2}),
        ],
        captures=[
            ProspectionCapture(
                espece="NSE", categorie="larve", phase="gregaire", stade="L1", effectif=5
            ),
        ],
    )
    cible = construire_cible(p)
    assert cible.petites_larves_nse == 7


def test_cible_detail_par_espece_densites_diffuse_groupee():
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC", categorie="imago", densite_diffuse=12.0, densite_groupee=3.0
            ),
            ProspectionPopulation(espece="LMC", categorie="larve", densite_diffuse=8.0),
            ProspectionPopulation(espece="NSE", categorie="imago", densite_diffuse=5.0),
        ]
    )
    cible = construire_cible(p)
    # LMC : cumul des lignes imago + larve de cette espece (20 = 12 + 8).
    assert cible.densite_diffuse_lmc == 20.0
    assert cible.densite_groupee_lmc == 3.0
    assert cible.densite_diffuse_nse == 5.0
    assert cible.densite_groupee_nse is None


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


def test_cible_essaim_en_vol_extensif_imagos_migration_0033():
    """essaim_observe a été remplacé par essaim_en_vol/essaim_pose pour l'Extensif
    Imagos (migration 0033) — jamais renseigné pour ces fiches-là, d'où
    "Vols/essaims" toujours "non renseigné" en Synthèse de traitement avant ce
    correctif, alors même que l'essaim était bien saisi (État Repos/Déplacement,
    cf. extensive-recap.tsx côté mobile)."""
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC",
                categorie="imago",
                essaim_observe=None,
                essaim_en_vol=True,
                essaim_pose=False,
            )
        ]
    )
    assert construire_cible(p).vols_clairs_essaims == "oui"


def test_cible_essaim_pose_extensif_imagos_migration_0033():
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC",
                categorie="imago",
                essaim_observe=None,
                essaim_en_vol=False,
                essaim_pose=True,
            )
        ]
    )
    assert construire_cible(p).vols_clairs_essaims == "oui"


def test_cible_essaim_ni_observe_ni_en_vol_pose_reste_non_renseigne():
    """Extensif Imagos sans État sélectionné : aucun des deux modèles n'est
    renseigné, le champ reste `None` (« non renseigné »), comme avant."""
    p = _prospection(
        populations=[
            ProspectionPopulation(
                espece="LMC",
                categorie="imago",
                essaim_observe=None,
                essaim_en_vol=None,
                essaim_pose=None,
            )
        ]
    )
    assert construire_cible(p).vols_clairs_essaims is None


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
        pilote="Jean Dupont",
        mecanicien="Marc Rabe",
        chef_de_base_id=_CHEF.id,
        base_principale="Base Betioky",
        immatricule_aeronef="5R-XYZ",
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
async def test_creation_aerien_transmet_immatriculation_et_stock_pesticide():
    prospection = _prospection(
        surface_infestee=100.0,
        populations=[ProspectionPopulation(espece="LMC", categorie="imago")],
    )
    use_case, _ = _use_case(prospection=prospection, chef=_CHEF)
    traitement = await use_case.execute(
        **_args(
            immatricule_aeronef="5R-ABC",
            pesticide_recu_l=200.0,
        )
    )

    assert traitement.aerien.immatricule_aeronef == "5R-ABC"
    assert traitement.aerien.surface_traitee_ha == 0.0
    # Pas de rotation à la création (sous-ressource ajoutée après coup) : rien de
    # consommé, le stock = tout le reçu.
    assert traitement.aerien.surface_restante_ha == 100.0
    assert traitement.aerien.pesticide_stock_restant_l == 200.0


@pytest.mark.asyncio
async def test_creation_aerien_transmet_efficacite():
    prospection = _prospection(
        surface_infestee=100.0,
        populations=[ProspectionPopulation(espece="LMC", categorie="imago")],
    )
    use_case, _ = _use_case(prospection=prospection, chef=_CHEF)
    traitement = await use_case.execute(
        **_args(
            taux_mortalite_pourcent=92.0,
            evaluation_efficacite_heures_apres=24.0,
            methode_evaluation_efficacite="ESTIMATION_VISUELLE",
        )
    )

    assert traitement.aerien.taux_mortalite_pourcent == 92.0
    assert traitement.aerien.evaluation_efficacite_heures_apres == 24.0
    assert traitement.aerien.methode_evaluation_efficacite == "ESTIMATION_VISUELLE"


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
async def test_rejette_pilote_identique_au_chef_de_base():
    chef = UtilisateurRef(id=uuid.uuid4(), prenom="Jean", nom="Dupont", role="chef_de_base")
    use_case, _ = _use_case(prospection=_prospection(), chef=chef)
    with pytest.raises(RolesAerienNonDistinctsError):
        await use_case.execute(**_args(pilote="Jean Dupont"))


@pytest.mark.asyncio
async def test_rejette_pilote_identique_au_chef_de_base_casse_et_espaces_ignores():
    chef = UtilisateurRef(id=uuid.uuid4(), prenom="Jean", nom="Dupont", role="chef_de_base")
    use_case, _ = _use_case(prospection=_prospection(), chef=chef)
    with pytest.raises(RolesAerienNonDistinctsError):
        await use_case.execute(**_args(pilote="  jean   DUPONT  "))


@pytest.mark.asyncio
async def test_rejette_pilote_identique_au_mecanicien():
    use_case, _ = _use_case(prospection=_prospection(), chef=_CHEF)
    with pytest.raises(RolesAerienNonDistinctsError):
        await use_case.execute(**_args(pilote="Marc Rabe", mecanicien="Marc Rabe"))


@pytest.mark.asyncio
async def test_accepte_consultant_identique_au_pilote():
    """Le consultant est exempté de la règle de distinction (facultatif, non structurant)."""
    use_case, _ = _use_case(prospection=_prospection(), chef=_CHEF)
    traitement = await use_case.execute(
        **_args(pilote="Jean Dupont", consultant_international="Jean Dupont")
    )
    assert traitement.aerien.consultant_international == "Jean Dupont"


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
        produit_id=uuid.uuid4(),
        quantite=10.0,
        unite="L",
        surface_ha=1.0,
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
    assert aerien.total_pesticide_l == 0.0


def test_recalculer_totaux_trois_rotations():
    aerien = TraitementAerien()
    aerien.rotations = [
        _rotation(numero=1, quantite=10.0),
        _rotation(numero=2, quantite=15.5),
        _rotation(numero=3, quantite=8.25),
    ]
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 3
    assert aerien.total_pesticide_l == 33.75


def test_recalculer_totaux_cumuls_separes_par_unite():
    """Migration 0047 : une rotation dosée au litre (ULV) et une au kg (poudre) ne
    s'additionnent jamais dans le même total."""
    aerien = TraitementAerien()
    aerien.rotations = [
        _rotation(numero=1, quantite=10.0, unite="L"),
        _rotation(numero=2, quantite=15.5, unite="L"),
        _rotation(numero=3, quantite=4.0, unite="kg"),
    ]
    aerien.recalculer_totaux()
    assert aerien.total_pesticide_l == 25.5
    assert aerien.total_pesticide_kg == 4.0


def test_recalculer_totaux_apres_suppression():
    aerien = TraitementAerien()
    r1, r2 = _rotation(numero=1, quantite=10.0), _rotation(numero=2, quantite=5.0)
    aerien.rotations = [r1, r2]
    aerien.recalculer_totaux()
    aerien.rotations.remove(r1)
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 1
    assert aerien.total_pesticide_l == 5.0


def test_recalculer_totaux_derniere_suppression_repasse_a_none():
    aerien = TraitementAerien()
    r1 = _rotation(numero=1, quantite=10.0)
    aerien.rotations = [r1]
    aerien.recalculer_totaux()
    aerien.rotations.remove(r1)
    aerien.recalculer_totaux()
    assert aerien.nb_rotations == 0
    assert aerien.total_pesticide_l == 0.0


def test_recalculer_totaux_surface_traitee_somme_des_rotations():
    """Migration 0046 : pas d'équivalent aérien aux 3 surfaces par équipement du
    Terrestre, mais surface_traitee_ha n'est plus une saisie directe — recalculer_totaux()
    la dérive de la somme des `surface_ha` de chaque rotation."""
    aerien = TraitementAerien()
    aerien.rotations = [
        _rotation(numero=1, surface_ha=12.0),
        _rotation(numero=2, surface_ha=8.5),
    ]
    aerien.recalculer_totaux()
    assert aerien.surface_traitee_ha == 20.5
    aerien.recalculer_surfaces(surface_infestee_ha=100.0)
    assert aerien.surface_restante_ha == 79.5


def test_recalculer_totaux_sans_rotation_surface_traitee_zero():
    """Migration 0047 : surface_traitee_ha n'est plus nullable — sans rotation,
    recalculer_totaux() la remet à 0.0, jamais à None."""
    aerien = TraitementAerien()
    aerien.recalculer_totaux()
    assert aerien.surface_traitee_ha == 0.0


def test_recalculer_surfaces_aerien_restante_plancher_zero_cdg_9():
    aerien = TraitementAerien(surface_traitee_ha=80.0)
    aerien.recalculer_surfaces(surface_infestee_ha=50.0)
    assert aerien.surface_restante_ha == 0.0


def test_recalculer_surfaces_aerien_infestee_none_restante_none():
    aerien = TraitementAerien(surface_traitee_ha=30.0)
    aerien.recalculer_surfaces(surface_infestee_ha=None)
    assert aerien.surface_restante_ha is None


def test_recalculer_surfaces_aerien_sans_cumul_precedent_par_defaut():
    """Migration 0050 : surface_cumulee_precedente est optionnel (0.0 par défaut,
    fiche indépendante) — surface_cumulee_ha vaut alors simplement surface_traitee_ha."""
    aerien = TraitementAerien(surface_traitee_ha=10.0)
    aerien.recalculer_surfaces(100.0)
    assert aerien.surface_cumulee_ha == 10.0
    assert aerien.surface_restante_ha == 90.0


def test_recalculer_surfaces_aerien_avec_cumul_precedent():
    """Migration 0050 : chaînage de reprise généralisé à l'Aérien, mirroir de
    test_recalculer_surfaces_avec_cumul_precedent (Terrestre)."""
    aerien = TraitementAerien(surface_traitee_ha=10.0)
    aerien.recalculer_surfaces(surface_infestee_ha=100.0, surface_cumulee_precedente=30.0)
    assert aerien.surface_traitee_ha == 10.0
    assert aerien.surface_cumulee_ha == 40.0
    assert aerien.surface_restante_ha == 60.0


def test_recalculer_totaux_aerien_alimente_le_stock_pesticide():
    aerien = TraitementAerien(pesticide_recu_l=200.0)
    aerien.rotations = [_rotation(numero=1, quantite=60.0)]
    aerien.recalculer_totaux()
    assert aerien.total_pesticide_l == 60.0
    assert aerien.pesticide_stock_restant_l == 140.0


def test_recalculer_stock_pesticide_aerien_sans_reception_reste_none():
    aerien = TraitementAerien()
    aerien.rotations = [_rotation(numero=1, quantite=60.0)]
    aerien.recalculer_totaux()
    assert aerien.pesticide_stock_restant_l is None


def test_recalculer_stock_pesticide_aerien_plancher_zero_surconsommation():
    """Consommation > réception (ex. pesticide partagé avec une autre fiche) :
    le stock ne descend jamais sous 0, même convention que surface_restante_ha."""
    aerien = TraitementAerien(pesticide_recu_l=50.0)
    aerien.rotations = [_rotation(numero=1, quantite=80.0)]
    aerien.recalculer_totaux()
    assert aerien.pesticide_stock_restant_l == 0.0


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

    async def add_rotation(
        self,
        traitement_id,
        rotation,
        nb_rotations,
        total_pesticide_l,
        total_pesticide_kg,
        surface_traitee_ha,
        surface_cumulee_ha,
        surface_restante_ha,
        pesticide_stock_restant_l,
    ):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        self.traitement.aerien.total_pesticide_kg = total_pesticide_kg
        self.traitement.aerien.surface_traitee_ha = surface_traitee_ha
        self.traitement.aerien.surface_cumulee_ha = surface_cumulee_ha
        self.traitement.aerien.surface_restante_ha = surface_restante_ha
        self.traitement.aerien.pesticide_stock_restant_l = pesticide_stock_restant_l
        return self.traitement

    async def update_rotation(
        self,
        traitement_id,
        rotation,
        nb_rotations,
        total_pesticide_l,
        total_pesticide_kg,
        surface_traitee_ha,
        surface_cumulee_ha,
        surface_restante_ha,
        pesticide_stock_restant_l,
    ):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        self.traitement.aerien.total_pesticide_kg = total_pesticide_kg
        self.traitement.aerien.surface_traitee_ha = surface_traitee_ha
        self.traitement.aerien.surface_cumulee_ha = surface_cumulee_ha
        self.traitement.aerien.surface_restante_ha = surface_restante_ha
        self.traitement.aerien.pesticide_stock_restant_l = pesticide_stock_restant_l
        return self.traitement

    async def remove_rotation(
        self,
        traitement_id,
        rotation_id,
        nb_rotations,
        total_pesticide_l,
        total_pesticide_kg,
        surface_traitee_ha,
        surface_cumulee_ha,
        surface_restante_ha,
        pesticide_stock_restant_l,
    ):
        self.traitement.aerien.nb_rotations = nb_rotations
        self.traitement.aerien.total_pesticide_l = total_pesticide_l
        self.traitement.aerien.total_pesticide_kg = total_pesticide_kg
        self.traitement.aerien.surface_traitee_ha = surface_traitee_ha
        self.traitement.aerien.surface_cumulee_ha = surface_cumulee_ha
        self.traitement.aerien.surface_restante_ha = surface_restante_ha
        self.traitement.aerien.pesticide_stock_restant_l = pesticide_stock_restant_l
        return self.traitement


def _traitement_aerien(rotations: list[Rotation] | None = None) -> Traitement:
    aerien = TraitementAerien()
    aerien.rotations = rotations or []
    return Traitement(aerien=aerien)


def _rotation_args(**overrides):
    # numero_cuve n'y figure pas : dérivé côté serveur (migration 0047), plus un
    # paramètre d'AddRotation/UpdateRotation.
    args = dict(
        produit_id=uuid.uuid4(),
        quantite=10.0,
        unite="L",
        surface_ha=1.0,
        temperature_debut_c=25.0,
        temperature_fin_c=27.0,
        vent_debut_ms=2.0,
        vent_fin_ms=3.0,
        heure_debut=time(6, 0),
        heure_ouverture_vanne=time(6, 5),
        heure_fermeture_vanne=time(6, 25),
        heure_fin=time(6, 30),
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
    existante = _rotation(numero=1, quantite=10.0)
    traitement = _traitement_aerien([existante])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)

    await use_case.execute(traitement_id=traitement.id, **_rotation_args(quantite=5.0))

    assert [r.numero for r in traitement.aerien.rotations] == [1, 2]
    assert traitement.aerien.nb_rotations == 2
    assert traitement.aerien.total_pesticide_l == 15.0


@pytest.mark.asyncio
async def test_add_rotation_numero_cuve_derive_jamais_saisi():
    """Migration 0047 : numero_cuve n'est plus un paramètre d'AddRotation — il est
    toujours dérivé de numero (str(numero)), quoi que le client ait pu envoyer."""
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)

    await use_case.execute(traitement_id=traitement.id, **_rotation_args())
    await use_case.execute(traitement_id=traitement.id, **_rotation_args())

    assert [r.numero_cuve for r in traitement.aerien.rotations] == ["1", "2"]


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
async def test_add_rotation_rejette_heure_fin_anterieure_ou_egale():
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)
    with pytest.raises(ValueError):
        await use_case.execute(
            traitement_id=traitement.id,
            **_rotation_args(heure_debut=time(9, 0), heure_fin=time(9, 0)),
        )


@pytest.mark.asyncio
async def test_add_rotation_rejette_heure_fermeture_vanne_anterieure_ou_egale():
    traitement = _traitement_aerien()
    repo = FakeTraitementRepoRotations(traitement)
    use_case = AddRotation(repo)
    with pytest.raises(ValueError):
        await use_case.execute(
            traitement_id=traitement.id,
            **_rotation_args(heure_ouverture_vanne=time(9, 10), heure_fermeture_vanne=time(9, 10)),
        )


@pytest.mark.asyncio
async def test_update_rotation_recalcule_totaux():
    existante = _rotation(numero=1, quantite=10.0)
    traitement = _traitement_aerien([existante])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = UpdateRotation(repo)

    resultat = await use_case.execute(
        traitement_id=traitement.id,
        rotation_id=existante.id,
        **_rotation_args(quantite=20.0),
    )

    assert resultat.aerien.nb_rotations == 1
    assert resultat.aerien.total_pesticide_l == 20.0
    assert existante.quantite == 20.0


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
async def test_update_rotation_rejette_heure_fin_anterieure_ou_egale():
    existante = _rotation(numero=1)
    traitement = _traitement_aerien([existante])
    repo = FakeTraitementRepoRotations(traitement)
    use_case = UpdateRotation(repo)
    with pytest.raises(ValueError):
        await use_case.execute(
            traitement_id=traitement.id,
            rotation_id=existante.id,
            **_rotation_args(heure_debut=time(9, 0), heure_fin=time(8, 0)),
        )


@pytest.mark.asyncio
async def test_remove_rotation_recalcule_totaux():
    r1 = _rotation(numero=1, quantite=10.0)
    r2 = _rotation(numero=2, quantite=5.0)
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
        surface_atomiseur_ha=10.0,
        surface_disque_rotatif_ha=5.5,
        surface_atomiseur_autoporte_ha=2.25,
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
async def test_creation_terrestre_transmet_stock_pesticide():
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(
        **_args_terrestre(surface_restante_abandonnee=False, pesticide_recu_l=150.0)
    )

    assert traitement.terrestre.pesticide_recu_l == 150.0
    # Pas de produit à la création (sous-ressource ajoutée après coup) : rien de
    # consommé, le stock = tout le reçu.
    assert traitement.terrestre.pesticide_stock_restant_l == 150.0


@pytest.mark.asyncio
async def test_creation_terrestre_transmet_stock_initial():
    """`stock_initial_l` (#stock-initial-terrestre) entre dans le calcul du
    stock final au même titre que `pesticide_recu_l`."""
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(
        **_args_terrestre(
            surface_restante_abandonnee=False, stock_initial_l=40.0, pesticide_recu_l=150.0
        )
    )

    assert traitement.terrestre.stock_initial_l == 40.0
    assert traitement.terrestre.pesticide_stock_restant_l == 190.0


@pytest.mark.asyncio
async def test_creation_terrestre_transmet_efficacite():
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(
        **_args_terrestre(
            surface_restante_abandonnee=False,
            taux_mortalite_pourcent=87.5,
            evaluation_efficacite_heures_apres=6.0,
            methode_evaluation_efficacite="COMPTAGES_PRE_POST",
        )
    )

    assert traitement.terrestre.taux_mortalite_pourcent == 87.5
    assert traitement.terrestre.evaluation_efficacite_heures_apres == 6.0
    assert traitement.terrestre.methode_evaluation_efficacite == "COMPTAGES_PRE_POST"


@pytest.mark.asyncio
async def test_creation_terrestre_efficacite_facultative():
    prospection = _prospection(surface_infestee=100.0)
    use_case, _ = _use_case_terrestre(prospection=prospection, chef=_CHEF_EQUIPE)
    traitement = await use_case.execute(**_args_terrestre(surface_restante_abandonnee=False))

    assert traitement.terrestre.taux_mortalite_pourcent is None
    assert traitement.terrestre.evaluation_efficacite_heures_apres is None
    assert traitement.terrestre.methode_evaluation_efficacite is None


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


def test_recalculer_total_pesticide_terrestre_alimente_le_stock():
    terrestre = TraitementTerrestre(pesticide_recu_l=100.0)
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l == 60.0


def test_recalculer_stock_pesticide_terrestre_sans_reception_reste_none():
    terrestre = TraitementTerrestre()
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l is None


def test_recalculer_stock_pesticide_terrestre_plancher_zero_surconsommation():
    terrestre = TraitementTerrestre(pesticide_recu_l=20.0)
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l == 0.0


def test_recalculer_stock_pesticide_terrestre_integre_le_stock_initial():
    """`pesticide_stock_restant_l` (« Stock final ») = stock initial + reçu −
    consommé — pas seulement reçu − consommé (#stock-initial-terrestre)."""
    terrestre = TraitementTerrestre(stock_initial_l=30.0, pesticide_recu_l=100.0)
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l == 90.0


def test_recalculer_stock_pesticide_terrestre_stock_initial_seul_sans_approvisionnement():
    """Stock initial seul (sans réception) suffit à déduire un stock final —
    contrairement à `pesticide_recu_l` seul, "reçu" n'est plus la seule source
    possible depuis l'ajout du stock initial."""
    terrestre = TraitementTerrestre(stock_initial_l=50.0)
    terrestre.produits = [_produit(numero=1, quantite_l=20.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l == 30.0


def test_recalculer_stock_pesticide_terrestre_ni_initial_ni_recu_reste_none():
    terrestre = TraitementTerrestre()
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l is None


def test_recalculer_stock_pesticide_terrestre_stock_initial_plancher_zero_surconsommation():
    terrestre = TraitementTerrestre(stock_initial_l=10.0, pesticide_recu_l=10.0)
    terrestre.produits = [_produit(numero=1, quantite_l=40.0)]
    terrestre.recalculer_total_pesticide()
    assert terrestre.pesticide_stock_restant_l == 0.0


def test_recalculer_stock_pesticide_aerien_sans_stock_initial_inchange():
    """Aérien n'a pas de `stock_initial_l` : `_stock_pesticide_restant` doit se
    comporter exactement comme avant l'ajout du stock initial (Terrestre)."""
    aerien = TraitementAerien(pesticide_recu_l=200.0)
    aerien.rotations = [_rotation(numero=1, quantite=60.0)]
    aerien.recalculer_totaux()
    assert aerien.pesticide_stock_restant_l == 140.0


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

    async def add_produit(
        self, traitement_id, produit, total_pesticide_l, pesticide_stock_restant_l
    ):
        self.traitement.terrestre.total_pesticide_l = total_pesticide_l
        self.traitement.terrestre.pesticide_stock_restant_l = pesticide_stock_restant_l
        return self.traitement

    async def remove_produit(
        self, traitement_id, produit_id, total_pesticide_l, pesticide_stock_restant_l
    ):
        self.traitement.terrestre.total_pesticide_l = total_pesticide_l
        self.traitement.terrestre.pesticide_stock_restant_l = pesticide_stock_restant_l
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
# Traitement.verifier_disponible_pour_pdf / GenererTraitementPdf (#495)
# ==========================================


def test_verifier_disponible_pour_pdf_brouillon_leve_non_validee():
    with pytest.raises(TraitementNonValideeError):
        Traitement(statut="brouillon").verifier_disponible_pour_pdf()


def test_verifier_disponible_pour_pdf_validee_ne_leve_pas():
    Traitement(statut="validee").verifier_disponible_pour_pdf()


@pytest.mark.asyncio
async def test_generer_traitement_pdf_inexistant_leve_introuvable():
    repo = FakeTraitementRepo(traitements_par_id={})
    use_case = GenererTraitementPdf(repo)
    with pytest.raises(TraitementIntrouvableError):
        await use_case.execute(uuid.uuid4())


@pytest.mark.asyncio
async def test_generer_traitement_pdf_brouillon_leve_non_validee():
    traitement = Traitement(statut="brouillon")
    repo = FakeTraitementRepo(traitements_par_id={traitement.id: traitement})
    use_case = GenererTraitementPdf(repo)
    with pytest.raises(TraitementNonValideeError):
        await use_case.execute(traitement.id)


@pytest.mark.asyncio
async def test_generer_traitement_pdf_validee_retourne_le_traitement():
    traitement = Traitement(statut="validee")
    repo = FakeTraitementRepo(traitements_par_id={traitement.id: traitement})
    use_case = GenererTraitementPdf(repo)
    assert await use_case.execute(traitement.id) is traitement


# ==========================================
# Traitement.valider — matrice de signatures (CDG §9)
# ==========================================


def _traitement_aerien_valide(**overrides) -> Traitement:
    args = dict(
        pilote="Jean Dupont",
        mecanicien="Marc Rabe",
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
        agent_encadreur=None,
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


def test_valider_persiste_le_trace_de_signature_quand_fourni():
    traitement = _traitement_aerien_valide()
    signatures = traitement.valider(
        date(2026, 8, 12),
        [
            {"role": "PILOTE", "signataire_nom": "J. Dupont", "signature_image": "M0 0 L10 10"},
            {"role": "MECANICIEN", "signataire_nom": "M. Rabe"},
            {"role": "CHEF_DE_BASE", "signataire_nom": "Hery"},
        ],
    )
    par_role = {s.role: s for s in signatures}
    assert par_role["PILOTE"].signature_image == "M0 0 L10 10"
    # Rétrocompatibilité : une signature sans tracé reste acceptée (None).
    assert par_role["MECANICIEN"].signature_image is None


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
    traitement = _traitement_terrestre_valide(agent_encadreur=None)
    traitement.valider(date(2026, 8, 12), [{"role": "CHEF_EQUIPE", "signataire_nom": "Hery"}])
    assert traitement.statut == "validee"


def test_valider_terrestre_agent_encadreur_renseigne_ne_signe_jamais():
    traitement = _traitement_terrestre_valide(agent_encadreur="Rakoto Jean")
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
        kit_combinaison=0,
        kit_gants=0,
        kit_lunettes=0,
        kit_masques=0,
        kit_botte=0,
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
        agent_encadreur=None,
        consultant_international=None,
        surface_atomiseur_ha=10.0,
        surface_disque_rotatif_ha=None,
        surface_atomiseur_autoporte_ha=None,
        surface_restante_abandonnee=None,
        motif_surface_restante_abandonnee=None,
        essence_litres=None,
        nb_piles=None,
        pesticide_recu_l=None,
        stock_initial_l=None,
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


def test_valider_surfaces_bloc_total_avec_surface_protegee_refuse():
    """#surface-bloc-mode-infestee : TOTAL (choc) n'attend que surface_traitee_ha."""
    with pytest.raises(BlocModeIncoherentError):
        valider_surfaces_bloc("TOTAL", None, surface_protegee_ha=10.0, surface_traitee_ha=None)


def test_valider_surfaces_bloc_barriere_avec_surface_traitee_refuse():
    """BARRIERE (barrière) n'attend que surface_protegee_ha."""
    with pytest.raises(BlocModeIncoherentError):
        valider_surfaces_bloc("BARRIERE", None, surface_protegee_ha=None, surface_traitee_ha=10.0)


def test_valider_surfaces_bloc_total_avec_surface_traitee_seule_accepte():
    valider_surfaces_bloc("TOTAL", None, surface_protegee_ha=None, surface_traitee_ha=10.0)
    valider_surfaces_bloc("TOTAL", None, surface_protegee_ha=0, surface_traitee_ha=10.0)


def test_valider_surfaces_bloc_barriere_avec_surface_protegee_seule_accepte():
    valider_surfaces_bloc("BARRIERE", None, surface_protegee_ha=10.0, surface_traitee_ha=None)


def test_valider_surfaces_bloc_irregulier_sans_contrainte_de_mode():
    """IRREGULIER n'impose rien — même tolérance que `typeProduitAttendu` mobile."""
    valider_surfaces_bloc("IRREGULIER", None, surface_protegee_ha=5.0, surface_traitee_ha=5.0)


def test_valider_surfaces_bloc_depasse_surface_infestee_refuse():
    cible = Cible(surface_infestee_ha=8.0)
    with pytest.raises(BlocSurfaceDepasseInfesteeError):
        valider_surfaces_bloc("TOTAL", cible, surface_protegee_ha=None, surface_traitee_ha=10.0)


def test_valider_surfaces_bloc_egale_surface_infestee_accepte():
    cible = Cible(surface_infestee_ha=10.0)
    valider_surfaces_bloc("TOTAL", cible, surface_protegee_ha=None, surface_traitee_ha=10.0)


def test_valider_surfaces_bloc_sans_surface_infestee_connue_aucun_controle():
    cible = Cible(surface_infestee_ha=None)
    valider_surfaces_bloc("TOTAL", cible, surface_protegee_ha=None, surface_traitee_ha=1000.0)


def test_contenu_diverge_champ_commun_different():
    existant = _traitement_terrestre_sync()
    entrant = _traitement_terrestre_sync(localite="Ampanihy")
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_champ_terrestre_different():
    existant = _traitement_terrestre_sync()
    entrant = _traitement_terrestre_sync(surface_atomiseur_ha=99.0)
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_stock_initial_terrestre_different():
    """#stock-initial-terrestre : une modification isolée de `stock_initial_l`
    doit être détectée comme un contenu divergent, comme tout autre champ de
    `_CHAMPS_CONTENU_TERRESTRE`."""
    existant = _traitement_terrestre_sync(stock_initial_l=30.0)
    entrant = _traitement_terrestre_sync(stock_initial_l=45.0)
    assert contenu_diverge(existant, entrant) is True


def test_contenu_diverge_champ_aerien_different():
    existant = _traitement_aerien_valide(pilote="Jean Dupont")
    entrant = _traitement_aerien_valide(pilote="Marc Rabe")
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
async def test_sync_push_terrestre_conserve_stock_pesticide_existant_sans_ecraser_consommation():
    """Les produits existants ne sont pas renvoyés par ce push (sous-ressource
    distincte, ajoutée via son propre endpoint) : le stock doit se recalculer à
    partir de la consommation déjà connue côté serveur, jamais depuis une liste de
    produits vide (qui donnerait à tort stock = reçu)."""
    fiche_id = uuid.uuid4()
    ancien_updated_at = datetime(2026, 8, 11, 8, 0)
    updated_at_serveur = datetime(2026, 8, 11, 9, 0)
    args = _sync_terrestre_args(fiche_id, base_updated_at=ancien_updated_at, pesticide_recu_l=150.0)

    existant = _traitement_terrestre_sync(
        id=fiche_id,
        prospection_id=args["prospection_id"],
        numero_fiche=args["numero_fiche"],
        localite=args["localite"],
        chef_equipe_id=args["chef_equipe_id"],
        surface_atomiseur_ha=args["surface_atomiseur_ha"],
        surface_restante_abandonnee=args["surface_restante_abandonnee"],
        pesticide_recu_l=150.0,
        statut_sync="synced",
        updated_at=updated_at_serveur,
    )
    existant.terrestre.total_pesticide_l = 40.0
    use_case, repo = _sync_use_case(existant=existant)

    traitement, cree = await use_case.execute(**args)

    assert cree is False
    assert traitement.terrestre.total_pesticide_l == 40.0
    assert traitement.terrestre.pesticide_stock_restant_l == 110.0


@pytest.mark.asyncio
async def test_sync_push_terrestre_transmet_stock_initial():
    """#stock-initial-terrestre côté synchronisation (create-branch, id inconnu) :
    même comportement que la création directe (`CreateTraitementTerrestre`)."""
    fiche_id = uuid.uuid4()
    use_case, _ = _sync_use_case(existant=None)

    args = _sync_terrestre_args(
        fiche_id, base_updated_at=datetime.utcnow(), stock_initial_l=40.0, pesticide_recu_l=150.0
    )
    traitement, cree = await use_case.execute(**args)

    assert cree is True
    assert traitement.terrestre.stock_initial_l == 40.0
    assert traitement.terrestre.pesticide_stock_restant_l == 190.0


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
