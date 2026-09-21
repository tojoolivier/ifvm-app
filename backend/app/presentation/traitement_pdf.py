"""Gabarit HTML du PDF de la fiche CRT (#495), rendu par
`render_html_to_pdf` (#533). Reproduction du formulaire papier
`docs/IFVM_Fiche_compte_rendu_traitement (1).md` (12 sections), avec un bloc
Aérien ou Terrestre selon `traitement.type_traitement` — pas un template
unique à trous (cf. issue #495).
"""

from enum import Enum
from html import escape
from typing import Any

from app.infrastructure.pdf_renderer import PDF_BASE_CSS
from app.presentation.traitement_schemas import (
    EspeceCible,
    EvaluationRisquePopulationRead,
    RepartitionPopulation,
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

# Libellés des axes de risque environnemental captés par l'écran mobile
# `impacts.tsx` (champ `evaluation_risque`) — absents du formulaire papier
# (12 sections), rendus dans une section complémentaire non numérotée plutôt
# que silencieusement ignorés (cf. build_crt_html).
_LIBELLES_AXES_RISQUE = {
    "ressources_eau": "Ressources en eau",
    "sol": "Sol",
    "faune_non_cible": "Faune non cible",
    "abeilles": "Abeilles / pollinisateurs",
}


def _texte(valeur: Any) -> str:
    # Un `str, Enum` (ModeTraitement, EspeceCible...) affiché via `str()` rend
    # "ModeTraitement.TOTAL" et non "TOTAL" en Python 3.14 (le mixin `str`
    # perd la priorité sur `__str__` face à `Enum.__str__`, contrairement à
    # `__format__` — cf. commentaire historique sur `pesticide_unite` plus
    # bas) : on déballe `.value` explicitement avant toute mise en forme.
    if isinstance(valeur, Enum):
        valeur = valeur.value
    if isinstance(valeur, bool):
        valeur = "Oui" if valeur else "Non"
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
    terrestre = traitement.terrestre
    return _section(
        "1. Références",
        [
            ("N° CRT", traitement.numero_fiche),
            # Chef d'équipe (1.2 du formulaire papier) : seul `chef_equipe_id`
            # (FK Utilisateur) existe côté modèle, aucun nom résolu — pas de
            # jointure sur Utilisateur dans ce ticket (cf. #495, "pas
            # d'extension de schéma"). Case vide plutôt qu'un UUID brut.
            ("Chef d'équipe", None),
            ("Agent encadreur", terrestre.agent_encadreur if terrestre else None),
            ("Date de validation", traitement.date_validation),
            ("Date de traitement", traitement.date_traitement),
            ("Localité", traitement.localite),
            ("Commune", traitement.commune),
            ("District", traitement.district),
            ("Région", traitement.region),
            ("Coordonnées", coordonnees),
        ],
    )


def _densite_infestation(cible) -> float | None:
    """Densité (ind./ha, §2.2 du formulaire papier) : dérivée de la paire
    (espèce, répartition) parmi les colonnes dédiées par espèce du modèle
    (migration 0066) — absente en tant que champ générique unique."""
    if cible is None or cible.espece is None or cible.repartition_population is None:
        return None
    diffuse = cible.repartition_population == RepartitionPopulation.DIFFUSE
    if cible.espece == EspeceCible.LMC:
        return cible.densite_diffuse_lmc if diffuse else cible.densite_groupee_lmc
    if cible.espece == EspeceCible.NSE:
        return cible.densite_diffuse_nse if diffuse else cible.densite_groupee_nse
    return None


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
            ("Densité (ind./ha)", _densite_infestation(cible)),
        ],
    )


