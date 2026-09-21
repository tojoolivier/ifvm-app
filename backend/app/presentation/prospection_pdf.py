"""Gabarit HTML du PDF de la fiche de prospection (#494/#594), rendu par
`render_html_to_pdf` (#533). Reproduction des formulaires papier
`docs/IFVM_Fiche_prospection_intensive (1).md` (intensive) et
`docs/iFVM_Fiche_prospection_extensive (1).md` (extensive), branchée sur
`prospection.type_prospection` — même méthode que `traitement_pdf.build_crt_html`
(#495) : un gabarit par formulaire, pas un template générique à trous.
"""

from enum import Enum
from html import escape
from typing import Any

from app.infrastructure.pdf_renderer import PDF_BASE_CSS
from app.presentation.prospection_schemas import (
    CaptureRead,
    InfestationRead,
    PopulationRead,
    ProspectionRead,
)

_PROSPECTION_CSS = """
h1 { font-size: 12pt; text-align: center; margin-bottom: 0.1cm; }
h2 { font-size: 10pt; text-align: center; margin-bottom: 0.4cm; }
h3 { font-size: 10pt; background: #e5e7eb; padding: 0.1cm 0.2cm; margin: 0.4cm 0 0.15cm; }
table { width: 100%; border-collapse: collapse; margin-bottom: 0.25cm; }
th, td { border: 1px solid #9ca3af; padding: 0.1cm 0.15cm; font-size: 7.5pt; text-align: center; }
td.label, th.label { text-align: left; font-weight: normal; }
p.ref { margin: 0.1cm 0; font-size: 8.5pt; }
"""


def _texte(valeur: Any) -> str:
    # Cf. traitement_pdf._texte : un `str, Enum` affiché via `str()` rend
    # "TypeCible.VOL_CLAIR" et non "vol_clair" en Python 3.14 — déballer
    # `.value` explicitement avant toute mise en forme.
    if isinstance(valeur, Enum):
        valeur = valeur.value
    if isinstance(valeur, bool):
        return "Oui" if valeur else "Non"
    if valeur is None or valeur == "":
        return "—"
    return escape(str(valeur))


def _coche(actif: bool) -> str:
    return "☒" if actif else "☐"


def _date_fr(valeur: Any) -> str:
    if valeur is None or valeur == "":
        return "—"
    return (
        escape(valeur.strftime("%d/%m/%Y")) if hasattr(valeur, "strftime") else escape(str(valeur))
    )


def _espece_label(espece: str) -> str:
    return "Locusta migratoria capito" if espece == "LMC" else "Nomadacris septemfasciata"


# -- Fiche intensive ---------------------------------------------------------

_PHASES_IMAGO = [
    ("solitaire", "Solitaires"),
    ("solitaro_trans", "Solitaro-trans"),
    ("transiens", "Transiens"),
    ("gregaire", "Grégraires"),
]
_STADES_IMAGO = ["A1", "A2", "A3", "A3-1/4", "A3-1/2", "A3-3/4", "A3-4/4", "A4", "A5"]

_NIVEAUX_POPULATION = [
    ("neant", "Néant"),
    ("rare", "Rare"),
    ("peu", "Peu"),
    ("beaucoup", "Beaucoup"),
    ("dominant", "Dominant"),
]

_TYPES_INFESTATION_INTENSIVE = [
    ("tache_larvaire", "Tache L"),
    ("bande_larvaire", "Bande L"),
    ("vol_clair", "Vol clair"),
    ("essaim", "Essaim"),
]


def _effectif(
    captures: list[CaptureRead],
    espece: str,
    categorie: str,
    sexe: str | None,
    phase: str,
    stade: str,
) -> int:
    return sum(
        c.effectif
        for c in captures
        if c.espece.value == espece
        and c.categorie.value == categorie
        and (c.sexe.value if c.sexe else None) == sexe
        and c.phase.value == phase
        and c.stade == stade
    )


def _population(
    populations: list[PopulationRead], espece: str, categorie: str
) -> PopulationRead | None:
    return next(
        (p for p in populations if p.espece.value == espece and p.categorie.value == categorie),
        None,
    )


