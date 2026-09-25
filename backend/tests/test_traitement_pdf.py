import uuid
from datetime import date, datetime

from app.presentation.traitement_pdf import _case, build_crt_html
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
        nb_agents_permanents=None,
        nb_agents_temporaires=None,
        nb_personnel_local=None,
        moyens_atomiseur_nb=None,
        moyens_essence_litres=None,
        moyens_disque_rotatif_nb=None,
        moyens_piles_nb=None,
        moyens_ulvamast_nb=None,
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
            site_principal_id=uuid.uuid4(),
            stand=None,
            stand_date_installation=None,
            base_secondaire=None,
            base_secondaire_date_installation=None,
            immatricule_aeronef="5R-ABC",
            nb_rotations=1,
            total_pesticide_l=10.0,
            total_pesticide_kg=0.0,
            surface_traitee_ha=25.0,
            surface_protegee_ha=0.0,
            reprise_traitement=False,
            traitement_origine_id=None,
            surface_cumulee_ha=25.0,
            surface_restante_ha=None,
            surface_restante_abandonnee=None,
            motif_surface_restante_abandonnee=None,
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
        prospection_date_validation=None,
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
        surface_protegee_ha=None,
        surface_cumulee_ha=None,
        surface_restante_ha=None,
        surface_restante_abandonnee=None,
        motif_surface_restante_abandonnee=None,
        essence_litres=None,
        nb_piles=None,
        pesticide_unite="L",
        total_pesticide_l=None,
        pesticide_recu_l=None,
        stock_initial_l=None,
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
    assert "Détail Terrestre" not in html


def test_build_crt_html_terrestre_naffiche_pas_le_bloc_aerien():
    html = build_crt_html(_traitement_terrestre())

    assert "06:00:00" in html
    assert "5R-ABC" not in html


def test_build_crt_html_detail_terrestre_absent_si_essence_et_piles_non_renseignes():
    """Après retrait des doublons avec §3/§5 (surfaces, produit consommé —
    déjà les champs canoniques du formulaire numéroté) et déplacement de
    "Consultant international" en §1, l'annexe Détail Terrestre ne reste
    utile que pour essence_litres/nb_piles (cf. test ci-dessous) : absente
    quand ces deux champs ne sont pas renseignés, comme les autres annexes
    facultatives (Axes de risque)."""
    html = build_crt_html(_traitement_terrestre())

    assert "Détail Terrestre" not in html
    assert "Détail Aérien" not in html


def test_build_crt_html_detail_terrestre_affiche_essence_et_piles_specifiques():
    """`terrestre.essence_litres`/`nb_piles` ne sont PAS des doublons de
    `moyens_essence_litres`/`moyens_piles_nb` (§4.2) malgré l'intitulé
    proche : l'écran mobile recap.tsx les affiche comme deux quantités
    distinctes, dans deux cartes séparées ("Moyens & produits (Terrestre)"
    vs "Moyens & protection") — supprimés par erreur lors d'un passage
    précédent (cf. revue de code), restaurés ici."""
    traitement = _traitement_terrestre()
    traitement.terrestre.essence_litres = 20.0
    traitement.terrestre.nb_piles = 5
    traitement.moyens_essence_litres = 999.0  # valeur §4.2 distincte, ne doit pas se confondre

    html = build_crt_html(traitement)

    assert "Détail Terrestre" in html
    assert ">20.0</span>" in html
    assert ">5</span>" in html


def test_build_crt_html_affiche_les_signatures_avec_horodatage():
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
    # Date/heure de signature au format français, colonne désormais affichée.
    assert "11/08/2026 09:00" in html


def test_build_crt_html_champs_manquants_au_modele_affiches_vides():
    html = build_crt_html(_traitement_aerien())

    assert "Nb agents permanents" in html
    assert "Stock initial" in html


def test_build_crt_html_affiche_moyens_humains_materiels():
    traitement = _traitement_aerien(
        nb_agents_permanents=4,
        nb_agents_temporaires=2,
        nb_personnel_local=6,
        moyens_atomiseur_nb=3,
        moyens_essence_litres=50.0,
        moyens_disque_rotatif_nb=1,
        moyens_piles_nb=12,
        moyens_ulvamast_nb=2,
    )

    html = build_crt_html(traitement)

    for valeur in ("4", "2", "6", "3", "50.0", "1", "12"):
        assert f">{valeur}</span>" in html


