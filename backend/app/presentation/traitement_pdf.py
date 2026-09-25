"""Gabarit HTML du PDF de la fiche CRT (#495), rendu par
`render_html_to_pdf` (#533). Reproduction visuelle du formulaire papier
`docs/IFVM_Fiche_compte_rendu_traitement (1).md` (12 sections, libellés et
sous-numérotation 1.1/1.2/... repris à l'identique, cases à cocher) — pas un
tableau libellé/valeur générique, avec un bloc Aérien ou Terrestre selon
`traitement.type_traitement` (cf. issue #495 et son retour utilisateur :
"copie conforme" du formulaire officiel attendue, pas une simple liste)."""

import unicodedata
from datetime import date as date_type
from datetime import datetime as datetime_type
from enum import Enum
from html import escape
from typing import Any

from app.infrastructure.pdf_renderer import PDF_BASE_CSS
from app.presentation.traitement_schemas import (
    EmpoisonnementMode,
    EmpoisonnementType,
    EspeceCible,
    EvaluationRisquePopulationRead,
    MethodeEvaluationEfficacite,
    ModeTraitement,
    RepartitionPopulation,
    RoleSignature,
    SignatureRead,
    TraitementAerienRead,
    TraitementRead,
    TypeTraitement,
)

_CRT_CSS = """
body { font-size: 9.5pt; line-height: 1.35; }

.entete { text-align: center; margin-bottom: 0.15cm; }
.entete .organisme { font-size: 10pt; font-weight: bold; margin: 0; }
.entete h1 { font-size: 11pt; font-weight: bold; margin: 0.05cm 0 0.15cm; }
.entete .sigle { font-size: 9.5pt; text-align: right; margin: 0; }

/* Le formulaire papier ne graisse/encadre que les 12 titres de section — pas
   les sous-numéros (1.1, 4.1...), qui restent en corps de texte normal, mais
   indentés d'un cran (tabulation) sous leur titre, comme sur le papier. */
h2.section { font-size: 10pt; font-weight: bold; margin: 0.28cm 0 0.05cm; }

p.ligne { margin: 0.05cm 0 0.05cm 0.45cm; }
span.champ { margin-right: 0.35cm; white-space: nowrap; }
span.libelle { font-weight: 400; }
span.valeur { border-bottom: 0.75pt solid #111827; padding: 0 0.08cm; }
span.blanc { display: inline-block; min-width: 1.3cm; border-bottom: 0.75pt dotted #6b7280; }

span.option { margin-right: 0.3cm; white-space: nowrap; }
span.case { display: inline-block; width: 0.3cm; height: 0.3cm; line-height: 0.26cm;
  text-align: center; border: 0.75pt solid #111827; margin-left: 0.1cm; font-size: 7pt;
  font-weight: bold; vertical-align: -0.03cm; }
span.case.cochee::after { content: "X"; }

table.grille { width: calc(100% - 0.45cm); border-collapse: collapse;
  margin: 0.1cm 0 0.1cm 0.45cm; }
table.grille th, table.grille td { border: 0.75pt solid #9ca3af; padding: 0.08cm 0.15cm;
  font-size: 9pt; text-align: left; }

div.zone-texte { border: 0.75pt solid #9ca3af; min-height: 1.2cm; padding: 0.15cm;
  margin: 0.05cm 0 0.05cm 0.45cm; width: calc(100% - 0.45cm - 0.3cm); box-sizing: border-box; }

/* Signatures : seule annexe qui reste un tableau (image de signature en
   colonne) — même style de grille que la table §9, pas de mise en avant
   particulière par rapport aux 12 sections du formulaire. Colonne signature
   volontairement large/haute : c'est l'endroit où quelqu'un doit apposer un
   vrai tracé, pas juste une valeur textuelle. */
table.signatures td.signature { min-width: 4.5cm; height: 2cm; vertical-align: middle; }
table.signatures td.a-signer { color: #6b7280; font-style: italic; vertical-align: middle; }
img.signature-image { max-height: 1.8cm; max-width: 4.2cm; }
"""