def _grille_imagos(captures: list[CaptureRead], espece: str) -> str:
    def lignes(sexe: str, groupe_label: str) -> str:
        html = ""
        for i, (valeur, label) in enumerate(_PHASES_IMAGO):
            entete = (
                f'<td class="label" rowspan="{len(_PHASES_IMAGO)}">{escape(groupe_label)}</td>'
                if i == 0
                else ""
            )
            cellules = "".join(
                f"<td>{_effectif(captures, espece, 'imago', sexe, valeur, s) or ''}</td>"
                for s in _STADES_IMAGO
            )
            html += f'<tr>{entete}<td class="label">{escape(label)}</td>{cellules}</tr>'
        return html

    entetes = "".join(f"<th>{s}</th>" for s in _STADES_IMAGO)
    return f"""
    <table>
      <tr><th class="label">Sexe</th><th class="label">Phase</th>{entetes}</tr>
      {lignes("F", "Nbre de Femelles")}
      {lignes("M", "Nbre de Mâles")}
    </table>"""


def _grille_larves(captures: list[CaptureRead], espece: str, stades: list[str]) -> str:
    entetes = "".join(f"<th>{s}</th>" for s in stades)
    lignes = "".join(
        f'<tr><td class="label">{escape(label)}</td>'
        + "".join(
            f"<td>{_effectif(captures, espece, 'larve', None, valeur, s) or ''}</td>"
            for s in stades
        )
        + "</tr>"
        for valeur, label in _PHASES_IMAGO
        if valeur != "solitaro_trans"
    )
    return f'<table><tr><th class="label">Phase</th>{entetes}</tr>{lignes}</table>'


def _table_niveau(titre1: str, titre2: str, population: PopulationRead | None) -> str:
    def ligne(label: str, valeur: Any) -> str:
        valeur_str = valeur.value if isinstance(valeur, Enum) else valeur
        cellules = "".join(f"<td>{_coche(valeur_str == v)}</td>" for v, _ in _NIVEAUX_POPULATION)
        return f'<tr><td class="label">{escape(label)}</td>{cellules}</tr>'

    entetes = "".join(f"<th>{label}</th>" for _, label in _NIVEAUX_POPULATION)
    return f"""
    <table>
      <tr><th class="label"></th>{entetes}</tr>
      {ligne(titre1, population.accouplement if population else None)}
      {ligne(titre2, population.ponte if population else None)}
    </table>"""


def _infestation_par_type(
    infestations: list[InfestationRead], type_cible: str
) -> InfestationRead | None:
    if type_cible == "essaim":
        return next(
            (i for i in infestations if i.type_cible.value in ("dense", "tres_dense")), None
        )
    return next((i for i in infestations if i.type_cible.value == type_cible), None)


def _section_description_infestation(infestations: list[InfestationRead]) -> str:
    lignes = ""
    for valeur, label in _TYPES_INFESTATION_INTENSIVE:
        i = _infestation_par_type(infestations, valeur)
        lignes += f"""<tr>
          <td class="label">{escape(label)}</td>
          <td>{_texte(i.espece if i else None)}</td>
          <td>{_texte(i.taille_min if i else None)}</td>
          <td>{_texte(i.taille_max if i else None)}</td>
          <td>{_texte(i.taille_moy if i else None)}</td>
          <td>{_texte(i.surface_totale if i else None)}</td>
          <td>{_texte(i.densite_min if i else None)}</td>
          <td>{_texte(i.densite_max if i else None)}</td>
          <td>{_texte(i.densite_moy if i else None)}</td>
          <td>{_texte(i.interdistance if i else None)}</td>
        </tr>"""
    return f"""
    <table>
      <tr><th></th><th>Espèce</th><th colspan="3">Taille</th><th>Surf TOT ha</th>
        <th colspan="3">Densité</th><th>Interdistance</th></tr>
      <tr><th></th><th></th><th>min</th><th>max</th><th>moy</th><th></th>
        <th>min</th><th>max</th><th>moy</th><th></th></tr>
      {lignes}
    </table>"""


def _section_comportement_infestation(infestations: list[InfestationRead]) -> str:
    lignes = ""
    for valeur, label in _TYPES_INFESTATION_INTENSIVE:
        i = _infestation_par_type(infestations, valeur)
        comportement = i.comportement.value if i and i.comportement else None
        lignes += f"""<tr>
          <td class="label">{escape(label)}</td>
          <td>{_texte(i.espece if i else None)}</td>
          <td>{_coche(comportement == "repos")}</td>
          <td>{_coche(comportement == "deplacement")}</td>
          <td>{_texte(i.direction_de if i else None)}</td>
          <td>{_texte(i.direction_vers if i else None)}</td>
          <td>{_texte(i.vent_de if i else None)}</td>
          <td>{_texte(i.vent_vitesse if i else None)}</td>
        </tr>"""
    return f"""
    <table>
      <tr><th></th><th>Espèce</th><th>Repos</th><th>Déplac</th>
        <th colspan="2">Direction</th><th colspan="2">Vent</th></tr>
      <tr><th></th><th></th><th></th><th></th><th>de</th><th>vers</th><th>de</th><th>vitesse</th></tr>
      {lignes}
    </table>"""


