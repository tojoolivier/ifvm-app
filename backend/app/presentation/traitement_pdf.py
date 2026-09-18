"""Gabarit HTML du PDF de la fiche CRT (#495), rendu par
`render_html_to_pdf` (#533). Reproduction du formulaire papier
`docs/IFVM_Fiche_compte_rendu_traitement (1).md` (12 sections), avec un bloc
Aérien ou Terrestre selon `traitement.type_traitement` — pas un template
unique à trous (cf. issue #495).
"""

from html import escape
from typing import Any

from app.infrastructure.pdf_renderer import PDF_BASE_CSS
from app.presentation.traitement_schemas import TraitementRead, TypeTraitement

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


def _section_references(t: TraitementRead) -> str:
    coordonnees = f"{t.latitude} / {t.longitude} / {t.altitude}" if t.latitude is not None else None
    return f"""
    <h2>1. Références</h2>
    <table>
      {_ligne("N° CRT", t.numero_fiche)}
      {_ligne("Date de validation", t.date_validation)}
      {_ligne("Date de traitement", t.date_traitement)}
      {_ligne("Localité", t.localite)}
      {_ligne("Région", t.region)}
      {_ligne("District", t.district)}
      {_ligne("Commune", t.commune)}
      {_ligne("Coordonnées", coordonnees)}
    </table>
    """


def _section_cibles(t: TraitementRead) -> str:
    c = t.cible
    return f"""
    <h2>2. Cibles</h2>
    <table>
      {_ligne("Espèce", c.espece if c else None)}
      {_ligne("Petites larves", c.petites_larves if c else None)}
      {_ligne("Grandes larves", c.grandes_larves if c else None)}
      {_ligne("Vols clairs / essaims", c.vols_clairs_essaims if c else None)}
      {_ligne("Répartition population", c.repartition_population if c else None)}
      {_ligne("Surface infestée (ha)", c.surface_infestee_ha if c else None)}
    </table>
    """


def _fait_traitement(t: TraitementRead):
    """Le fait Aérien ou Terrestre porteur des champs communs aux deux gabarits
    (taux de mortalité, pesticides...) — un seul des deux est jamais renseigné."""
    return t.aerien or t.terrestre


def _section_traitement(t: TraitementRead) -> str:
    terrestre = t.terrestre
    fait = _fait_traitement(t)
    heure_debut = terrestre.heure_debut if terrestre else None
    heure_fin = terrestre.heure_fin if terrestre else None
    vitesse_vent = terrestre.vitesse_vent_ms if terrestre else None
    direction_vent = terrestre.direction_vent if terrestre else None
    temperature = terrestre.temperature_c if terrestre else None
    taux_mortalite = fait.taux_mortalite_pourcent if fait else None
    evaluation_heures = fait.evaluation_efficacite_heures_apres if fait else None
    methode_evaluation = fait.methode_evaluation_efficacite if fait else None
    return f"""
    <h2>3. Traitement</h2>
    <table>
      {_ligne("Mode de traitement", t.mode_traitement)}
      {_ligne("Début (heure)", heure_debut)}
      {_ligne("Fin (heure)", heure_fin)}
      {_ligne("Vent — vitesse (m/s)", vitesse_vent)}
      {_ligne("Vent — direction", direction_vent)}
      {_ligne("Température (°C)", temperature)}
      {_ligne("Taux de mortalité (%)", taux_mortalite)}
      {_ligne("Évalué après traitement (h)", evaluation_heures)}
      {_ligne("Méthode d'évaluation", methode_evaluation)}
    </table>
    """