# Familles saisies côté mobile (impacts.tsx : ESPECES_NON_CIBLES/FAMILLES_MORTALITE)
# vs libellés exacts du formulaire papier — orthographes différentes (Oiseux/Oiseaux,
# Insecte/Insectes utiles...), rapprochées par `_cases_familles` plutôt que comparées
# telles quelles (sinon aucune case ne se cocherait jamais).
_FAMILLES_COMPORTEMENT_PAPIER = [
    "Oiseux",
    "Reptile",
    "Insecte",
    "Mammifère",
    "Amphibien",
    "Poisson",
]
_FAMILLES_MORTALITE_PAPIER = ["Oiseaux", "Reptile", "Insecte", "Mammifère", "Amphibien", "Poissons"]

_LIBELLES_AXES_RISQUE = {
    "ressources_eau": "Ressources en eau",
    "sol": "Sol",
    "faune_non_cible": "Faune non cible",
    "abeilles": "Abeilles / pollinisateurs",
}


def _valeur_texte(valeur: Any) -> str | None:
    # Un `str, Enum` (ModeTraitement, EspeceCible...) affiché via `str()` rend
    # "ModeTraitement.TOTAL" et non "TOTAL" en Python 3.14 (le mixin `str`
    # perd la priorité sur `__str__` face à `Enum.__str__`) : on déballe
    # `.value` explicitement avant toute mise en forme (cf. #495).
    if isinstance(valeur, Enum):
        valeur = valeur.value
    if isinstance(valeur, bool):
        valeur = "Oui" if valeur else "Non"
    # Dates/heures au format français (jj/mm/aaaa) plutôt que l'ISO
    # (aaaa-mm-jj) par défaut de `str()` — `datetime` avant `date` : un
    # `datetime` est aussi une instance de `date`.
    if isinstance(valeur, datetime_type):
        valeur = valeur.strftime("%d/%m/%Y %H:%M")
    elif isinstance(valeur, date_type):
        valeur = valeur.strftime("%d/%m/%Y")
    if valeur is None or valeur == "":
        return None
    return escape(str(valeur))


def _champ(label: str, valeur: Any) -> str:
    """Un couple "Libellé : valeur" du formulaire papier — valeur soulignée
    pleine si renseignée, pointillés (case à remplir) sinon."""
    texte = _valeur_texte(valeur)
    if texte is None:
        contenu = '<span class="blanc">&nbsp;</span>'
    else:
        contenu = f'<span class="valeur">{texte}</span>'
    return f'<span class="champ"><span class="libelle">{escape(label)} :</span> {contenu}</span>'


def _ligne(*champs: tuple[str, Any]) -> str:
    return (
        '<p class="ligne">' + " ".join(_champ(label, valeur) for label, valeur in champs) + "</p>"
    )


def _case_html(cochee: bool) -> str:
    """La case elle-même (sans libellé) — `data-checked` gardé (invisible à
    l'impression) pour permettre de tester l'état sans dépendre du CSS."""
    classes = "case cochee" if cochee else "case"
    return f'<span class="{classes}" data-checked="{"true" if cochee else "false"}"></span>'


def _case(label: str, cochee: bool) -> str:
    """Case à cocher "Libellé ☐" (l'ordre le plus courant sur le formulaire
    papier)."""
    return f'<span class="option">{escape(label)} {_case_html(cochee)}</span>'


def _ligne_options(*options: tuple[str, bool]) -> str:
    return (
        '<p class="ligne">' + " ".join(_case(label, cochee) for label, cochee in options) + "</p>"
    )


def _texte_ligne(texte: str) -> str:
    """Ligne de texte simple (ex. "3.4 Condition de traitement", "4.3 Kit
    protection :") — le formulaire papier ne graisse/encadre pas ces
    sous-titres, contrairement aux 12 titres de section eux-mêmes."""
    return f'<p class="ligne">{escape(texte)}</p>'