_STRATES = [
    ("arboree", "Strate arborée"),
    ("arbustive", "Strate arbustive"),
    ("buissonneuse", "Strate buissonneuse"),
    ("herbeuse", "Strate herbeuse"),
    ("cultures_seches", "Cultures sèches"),
    ("cultures_hygro", "Cultures hygrophiles"),
]


def _phenologie(valeurs: Any) -> str:
    if not valeurs:
        return "—"
    if isinstance(valeurs, list):
        return escape(", ".join(str(v) for v in valeurs))
    return escape(str(valeurs))


def _section_vegetation(vegetation: dict[str, Any] | None, sol: dict[str, Any] | None) -> str:
    strates = (vegetation or {}).get("strates") or {}
    sol_nu = (sol or {}).get("solNu")
    lignes = f'<tr><td class="label">Sol nu</td><td colspan="9">{_texte(sol_nu)}%</td></tr>'
    for cle, label in _STRATES:
        s = strates.get(cle) or {}
        lignes += f"""<tr>
          <td class="label">{label}</td>
          <td>{_texte(s.get("surfRel"))}</td>
          <td>{_texte(s.get("hMoy"))}</td>
          <td>{_texte(s.get("recouvrement"))}</td>
          <td>{_texte(s.get("verdissement"))}</td>
          <td>{"—" if s.get("repousse") is None else ("Oui" if s.get("repousse") else "Non")}</td>
          <td>{_phenologie(s.get("orpad"))}</td>
          <td>{_phenologie(s.get("feuille"))}</td>
          <td>{_phenologie(s.get("fleur"))}</td>
          <td>{_phenologie(s.get("fruit"))}</td>
          <td>{_phenologie(s.get("sec"))}</td>
        </tr>"""
    return f"""
    <table>
      <tr><th class="label"></th><th>a Surf. Rel.</th><th>b H.Moy.(m)</th><th>c Rec%</th>
        <th>d %Verdiss.</th><th>e Repous.</th><th>f Germ.</th><th>g Feuille</th>
        <th>h Fleur</th><th>i Fruit</th><th>j Sec</th></tr>
      {lignes}
    </table>"""


_DEGATS = [("nuls", "Nuls"), ("faibles", "Faibles"), ("moyens", "Moyens"), ("forts", "Forts")]
_HUMIDITES = [
    ("surface", "Surf."),
    ("0_5cm", "0,5 cm"),
    ("5_12cm", "5-12 cm"),
    ("12_30cm", "12-30 cm"),
    ("gt_30cm", ">30cm"),
]
_TEXTURES = [
    ("argileuse", "Argileuse"),
    ("limoneuse", "Limoneuse"),
    ("sable_fin", "Sable fin"),
    ("sable_grossier", "Sable grossier"),
    ("gravier", "Gravier"),
    ("cailloux", "Cailloux"),
    ("bloc", "Bloc"),
]


