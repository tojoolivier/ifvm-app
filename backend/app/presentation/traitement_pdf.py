"""Gabarit HTML du PDF de la fiche CRT (#495), rendu par
`render_html_to_pdf` (#533). Reproduction du formulaire papier
`docs/IFVM_Fiche_compte_rendu_traitement (1).md` (12 sections), avec un bloc
Aérien ou Terrestre selon `traitement.type_traitement` — pas un template
unique à trous (cf. issue #495).
"""

from html import escape
from typing import Any

from app.infrastructure.pdf_renderer import PDF_BASE_CSS
from app.presentation.traitement_schemas import (
    EvaluationRisquePopulationRead,
    SignatureRead,
    TraitementRead,
    TypeTraitement,
)

_CRT_CSS = """
h1 { font-size: 14pt; text-align: center; margin-bottom: 0.2cm; }
h2 { font-size: 11pt; background: #e5e7eb; padding: 0.1cm 0.2cm; margin-top: 0.5cm; }
table { width: 100%; border-collapse: collapse; margin-bottom: 0.3cm; }
th, td { border: 1px solid #9ca3af; padding: 0.15cm 0.2cm; font-size: 9.5pt; text-align: left; }
.champ-vide::after { content: " —"; color: #6b7280; }
.signature-image { max-height: 2cm; }
"""


def _texte(valeur: Any) -> str:
    if valeur is None or valeur == "":
        return '<span class="champ-vide"></span>'
    return escape(str(valeur))


def _ligne(label: str, valeur: Any) -> str:
    return f"<tr><th>{escape(label)}</th><td>{_texte(valeur)}</td></tr>"


def _section(titre: str, lignes: list[tuple[str, Any]]) -> str:
    """Rend une section « titre + table label/valeur » — la forme que
    reprennent la plupart des sections du formulaire papier (#495)."""
    corps = "".join(_ligne(label, valeur) for label, valeur in lignes)
    return f"""
    <h2>{escape(titre)}</h2>
    <table>{corps}</table>
    """


def _fait_traitement(traitement: TraitementRead):
    """Le fait Aérien ou Terrestre porteur des champs communs aux deux gabarits
    (taux de mortalité, pesticides...) — un seul des deux est jamais renseigné."""
    return traitement.aerien or traitement.terrestre


def _section_references(traitement: TraitementRead) -> str:
    coordonnees = None
    if traitement.latitude is not None:
        coordonnees = f"{traitement.latitude} / {traitement.longitude} / {traitement.altitude}"
    return _section(
        "1. Références",
        [
            ("N° CRT", traitement.numero_fiche),
            ("Date de validation", traitement.date_validation),
            ("Date de traitement", traitement.date_traitement),
            ("Localité", traitement.localite),
            ("Région", traitement.region),
            ("District", traitement.district),
            ("Commune", traitement.commune),
            ("Coordonnées", coordonnees),
        ],
    )


def _section_cibles(traitement: TraitementRead) -> str:
    cible = traitement.cible
    return _section(
        "2. Cibles",
        [
            ("Espèce", cible.espece if cible else None),
            ("Petites larves", cible.petites_larves if cible else None),
            ("Grandes larves", cible.grandes_larves if cible else None),
            ("Vols clairs / essaims", cible.vols_clairs_essaims if cible else None),
            ("Répartition population", cible.repartition_population if cible else None),
            ("Surface infestée (ha)", cible.surface_infestee_ha if cible else None),
        ],
    )


def _section_traitement(traitement: TraitementRead) -> str:
    terrestre = traitement.terrestre
    fait = _fait_traitement(traitement)
    evaluation_heures = fait.evaluation_efficacite_heures_apres if fait else None
    return _section(
        "3. Traitement",
        [
            ("Mode de traitement", traitement.mode_traitement),
            ("Début (heure)", terrestre.heure_debut if terrestre else None),
            ("Fin (heure)", terrestre.heure_fin if terrestre else None),
            ("Vent — vitesse (m/s)", terrestre.vitesse_vent_ms if terrestre else None),
            ("Vent — direction", terrestre.direction_vent if terrestre else None),
            ("Température (°C)", terrestre.temperature_c if terrestre else None),
            ("Taux de mortalité (%)", fait.taux_mortalite_pourcent if fait else None),
            ("Évalué après traitement (h)", evaluation_heures),
            ("Méthode d'évaluation", fait.methode_evaluation_efficacite if fait else None),
        ],
    )