def _normaliser(texte: str) -> str:
    sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode()
    racine = sans_accents.lower().rstrip("s")
    # "Oiseux" (§10 du formulaire papier) / "Oiseaux" (§11 du même formulaire,
    # et saisie mobile ESPECES_NON_CIBLES/FAMILLES_MORTALITE) désignent la
    # même famille malgré l'orthographe divergente du document officiel
    # lui-même — sans ce cas particulier, aucune case ne se coche jamais.
    if racine in ("oiseux", "oiseaux"):
        return "oiseau"
    return racine


def _cases_familles(
    familles: dict, labels_papier: list[str]
) -> tuple[list[tuple[str, bool]], list[str]]:
    """Rapproche les familles cochées côté mobile (`comportement_non_cibles`/
    `mortalite_familles`, clés en toutes lettres — ex. "Insectes utiles") des
    libellés exacts du formulaire papier (ex. "Insecte"), par comparaison
    insensible aux accents/pluriels. Retourne les cases à afficher, et les
    clés mobiles sans correspondance papier (ex. "Abeilles", absente de la
    fiche officielle) — jamais silencieusement perdues, restituées à part."""
    cles_normalisees = {cle: _normaliser(cle) for cle in familles}
    cases = []
    matched: set[str] = set()
    for label in labels_papier:
        norme_label = _normaliser(label)
        trouve = False
        for cle, norme_cle in cles_normalisees.items():
            if norme_label in norme_cle or norme_cle in norme_label:
                trouve = True
                matched.add(cle)
        cases.append((label, trouve))
    non_rapprochees = [cle for cle in familles if cle not in matched]
    return cases, non_rapprochees


def _fait_traitement(traitement: TraitementRead):
    """Le fait Aérien ou Terrestre porteur des champs communs aux deux gabarits
    (taux de mortalité, pesticides...) — un seul des deux est jamais renseigné."""
    return traitement.aerien or traitement.terrestre


def _densite_infestation(cible) -> float | None:
    """Densité (ind./ha, §2.2) : dérivée de la paire (espèce, répartition)
    parmi les colonnes dédiées par espèce du modèle (migration 0066) —
    absente en tant que champ générique unique."""
    if cible is None or cible.espece is None or cible.repartition_population is None:
        return None
    diffuse = cible.repartition_population == RepartitionPopulation.DIFFUSE
    if cible.espece == EspeceCible.LMC:
        return cible.densite_diffuse_lmc if diffuse else cible.densite_groupee_lmc
    if cible.espece == EspeceCible.NSE:
        return cible.densite_diffuse_nse if diffuse else cible.densite_groupee_nse
    return None


def _section_references(traitement: TraitementRead) -> str:
    terrestre = traitement.terrestre
    coordonnees = None
    if traitement.latitude is not None:
        coordonnees = f"{traitement.latitude} / {traitement.longitude} / {traitement.altitude}"
    fait = _fait_traitement(traitement)
    return (
        '<h2 class="section">1. Références</h2>'
        # Chef d'équipe (1.2) : seul `chef_equipe_id` (FK Utilisateur) existe
        # côté modèle, aucun nom résolu — pas de jointure sur Utilisateur dans
        # ce ticket (cf. #495). Case vide plutôt qu'un UUID brut.
        + _ligne(
            ("1.1 N° CRT", traitement.numero_fiche),
            ("1.2 Chef d'équipe", None),
            ("1.3 Agent encadreur", terrestre.agent_encadreur if terrestre else None),
        )
        # Consultant international : commun Aérien/Terrestre, retiré des
        # annexes "Détail Aérien/Terrestre" (doublon) — sa place naturelle est
        # ici, à côté des autres intervenants nommés de la fiche.
        + _ligne(("Consultant international", fait.consultant_international if fait else None))
        # §1.4/1.5 : la validation référencée ici est celle de la prospection
        # liée (`prospection_id`), pas `traitement.date_validation` (une
        # validation propre au CRT, distincte — cf. #495, retour
        # utilisateur) ; même pattern que FicheVol.prospection_date_validation.
        + _ligne(
            (
                "1.4 Date de validation",
                traitement.prospection_date_validation.date()
                if traitement.prospection_date_validation
                else None,
            ),
            ("1.5 N° de validation", traitement.prospection_n_fiche),
            ("1.6 Date de traitement", traitement.date_traitement),
        )
        + _ligne(
            ("1.7 Localité", traitement.localite),
            ("1.8 C/R", traitement.commune),
            ("1.9 District", traitement.district),
        )
        + _ligne(
            ("1.10 PA", None),
            ("1.11 ZA", None),
            ("1.12 Région", traitement.region),
        )
        + _ligne(("Coordonnées", coordonnees), ("Coordonnées 1ère passe", None))
    )


