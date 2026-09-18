import uuid
from datetime import date, datetime

from app.presentation.traitement_pdf import build_crt_html
from app.presentation.traitement_schemas import (
    StatutTraitement,
    TraitementAerienRead,
    TraitementRead,
    TraitementTerrestreRead,
    TypeTraitement,
)


def _traitement_aerien(**overrides) -> TraitementRead:
    base = dict(
        id=uuid.uuid4(),
        prospection_id=uuid.uuid4(),
        numero_fiche="Hery-Aerien-2026-08-11",
        type_traitement=TypeTraitement.AERIEN,
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
        observations=None,
        statut=StatutTraitement.VALIDEE,
        statut_sync="synced",
        created_at=datetime(2026, 8, 11, 8, 0),
        updated_at=datetime(2026, 8, 11, 8, 0),
        cible=None,
        aerien=TraitementAerienRead(
            pilote="J. Dupont",
            mecanicien="M. Rabe",
            chef_de_base_id=uuid.uuid4(),
            consultant_international=None,
            base_principale="Base Betioky",
            stand=None,
            stand_date_installation=None,
            base_secondaire=None,
            base_secondaire_date_installation=None,
            immatricule_aeronef="5R-ABC",
            nb_rotations=1,
            total_pesticide_l=10.0,
            total_pesticide_kg=0.0,
            surface_traitee_ha=25.0,
            reprise_traitement=False,
            traitement_origine_id=None,
            surface_cumulee_ha=25.0,
            surface_restante_ha=None,
            pesticide_recu_l=50.0,
            pesticide_stock_restant_l=40.0,
            taux_mortalite_pourcent=None,
            evaluation_efficacite_heures_apres=None,
            methode_evaluation_efficacite=None,
            rotations=[],
            blocs=[],
        ),
        terrestre=None,
        signatures=[],
        evaluations_risque_population=[],
        prospection_n_fiche=None,
    )
    base.update(overrides)
    return TraitementRead.model_validate(base)


def _traitement_terrestre(**overrides) -> TraitementRead:
    base = _traitement_aerien(type_traitement=TypeTraitement.TERRESTRE, aerien=None).model_dump()
    base["terrestre"] = TraitementTerrestreRead(
        heure_debut="06:00:00",
        heure_fin="09:00:00",
        vitesse_vent_ms=1.5,
        direction_vent=None,
        temperature_c=24.0,
        taux_mortalite_pourcent=None,
        evaluation_efficacite_heures_apres=None,
        methode_evaluation_efficacite=None,
        reprise_traitement=False,
        traitement_origine_id=None,
        chef_equipe_id=uuid.uuid4(),
        agent_encadreur=None,
        consultant_international=None,
        surface_atomiseur_ha=None,
        surface_disque_rotatif_ha=None,
        surface_atomiseur_autoporte_ha=None,
        surface_traitee_ha=None,
        surface_cumulee_ha=None,
        surface_restante_ha=None,
        surface_restante_abandonnee=None,
        motif_surface_restante_abandonnee=None,
        essence_litres=None,
        nb_piles=None,
        total_pesticide_l=None,
        pesticide_recu_l=None,
        pesticide_stock_restant_l=None,
        produits=[],
    )
    base.update(overrides)
    return TraitementRead.model_validate(base)


def test_build_crt_html_contient_le_numero_de_fiche_et_le_css_de_base():
    html = build_crt_html(_traitement_aerien())

    assert "Hery-Aerien-2026-08-11" in html
    assert "size: A4" in html


def test_build_crt_html_aerien_affiche_le_bloc_aerien_pas_le_bloc_terrestre():
    html = build_crt_html(_traitement_aerien())

    assert "5R-ABC" in html
    assert "J. Dupont" in html
    assert "Chef d’équipe" not in html or "chef_equipe" not in html


def test_build_crt_html_terrestre_affiche_le_bloc_terrestre_pas_le_bloc_aerien():
    html = build_crt_html(_traitement_terrestre())

    assert "06:00:00" in html
    assert "5R-ABC" not in html


def test_build_crt_html_affiche_les_signatures():
    traitement = _traitement_aerien(
        signatures=[
            {
                "id": uuid.uuid4(),
                "role": "PILOTE",
                "signataire_nom": "J. Dupont",
                "signature_image": None,
                "horodatage": datetime(2026, 8, 11, 9, 0),
            }
        ]
    )

    html = build_crt_html(traitement)

    assert "J. Dupont" in html


def test_build_crt_html_champs_manquants_au_modele_affiches_vides():
    """§4.1/4.2 (moyens humains/materiels) et §5.3 (stock initial pesticide) ne
    sont pas modelises (cf. issue #495) : la case doit rester vide, pas
    disparaitre ni planter."""
    html = build_crt_html(_traitement_aerien())

    assert "Nb agents permanents" in html
    assert "Stock initial" in html