def _section_traitement(traitement: TraitementRead) -> str:
    terrestre = traitement.terrestre
    aerien = traitement.aerien
    fait = _fait_traitement(traitement)
    evaluation_heures = fait.evaluation_efficacite_heures_apres if fait else None
    return _section(
        "3. Traitement",
        [
            ("Mode de traitement", traitement.mode_traitement),
            # §3.2 : surface traitée par moyen — Ulvamast sans équivalent au
            # modèle (case vide, pas d'extension de schéma dans ce ticket).
            ("Surface atomiseur à dos (ha)", terrestre.surface_atomiseur_ha if terrestre else None),
            (
                "Surface disque rotatif (ha)",
                terrestre.surface_disque_rotatif_ha if terrestre else None,
            ),
            ("Surface ulvamast (ha)", None),
            ("Surface traitée par aéronef (ha)", aerien.surface_traitee_ha if aerien else None),
            ("Surface reste à traiter (ha)", fait.surface_restante_ha if fait else None),
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
    # §4.1/4.2 (moyens humains/matériels, migration 0076, #moyens-humains-materiels).
    return _section(
        "4. Moyens",
        [
            ("Nb agents permanents", traitement.nb_agents_permanents),
            ("Nb agents temporaires", traitement.nb_agents_temporaires),
            ("Nb personnel local", traitement.nb_personnel_local),
            ("Atomiseur", traitement.moyens_atomiseur_nb),
            ("Essence (litres)", traitement.moyens_essence_litres),
            ("Disque rotatif", traitement.moyens_disque_rotatif_nb),
            ("Piles (nb)", traitement.moyens_piles_nb),
            ("Ulvamast (nb)", traitement.moyens_ulvamast_nb),
            ("Combinaison", traitement.kit_combinaison),
            ("Gants", traitement.kit_gants),
            ("Lunettes", traitement.kit_lunettes),
            ("Masques", traitement.kit_masques),
            ("Bottes", traitement.kit_botte),
        ],
    )


def _section_pesticides(traitement: TraitementRead) -> str:
    fait = _fait_traitement(traitement)
    # `pesticide_unite` (#produits-unite-l-kg) — Terrestre uniquement, pas
    # d'équivalent Aérien : `getattr` avec repli sur "L" pour ne rien changer
    # à l'affichage Aérien (toujours en litres, comme avant cet ajout).
    unite_brute = getattr(fait, "pesticide_unite", "L") if fait else "L"
    unite = unite_brute.value if isinstance(unite_brute, Enum) else unite_brute
    return _section(
        "5. Pesticides",
        [
            ("Nom commercial", None),
            ("Matières actives", None),
            # Terrestre uniquement (pas d'équivalent Aérien) — `getattr` plutôt
            # qu'un accès direct, `fait` pouvant être un TraitementAerienRead.
            ("Stock initial", getattr(fait, "stock_initial_l", None) if fait else None),
            (f"Approvisionnement (produit reçu, {unite})", fait.pesticide_recu_l if fait else None),
            # §5.5 — total consommé (somme des rotations Aérien, des produits
            # utilisés Terrestre) : existait déjà sur le modèle, jamais affiché.
            (f"Produit consommé ({unite})", fait.total_pesticide_l if fait else None),
            (f"Stock final restant ({unite})", fait.pesticide_stock_restant_l if fait else None),
        ],
    )


def _section_zones_cibles(traitement: TraitementRead) -> str:
    # Le choix produit a réduit les zones cibles saisissables à Cultures et
    # Pâturages (mobile/(traitement)/moyens.tsx) : les autres postes du
    # formulaire papier (Maïs/Riz/.../Sorgho, Apiculture, Aquaculture,
    # Production organique, Zone forestier) restent des cases vides,
    # reproduites ici pour la fidélité de mise en page plutôt que supprimées.
    zones = traitement.zones_exposees or {}
    return _section(
        "6. Zones cibles",
        [
            ("Culture", zones.get("cultures")),
            ("Maïs (ha)", None),
            ("Riz (ha)", None),
            ("Canne à sucre (ha)", None),
            ("Banane (ha)", None),
            ("Manioc (ha)", None),
            ("Sorgho (ha)", None),
            ("Pâturage", zones.get("paturages")),
            ("Apiculture", None),
            ("Aquaculture", None),
            ("Production organique", None),
            ("Zone forestière", None),
        ],
    )


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
            ("Cas d'empoisonnement", traitement.empoisonnement),
            ("Type", traitement.empoisonnement_type),
            ("Mode", traitement.empoisonnement_mode),
            ("Autre (précision)", traitement.empoisonnement_autre),
        ],
    )


def _sensibilisation_texte(evaluation: EvaluationRisquePopulationRead) -> str:
    return _texte(evaluation.sensibilisation)


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


def _section_observation_non_cibles(traitement: TraitementRead) -> str:
    comportement = traitement.comportement_non_cibles or {}
    familles = ", ".join(comportement.keys()) if comportement else None
    return _section(
        "10. Observation sur non cibles",
        [
            ("Comportement anormal", traitement.comportement_anormal),
            ("Famille(s) concernée(s)", familles),
        ],
    )


def _section_mortalite(traitement: TraitementRead) -> str:
    familles = traitement.mortalite_familles or {}
    familles_texte = ", ".join(familles.keys()) if familles else None
    return _section(
        "11. Mortalité",
        [
            ("Mortalité constatée", traitement.mortalite),
            ("Famille(s) concernée(s)", familles_texte),
        ],
    )


def _section_observations(traitement: TraitementRead) -> str:
    return _section("12. Observation générale", [("Observations", traitement.observations)])


def _section_axes_risque(traitement: TraitementRead) -> str:
    """Axes de risque environnemental (`evaluation_risque`, écran mobile
    `impacts.tsx`) — hors des 12 sections du formulaire papier, mais saisis
    par le terrain et jusqu'ici jamais restitués dans le PDF (champ mort).
    Section complémentaire, omise quand rien n'est renseigné (contrairement
    aux 12 sections numérotées, toujours rendues même vides)."""
    axes = traitement.evaluation_risque or {}
    if not axes:
        return ""
    lignes = [(_LIBELLES_AXES_RISQUE.get(cle, cle), valeur) for cle, valeur in axes.items()]
    return _section("Axes de risque environnemental (complément)", lignes)


def _section_bloc_aerien(traitement: TraitementRead) -> str:
    aerien = traitement.aerien
    if aerien is None:
        return ""
    return _section(
        "Détail Aérien",
        [
            ("Pilote", aerien.pilote),
            ("Mécanicien", aerien.mecanicien),
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