def _section_cibles(traitement: TraitementRead) -> str:
    cible = traitement.cible
    espece = cible.espece if cible else None
    repartition = cible.repartition_population if cible else None
    return (
        '<h2 class="section">2. Cibles</h2>'
        + _ligne_options(
            ("2.1 Espèces — LMC", espece == EspeceCible.LMC),
            ("NSE", espece == EspeceCible.NSE),
            ("Mélange", espece == EspeceCible.MELANGE),
        )
        + _ligne(
            ("Petites larves", cible.petites_larves if cible else None),
            ("Grandes larves", cible.grandes_larves if cible else None),
            ("Vols clairs / essaims", cible.vols_clairs_essaims if cible else None),
        )
        + _ligne(
            ("2.2 Surface infestée (ha)", cible.surface_infestee_ha if cible else None),
            ("Densité (ind./ha)", _densite_infestation(cible)),
        )
        + _ligne_options(
            ("Population — Diffuse", repartition == RepartitionPopulation.DIFFUSE),
            ("groupée", repartition == RepartitionPopulation.GROUPEE),
        )
    )


def _section_traitement(traitement: TraitementRead) -> str:
    terrestre = traitement.terrestre
    aerien = traitement.aerien
    fait = _fait_traitement(traitement)
    mode = traitement.mode_traitement
    methode = fait.methode_evaluation_efficacite if fait else None
    return (
        '<h2 class="section">3. Traitement</h2>'
        + _ligne_options(
            ("3.1 Mode de traitement — Couverture Total", mode == ModeTraitement.TOTAL),
            ("Barrière", mode == ModeTraitement.BARRIERE),
            ("Traitement irrégulier", mode == ModeTraitement.IRREGULIER),
        )
        # §3.2 : Ulvamast sans équivalent au modèle (case vide, pas
        # d'extension de schéma dans ce ticket).
        + _ligne(
            (
                "3.2 Surface traitée par atomiseur à dos (ha)",
                terrestre.surface_atomiseur_ha if terrestre else None,
            ),
            ("par disque rotatif (ha)", terrestre.surface_disque_rotatif_ha if terrestre else None),
            ("par ulvamast (ha)", None),
            # Surface couverte par l'aéronef, quel que soit le produit : le mode
            # (case « Barrière » de §3.1) dit déjà si elle est traitée ou protégée.
            (
                "par aéronef (ha)",
                aerien.surface_traitee_ha + aerien.surface_protegee_ha if aerien else None,
            ),
        )
        + _ligne(("3.3 Surface reste à traiter (ha)", fait.surface_restante_ha if fait else None))
        + _texte_ligne("3.4 Condition de traitement")
        + _ligne(
            ("Début (heure)", terrestre.heure_debut if terrestre else None),
            ("Fin (heure)", terrestre.heure_fin if terrestre else None),
            ("Vent — Vitesse (m/s)", terrestre.vitesse_vent_ms if terrestre else None),
            ("Direction", terrestre.direction_vent if terrestre else None),
            ("Température (°C)", terrestre.temperature_c if terrestre else None),
        )
        + _ligne(
            (
                "3.5 Efficacité — Taux de mortalité (%)",
                fait.taux_mortalite_pourcent if fait else None,
            ),
            (
                "Évalué après traitement (h)",
                fait.evaluation_efficacite_heures_apres if fait else None,
            ),
        )
        + _ligne_options(
            (
                "Méthode d'évaluation — Estimation visuelle",
                methode == MethodeEvaluationEfficacite.ESTIMATION_VISUELLE,
            ),
            (
                "Comptages pré/post-traitement",
                methode == MethodeEvaluationEfficacite.COMPTAGES_PRE_POST,
            ),
        )
    )