def build_prospection_intensive_html(p: ProspectionRead) -> str:
    lmc_imago = _population(p.populations, "LMC", "imago")
    lmc_larve = _population(p.populations, "LMC", "larve")
    nse_imago = _population(p.populations, "NSE", "imago")
    nse_larve = _population(p.populations, "NSE", "larve")
    sol = p.sol or {}
    degats_cultures = p.degats_cultures.value if p.degats_cultures else None
    humidite = sol.get("humidite") or []
    texture = sol.get("texture") or []
    numero_fiche = escape(p.n_fiche or "—")

    return f"""<!doctype html>
<html><head><meta charset="utf-8" /><style>{PDF_BASE_CSS}{_PROSPECTION_CSS}</style></head><body>
<h1>IVOTOERANA FAMONGORANA NY VALALA ETO MADAGASIKARA</h1>
<h2>FICHE DE PROSPECTION ANTIACRIDIENNE — IFVM — {numero_fiche}</h2>

<h3>A. Référence</h3>
<p class="ref"><b>Prospecteur :</b> {_texte(p.prospecteur_nom)} &nbsp;
  <b>N° relevé :</b> {_texte(p.n_message)} &nbsp;
  <b>Date :</b> {_date_fr(p.date_prospection)} &nbsp;
  <b>N° Fiche :</b> {_texte(p.n_fiche)}</p>
<p class="ref"><b>PA :</b> {_texte(p.pa_code)} &nbsp;
  <b>Région :</b> {_texte(p.region)} &nbsp;
  <b>District :</b> {_texte(p.district)} &nbsp;
  <b>Commune :</b> {_texte(p.commune)}</p>
<p class="ref"><b>Station :</b> {_texte(p.station_libre or p.station_id)} &nbsp;
  <b>Latitude :</b> {_texte(p.latitude)} &nbsp;
  <b>Longitude :</b> {_texte(p.longitude)}E &nbsp;
  <b>Altitude :</b> {_texte(p.altitude)} m</p>
<p class="ref"><b>Surf. Station :</b> {_texte(p.surface_station)} ha &nbsp;
  <b>Surf. prospect. :</b> {_texte(p.surface_prospectee)} ha &nbsp;
  <b>Surf. Infestée :</b> {_texte(p.surface_infestee)} ha</p>

<h3>B. {_espece_label("LMC")} — Imagos</h3>
<p class="ref">9. Densité population diffuse :
  {_texte(lmc_imago.densite_diffuse if lmc_imago else None)}/ha &nbsp;
  10. Densité population groupée :
  {_texte(lmc_imago.densite_groupee if lmc_imago else None)}/m²</p>
<p class="ref"><b>Accouplement / Ponte</b></p>
{_table_niveau("11. Acclt", "12. Ponte", lmc_imago)}
<p class="ref">13. Captures — Nombre d'imagos capturés :
  {_texte(lmc_imago.captures_nombre if lmc_imago else None)} (50 max) &nbsp;
  Temps de capture : {_texte(lmc_imago.temps_capture if lmc_imago else None)}
  minutes (30 min max)</p>
{_grille_imagos(p.captures, "LMC")}

<p class="ref"><b>Larves</b></p>
<p class="ref">14. Densité population diffuse :
  {_texte(lmc_larve.densite_diffuse if lmc_larve else None)}/ha &nbsp;
  15. Densité population groupée :
  {_texte(lmc_larve.densite_groupee if lmc_larve else None)}/m²</p>
<p class="ref">16. Captures — Nombre :
  {_texte(lmc_larve.captures_nombre if lmc_larve else None)} (65 max)</p>
{_grille_larves(p.captures, "LMC", ["L1", "L2", "L3", "L4", "L5"])}

<h3>C. {_espece_label("NSE")} — Imagos</h3>
<p class="ref">17. Densité population diffuse :
  {_texte(nse_imago.densite_diffuse if nse_imago else None)}/ha &nbsp;
  18. Densité population groupée :
  {_texte(nse_imago.densite_groupee if nse_imago else None)}/m²</p>
<p class="ref"><b>Accouplement / ponte</b></p>
{_table_niveau("16. Accplt", "17. Ponte", nse_imago)}
<p class="ref">19. Capture — Nombre :
  {_texte(nse_imago.captures_nombre if nse_imago else None)} (30 max)</p>
{_grille_imagos(p.captures, "NSE")}

<p class="ref"><b>Larves</b></p>
<p class="ref">20. Densité population diffuse :
  {_texte(nse_larve.densite_diffuse if nse_larve else None)}/ha &nbsp;
  21. Densité population groupée :
  {_texte(nse_larve.densite_groupee if nse_larve else None)}/m²</p>
<p class="ref">21. Captures — Nombre :
  {_texte(nse_larve.captures_nombre if nse_larve else None)} (75 max)</p>
{_grille_larves(p.captures, "NSE", ["L1", "L2", "L3", "L4", "L5", "L6", "L7"])}

<h3>D. Infestation — Description</h3>
{_section_description_infestation(p.infestations)}
<p class="ref"><b>Comportement</b></p>
{_section_comportement_infestation(p.infestations)}

<h3>E. Végétation</h3>
{_section_vegetation(p.vegetation, p.sol)}
<p class="ref"><b>43. Dégâts sur culture :</b>
  {" &nbsp; ".join(f"{label} {_coche(degats_cultures == v)}" for v, label in _DEGATS)}</p>
<p class="ref"><b>Humidité du sol (S ou H) :</b>
  {" &nbsp; ".join(f"{label} {_coche(v in humidite)}" for v, label in _HUMIDITES)}</p>
<p class="ref"><b>45. Texture au sol :</b>
  {" &nbsp; ".join(f"{label} {_coche(v in texture)}" for v, label in _TEXTURES)}</p>

<p class="ref"><b>46. Ennemis naturels observés :</b> {_texte(p.ennemis_naturels)}</p>
<p class="ref"><b>Observation :</b> {_texte(p.observations)}</p>
</body></html>"""


