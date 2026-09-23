"""traitement_aerien : suppression de pesticide_recu_l / pesticide_stock_restant_l

Ticket #609 (parent #592). Ces deux colonnes portaient un stock photographié par
fiche (« reçu » saisi, « reste » dérivé de `total_pesticide_l`) — sans continuité
d'une fiche à l'autre, sans traçabilité des entrées, incohérent dès qu'une fiche
reprend une base déjà approvisionnée par une fiche précédente. Le stock vit
désormais dans `mouvement_pesticide` (migrations 0090/#606, 0093/#609) : chaque
fiche génère ses propres mouvements `consommation`, agrégés par (site, pesticide,
unité) sur l'ensemble des fiches d'un site.

## Ce que fait cette migration

Supprime `traitement_aerien.pesticide_recu_l` et `.pesticide_stock_restant_l`.

**Pas de conversion en mouvements** (décision actée, cf. ticket #609) : ces valeurs
sont des photos ponctuelles incohérentes entre elles (`pesticide_recu_l` d'une
fiche ne dit rien du stock réellement présent sur le site à ce moment-là, qui
dépendait d'approvisionnements et de fiches antérieures jamais tracés) — rejouer
l'historique produirait des mouvements `approvisionnement` fictifs, sans valeur
probante, sous couvert d'une précision qu'ils n'ont pas.

**Inventaire avant suppression** (journalisé, non bloquant — même patron que la
migration 0089) : nombre de fiches ayant renseigné `pesticide_recu_l`, et parmi
elles combien ont un `pesticide_stock_restant_l` négatif (signe d'une saisie
incohérente, `pesticide_recu_l` inférieur à `total_pesticide_l`) — pour donner une
photo de ce qui est perdu, sans bloquer la migration dessus.

`TraitementTerrestre.pesticide_recu_l` / `.pesticide_stock_restant_l` ne sont pas
concernées (hors périmètre de #609, cf. « Stock du traitement terrestre » dans les
tickets #606/#609).

Revision ID: 0094
Revises: 0093
Create Date: 2026-09-23
"""

import logging

import sqlalchemy as sa

from alembic import context, op

_log = logging.getLogger("alembic.runtime.migration")

revision = "0094"
down_revision = "0093"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _journaliser_inventaire()
    op.drop_column("traitement_aerien", "pesticide_recu_l")
    op.drop_column("traitement_aerien", "pesticide_stock_restant_l")


def _journaliser_inventaire() -> None:
    """Photo non bloquante des valeurs perdues — cf. docstring ci-dessus."""
    if context.is_offline_mode():
        return
    renseignees, incoherentes = (
        op.get_bind()
        .execute(
            sa.text(
                """
                SELECT
                    COUNT(*) FILTER (WHERE pesticide_recu_l IS NOT NULL),
                    COUNT(*) FILTER (WHERE pesticide_stock_restant_l < 0)
                FROM traitement_aerien
                """
            )
        )
        .one()
    )
    if renseignees:
        _log.warning(
            "Migration 0094 : %d fiche(s) traitement aérien avaient pesticide_recu_l "
            "renseigné (dont %d avec un pesticide_stock_restant_l négatif) — colonnes "
            "supprimées sans conversion en mouvements (#609, décision actée).",
            renseignees,
            incoherentes,
        )


def downgrade() -> None:
    op.add_column("traitement_aerien", sa.Column("pesticide_recu_l", sa.Numeric(10, 2)))
    op.add_column("traitement_aerien", sa.Column("pesticide_stock_restant_l", sa.Numeric(10, 2)))
