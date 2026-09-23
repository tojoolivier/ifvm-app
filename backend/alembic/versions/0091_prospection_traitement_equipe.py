"""prospection/traitement : rattachement à l'équipe qui les a menés

Ticket #607 (parent #592, bloqué par #602/#604 -> equipe(id, type) unifiée,
migration 0084). Aujourd'hui, aucune prospection ni aucun traitement n'est
rattaché à une équipe : impossible de retracer les déplacements d'une équipe
mobile terrestre (EMT) à partir de ses interventions, ni d'attribuer une fiche
à l'équipe qui l'a menée.

## Ce que fait cette migration

Ajoute `equipe_id` + `equipe_type` (GENERATED ALWAYS ... STORED) à `prospection`
et `traitement`, avec la FK composite type-sûre `(equipe_id, equipe_type) ->
equipe(id, type)` — même patron que les FK entrantes retargetées en 0084
(`_retargeter_fk`), mais `equipe_type` n'y est pas une constante :

- `traitement.equipe_type` est déduit de `type_traitement` seul (AERIEN ->
  aerien, TERRESTRE -> terrestre) — sans ambiguïté, une fiche de traitement n'a
  qu'un type.
- `prospection.equipe_type` est déduit de `type_prospection` ET
  `mode_extensif` : intensive/validation sont toujours terrestres (le « CHECK
  métier » du ticket, ici *forcé* par la colonne générée plutôt que vérifié à
  côté — aucun chemin d'écriture ne peut le contourner) ; une extensive suit
  `mode_extensif` (NULL ou 'terrestre' -> terrestre, 'aerien' -> aerien), l'axe
  orthogonal à `type_prospection` déjà en place depuis la migration 0035. La FK
  composite refuse donc nativement de rattacher une intensive/validation à une
  équipe aérienne : `equipe_type` vaudrait 'terrestre' alors que l'équipe visée
  est 'aerien', la ligne cible n'existe pas dans `equipe(id, type)`.

Les deux colonnes `equipe_id` restent NULLABLE en base (rétro-compatibilité
avec les fiches déjà enregistrées) ; `ProspectionCreate`/`TraitementCreate`
l'exigent pour toute nouvelle fiche (validation applicative, hors périmètre SQL).

Pas de backfill des fiches existantes (décision actée, hors scope #607) : elles
gardent `equipe_id IS NULL`.

Revision ID: 0089
Revises: 0088
Create Date: 2026-09-23
"""

import sqlalchemy as sa

from alembic import op

revision = "0089"
down_revision = "0088"
branch_labels = None
depends_on = None

# (table, expression SQL de equipe_type, nom de la FK)
_TABLES = (
    (
        "prospection",
        "CASE WHEN equipe_id IS NULL THEN NULL "
        "WHEN type_prospection IN ('intensive','validation') THEN 'terrestre' "
        "WHEN mode_extensif = 'aerien' THEN 'aerien' "
        "ELSE 'terrestre' END",
        "fk_prospection_equipe_id",
    ),
    (
        "traitement",
        "CASE WHEN equipe_id IS NULL THEN NULL "
        "WHEN type_traitement = 'AERIEN' THEN 'aerien' "
        "ELSE 'terrestre' END",
        "fk_traitement_equipe_id",
    ),
)


def upgrade() -> None:
    for table, expression, nom_fk in _TABLES:
        op.add_column(
            table,
            sa.Column("equipe_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.add_column(
            table,
            sa.Column(
                "equipe_type",
                sa.Text(),
                sa.Computed(expression, persisted=True),
                nullable=True,
            ),
        )
        op.create_foreign_key(
            nom_fk,
            table,
            "equipe",
            ["equipe_id", "equipe_type"],
            ["id", "type"],
            ondelete="RESTRICT",
        )
        op.create_index(f"ix_{table}_equipe_id", table, ["equipe_id"])
        op.execute(
            f"COMMENT ON COLUMN {table}.equipe_type IS "
            f"'Derivee de {table} (GENERATED STORED) : rend la FK vers equipe type-sure.'"
        )


def downgrade() -> None:
    for table, _expression, nom_fk in reversed(_TABLES):
        op.drop_index(f"ix_{table}_equipe_id", table_name=table)
        op.drop_constraint(nom_fk, table, type_="foreignkey")
        op.drop_column(table, "equipe_type")
        op.drop_column(table, "equipe_id")
