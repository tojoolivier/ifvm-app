"""traitement_aerien.site_principal_id : FK vers le référentiel des sites aériens

Ticket #605 (parent #592). `base_principale` (texte libre, migration 0054) devient
rattachable au référentiel `site_aerienne` — cette FK a déjà existé et a été retirée
deux fois (migrations 0054 et 0063, motif documenté : « choisir la base dans un
référentiel synchronisé s'est révélé être une contrainte terrain non voulue »). Le
document de cadrage métier impose désormais une base principale obligatoire par
opération, une règle dure inexprimable sur du texte libre seul.

## Ce que fait cette migration

1. **Colonne nullable en base**, contrairement à `base_principale` (NOT NULL) :
   `base_principale` reste du texte saisi librement sans garantie de correspondance
   avec `site_aerienne.numero`/`localite` — le backfill n'est pas déterministe. La
   contrainte NOT NULL est reportée côté schéma Pydantic `TraitementAerienCreate`,
   qui l'exige pour toute nouvelle fiche (même patron que les FK référentiel ajoutées
   après coup dans ce projet).
2. **Backfill best-effort**, jamais bloquant (à la différence des garde-fous de
   0086 : une fiche existante non rapprochée reste valide, elle reste simplement
   NULL) :
   - Rapprochement sur `site_aerienne.numero = base_principale` en premier (identifiant
     stable, sans ambiguïté possible car `numero` est UNIQUE).
   - Puis, pour les lignes encore NULL, rapprochement sur `site_aerienne.localite =
     base_principale` — mais seulement si exactement un site porte cette localite
     (`localite` n'est pas UNIQUE) ; une localite partagée par plusieurs sites reste
     NULL plutôt que de deviner.
3. **Inventaire des non-rapprochés** : journalisé (`_log.warning`, une ligne par fiche)
   à la fin de l'`upgrade`, jamais en erreur SQL (`RAISE NOTICE` n'atteint pas la
   sortie d'alembic — même limitation documentée en 0084). Le nombre exact dépend des
   données réelles de l'environnement où la migration s'exécute ; interroger
   `SELECT numero_fiche FROM traitement JOIN traitement_aerien ON traitement_aerien.
   traitement_id = traitement.id WHERE site_principal_id IS NULL` pour la liste à jour.
4. **`base_principale` n'est pas supprimée** — hors périmètre de ce ticket (#605),
   sa suppression est un geste séparé une fois le rapprochement vérifié sur données
   réelles. `stand`, `base_secondaire` et leurs dates d'installation restent
   inchangées (bascule vers l'entité `vol` traitée par un autre ticket du lot).

Revision ID: 0087
Revises: 0086
Create Date: 2026-09-22
"""

import logging

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

_log = logging.getLogger("alembic.runtime.migration")

revision = "0087"
down_revision = "0086"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien", sa.Column("site_principal_id", UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_traitement_aerien_site_principal_id",
        "traitement_aerien",
        "site_aerienne",
        ["site_principal_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    _backfiller_par_numero()
    _backfiller_par_localite_non_ambigue()
    _journaliser_non_rapproches()


def _backfiller_par_numero() -> None:
    op.execute(
        """
        UPDATE traitement_aerien ta
        SET site_principal_id = s.id
        FROM site_aerienne s
        WHERE s.numero = ta.base_principale
          AND ta.site_principal_id IS NULL
        """
    )


def _backfiller_par_localite_non_ambigue() -> None:
    op.execute(
        """
        UPDATE traitement_aerien ta
        SET site_principal_id = s.id
        FROM site_aerienne s
        WHERE s.localite = ta.base_principale
          AND ta.site_principal_id IS NULL
          AND (SELECT COUNT(*) FROM site_aerienne s2 WHERE s2.localite = ta.base_principale) = 1
        """
    )


def _journaliser_non_rapproches() -> None:
    """Inventaire non bloquant des fiches non rapprochées — cf. docstring §3."""
    if context.is_offline_mode():
        return
    lignes = (
        op.get_bind()
        .execute(
            sa.text(
                """
                SELECT t.numero_fiche, ta.base_principale
                FROM traitement_aerien ta
                JOIN traitement t ON t.id = ta.traitement_id
                WHERE ta.site_principal_id IS NULL
                ORDER BY t.numero_fiche
                """
            )
        )
        .all()
    )
    if lignes:
        details = ", ".join(
            f"{numero_fiche} ({base_principale})" for numero_fiche, base_principale in lignes
        )
        _log.warning(
            "Migration 0087 : %d fiche(s) traitement aérien non rapprochées à un "
            "site_aerienne (base_principale sans correspondance numero/localite "
            "univoque), site_principal_id laissé à NULL : %s",
            len(lignes),
            details,
        )


def downgrade() -> None:
    op.drop_constraint(
        "fk_traitement_aerien_site_principal_id", "traitement_aerien", type_="foreignkey"
    )
    op.drop_column("traitement_aerien", "site_principal_id")