def _section_moyens(t: TraitementRead) -> str:
    # §4.1/4.2 (moyens humains/matériels) : absents du modèle actuel (issue
    # #495) — cases volontairement vides, pas d'extension de schéma ici.
    return f"""
    <h2>4. Moyens</h2>
    <table>
      {_ligne("Nb agents permanents", None)}
      {_ligne("Nb agents temporaires", None)}
      {_ligne("Nb personnel local", None)}
      {_ligne("Atomiseur", None)}
      {_ligne("Essence (litres)", None)}
      {_ligne("Disque rotatif", None)}
      {_ligne("Piles (nb)", None)}
      {_ligne("Ulvamast (nb)", None)}
      {_ligne("Combinaison", t.kit_combinaison)}
      {_ligne("Gants", t.kit_gants)}
      {_ligne("Lunettes", t.kit_lunettes)}
      {_ligne("Masques", t.kit_masques)}
      {_ligne("Bottes", t.kit_botte)}
    </table>
    """


def _section_pesticides(t: TraitementRead) -> str:
    fait = _fait_traitement(t)
    return f"""
    <h2>5. Pesticides</h2>
    <table>
      {_ligne("Nom commercial", None)}
      {_ligne("Matières actives", None)}
      {_ligne("Stock initial", None)}
      {_ligne("Approvisionnement (produit reçu, L)", fait.pesticide_recu_l if fait else None)}
      {_ligne("Stock final restant (L)", fait.pesticide_stock_restant_l if fait else None)}
    </table>
    """


def _section_zones_cibles(t: TraitementRead) -> str:
    zones = t.zones_exposees or {}
    lignes = "".join(_ligne(cle, valeur) for cle, valeur in zones.items())
    return f"""
    <h2>6. Zones cibles</h2>
    <table>
      {lignes or _ligne("Zones exposées", None)}
    </table>
    """


def _section_vegetation(t: TraitementRead) -> str:
    return f"""
    <h2>7. Type de végétation</h2>
    <table>
      {_ligne("Hauteur strate herbeuse (m)", t.hauteur_strate_herbeuse_m)}
      {_ligne("Hauteur strate arborée (m)", t.hauteur_strate_arboree_m)}
      {_ligne("Recouvrement (%)", t.recouvrement_percent)}
    </table>
    """


def _section_empoisonnement(t: TraitementRead) -> str:
    return f"""
    <h2>8. Empoisonnement</h2>
    <table>
      {_ligne("Cas d'empoisonnement", "Oui" if t.empoisonnement else "Non")}
      {_ligne("Type", t.empoisonnement_type)}
      {_ligne("Mode", t.empoisonnement_mode)}
      {_ligne("Autre (précision)", t.empoisonnement_autre)}
    </table>
    """


def _section_evaluation_risque(t: TraitementRead) -> str:
    evaluations = t.evaluations_risque_population
    if not evaluations:
        return f"""
        <h2>9. Évaluation du risque pour la population</h2>
        <table><tr><td>{_texte(None)}</td></tr></table>
        """
    colonnes = "".join(f"<th>{i + 1}</th>" for i in range(len(evaluations)))
    habitats = "".join(f"<td>{_texte(e.habitat_proche)}</td>" for e in evaluations)
    distances = "".join(f"<td>{_texte(e.distance_km)}</td>" for e in evaluations)

    def _sensibilisation(e: Any) -> str:
        if e.sensibilisation is None:
            return _texte(None)
        return _texte("Oui" if e.sensibilisation else "Non")

    sensibilisations = "".join(f"<td>{_sensibilisation(e)}</td>" for e in evaluations)
    return f"""
    <h2>9. Évaluation du risque pour la population</h2>
    <table>
      <tr><th></th>{colonnes}</tr>
      <tr><th>Habitat le plus proche</th>{habitats}</tr>
      <tr><th>Distance (km)</th>{distances}</tr>
      <tr><th>Sensibilisation</th>{sensibilisations}</tr>
    </table>
    """