def test_build_crt_html_terrestre_affiche_stock_initial():
    traitement = _traitement_terrestre()
    traitement.terrestre.stock_initial_l = 40.0

    html = build_crt_html(traitement)

    assert "Stock initial" in html
    assert "40.0" in html


def test_build_crt_html_terrestre_libelles_pesticides_suivent_unite_choisie():
    traitement_l = _traitement_terrestre()
    html_l = build_crt_html(traitement_l)
    assert "5.4 Approvisionnement (L)" in html_l
    assert "5.5 Produit consommé (L)" in html_l
    assert "5.6 Stock final (L)" in html_l

    traitement_kg = _traitement_terrestre()
    traitement_kg.terrestre.pesticide_unite = "kg"
    html_kg = build_crt_html(traitement_kg)
    assert "5.4 Approvisionnement (kg)" in html_kg
    assert "5.5 Produit consommé (kg)" in html_kg
    assert "5.6 Stock final (kg)" in html_kg

    html_aerien = build_crt_html(_traitement_aerien())
    assert "5.4 Approvisionnement (L)" in html_aerien
    assert "5.5 Produit consommé (L)" in html_aerien
    assert "5.6 Stock final (L)" in html_aerien


def test_build_crt_html_affiche_le_produit_consomme():
    html = build_crt_html(_traitement_aerien())

    assert "5.5 Produit consommé (L)" in html
    assert ">10.0</span>" in html


def test_build_crt_html_naffiche_jamais_la_representation_brute_dun_enum():
    """Bug racine (#495) : `str(ModeTraitement.TOTAL)` rend "ModeTraitement.TOTAL"
    en Python 3.14 (le mixin `str` perd la priorité sur `Enum.__str__`) —
    aucun nom de classe d'enum ne doit fuiter dans le HTML, et les enums
    rendus en case à cocher doivent cocher la bonne option."""
    traitement = _traitement_terrestre(
        mode_traitement="TOTAL",
        empoisonnement_type="AGENT",
        empoisonnement_mode="INGESTION",
    )
    traitement.terrestre.direction_vent = "NE"
    traitement.terrestre.methode_evaluation_efficacite = "ESTIMATION_VISUELLE"

    html = build_crt_html(traitement)

    assert "ModeTraitement" not in html
    assert "EmpoisonnementType" not in html
    assert "EmpoisonnementMode" not in html
    assert "DirectionVent" not in html
    assert "MethodeEvaluationEfficacite" not in html
    # direction_vent reste affiché en toutes lettres (pas une case à cocher).
    assert ">NE</span>" in html
    # Vérification indépendante de `_case()` (pas seulement via le même
    # générateur que la production) : la case cochée porte "cochee" et
    # data-checked="true", jamais les deux formes à la fois pour Total/Barrière.
    total, barriere = (
        html.index("Couverture Total"),
        html.index("Barrière", html.index("Couverture Total")),
    )
    assert 'case cochee" data-checked="true"' in html[total : total + 80]
    assert 'case" data-checked="false"' in html[barriere : barriere + 80]
    # Les autres passent par une case à cocher — on vérifie la bonne coche.
    assert _case("3.1 Mode de traitement — Couverture Total", True) in html
    assert _case("Barrière", False) in html
    assert _case("Si oui, Agent", True) in html
    assert _case("Population", False) in html
    assert _case("8.2 Comment ? — Ingestion", True) in html
    assert _case("Méthode d'évaluation — Estimation visuelle", True) in html


def test_build_crt_html_espece_et_repartition_cochent_la_bonne_case():
    traitement = _traitement_aerien(
        cible={
            "espece": "LMC",
            "petites_larves": None,
            "grandes_larves": None,
            "vols_clairs_essaims": None,
            "repartition_population": "DIFFUSE",
            "surface_infestee_ha": 12.0,
            "petites_larves_lmc": None,
            "petites_larves_nse": None,
            "grandes_larves_lmc": None,
            "grandes_larves_nse": None,
            "densite_diffuse_lmc": 3.5,
            "densite_groupee_lmc": None,
            "densite_diffuse_nse": None,
            "densite_groupee_nse": None,
        }
    )

    html = build_crt_html(traitement)

    assert "EspeceCible" not in html
    assert "RepartitionPopulation" not in html
    assert _case("2.1 Espèces — LMC", True) in html
    assert _case("NSE", False) in html
    assert _case("Mélange", False) in html
    assert _case("Population — Diffuse", True) in html
    assert _case("groupée", False) in html
    # Densité (ind./ha) dérivée de la paire (espèce=LMC, répartition=DIFFUSE).
    assert ">3.5</span>" in html


