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
    """§4.1/4.2 (moyens humains/matériels, désormais modélisés — migration 0076,
    #moyens-humains-materiels) et §5.3 (stock initial pesticide, Terrestre
    uniquement — #stock-initial-terrestre) : sur une fiche qui ne les renseigne
    pas, la case doit rester vide, pas disparaitre ni planter (cf.
    test_build_crt_html_affiche_moyens_humains_materiels et
    test_build_crt_html_terrestre_affiche_stock_initial pour le cas renseigné)."""
    html = build_crt_html(_traitement_aerien())

    assert "Nb agents permanents" in html
    assert "Stock initial" in html


def test_build_crt_html_affiche_moyens_humains_materiels():
    """#moyens-humains-materiels : contrairement au test ci-dessus (fiche vide),
    la case affiche la vraie valeur quand ces champs sont renseignés."""
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

    assert ">4<" in html
    assert ">2<" in html
    assert ">6<" in html
    assert ">3<" in html
    assert ">50.0<" in html
    assert ">1<" in html
    assert ">12<" in html


def test_build_crt_html_terrestre_affiche_stock_initial():
    """#stock-initial-terrestre : contrairement à l'Aérien (ci-dessus), la case
    "Stock initial" du Terrestre est désormais alimentée par une vraie valeur,
    pas seulement affichée vide."""
    traitement = _traitement_terrestre()
    traitement.terrestre.stock_initial_l = 40.0

    html = build_crt_html(traitement)

    assert "Stock initial" in html
    assert "40.0" in html


def test_build_crt_html_terrestre_libelles_pesticides_suivent_unite_choisie():
    """#produits-unite-l-kg : "Approvisionnement"/"Produit consommé"/"Stock final
    restant" affichent "(kg)" quand cette unité est choisie, "(L)" par défaut
    (Aérien inclus, qui n'a pas ce champ — repli sur "L", comportement inchangé)."""
    traitement_l = _traitement_terrestre()
    html_l = build_crt_html(traitement_l)
    assert "Approvisionnement (produit reçu, L)" in html_l
    assert "Produit consommé (L)" in html_l
    assert "Stock final restant (L)" in html_l

    traitement_kg = _traitement_terrestre()
    traitement_kg.terrestre.pesticide_unite = "kg"
    html_kg = build_crt_html(traitement_kg)
    assert "Approvisionnement (produit reçu, kg)" in html_kg
    assert "Produit consommé (kg)" in html_kg
    assert "Stock final restant (kg)" in html_kg

    html_aerien = build_crt_html(_traitement_aerien())
    assert "Approvisionnement (produit reçu, L)" in html_aerien
    assert "Produit consommé (L)" in html_aerien
    assert "Stock final restant (L)" in html_aerien


def test_build_crt_html_affiche_le_produit_consomme():
    """§5.5 du formulaire papier : existait sur le modèle (`total_pesticide_l`,
    déjà affiché dans "Détail Aérien"/"Détail Terrestre") mais jamais restitué
    dans la section Pesticides elle-même — c'est ce que corrige ce champ."""
    html = build_crt_html(_traitement_aerien())

    assert "Produit consommé (L)" in html
    assert ">10.0<" in html


def test_build_crt_html_naffiche_jamais_la_representation_brute_dun_enum():
    """Bug racine (#495) : `str(ModeTraitement.TOTAL)` rend "ModeTraitement.TOTAL"
    en Python 3.14 (le mixin `str` perd la priorité sur `Enum.__str__`) —
    chaque enum affiché dans le PDF doit passer par `.value`, jamais par
    `str()` nu, sous peine d'afficher du texte technique illisible."""
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
    assert ">TOTAL<" in html
    assert ">AGENT<" in html
    assert ">INGESTION<" in html
    assert ">NE<" in html
    assert ">ESTIMATION_VISUELLE<" in html


def test_build_crt_html_espece_et_repartition_ne_fuient_pas_leur_repr_enum():
    """Même bug que ci-dessus mais côté §2 Cibles (EspeceCible, RepartitionPopulation)."""
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
    assert ">LMC<" in html
    assert ">DIFFUSE<" in html
    # Densité (ind./ha) dérivée de la paire (espèce=LMC, répartition=DIFFUSE).
    assert ">3.5<" in html


def test_build_crt_html_affiche_les_surfaces_par_moyen_et_le_reste_a_traiter():
    """§3.2/3.3 du formulaire papier : surfaces par moyen de traitement et
    surface restante — présentes sur le modèle mais jamais affichées avant."""
    traitement = _traitement_terrestre()
    traitement.terrestre.surface_atomiseur_ha = 5.0
    traitement.terrestre.surface_disque_rotatif_ha = 2.0
    traitement.terrestre.surface_restante_ha = 1.0

    html = build_crt_html(traitement)

    assert "Surface atomiseur à dos (ha)" in html
    assert "Surface disque rotatif (ha)" in html
    assert "Surface reste à traiter (ha)" in html
    assert ">5.0<" in html
    assert ">2.0<" in html
    assert ">1.0<" in html


def test_build_crt_html_zones_cibles_affiche_oui_non_pas_de_booleen_python():
    traitement = _traitement_aerien(zones_exposees={"cultures": True, "paturages": False})

    html = build_crt_html(traitement)

    assert "Culture" in html
    assert "Pâturage" in html
    assert "True" not in html
    assert "False" not in html


def test_build_crt_html_sections_10_11_12_sont_distinctes_et_dans_lordre():
    """Le formulaire papier sépare "10. Observation sur non cibles" et
    "11. Mortalité" — l'ancien gabarit les fusionnait sous un même "10.", ce
    qui décalait "Observation générale" à "11." au lieu de "12."."""
    html = build_crt_html(_traitement_aerien())

    assert "10. Observation sur non cibles" in html
    assert "11. Mortalité" in html
    assert "12. Observation générale" in html
    assert html.index("10. Observation sur non cibles") < html.index("11. Mortalité")
    assert html.index("11. Mortalité") < html.index("12. Observation générale")


def test_build_crt_html_affiche_les_axes_de_risque_quand_renseignes():
    """`evaluation_risque` (écran mobile impacts.tsx) était saisi et persisté
    mais jamais restitué dans le PDF — champ mort corrigé ici."""
    traitement = _traitement_aerien(evaluation_risque={"ressources_eau": True, "sol": False})

    html = build_crt_html(traitement)

    assert "Ressources en eau" in html
    assert "Sol" in html


def test_build_crt_html_naffiche_pas_la_section_axes_de_risque_si_vide():
    html = build_crt_html(_traitement_aerien(evaluation_risque=None))

    assert "Axes de risque" not in html


def test_build_crt_html_naffiche_jamais_duuid_brut_pour_chef_equipe():
    """Ni `chef_equipe_id` (Terrestre) ni `chef_de_base_id` (Aérien) ne sont
    des noms lisibles : aucune jointure Utilisateur dans ce ticket (#495), donc
    le PDF ne doit jamais imprimer l'UUID brut à la place d'un nom."""
    chef_equipe_id = uuid.uuid4()
    traitement = _traitement_terrestre()
    traitement.terrestre.chef_equipe_id = chef_equipe_id

    html = build_crt_html(traitement)

    assert str(chef_equipe_id) not in html
