"""prospection_population.type_cible passe en multi-select (JSONB)

`prospection_population.type_cible` (extensif, par espèce — Vol clair/Dense/Très
dense) était `TEXT` à valeur unique, avec un CHECK IN (...). L'utilisateur doit
désormais pouvoir cocher plusieurs de ces 3 valeurs simultanément (ex. Vol clair +
Dense), sans aucune présélection par défaut côté mobile.

Même pattern que `prospection.biotope`/`type_station` (migration 0042) : colonne
JSONB dédiée (pas de table de jonction, ensemble fermé à 3 valeurs sans attribut
propre par ligne), non nullable, défaut `'[]'::jsonb`. Conversion sans perte :
valeur scalaire existante → tableau à un seul élément, `NULL` → `[]`. CHECK via
l'opérateur de confinement `<@` (pas de sous-requête, interdite dans un CHECK
Postgres), comme 0042.

Ne touche pas `prospection_infestation.type_cible` (Intensif) : table et mécanisme
différents (une ligne par cible sélectionnée), déjà conforme au besoin, hors
périmètre de cette migration.

Revision ID: 0045
Revises: 0044
Create Date: 2026-09-03

"""

from alembic import op

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None

_ALLOWED = '\'["vol_clair","dense","tres_dense"]\'::jsonb'
_TABLE = "prospection_population"
_COL = "type_cible"
_CK = f"ck_{_TABLE}_{_COL}"


def upgrade() -> None:
    # IF EXISTS : par précaution, comme 0042 pour ck_prospection_biotope — évite un
    # échec si la contrainte a pu diverger du modèle SQLAlchemy en base.
    op.execute(f"ALTER TABLE {_TABLE} DROP CONSTRAINT IF EXISTS {_CK}")

    op.execute(
        f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} TYPE JSONB "
        f"USING CASE WHEN {_COL} IS NULL THEN '[]'::jsonb ELSE jsonb_build_array({_COL}) END"
    )
    op.execute(f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} SET NOT NULL")
    op.execute(f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} SET DEFAULT '[]'::jsonb")

    op.create_check_constraint(
        _CK,
        _TABLE,
        f"jsonb_typeof({_COL}) = 'array' AND {_COL} <@ {_ALLOWED}",
    )


def downgrade() -> None:
    op.drop_constraint(_CK, _TABLE, type_="check")
    op.execute(f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} DROP DEFAULT")
    op.execute(f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} DROP NOT NULL")
    op.execute(
        f"ALTER TABLE {_TABLE} ALTER COLUMN {_COL} TYPE TEXT "
        f"USING CASE WHEN jsonb_array_length({_COL}) > 0 THEN {_COL}->>0 ELSE NULL END"
    )
    op.create_check_constraint(
        _CK,
        _TABLE,
        f"{_COL} IN ('vol_clair', 'dense', 'tres_dense')",
    )
