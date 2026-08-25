"""Amorçage du référentiel des stades acridiens.

Le référentiel fait autorité : `prospection_capture.stade` référence `stade.code` par
clé étrangère, l'API refuse un stade absent de la table, et les tablettes synchronisent
`code_stade` pour construire leurs grilles de saisie. Ce module ne sert qu'à *semer* ces
tables — ajouter un stade en production est une ligne de référentiel, pas un déploiement.

Deux niveaux, parce qu'un stade et sa place dans une grille sont deux faits distincts :
`VOCABULAIRE` liste les codes existants, `GRILLES` dit où chacun se saisit. Un même code
apparaît dans plusieurs grilles — A1 est un stade femelle *et* mâle, L1 vaut pour les
deux espèces.

- `espece = None` : applicable à Locusta comme à Nomadacris. Seuls L6 et L7 sont propres
  à Nomadacris (ADR-006).
- `sexe = None` : stade larvaire, non sexé à la saisie.
- `ordre` : rang d'affichage dans sa grille.
"""

from dataclasses import dataclass

VOCABULAIRE: list[tuple[str, str]] = [
    ("A1", "Imago stade A1"),
    ("A2", "Imago stade A2"),
    ("A3", "Imago stade A3"),
    ("A3-1/4", "Imago stade A3 ¼"),
    ("A3-1/2", "Imago stade A3 ½"),
    ("A3-3/4", "Imago stade A3 ¾"),
    ("A3-4/4", "Imago stade A3 4/4"),
    ("A4", "Imago stade A4"),
    ("A5", "Imago stade A5"),
    ("A234", "Imago stades A2-A3-A4 groupés"),
    *((f"L{n}", f"Larve stade L{n}") for n in range(1, 8)),
]

# Codes mâles hérités du premier modèle (un suffixe « b » par stade), remplacés par le
# stade groupé A234. Conservés inactifs : des tablettes les ont déjà synchronisés.
CODES_INACTIFS: list[str] = ["A1b", "A2b", "A5b"]


@dataclass(frozen=True)
class PlaceEnGrille:
    code: str
    categorie: str
    sexe: str | None
    espece: str | None
    libelle: str
    ordre: int


_FEMELLES = ["A1", "A2", "A3", "A3-1/4", "A3-1/2", "A3-3/4", "A3-4/4", "A4", "A5"]
_MALES = ["A1", "A234", "A5"]

_LIBELLES = dict(VOCABULAIRE)

GRILLES: list[PlaceEnGrille] = (
    [PlaceEnGrille(c, "imago", "F", None, f"♀ {_LIBELLES[c]}", i) for i, c in enumerate(_FEMELLES)]
    + [PlaceEnGrille(c, "imago", "M", None, f"♂ {_LIBELLES[c]}", i) for i, c in enumerate(_MALES)]
    + [
        PlaceEnGrille(f"L{n}", "larve", None, None if n <= 5 else "NSE", _LIBELLES[f"L{n}"], n - 1)
        for n in range(1, 8)
    ]
)