def _section_moyens(traitement: TraitementRead) -> str:
    # §4.1/4.2 (moyens humains/matériels) : absents du modèle actuel (issue
    # #495) — cases volontairement vides, pas d'extension de schéma ici.
    return _section(
        "4. Moyens",
        [
            ("Nb agents permanents", None),
            ("Nb agents temporaires", None),
            ("Nb personnel local", None),
            ("Atomiseur", None),
            ("Essence (litres)", None),
            ("Disque rotatif", None),
            ("Piles (nb)", None),
            ("Ulvamast (nb)", None),
            ("Combinaison", traitement.kit_combinaison),
            ("Gants", traitement.kit_gants),
            ("Lunettes", traitement.kit_lunettes),
            ("Masques", traitement.kit_masques),
            ("Bottes", traitement.kit_botte),
        ],
    )


def _section_pesticides(traitement: TraitementRead) -> str:
    fait = _fait_traitement(traitement)
    return _section(
        "5. Pesticides",
        [
            ("Nom commercial", None),
            ("Matières actives", None),
            # Terrestre uniquement (pas d'équivalent Aérien) — `getattr` plutôt
            # qu'un accès direct, `fait` pouvant être un TraitementAerienRead.
            ("Stock initial", getattr(fait, "stock_initial_l", None) if fait else None),
            ("Approvisionnement (produit reçu, L)", fait.pesticide_recu_l if fait else None),
            ("Stock final restant (L)", fait.pesticide_stock_restant_l if fait else None),
        ],
    )


def _section_zones_cibles(traitement: TraitementRead) -> str:
    zones = traitement.zones_exposees or {}
    lignes = list(zones.items()) or [("Zones exposées", None)]
    return _section("6. Zones cibles", lignes)


def _section_vegetation(traitement: TraitementRead) -> str:
    return _section(
        "7. Type de végétation",
        [
            ("Hauteur strate herbeuse (m)", traitement.hauteur_strate_herbeuse_m),
            ("Hauteur strate arborée (m)", traitement.hauteur_strate_arboree_m),
            ("Recouvrement (%)", traitement.recouvrement_percent),
        ],
    )


def _section_empoisonnement(traitement: TraitementRead) -> str:
    return _section(
        "8. Empoisonnement",
        [
            ("Cas d'empoisonnement", "Oui" if traitement.empoisonnement else "Non"),
            ("Type", traitement.empoisonnement_type),
            ("Mode", traitement.empoisonnement_mode),
            ("Autre (précision)", traitement.empoisonnement_autre),
        ],
    )


def _sensibilisation_texte(evaluation: EvaluationRisquePopulationRead) -> str:
    if evaluation.sensibilisation is None:
        return _texte(None)
    return _texte("Oui" if evaluation.sensibilisation else "Non")


def _section_evaluation_risque(traitement: TraitementRead) -> str:
    evaluations = traitement.evaluations_risque_population
    titre = "9. Évaluation du risque pour la population"
    if not evaluations:
        return f"""
        <h2>{titre}</h2>
        <table><tr><td>{_texte(None)}</td></tr></table>
        """
    colonnes = "".join(f"<th>{i + 1}</th>" for i in range(len(evaluations)))
    habitats = "".join(f"<td>{_texte(e.habitat_proche)}</td>" for e in evaluations)
    distances = "".join(f"<td>{_texte(e.distance_km)}</td>" for e in evaluations)
    sensibilisations = "".join(f"<td>{_sensibilisation_texte(e)}</td>" for e in evaluations)
    return f"""
    <h2>{titre}</h2>
    <table>
      <tr><th></th>{colonnes}</tr>
      <tr><th>Habitat le plus proche</th>{habitats}</tr>
      <tr><th>Distance (km)</th>{distances}</tr>
      <tr><th>Sensibilisation</th>{sensibilisations}</tr>
    </table>
    """