def _section_moyens(traitement: TraitementRead) -> str:
    return (
        '<h2 class="section">4. Moyens</h2>'
        + _ligne(
            ("4.1 Humains — Nb agents permanents", traitement.nb_agents_permanents),
            ("Nb agents temporaires", traitement.nb_agents_temporaires),
            ("Nb personnel local", traitement.nb_personnel_local),
        )
        + _ligne(
            ("4.2 Matériels — Atomiseur", traitement.moyens_atomiseur_nb),
            ("Essence (litres)", traitement.moyens_essence_litres),
            ("Disque rotatif", traitement.moyens_disque_rotatif_nb),
            ("Piles (nb)", traitement.moyens_piles_nb),
        )
        + _ligne(("Ulvamast (nb)", traitement.moyens_ulvamast_nb))
        + _texte_ligne("4.3 Kit protection :")
        + _ligne(
            ("Combinaison", traitement.kit_combinaison),
            ("Gants", traitement.kit_gants),
            ("Lunettes", traitement.kit_lunettes),
            ("Masques", traitement.kit_masques),
            ("Botte", traitement.kit_botte),
        )
    )


def _section_pesticides(traitement: TraitementRead) -> str:
    fait = _fait_traitement(traitement)
    # `pesticide_unite` (#produits-unite-l-kg) — Terrestre uniquement, pas
    # d'équivalent Aérien : `getattr` avec repli sur "L".
    unite_brute = getattr(fait, "pesticide_unite", "L") if fait else "L"
    unite = unite_brute.value if isinstance(unite_brute, Enum) else unite_brute
    consomme = fait.total_pesticide_l if fait else None
    # Aérien : « Approvisionnement » est saisi dans l'unité du produit (poudre en kg) —
    # même règle que `TraitementAerien.recalculer_stock_pesticide`.
    if (
        isinstance(fait, TraitementAerienRead)
        and fait.total_pesticide_l == 0
        and fait.total_pesticide_kg > 0
    ):
        unite = "kg"
        consomme = fait.total_pesticide_kg
    return (
        '<h2 class="section">5. Pesticides</h2>'
        + _ligne(
            ("5.1 Nom commercial", None),
            ("5.2 Matières actives", None),
        )
        + _ligne(
            ("5.3 Stock initial", getattr(fait, "stock_initial_l", None) if fait else None),
            # pesticide_recu_l/pesticide_stock_restant_l : Terrestre uniquement
            # depuis #609 — le stock Aérien vit dans `mouvement_pesticide`, hors
            # périmètre de ce PDF (écrans de consultation du stock, hors scope
            # #609). Même repli `getattr` que pesticide_unite/stock_initial_l
            # ci-dessus pour l'Aérien.
            (
                f"5.4 Approvisionnement ({unite})",
                getattr(fait, "pesticide_recu_l", None) if fait else None,
            ),
        )
        + _ligne(
            (f"5.5 Produit consommé ({unite})", consomme),
            (
                f"5.6 Stock final ({unite})",
                getattr(fait, "pesticide_stock_restant_l", None) if fait else None,
            ),
        )
    )