# -- Fiche extensive -----------------------------------------------------


_LIBELLES_ESSAIM = {"vol_clair": "Vol Clair", "dense": "Dense", "tres_dense": "Très dense"}


def _bloc_espece_imago(populations: list[PopulationRead], espece: str) -> str:
    pop = _population(populations, espece, "imago")
    stades = ["A1", "A2", "A3", "A4", "A5"]
    stades_imago = pop.stades_imago if pop and pop.stades_imago else {}
    ligne_stades = "".join(f"<td>{_texte(stades_imago.get(s))}</td>" for s in stades)
    essaim_label = (
        _LIBELLES_ESSAIM.get(pop.type_cible[0].value, pop.type_cible[0].value)
        if pop and pop.type_cible
        else None
    )
    captures_nombre = _texte(pop.captures_nombre if pop else None)
    captures_sol = _texte(pop.captures_sol if pop else None)
    captures_trans = _texte(pop.captures_trans if pop else None)
    captures_greg = _texte(pop.captures_greg if pop else None)
    densite_diffuse = _texte(pop.densite_diffuse if pop else None)
    densite_groupee = _texte(pop.densite_groupee if pop else None)
    direction_de = _texte(pop.direction_de if pop else None)
    direction_vers = _texte(pop.direction_vers if pop else None)
    en_vol = _coche(bool(pop and pop.essaim_en_vol))
    pose = _coche(bool(pop and pop.essaim_pose))
    surface_contaminee = _texte(pop.surface_contaminee_ha if pop else None)
    return f"""
    <table>
      <tr><th colspan="2">Nbre de Captures : {captures_nombre}</th>
        <th colspan="3">{escape(espece)}</th></tr>
      <tr><td>Nbre Sol : {captures_sol}</td><td>Nbre Trans : {captures_trans}</td>
        <td colspan="3">Nbre Greg : {captures_greg}</td></tr>
      <tr>{"".join(f"<th>{s}</th>" for s in stades)}</tr>
      <tr>{ligne_stades}</tr>
      <tr><td colspan="2">Nbre Acc : —</td><td colspan="3">Nbre Pnt : —</td></tr>
      <tr><td colspan="2">Pop diff D/ha : {densite_diffuse}</td>
        <td colspan="3">Pop group D/m² : {densite_groupee}</td></tr>
      <tr><td colspan="5">Essaim : {_texte(essaim_label)} &nbsp;
        Dir de {direction_de} vers {direction_vers} &nbsp;
        En vol {en_vol} Posé {pose}</td></tr>
      <tr><td colspan="5">Surf. Infestée (ha) : {surface_contaminee}</td></tr>
    </table>"""


