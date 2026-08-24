"""Règles métier de la fiche de vol — cahier des charges « gestion des heures de vol ».

Ces tests portent sur le domaine pur (aucune base) : dérivation du numéro de fiche,
calcul des durées et cumuls, cohérence du rattachement d'un vol, et complétude des
signatures. Cf. docs/adr/ADR-011 §7.
"""

import uuid
from datetime import date, time

import pytest

from app.domain.fiche_vol import (
    TYPES_VOL,
    FicheVol,
    HeuresVolIncoherentesError,
    RotationsIncompletesError,
    SignaturesVolManquantesError,
    SignatureVol,
    Vol,
    VolRattachementInvalideError,
    composer_numero_fiche,
    cumuler_durees,
    roles_signature_requis,
    valider_rattachement,
    valider_rotations_completes,
    valider_signatures,
)


def _vol(type_vol: str, debut: time, fin: time, **kwargs) -> Vol:
    return Vol(
        id=uuid.uuid4(),
        fiche_vol_id=uuid.uuid4(),
        numero=kwargs.pop("numero", 1),
        type_vol=type_vol,
        heure_debut=debut,
        heure_fin=fin,
        **kwargs,
    )


def _fiche(**kwargs) -> FicheVol:
    defaults = dict(
        id=uuid.uuid4(),
        numero_fiche="2026-08-24-IHO01-MDGA21",
        date_vol=date(2026, 8, 24),
        compagnie="Aviation Malgache",
        immatriculation="MDG-A21",
        base_code="IHO01",
        base_nom="Ihosy",
        stand_nom="Stand Sud",
        pilote="Rakoto A.",
        mecanicien="Randria B.",
        chef_de_base_id=uuid.uuid4(),
    )
    defaults.update(kwargs)
    return FicheVol(**defaults)


# --- Numéro de fiche : [Date]-[Base numérotée]-[Immatriculation] + compteur ---------


def test_numero_suit_le_format_du_cahier_des_charges():
    assert composer_numero_fiche(date(2026, 8, 24), "IHO01", "MDG-A21") == "2026-08-24-IHO01-MDGA21"


def test_numero_normalise_la_casse_et_les_separateurs_de_l_immatriculation():
    assert composer_numero_fiche(date(2026, 8, 24), "iho01", "mdg a21") == (
        "2026-08-24-IHO01-MDGA21"
    )


def test_une_seconde_fiche_du_meme_jour_recoit_un_compteur():
    """« Une seule fiche par jour si possible » : convention, pas contrainte. Le terrain
    ne doit jamais être bloqué — le numéro porte un suffixe incrémental."""
    base = composer_numero_fiche(date(2026, 8, 24), "IHO01", "MDG-A21")
    assert composer_numero_fiche(date(2026, 8, 24), "IHO01", "MDG-A21", suffixe=2) == f"{base}-02"
    assert composer_numero_fiche(date(2026, 8, 24), "IHO01", "MDG-A21", suffixe=10) == f"{base}-10"


# --- Durées : dérivées, jamais stockées --------------------------------------------


def test_duree_du_vol_est_derivee_des_heures():
    assert _vol("APPLICATION", time(6, 0), time(7, 25)).duree_minutes == 85


def test_heure_de_fin_anterieure_est_refusee():
    """Un vol ne franchit pas minuit : sans cette règle la durée dérivée serait négative."""
    with pytest.raises(HeuresVolIncoherentesError):
        _vol("CONVOYAGE", time(23, 30), time(0, 15))


def test_duree_totale_de_la_fiche_somme_ses_vols():
    fiche = _fiche(
        vols=[
            _vol("MEP", time(6, 0), time(6, 20), numero=1),
            _vol("APPLICATION", time(6, 20), time(7, 5), numero=2),
        ]
    )
    assert fiche.duree_totale_minutes == 65


# --- Cumuls : journalier / hebdomadaire / mensuel / total --------------------------


def test_cumuls_ventilent_par_jour_semaine_mois_et_total():
    fiches = [
        _fiche(date_vol=date(2026, 8, 24), vols=[_vol("DIVERS", time(8, 0), time(9, 0))]),
        _fiche(date_vol=date(2026, 8, 25), vols=[_vol("DIVERS", time(8, 0), time(8, 30))]),
        _fiche(date_vol=date(2026, 8, 3), vols=[_vol("DIVERS", time(8, 0), time(10, 0))]),
        _fiche(date_vol=date(2026, 7, 30), vols=[_vol("DIVERS", time(8, 0), time(8, 15))]),
    ]
    cumuls = cumuler_durees(fiches, reference=date(2026, 8, 24))

    assert cumuls["jour"] == 60
    assert cumuls["semaine"] == 90  # lundi 24 et mardi 25 — même semaine ISO (2026-S35)
    assert cumuls["mois"] == 210  # les trois d'août
    assert cumuls["total"] == 225