def _section_zones_cibles(traitement: TraitementRead) -> str:
    # Le choix produit a réduit les zones cibles saisissables à Cultures et
    # Pâturages (mobile/(traitement)/moyens.tsx) : les autres postes du
    # formulaire papier restent des cases non cochées / champs vides,
    # reproduits pour la fidélité de mise en page plutôt que supprimés.
    zones = traitement.zones_exposees or {}
    return (
        '<h2 class="section">6. Zones cibles</h2>'
        + _ligne_options(("6.1 Culture", bool(zones.get("cultures"))))
        + _ligne(
            ("Maïs (ha)", None),
            ("Riz (ha)", None),
            ("Canne à sucre (ha)", None),
        )
        + _ligne(
            ("Banane (ha)", None),
            ("Manioc (ha)", None),
            ("Sorgho (ha)", None),
        )
        + _ligne_options(
            ("6.2 Pâturage", bool(zones.get("paturages"))),
            ("6.3 Apiculture", False),
            ("6.4 Aquaculture", False),
            ("6.5 Production organique", False),
            ("Zone forestier", False),
        )
    )


def _section_vegetation(traitement: TraitementRead) -> str:
    return '<h2 class="section">7. Type de végétation</h2>' + _ligne(
        ("7.1 Hauteur strate herbeuse (m)", traitement.hauteur_strate_herbeuse_m),
        ("7.2 Hauteur strate arborée (m)", traitement.hauteur_strate_arboree_m),
        ("7.3 Recouvrement (%)", traitement.recouvrement_percent),
    )


def _section_empoisonnement(traitement: TraitementRead) -> str:
    type_ = traitement.empoisonnement_type
    mode = traitement.empoisonnement_mode
    return (
        '<h2 class="section">8. Empoisonnement</h2>'
        + _ligne_options(
            ("8.1 Cas d'empoisonnement — Oui", traitement.empoisonnement is True),
            ("Non", traitement.empoisonnement is False),
        )
        + _ligne_options(
            ("Si oui, Agent", type_ == EmpoisonnementType.AGENT),
            ("Population", type_ == EmpoisonnementType.POPULATION),
        )
        + _ligne_options(
            ("8.2 Comment ? — Ingestion", mode == EmpoisonnementMode.INGESTION),
            ("Inhalation", mode == EmpoisonnementMode.INHALATION),
            ("Contact", mode == EmpoisonnementMode.CONTACT),
            ("Autres", mode == EmpoisonnementMode.AUTRE),
        )
        + _ligne(("Autres à préciser", traitement.empoisonnement_autre))
    )


def _sensibilisation_html(evaluation: EvaluationRisquePopulationRead) -> str:
    """9.3 Sensibilisation : deux cases "☐ Oui ☐ Non" comme sur le formulaire
    papier — pas un simple texte, même quand la réponse est connue."""
    sensibilisation = evaluation.sensibilisation
    return f"{_case_html(sensibilisation is True)} Oui {_case_html(sensibilisation is False)} Non"


def _section_evaluation_risque(traitement: TraitementRead) -> str:
    evaluations = traitement.evaluations_risque_population
    entete = '<h2 class="section">9. Évaluation du risque pour la population</h2>'
    if not evaluations:
        return entete + '<table class="grille"><tr><td>&mdash;</td></tr></table>'
    colonnes = "".join(f"<th>{i + 1}</th>" for i in range(len(evaluations)))
    habitats = "".join(
        f"<td>{_valeur_texte(e.habitat_proche) or '&mdash;'}</td>" for e in evaluations
    )
    distances = "".join(
        f"<td>{_valeur_texte(e.distance_km) or '&mdash;'}</td>" for e in evaluations
    )
    sensibilisations = "".join(f"<td>{_sensibilisation_html(e)}</td>" for e in evaluations)
    return (
        entete
        + f"""<table class="grille">
      <tr><th></th>{colonnes}</tr>
      <tr><th>Habitat le plus proche</th>{habitats}</tr>
      <tr><th>9.2 Distance (km)</th>{distances}</tr>
      <tr><th>9.3 Sensibilisation</th>{sensibilisations}</tr>
    </table>"""
    )