def _bloc_espece_larve(populations: list[PopulationRead], espece: str, stades: list[str]) -> str:
    pop = _population(populations, espece, "larve")
    densites_larve = pop.densites_larve if pop and pop.densites_larve else {}
    ligne_stades = "".join(f"<td>{_texte(densites_larve.get(s))}</td>" for s in stades)
    colspan = max(len(stades) - 2, 1)
    captures_nombre = _texte(pop.captures_nombre if pop else None)
    captures_sol = _texte(pop.captures_sol if pop else None)
    captures_trans = _texte(pop.captures_trans if pop else None)
    captures_greg = _texte(pop.captures_greg if pop else None)
    densite_diffuse = _texte(pop.densite_diffuse if pop else None)
    densite_groupee = _texte(pop.densite_groupee if pop else None)
    tl = _coche(bool(pop and pop.tache_larvaire))
    bl = _coche(bool(pop and pop.bande_larvaire))
    interdistance = _texte(pop.interdistance if pop else None)
    surface_contaminee = _texte(pop.surface_contaminee_ha if pop else None)
    deplacement = _texte(pop.deplacement if pop else None)
    return f"""
    <table>
      <tr><th colspan="2">Nbre de Captures : {captures_nombre}</th>
        <th colspan="{colspan}">{escape(espece)}</th></tr>
      <tr><td>Nbre Sol : {captures_sol}</td><td>Nbre Trans : {captures_trans}</td>
        <td colspan="{colspan}">Nbre Greg : {captures_greg}</td></tr>
      <tr>{"".join(f"<th>{s}</th>" for s in stades)}</tr>
      <tr>{ligne_stades}</tr>
      <tr><td colspan="{len(stades)}">Pop diff D/ha : {densite_diffuse} &nbsp;
        Pop group D/m² : {densite_groupee}</td></tr>
      <tr><td colspan="{len(stades)}">TL {tl} / BL {bl} &nbsp;
        Interdistance : {interdistance} m</td></tr>
      <tr><td colspan="{len(stades)}">Surf. Infestée (ha) : {surface_contaminee} &nbsp;
        Déplacement/Repos : {deplacement}</td></tr>
    </table>"""


def build_prospection_extensive_html(p: ProspectionRead) -> str:
    numero_fiche = escape(p.n_fiche or "—")
    biotope = _texte(", ".join(b.value for b in p.biotope) if p.biotope else None)
    bloc_imago_lmc = _bloc_espece_imago(p.populations, "LMC")
    bloc_imago_nse = _bloc_espece_imago(p.populations, "NSE")
    bloc_larve_lmc = _bloc_espece_larve(p.populations, "LMC", ["L1", "L2", "L3", "L4", "L5"])
    bloc_larve_nse = _bloc_espece_larve(p.populations, "NSE", ["L1", "L2", "L3", "L4", "L5", "L6"])
    return f"""<!doctype html>
<html><head><meta charset="utf-8" /><style>{PDF_BASE_CSS}{_PROSPECTION_CSS}</style></head><body>
<h1>Ivotoerana Famongorana ny Valala eto Madagasikara</h1>
<h2>Prospection extensive — validation — {numero_fiche}</h2>

<h3>A. Références</h3>
<p class="ref"><b>Prospecteur :</b> {_texte(p.prospecteur_nom)} &nbsp;
  <b>PA :</b> {_texte(p.pa_code)} &nbsp;
  <b>Date :</b> {_date_fr(p.date_prospection)} &nbsp;
  <b>N° message :</b> {_texte(p.n_message)}</p>
<p class="ref"><b>Station :</b> {_texte(p.station_libre or p.station_id)} &nbsp;
  <b>Latitude S :</b> {_texte(p.latitude)} &nbsp;
  <b>Longitude E :</b> {_texte(p.longitude)}</p>
<p class="ref"><b>Type de station (biotope) :</b> {biotope} &nbsp;
  <b>Surf. :</b> {_texte(p.surface_station)}</p>

<h3>B. Imagos</h3>
<table><tr><td style="border:none;width:50%">{bloc_imago_lmc}</td>
  <td style="border:none;width:50%">{bloc_imago_nse}</td></tr></table>

<h3>C. Larves</h3>
<table><tr><td style="border:none;width:50%">{bloc_larve_lmc}</td>
  <td style="border:none;width:50%">{bloc_larve_nse}</td></tr></table>

<h3>D. Observations</h3>
<p class="ref"><b>Dégâts sur les cultures :</b> {_texte(p.degats_cultures)} &nbsp;
  <b>% Verd strate herbeuse :</b> {_texte(p.verdissement_pourcent)} &nbsp;
  <b>H Str Herb :</b> {_texte(p.hauteur_herbe_cm)}</p>
<p class="ref"><b>Dernière pluie le :</b> {_date_fr(p.derniere_pluie)} &nbsp;
  <b>Intensité :</b> {_texte(p.intensite_pluie)}</p>
</body></html>"""


def build_prospection_html(p: ProspectionRead) -> str:
    """Gabarit HTML de la fiche de prospection, branché sur `type_prospection` —
    intensive ou extensive (#494/#594). Une fiche `validation` (revalidation,
    même structure qu'extensive côté saisie) suit le gabarit extensif."""
    if p.type_prospection.value == "intensive":
        return build_prospection_intensive_html(p)
    return build_prospection_extensive_html(p)
