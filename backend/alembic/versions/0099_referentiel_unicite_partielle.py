"""Référentiel : unicité limitée aux lignes vivantes (#674)

Avec le soft-delete (0098), une ligne supprimée garde son `code`/`numero`/immatriculation.
Une contrainte UNIQUE ordinaire l'empêcherait de réutiliser ce code : recréer un poste
supprimé finirait en IntegrityError. On remplace donc chaque unicité métier par un index
unique partiel `WHERE deleted_at IS NULL` (Postgres). `uq_equipe_id_type` reste inchangé :
c'est une cible de FK composite, elle porte sur la clé primaire.

Revision ID: 0099
Revises: 0098
Create Date: 2026-09-24
"""

from alembic import op

revision = "0099"
down_revision = "0098"
branch_labels = None
depends_on = None

VIVANTE = "deleted_at IS NULL"

# (table, colonnes, ancien nom possible (contrainte ou index), nouveau nom)
SIMPLES = (
    ("zone_anti_acridien", "code", ("zone_anti_acridien_code_key",), "uq_zone_anti_acridien_code"),
    ("poste_acridien", "code", ("poste_acridien_code_key",), "uq_poste_acridien_code"),
    ("station_fixe", "code", ("station_fixe_code_key",), "uq_station_fixe_code"),
    ("pesticide", "code", ("pesticide_code_key",), "uq_pesticide_code"),
    ("culture", "code", ("culture_code_key",), "uq_culture_code"),
    (
        "site_aerienne",
        "numero",
        ("base_aerienne_numero_key", "site_aerienne_numero_key"),
        "uq_site_aerienne_numero",
    ),
    ("aeronef", "immatriculation", ("uq_aeronef_immatriculation",), "uq_aeronef_immatriculation"),
    ("site_aerienne", "equipe_id", ("uq_site_aerienne_equipe_id",), "uq_site_aerienne_equipe_id"),
)


def _supprimer_unicite(table: str, nom: str) -> None:
    op.execute(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "{nom}"')
    op.execute(f'DROP INDEX IF EXISTS "{nom}"')


def upgrade() -> None:
    for table, colonne, anciens, nouveau in SIMPLES:
        for ancien in anciens:
            _supprimer_unicite(table, ancien)
        op.execute(f'CREATE UNIQUE INDEX "{nouveau}" ON {table} ({colonne}) WHERE {VIVANTE}')

    _supprimer_unicite("code_stade", "uq_code_stade_grille")
    op.execute(
        "CREATE UNIQUE INDEX uq_code_stade_grille ON code_stade "
        f"(code, categorie, sexe, espece) NULLS NOT DISTINCT WHERE {VIVANTE}"
    )

    for nom, colonne in (
        ("uq_equipe_aeronef_ouverte_par_equipe", "equipe_id"),
        ("uq_equipe_aeronef_ouverte_par_aeronef", "aeronef_id"),
    ):
        _supprimer_unicite("equipe_aeronef", nom)
        op.execute(
            f'CREATE UNIQUE INDEX "{nom}" ON equipe_aeronef ({colonne}) '
            f"WHERE date_fin IS NULL AND {VIVANTE}"
        )


def downgrade() -> None:
    """Échoue s'il existe des doublons parmi les lignes supprimées : purger d'abord."""
    for nom, colonne in (
        ("uq_equipe_aeronef_ouverte_par_equipe", "equipe_id"),
        ("uq_equipe_aeronef_ouverte_par_aeronef", "aeronef_id"),
    ):
        _supprimer_unicite("equipe_aeronef", nom)
        op.execute(
            f'CREATE UNIQUE INDEX "{nom}" ON equipe_aeronef ({colonne}) WHERE date_fin IS NULL'
        )

    _supprimer_unicite("code_stade", "uq_code_stade_grille")
    op.execute(
        "CREATE UNIQUE INDEX uq_code_stade_grille ON code_stade "
        "(code, categorie, sexe, espece) NULLS NOT DISTINCT"
    )

    for table, colonne, anciens, nouveau in SIMPLES:
        _supprimer_unicite(table, nouveau)
        op.execute(f'ALTER TABLE {table} ADD CONSTRAINT "{anciens[0]}" UNIQUE ({colonne})')