def _section_mortalite(traitement: TraitementRead) -> str:
    familles = traitement.mortalite_familles or {}
    comportement = traitement.comportement_non_cibles or {}
    familles_comportement = ", ".join(comportement.keys()) if comportement else None
    familles_mortalite = ", ".join(familles.keys()) if familles else None
    return _section(
        "10. Comportement non cibles et mortalité",
        [
            ("Comportement anormal", "Oui" if traitement.comportement_anormal else "Non"),
            ("Familles concernées (comportement)", familles_comportement),
            ("Mortalité constatée", "Oui" if traitement.mortalite else "Non"),
            ("Familles concernées (mortalité)", familles_mortalite),
        ],
    )


def _section_observations(traitement: TraitementRead) -> str:
    return _section("11. Observation générale", [("Observations", traitement.observations)])


def _section_bloc_aerien(traitement: TraitementRead) -> str:
    aerien = traitement.aerien
    if aerien is None:
        return ""
    return _section(
        "Détail Aérien",
        [
            ("Pilote", aerien.pilote),
            ("Mécanicien", aerien.mecanicien),
            ("Chef de base", aerien.chef_de_base_id),
            ("Consultant international", aerien.consultant_international),
            ("Base principale", aerien.base_principale),
            ("Stand", aerien.stand),
            ("Base secondaire", aerien.base_secondaire),
            ("Immatriculation aéronef", aerien.immatricule_aeronef),
            ("Nb rotations", aerien.nb_rotations),
            ("Total pesticide (L)", aerien.total_pesticide_l),
            ("Surface traitée (ha)", aerien.surface_traitee_ha),
        ],
    )


def _section_bloc_terrestre(traitement: TraitementRead) -> str:
    terrestre = traitement.terrestre
    if terrestre is None:
        return ""
    return _section(
        "Détail Terrestre",
        [
            ("Chef d'équipe", terrestre.chef_equipe_id),
            ("Agent encadreur", terrestre.agent_encadreur),
            ("Consultant international", terrestre.consultant_international),
            ("Surface atomiseur (ha)", terrestre.surface_atomiseur_ha),
            ("Surface disque rotatif (ha)", terrestre.surface_disque_rotatif_ha),
            ("Essence (litres)", terrestre.essence_litres),
            ("Nb piles", terrestre.nb_piles),
            ("Total pesticide (L)", terrestre.total_pesticide_l),
        ],
    )


def _signature_image_html(signature: SignatureRead) -> str:
    if not signature.signature_image:
        return _texte(None)
    trace = escape(signature.signature_image)
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg'>"
        f"<path d='{trace}' stroke='black' fill='none'/></svg>"
    )
    return f'<img class="signature-image" src="data:image/svg+xml;utf8,{svg}" />'


def _section_signatures(traitement: TraitementRead) -> str:
    if not traitement.signatures:
        return ""
    lignes = "".join(
        f"<tr><th>{escape(signature.role.value)}</th>"
        f"<td>{escape(signature.signataire_nom)}</td>"
        f"<td>{_signature_image_html(signature)}</td></tr>"
        for signature in traitement.signatures
    )
    return f"""
    <h2>Signatures</h2>
    <table>{lignes}</table>
    """


def build_crt_html(traitement: TraitementRead) -> str:
    est_aerien = traitement.type_traitement == TypeTraitement.AERIEN
    bloc_specifique = (
        _section_bloc_aerien(traitement) if est_aerien else _section_bloc_terrestre(traitement)
    )
    numero_fiche = escape(traitement.numero_fiche)
    titre = f"Fiche de compte-rendu et évaluation rapide de traitement (CRT) — {numero_fiche}"

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>{PDF_BASE_CSS}{_CRT_CSS}</style>
</head>
<body>
<h1>{titre}</h1>
{_section_references(traitement)}
{_section_cibles(traitement)}
{_section_traitement(traitement)}
{bloc_specifique}
{_section_moyens(traitement)}
{_section_pesticides(traitement)}
{_section_zones_cibles(traitement)}
{_section_vegetation(traitement)}
{_section_empoisonnement(traitement)}
{_section_evaluation_risque(traitement)}
{_section_mortalite(traitement)}
{_section_observations(traitement)}
{_section_signatures(traitement)}
</body>
</html>
"""