def _section_observation_non_cibles(traitement: TraitementRead) -> str:
    comportement = traitement.comportement_non_cibles or {}
    cases, non_rapprochees = _cases_familles(comportement, _FAMILLES_COMPORTEMENT_PAPIER)
    html = (
        '<h2 class="section">10. Observation sur non cibles</h2>'
        + _ligne_options(
            ("10.1 Comportement anormal — Oui", traitement.comportement_anormal is True),
            ("Non", traitement.comportement_anormal is False),
        )
        + _ligne_options(
            *[
                (f"10.2 {label}" if i == 0 else label, coche)
                for i, (label, coche) in enumerate(cases)
            ]
        )
    )
    if non_rapprochees:
        html += _ligne(("Autres familles concernées", ", ".join(non_rapprochees)))
    return html


def _section_mortalite(traitement: TraitementRead) -> str:
    familles = traitement.mortalite_familles or {}
    cases, non_rapprochees = _cases_familles(familles, _FAMILLES_MORTALITE_PAPIER)
    html = (
        '<h2 class="section">11. Mortalité</h2>'
        + _ligne_options(
            ("Oui", traitement.mortalite is True),
            ("Non", traitement.mortalite is False),
        )
        + _ligne_options(
            *[
                (f"Si oui, Famille — {label}" if i == 0 else label, coche)
                for i, (label, coche) in enumerate(cases)
            ]
        )
    )
    if non_rapprochees:
        html += _ligne(("Autres familles concernées", ", ".join(non_rapprochees)))
    return html


def _section_observations(traitement: TraitementRead) -> str:
    contenu = _valeur_texte(traitement.observations) or "&nbsp;"
    return (
        f'<h2 class="section">12. Observation générale</h2><div class="zone-texte">{contenu}</div>'
    )


def _section_axes_risque(traitement: TraitementRead) -> str:
    """Axes de risque environnemental (`evaluation_risque`, écran mobile
    `impacts.tsx`) — hors des 12 sections du formulaire papier, mais saisis
    par le terrain et jusqu'ici jamais restitués dans le PDF (champ mort).
    Rendu dans le même style dense que les 12 sections officielles (et non
    plus un tableau à part) ; omis quand rien n'est renseigné, contrairement
    à ces 12 sections, toujours rendues même vides."""
    axes = traitement.evaluation_risque or {}
    if not axes:
        return ""
    champs = [(_LIBELLES_AXES_RISQUE.get(cle, cle), valeur) for cle, valeur in axes.items()]
    return '<h2 class="section">Axes de risque environnemental (complément)</h2>' + _ligne(*champs)


def _section_bloc_aerien(traitement: TraitementRead) -> str:
    """Détail Aérien : uniquement les champs sans équivalent dans les 12
    sections numérotées (§3 couvre déjà la surface aéronef, §5 le produit
    consommé — "Consultant international" a rejoint §1 Références) ; sinon
    doublon avec ces sections (cf. retour utilisateur #495)."""
    aerien = traitement.aerien
    if aerien is None:
        return ""
    return (
        '<h2 class="section">Détail Aérien (complément)</h2>'
        + _ligne(
            ("Pilote", aerien.pilote),
            ("Mécanicien", aerien.mecanicien),
        )
        + _ligne(
            ("Base principale", aerien.base_principale),
            ("Stand", aerien.stand),
            ("Base secondaire", aerien.base_secondaire),
        )
        + _ligne(
            ("Immatriculation aéronef", aerien.immatricule_aeronef),
            ("Nb rotations", aerien.nb_rotations),
        )
    )


