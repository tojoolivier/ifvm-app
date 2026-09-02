"""biotope / type_station passent en multi-select (JSONB)

`prospection.biotope` (intensif, obligatoire) et `prospection.type_station`
(extensif/validation, facultatif — affiché « Type de station (biotope) ») étaient
tous deux `TEXT` à valeur unique, avec un CHECK IN ('xerophyle','mesophyle',
'hydrophyle'). L'utilisateur doit désormais pouvoir cocher plusieurs de ces 3
valeurs simultanément, sur les 4 types de fiche.

Les 3 valeurs autorisées ne changent pas (question posée à l'utilisateur, qui a
choisi de les garder plutôt que de réintroduire l'ancien référentiel d'usage du
sol retiré par la migration 0026) : la conversion des données existantes est donc
**sans perte**, contrairement à la 0026 — une valeur scalaire devient un tableau à
un seul élément, `NULL` devient `[]`.

Colonne dédiée en JSONB (pas de table de jonction) : ensemble fermé à 3 valeurs,
sans attribut propre par ligne — même pattern déjà en place pour
`prospection.avertissements` (migration 0024). Non nullable, défaut `'[]'::jsonb`
— le caractère obligatoire de `biotope` reste appliqué en frontière applicative
(Pydantic `ProspectionCreate`), jamais en `NOT NULL` DB, comme tous les autres
champs "obligatoires" de ce schéma.

CHECK constraint : aucun précédent dans ce repo pour valider le contenu d'une
colonne JSONB — les subqueries/`EXISTS` étant interdites dans un CHECK Postgres
(`NOT EXISTS (SELECT ... FROM jsonb_array_elements_text(...))` serait rejeté à la
création de la contrainte), on utilise l'opérateur de confinement `<@` : pas de
sous-requête, vérifie que chaque élément du tableau appartient aux 3 valeurs
autorisées.

Revision ID: 0041
Revises: 0040
Create Date: 2026-09-02

"""

from alembic import op

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None

_ALLOWED = '\'["xerophyle","mesophyle","hydrophyle"]\'::jsonb'


def _upgrade_colonne(col: str) -> None:
    # L'ancienne contrainte CHECK (`type_station = ANY(ARRAY[...text...])`) doit être
    # levée AVANT le changement de type de colonne : Postgres la revalide sinon contre
    # le nouveau type JSONB pendant l'ALTER et échoue ("operator does not exist:
    # jsonb = text"), la comparaison scalaire texte n'ayant plus de sens.
    #
    # IF EXISTS : `ck_prospection_biotope` est déclarée dans le modèle SQLAlchemy mais
    # n'a jamais été réellement créée en base par une migration (dérive préexistante,
    # sans rapport avec ce changement — `ck_prospection_type_station`, elle, existe
    # bien). `op.drop_constraint` n'a pas d'équivalent IF EXISTS, d'où le SQL brut.
    op.execute(f"ALTER TABLE prospection DROP CONSTRAINT IF EXISTS ck_prospection_{col}")

    op.execute(
        f"ALTER TABLE prospection ALTER COLUMN {col} TYPE JSONB "
        f"USING CASE WHEN {col} IS NULL THEN '[]'::jsonb ELSE jsonb_build_array({col}) END"
    )
    op.execute(f"ALTER TABLE prospection ALTER COLUMN {col} SET NOT NULL")
    op.execute(f"ALTER TABLE prospection ALTER COLUMN {col} SET DEFAULT '[]'::jsonb")

    op.create_check_constraint(
        f"ck_prospection_{col}",
        "prospection",
        f"jsonb_typeof({col}) = 'array' AND {col} <@ {_ALLOWED}",
    )


def _downgrade_colonne(col: str) -> None:
    op.drop_constraint(f"ck_prospection_{col}", "prospection", type_="check")
    op.execute(f"ALTER TABLE prospection ALTER COLUMN {col} DROP DEFAULT")
    op.execute(f"ALTER TABLE prospection ALTER COLUMN {col} DROP NOT NULL")
    op.execute(
        f"ALTER TABLE prospection ALTER COLUMN {col} TYPE TEXT "
        f"USING CASE WHEN jsonb_array_length({col}) > 0 THEN {col}->>0 ELSE NULL END"
    )
    op.create_check_constraint(
        f"ck_prospection_{col}",
        "prospection",
        f"{col} IN ('xerophyle', 'mesophyle', 'hydrophyle')",
    )


def upgrade() -> None:
    _upgrade_colonne("biotope")
    _upgrade_colonne("type_station")


def downgrade() -> None:
    _downgrade_colonne("type_station")
    _downgrade_colonne("biotope")