# --- Rattachement d'un vol : dépend du type ---------------------------------------


def test_seuls_mep_et_application_se_rattachent_a_une_rotation():
    valider_rattachement("MEP", rotation_id=uuid.uuid4(), prospection_id=None)
    valider_rattachement("APPLICATION", rotation_id=uuid.uuid4(), prospection_id=None)


@pytest.mark.parametrize("type_vol", ["CONVOYAGE", "DIVERS", "PROSPECTION"])
def test_les_autres_types_ne_peuvent_pas_pointer_une_rotation(type_vol):
    with pytest.raises(VolRattachementInvalideError):
        valider_rattachement(type_vol, rotation_id=uuid.uuid4(), prospection_id=None)


def test_seule_une_prospection_se_rattache_a_une_prospection():
    valider_rattachement("PROSPECTION", rotation_id=None, prospection_id=uuid.uuid4())
    with pytest.raises(VolRattachementInvalideError):
        valider_rattachement("MEP", rotation_id=None, prospection_id=uuid.uuid4())


def test_convoyage_et_divers_ne_se_rattachent_a_rien():
    valider_rattachement("CONVOYAGE", rotation_id=None, prospection_id=None)
    valider_rattachement("DIVERS", rotation_id=None, prospection_id=None)


def test_type_de_vol_inconnu_est_refuse():
    with pytest.raises(VolRattachementInvalideError):
        valider_rattachement("DECOLLAGE", rotation_id=None, prospection_id=None)


def test_les_cinq_types_du_cahier_des_charges_sont_exposes():
    assert set(TYPES_VOL) == {"PROSPECTION", "MEP", "APPLICATION", "CONVOYAGE", "DIVERS"}


# --- « N rotations ⇒ N mises en place + N applications » ---------------------------


def test_une_rotation_rapprochee_exige_une_mep_et_une_application():
    rotation = uuid.uuid4()
    vols = [
        _vol("MEP", time(6, 0), time(6, 20), numero=1, rotation_id=rotation),
        _vol("APPLICATION", time(6, 20), time(7, 0), numero=2, rotation_id=rotation),
    ]
    valider_rotations_completes(vols)


def test_une_rotation_sans_mise_en_place_est_refusee():
    rotation = uuid.uuid4()
    vols = [_vol("APPLICATION", time(6, 20), time(7, 0), numero=1, rotation_id=rotation)]
    with pytest.raises(RotationsIncompletesError) as exc:
        valider_rotations_completes(vols)
    assert "MEP" in str(exc.value)


def test_une_rotation_sans_application_est_refusee():
    rotation = uuid.uuid4()
    vols = [_vol("MEP", time(6, 0), time(6, 20), numero=1, rotation_id=rotation)]
    with pytest.raises(RotationsIncompletesError):
        valider_rotations_completes(vols)


def test_les_vols_non_rapproches_sont_ignores_par_la_regle():
    valider_rotations_completes(
        [
            _vol("CONVOYAGE", time(5, 0), time(5, 40), numero=1),
            _vol("DIVERS", time(12, 0), time(12, 30), numero=2),
        ]
    )


# --- Signatures (cahier des charges §3) -------------------------------------------


def test_pilote_mecanicien_et_chef_de_base_signent_toujours():
    assert roles_signature_requis(_fiche()) == {"PILOTE", "MECANICIEN", "CHEF_DE_BASE"}


def test_le_consultant_international_signe_seulement_s_il_est_renseigne():
    fiche = _fiche(consultant_international="Dupont M.")
    assert "CONSULTANT_INTERNATIONAL" in roles_signature_requis(fiche)


def test_fiche_completement_signee_est_valide():
    fiche = _fiche(
        signatures=[
            SignatureVol(role="PILOTE", signataire_nom="Rakoto A."),
            SignatureVol(role="MECANICIEN", signataire_nom="Randria B."),
            SignatureVol(role="CHEF_DE_BASE", signataire_nom="Rasoa C."),
        ]
    )
    valider_signatures(fiche)


def test_signature_manquante_est_refusee():
    fiche = _fiche(signatures=[SignatureVol(role="PILOTE", signataire_nom="Rakoto A.")])
    with pytest.raises(SignaturesVolManquantesError) as exc:
        valider_signatures(fiche)
    assert "MECANICIEN" in str(exc.value)


def test_le_trace_graphique_est_facultatif_a_la_saisie():
    """La fiche doit rester enregistrable avant que les signatures soient tracées."""
    assert SignatureVol(role="PILOTE", signataire_nom="Rakoto A.").signature_image is None
