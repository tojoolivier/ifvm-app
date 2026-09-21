import uuid
from datetime import date, datetime

from app.presentation.prospection_pdf import build_prospection_html
from app.presentation.prospection_schemas import (
    CaptureRead,
    InfestationRead,
    PopulationRead,
    ProspectionRead,
)


def _prospection(**overrides) -> ProspectionRead:
    base = dict(
        id=uuid.uuid4(),
        type_prospection="intensive",
        campagne_id=uuid.uuid4(),
        prospecteur_id=uuid.uuid4(),
        station_id=None,
        n_fiche="F-001",
        n_message="M-042",
        date_prospection=date(2026, 7, 5),
        latitude=-21.5,
        longitude=47.1,
        altitude=800,
        biotope=[],
        surface_station=10,
        surface_prospectee=8,
        surface_infestee=2,
        degats_cultures=None,
        derniere_pluie=None,
        intensite_pluie=None,
        vegetation=None,
        sol=None,
        verdissement=None,
        hauteur_strate=None,
        ennemis_naturels=None,
        observations=None,
        statut="validee",
        statut_sync="synced",
        created_at=datetime(2026, 7, 5, 8, 0),
        updated_at=datetime(2026, 7, 5, 8, 0),
        prospecteur_nom="Jean Rakoto",
        region=None,
        district=None,
        commune=None,
        za=None,
        pa_code=None,
        populations=[],
        captures=[],
        infestations=[],
    )
    base.update(overrides)
    return ProspectionRead.model_validate(base)


def test_intensive_reproduit_la_grille_captures_sexe_phase_stade():
    captures = [
        CaptureRead.model_validate(
            dict(
                id=uuid.uuid4(),
                espece="LMC",
                categorie="imago",
                sexe="F",
                phase="gregaire",
                stade="A4",
                effectif=7,
            )
        )
    ]
    html = build_prospection_html(_prospection(captures=captures))

    assert "F-001" in html
    assert "Jean Rakoto" in html
    assert "FICHE DE PROSPECTION ANTIACRIDIENNE" in html
    assert ">7<" in html


def test_intensive_affiche_le_comportement_par_type_de_cible():
    infestations = [
        InfestationRead.model_validate(
            dict(
                id=uuid.uuid4(),
                espece="LMC",
                type_cible="vol_clair",
                taille_min=1,
                taille_max=3,
                taille_moy=2,
                surface_totale=5,
                densite_min=10,
                densite_max=20,
                densite_moy=15,
                interdistance=50,
                comportement="deplacement",
                direction_de="Nord",
                direction_vers="Sud",
                vent_de="Est",
                vent_vitesse=4,
            )
        )
    ]
    html = build_prospection_html(_prospection(infestations=infestations))

    assert "Vol clair" in html
    assert "Nord" in html


def test_intensive_case_vide_quand_aucune_donnee():
    html = build_prospection_html(_prospection())
    assert "☐" in html


def test_intensive_echappe_le_contenu_utilisateur():
    html = build_prospection_html(_prospection(n_fiche="<script>alert(1)</script>"))
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_extensive_reproduit_les_blocs_par_espece():
    populations = [
        PopulationRead.model_validate(
            dict(
                id=uuid.uuid4(),
                espece="LMC",
                categorie="imago",
                densite_diffuse=3,
                densite_groupee=None,
                captures_nombre=9,
                temps_capture=None,
                accouplement=None,
                ponte=None,
                type_cible=[],
                stades_imago={"A1": 2, "A2": 3},
            )
        )
    ]
    html = build_prospection_html(
        _prospection(type_prospection="extensive", populations=populations)
    )

    assert "Prospection extensive" in html
    assert "B. Imagos" in html
    assert "C. Larves" in html
    assert "Nbre de Captures : 9" in html


def test_type_prospection_validation_suit_le_gabarit_extensif():
    html = build_prospection_html(_prospection(type_prospection="validation"))
    assert "Prospection extensive" in html
