"""site_aerienne unifié : fusion de base_aerienne + stand_remplissage, historisation des positions

Ticket #604 (parent #592). Deux tables quasi identiques portaient la même forme
(`numero` UNIQUE, `localite`, `longitude`/`latitude`/`altitude` figés) : `base_aerienne`
(hiérarchique, `parent_base_id NULL` = principale) et `stand_remplissage` (même forme,
sans hiérarchie, rattachée à une équipe en N:1). Une base qui se déplaçait écrasait sa
position précédente — l'historique des implantations était perdu.

## Ce que fait cette migration

1. **Renommage** : `base_aerienne` -> `site_aerienne`, `parent_base_id` ->
   `parent_site_id`. Les FK entrantes suivent automatiquement (Postgres). Les
   contraintes nommées explicitement (`fk_base_aerienne_equipe_id`,
   `uq_base_aerienne_equipe_id`, `ck_base_aerienne_equipe_coherente`) et l'index
   (`ix_base_aerienne_parent_base_id`) sont renommés à l'identique côté modèle
   (`fk_site_aerienne_equipe_id`, etc.) — `ALTER ... RENAME CONSTRAINT`/`RENAME INDEX`
   ne change pas la définition, seulement le nom ; le CHECK continue de porter sur
   `parent_site_id` car Postgres réécrit son expression au renommage de colonne.

2. **Fusion** : chaque `stand_remplissage` devient une ligne `site_aerienne`
   secondaire, `parent_site_id` pointant vers la base principale de son équipe
   (`site_aerienne.equipe_id = stand.equipe_aerienne_id`). Deux garde-fous
   explicites AVANT toute écriture, même principe que le garde-fou de 0066 : échouer
   fort plutôt qu'inventer une donnée.
   - **Stands orphelins** (`equipe_aerienne_id IS NULL`) : aucun parent n'est
     déductible, la fusion échoue et liste les stands concernés — à rattacher
     manuellement (`PUT /stands-remplissage/{id}` sur la révision précédente, ou
     directement en base) avant de relancer cette migration.
   - **Collision de `numero`** : `numero` était UNIQUE sur chacune des deux tables
     séparément : un stand et une base peuvent porter le même numéro. La migration
     échoue et liste les collisions — à dé-doublonner manuellement (renommer l'un des
     deux `numero`) avant de relancer.
   - Une fois fusionné, un stand est indiscernable d'une base secondaire dans
     `site_aerienne` : le rôle est désormais contextuel (porté par la FK de
     l'appelant), pas par une colonne — décision produit #592 §6, confirmée par #604.

3. **Historisation** : `site_aerienne_position(id, site_id, latitude, longitude,
   altitude, date_debut, date_fin NULL, created_at)`, une ligne par période
   d'implantation — même patron que `equipe_aeronef` (migration 0085) pour
   l'affectation d'aéronef. Les coordonnées existantes (`site_aerienne.longitude`/
   `latitude` non NULL) sont reprises comme position initiale ouverte
   (`date_fin NULL`, `date_debut = site_aerienne.created_at`) ; un site sans
   coordonnées n'a simplement aucune position tant qu'il n'en est pas installé une via
   l'API. `longitude`/`latitude`/`altitude` sont ensuite retirées de `site_aerienne`.
   La durée d'implantation (`date_fin - date_debut`, ou l'écart à `today()`) est
   dérivée à la lecture, jamais stockée. Une seule position active par site : garde-fou
   partiel `uq_site_aerienne_position_ouverte_par_site` (comme les deux index
   équivalents de `equipe_aeronef`), validation complète côté application.

Revision ID: 0086
Revises: 0085
Create Date: 2026-09-22
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

revision = "0086"
down_revision = "0085"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    _renommer_base_aerienne()
    _refuser_stands_orphelins(conn)
    _refuser_collisions_numero(conn)
    _fusionner_stands()
    _creer_table_position()
    _reprendre_positions()
    _demonter_colonnes_position()


def _renommer_base_aerienne() -> None:
    op.rename_table("base_aerienne", "site_aerienne")
    op.alter_column("site_aerienne", "parent_base_id", new_column_name="parent_site_id")
    op.execute(
        "ALTER TABLE site_aerienne RENAME CONSTRAINT fk_base_aerienne_equipe_id "
        "TO fk_site_aerienne_equipe_id"
    )
    op.execute(
        "ALTER TABLE site_aerienne RENAME CONSTRAINT uq_base_aerienne_equipe_id "
        "TO uq_site_aerienne_equipe_id"
    )
    op.execute(
        "ALTER TABLE site_aerienne RENAME CONSTRAINT ck_base_aerienne_equipe_coherente "
        "TO ck_site_aerienne_equipe_coherente"
    )
    op.execute(
        "ALTER INDEX ix_base_aerienne_parent_base_id RENAME TO ix_site_aerienne_parent_site_id"
    )


def _refuser_stands_orphelins(conn) -> None:
    if context.is_offline_mode():
        return
    lignes = (
        conn.execute(
            sa.text(
                "SELECT numero FROM stand_remplissage "
                "WHERE equipe_aerienne_id IS NULL ORDER BY numero"
            )
        )
        .scalars()
        .all()
    )
    if lignes:
        raise RuntimeError(
            f"Migration 0086 : {len(lignes)} stand(s) de remplissage sans équipe "
            f"({', '.join(lignes)}) — aucun parent_site_id déductible. Rattachez-les "
            "d'abord à une équipe (PUT /stands-remplissage/{id} sur la révision "
            "précédente, ou UPDATE stand_remplissage en base), puis relancez cette "
            "migration."
        )


def _refuser_collisions_numero(conn) -> None:
    if context.is_offline_mode():
        return
    lignes = (
        conn.execute(
            sa.text(
                "SELECT s.numero FROM stand_remplissage s "
                "JOIN site_aerienne b ON b.numero = s.numero ORDER BY s.numero"
            )
        )
        .scalars()
        .all()
    )
    if lignes:
        raise RuntimeError(
            f"Migration 0086 : {len(lignes)} numero(s) en collision entre "
            f"stand_remplissage et site_aerienne ({', '.join(lignes)}) — numero est "
            "UNIQUE sur la table fusionnée. Renommez l'un des deux (stand ou base) "
            "avant de relancer cette migration."
        )


def _fusionner_stands() -> None:
    op.execute(
        """
        INSERT INTO site_aerienne
            (id, parent_site_id, equipe_id, numero, localite, actif, created_at, updated_at)
        SELECT s.id, principale.id, NULL, s.numero, s.localite, s.actif, s.created_at, s.updated_at
        FROM stand_remplissage s
        JOIN site_aerienne principale ON principale.equipe_id = s.equipe_aerienne_id
        """
    )
    op.drop_table("stand_remplissage")


def _creer_table_position() -> None:
    op.create_table(
        "site_aerienne_position",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=False),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["site_id"],
            ["site_aerienne.id"],
            name="fk_site_aerienne_position_site_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "date_fin IS NULL OR date_fin >= date_debut", name="ck_site_aerienne_position_periode"
        ),
    )
    # Garde-fou partiel — même patron que `uq_equipe_aeronef_ouverte_par_equipe`
    # (migration 0085) : deux positions *ouvertes* pour le même site sont toujours un
    # chevauchement, quel que soit le reste de l'historique. Validation complète
    # (bornes non chevauchantes) côté application.
    op.create_index(
        "uq_site_aerienne_position_ouverte_par_site",
        "site_aerienne_position",
        ["site_id"],
        unique=True,
        postgresql_where=sa.text("date_fin IS NULL"),
    )
    op.create_index("ix_site_aerienne_position_site_id", "site_aerienne_position", ["site_id"])


def _reprendre_positions() -> None:
    """Les coordonnées existantes deviennent la position initiale, ouverte. `date_debut`
    est une approximation assumée (même raisonnement que `date_debut` sur les
    affectations d'aéronef reprises, migration 0085) : `site_aerienne.created_at` est la
    seule borne inférieure que la base connaisse."""
    op.execute(
        """
        INSERT INTO site_aerienne_position
            (id, site_id, latitude, longitude, altitude, date_debut, date_fin, created_at)
        SELECT gen_random_uuid(), id, latitude, longitude, altitude, created_at::date, NULL, now()
        FROM site_aerienne
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """
    )


def _demonter_colonnes_position() -> None:
    op.drop_column("site_aerienne", "longitude")
    op.drop_column("site_aerienne", "latitude")
    op.drop_column("site_aerienne", "altitude")


def downgrade() -> None:
    raise NotImplementedError(
        "0086 fusionne base_aerienne et stand_remplissage puis retire leur position "
        "figée au profit de site_aerienne_position : irréversible. Après la fusion, un "
        "ancien stand et une ancienne base secondaire sont des lignes indiscernables "
        "(décision produit #592 §6) — aucune requête ne peut reconstituer laquelle "
        "table d'origine une ligne secondaire vient. Restaurer depuis la sauvegarde "
        "pg_dump (base_aerienne, stand_remplissage) puis revenir à la révision 0085 "
        "avec `alembic stamp 0085`."
    )