def _cible_dict(espece: str, repartition: str, **densites) -> dict:
    base = {
        "espece": espece,
        "petites_larves": None,
        "grandes_larves": None,
        "vols_clairs_essaims": None,
        "repartition_population": repartition,
        "surface_infestee_ha": None,
        "petites_larves_lmc": None,
        "petites_larves_nse": None,
        "grandes_larves_lmc": None,
        "grandes_larves_nse": None,
        "densite_diffuse_lmc": None,
        "densite_groupee_lmc": None,
        "densite_diffuse_nse": None,
        "densite_groupee_nse": None,
    }
    base.update(densites)
    return base


def test_build_crt_html_densite_infestation_lmc_groupee():
    traitement = _traitement_aerien(cible=_cible_dict("LMC", "GROUPEE", densite_groupee_lmc=7.0))

    html = build_crt_html(traitement)

    assert ">7.0</span>" in html


def test_build_crt_html_densite_infestation_nse_diffuse():
    traitement = _traitement_aerien(cible=_cible_dict("NSE", "DIFFUSE", densite_diffuse_nse=1.2))

    html = build_crt_html(traitement)

    assert ">1.2</span>" in html


def test_build_crt_html_densite_infestation_nse_groupee():
    traitement = _traitement_aerien(cible=_cible_dict("NSE", "GROUPEE", densite_groupee_nse=9.9))

    html = build_crt_html(traitement)

    assert ">9.9</span>" in html


def test_build_crt_html_affiche_les_surfaces_par_moyen_et_le_reste_a_traiter():
    traitement = _traitement_terrestre()
    traitement.terrestre.surface_atomiseur_ha = 5.0
    traitement.terrestre.surface_disque_rotatif_ha = 2.0
    traitement.terrestre.surface_restante_ha = 1.0

    html = build_crt_html(traitement)

    assert "3.2 Surface traitée par atomiseur à dos (ha)" in html
    assert "par disque rotatif (ha)" in html
    assert "3.3 Surface reste à traiter (ha)" in html
    assert ">5.0</span>" in html
    assert ">2.0</span>" in html
    assert ">1.0</span>" in html


def test_build_crt_html_zones_cibles_cases_a_cocher():
    traitement = _traitement_aerien(zones_exposees={"cultures": True, "paturages": False})

    html = build_crt_html(traitement)

    assert _case("6.1 Culture", True) in html
    assert _case("6.2 Pâturage", False) in html
    assert "True" not in html
    assert "False" not in html


def test_build_crt_html_sections_10_11_12_sont_distinctes_et_dans_lordre():
    html = build_crt_html(_traitement_aerien())

    assert "10. Observation sur non cibles" in html
    assert "11. Mortalité" in html
    assert "12. Observation générale" in html
    assert html.index("10. Observation sur non cibles") < html.index("11. Mortalité")
    assert html.index("11. Mortalité") < html.index("12. Observation générale")


def test_build_crt_html_familles_mobiles_cochent_les_cases_papier_malgre_lorthographe():
    """`comportement_non_cibles`/`mortalite_familles` utilisent les libellés
    mobiles ("Insectes utiles", "Oiseaux") qui ne correspondent pas mot pour
    mot aux libellés du formulaire papier ("Insecte", "Oiseux" en §10) —
    `_cases_familles` doit rapprocher les deux."""
    traitement = _traitement_aerien(
        comportement_non_cibles={"Insectes utiles": True},
        mortalite_familles={"Oiseaux": True, "Abeilles": True},
    )

    html = build_crt_html(traitement)

    assert _case("10.2 Oiseux", False) in html
    assert _case("Insecte", True) in html
    assert _case("Si oui, Famille — Oiseaux", True) in html
    # "Abeilles" n'a pas d'équivalent sur le formulaire papier : restituée à
    # part plutôt que silencieusement perdue.
    assert "Autres familles concernées" in html
    assert "Abeilles" in html