def _section_mortalite(t: TraitementRead) -> str:
    familles = t.mortalite_familles or {}
    comportement = t.comportement_non_cibles or {}
    familles_comportement = ", ".join(comportement.keys()) if comportement else None
    familles_mortalite = ", ".join(familles.keys()) if familles else None
    return f"""
    <h2>10. Comportement non cibles et mortalité</h2>
    <table>
      {_ligne("Comportement anormal", "Oui" if t.comportement_anormal else "Non")}
      {_ligne("Familles concernées (comportement)", familles_comportement)}
      {_ligne("Mortalité constatée", "Oui" if t.mortalite else "Non")}
      {_ligne("Familles concernées (mortalité)", familles_mortalite)}
    </table>
    """


def _section_observations(t: TraitementRead) -> str:
    return f"""
    <h2>11. Observation générale</h2>
    <table>{_ligne("Observations", t.observations)}</table>
    """


def _section_bloc_aerien(t: TraitementRead) -> str:
    a = t.aerien
    if a is None:
        return ""
    return f"""
    <h2>Détail Aérien</h2>
    <table>
      {_ligne("Pilote", a.pilote)}
      {_ligne("Mécanicien", a.mecanicien)}
      {_ligne("Chef de base", a.chef_de_base_id)}
      {_ligne("Consultant international", a.consultant_international)}
      {_ligne("Base principale", a.base_principale)}
      {_ligne("Stand", a.stand)}
      {_ligne("Base secondaire", a.base_secondaire)}
      {_ligne("Immatriculation aéronef", a.immatricule_aeronef)}
      {_ligne("Nb rotations", a.nb_rotations)}
      {_ligne("Total pesticide (L)", a.total_pesticide_l)}
      {_ligne("Surface traitée (ha)", a.surface_traitee_ha)}
    </table>
    """


def _section_bloc_terrestre(t: TraitementRead) -> str:
    ter = t.terrestre
    if ter is None:
        return ""
    return f"""
    <h2>Détail Terrestre</h2>
    <table>
      {_ligne("Chef d'équipe", ter.chef_equipe_id)}
      {_ligne("Agent encadreur", ter.agent_encadreur)}
      {_ligne("Consultant international", ter.consultant_international)}
      {_ligne("Surface atomiseur (ha)", ter.surface_atomiseur_ha)}
      {_ligne("Surface disque rotatif (ha)", ter.surface_disque_rotatif_ha)}
      {_ligne("Essence (litres)", ter.essence_litres)}
      {_ligne("Nb piles", ter.nb_piles)}
      {_ligne("Total pesticide (L)", ter.total_pesticide_l)}
    </table>
    """


def _section_signatures(t: TraitementRead) -> str:
    if not t.signatures:
        return ""
    lignes = []
    for s in t.signatures:
        image = (
            f'<img class="signature-image" src="data:image/svg+xml;utf8,'
            f"<svg xmlns='http://www.w3.org/2000/svg'><path d='{escape(s.signature_image)}' "
            f"stroke='black' fill='none'/></svg>\" />"
            if s.signature_image
            else _texte(None)
        )
        lignes.append(
            f"<tr><th>{escape(s.role.value)}</th><td>{escape(s.signataire_nom)}</td><td>{image}</td></tr>"
        )
    return f"""
    <h2>Signatures</h2>
    <table>{"".join(lignes)}</table>
    """


def build_crt_html(t: TraitementRead) -> str:
    est_aerien = t.type_traitement == TypeTraitement.AERIEN
    bloc_specifique = _section_bloc_aerien(t) if est_aerien else _section_bloc_terrestre(t)

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>{PDF_BASE_CSS}{_CRT_CSS}</style>
</head>
<body>
<h1>Fiche de compte-rendu et évaluation rapide de traitement (CRT) — {escape(t.numero_fiche)}</h1>
{_section_references(t)}
{_section_cibles(t)}
{_section_traitement(t)}
{bloc_specifique}
{_section_moyens(t)}
{_section_pesticides(t)}
{_section_zones_cibles(t)}
{_section_vegetation(t)}
{_section_empoisonnement(t)}
{_section_evaluation_risque(t)}
{_section_mortalite(t)}
{_section_observations(t)}
{_section_signatures(t)}
</body>
</html>
"""