def _section_bloc_terrestre(traitement: TraitementRead) -> str:
    """Détail Terrestre : surface_atomiseur_ha/disque_rotatif_ha (§3.2) et
    total_pesticide_l (§5.5) retirés (doublons — même champ que la section
    numérotée) et "Consultant international" déplacé en §1 Références. En
    revanche `terrestre.essence_litres`/`nb_piles` NE sont PAS des doublons
    de `moyens_essence_litres`/`moyens_piles_nb` (§4.2) malgré l'intitulé
    proche : l'écran mobile recap.tsx les affiche comme deux quantités
    distinctes, dans deux cartes séparées ("Moyens & produits (Terrestre)"
    vs "Moyens & protection") — retirés par erreur lors d'un passage
    précédent, restaurés ici après revue de code."""
    terrestre = traitement.terrestre
    if terrestre is None:
        return ""
    if terrestre.essence_litres is None and terrestre.nb_piles is None:
        return ""
    return '<h2 class="section">Détail Terrestre (complément)</h2>' + _ligne(
        ("Essence (litres)", terrestre.essence_litres),
        ("Nb piles", terrestre.nb_piles),
    )


def _signature_image_html(signature: SignatureRead) -> str:
    if not signature.signature_image:
        return "&mdash;"
    trace = escape(signature.signature_image)
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg'>"
        f"<path d='{trace}' stroke='black' fill='none'/></svg>"
    )
    return f'<img class="signature-image" src="data:image/svg+xml;utf8,{svg}" />'


def _section_signatures(traitement: TraitementRead) -> str:
    signatures = traitement.signatures
    lignes = "".join(
        f"<tr><th>{escape(signature.role.value)}</th>"
        f"<td>{escape(signature.signataire_nom)}</td>"
        f"<td>{_valeur_texte(signature.horodatage) or '&mdash;'}</td>"
        f'<td class="signature">{_signature_image_html(signature)}</td></tr>'
        for signature in signatures
    )
    # Le consultant international nommé sur la fiche (§1 Références) doit
    # signer comme les autres rôles : s'il n'a pas encore de signature
    # capturée, une ligne "à signer" le rend visible plutôt que de l'omettre
    # silencieusement (cf. retour utilisateur #495).
    fait = _fait_traitement(traitement)
    consultant_nom = getattr(fait, "consultant_international", None) if fait else None
    a_deja_signe = any(s.role == RoleSignature.CONSULTANT_INTERNATIONAL for s in signatures)
    if consultant_nom and not a_deja_signe:
        lignes += (
            f"<tr><th>{escape(RoleSignature.CONSULTANT_INTERNATIONAL.value)}</th>"
            f"<td>{escape(consultant_nom)}</td>"
            f"<td>&mdash;</td>"
            '<td class="a-signer signature">à signer</td></tr>'
        )
    if not lignes:
        return ""
    return (
        '<h2 class="section">Signatures (complément)</h2>'
        f'<table class="grille signatures">'
        "<tr><th>Rôle</th><th>Nom</th><th>Date / heure</th><th>Signature</th></tr>"
        f"{lignes}</table>"
    )


def build_crt_html(traitement: TraitementRead) -> str:
    est_aerien = traitement.type_traitement == TypeTraitement.AERIEN
    bloc_specifique = (
        _section_bloc_aerien(traitement) if est_aerien else _section_bloc_terrestre(traitement)
    )

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>{PDF_BASE_CSS}{_CRT_CSS}</style>
</head>
<body>
<div class="entete">
<p class="organisme">IVOTOERANA FAMONGORANA NY VALALA ETO MADAGASIKARA</p>
<h1>FICHE DE COMPTE-RENDU ET ÉVALUATION RAPIDE DE TRAITEMENT</h1>
<p class="sigle">Sigle <span class="valeur">{escape(traitement.numero_fiche)}</span> /CRT</p>
</div>
{_section_references(traitement)}
{_section_cibles(traitement)}
{_section_traitement(traitement)}
{_section_moyens(traitement)}
{_section_pesticides(traitement)}
{_section_zones_cibles(traitement)}
{_section_vegetation(traitement)}
{_section_empoisonnement(traitement)}
{_section_evaluation_risque(traitement)}
{_section_observation_non_cibles(traitement)}
{_section_mortalite(traitement)}
{_section_observations(traitement)}
{_section_axes_risque(traitement)}
{bloc_specifique}
{_section_signatures(traitement)}
</body>
</html>
"""