def test_build_crt_html_affiche_les_axes_de_risque_quand_renseignes():
    traitement = _traitement_aerien(evaluation_risque={"ressources_eau": True, "sol": False})

    html = build_crt_html(traitement)

    assert "Ressources en eau" in html
    assert "Sol" in html


def test_build_crt_html_naffiche_pas_la_section_axes_de_risque_si_vide():
    html = build_crt_html(_traitement_aerien(evaluation_risque=None))

    assert "Axes de risque" not in html


def test_build_crt_html_naffiche_jamais_duuid_brut_pour_chef_equipe():
    chef_equipe_id = uuid.uuid4()
    traitement = _traitement_terrestre()
    traitement.terrestre.chef_equipe_id = chef_equipe_id

    html = build_crt_html(traitement)

    assert str(chef_equipe_id) not in html


def test_build_crt_html_consultant_international_affiche_en_references():
    """Retiré des annexes "Détail Aérien/Terrestre" (doublon) — sa place est
    en §1 Références, à côté des autres intervenants nommés."""
    traitement = _traitement_terrestre()
    traitement.terrestre.consultant_international = "Pierre Rakoto"

    html = build_crt_html(traitement)

    assert "Consultant international" in html
    assert "Pierre Rakoto" in html


def test_build_crt_html_consultant_international_a_signer_si_pas_encore_signe():
    traitement = _traitement_terrestre()
    traitement.terrestre.consultant_international = "Pierre Rakoto"

    html = build_crt_html(traitement)

    assert "CONSULTANT_INTERNATIONAL" in html
    assert "à signer" in html


def test_build_crt_html_consultant_international_deja_signe_pas_de_ligne_a_signer():
    traitement = _traitement_terrestre(
        signatures=[
            {
                "id": uuid.uuid4(),
                "role": "CONSULTANT_INTERNATIONAL",
                "signataire_nom": "Pierre Rakoto",
                "signature_image": None,
                "horodatage": datetime(2026, 8, 11, 9, 0),
            }
        ]
    )
    traitement.terrestre.consultant_international = "Pierre Rakoto"

    html = build_crt_html(traitement)

    assert "à signer" not in html


def test_build_crt_html_references_utilise_la_validation_de_la_prospection_liee():
    """§1.4/§1.5 : référencent la validation de la prospection liée
    (`prospection_date_validation`/`prospection_n_fiche`), pas
    `traitement.date_validation` (une validation propre au CRT, distincte —
    cf. #495, retour utilisateur)."""
    traitement = _traitement_aerien(
        date_validation=date(2020, 1, 1),
        prospection_n_fiche="EXT-2026-045",
        prospection_date_validation=datetime(2026, 8, 9, 16, 30),
    )

    html = build_crt_html(traitement)

    assert "EXT-2026-045" in html
    assert "09/08/2026" in html
    assert "01/01/2020" not in html


def test_build_crt_html_1_5_vide_si_pas_de_prospection_liee_resolue():
    html = build_crt_html(_traitement_aerien())

    assert "1.5 N° de validation" in html


def test_build_crt_html_dates_au_format_francais():
    html = build_crt_html(_traitement_aerien())

    assert "11/08/2026" in html  # date_traitement
    assert "2026-08-11" not in html.replace("Hery-Aerien-2026-08-11", "")


def test_build_crt_html_5_aerien_poudre_affiche_unite_et_consommation_en_kg():
    """Aérien : « Approvisionnement » suit l'unité du produit — poudre (rotations en kg)
    → libellés en kg et consommation lue dans le cumul kg, pas dans le cumul litres."""
    base = _traitement_aerien()
    aerien = base.aerien.model_copy(update={"total_pesticide_l": 0.0, "total_pesticide_kg": 30.0})
    html = build_crt_html(base.model_copy(update={"aerien": aerien}))
    assert "5.4 Approvisionnement (kg)" in html
    assert "5.5 Produit consommé (kg)" in html
    assert "5.6 Stock final (kg)" in html
