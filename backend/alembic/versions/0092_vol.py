"""vol : ligne d'activité aérienne, catégories et rattachements de site

Ticket #608 (parent #592, bloqué par #602/#604/#603 -> equipe/site_aerienne/
equipe_aeronef). ADR-018 réintroduit `vol`, supprimée par la migration 0080
(ADR-017) : ce n'est pas la même entité (pas de carnet de bord, pas de signatures,
pas de cumuls d'heures, pas de `rotation_id`) — cf. ADR-018 pour la justification
de la révocation partielle.

## Ce que fait cette migration

Crée `vol(id, type, equipe_id, equipe_type, aeronef_id, site_principal_id,
stand_id, base_secondaire_id, date_vol, heure_debut, heure_fin, motif,
lieu_depart, lieu_arrivee, observations, created_at, updated_at)` :

- `type` : `mise_en_place`, `application`, `convoyage`, `prospection`, `divers`
  (`ck_vol_type`) — le document de cadrage métier n'en connaît que cinq ; le
  type « mixte » de la fiche papier reste une question ouverte (ADR-018,
  questions métier restantes n°1), volontairement absent.
- `equipe_id` NOT NULL, FK composite type-sûre `(equipe_id, equipe_type) ->
  equipe(id, type)`, `equipe_type` en `GENERATED ALWAYS ... STORED` toujours
  `'aerien'` (même patron que `equipe_aeronef`, migration 0087) — c'est la seule
  façon de tracer l'équipe sur un convoyage ou un vol divers, qui n'ont ni
  traitement ni prospection.
- `aeronef_id` NOT NULL, FK simple vers `aeronef` — la cohérence « affecté à
  l'équipe du vol à `date_vol` » n'est pas exprimable en CHECK SQL (elle
  suppose une jointure temporelle sur `equipe_aeronef`) : validée côté
  application (`AeronefNonAffecteError`).
- Trois FK indépendantes vers `site_aerienne` (`site_principal_id`, `stand_id`,
  `base_secondaire_id`), toutes nullables en base : seules deux catégories ont
  une obligation dure (`ck_vol_site_mise_en_place_application`) ; les autres
  sont « selon l'opération », donc libres. La cohérence hiérarchique
  (`stand`/`base_secondaire` rattaché au `site_principal_id` du vol) n'est pas
  un CHECK SQL — elle suppose de lire `site_aerienne.parent_site_id`, hors de
  portée d'une contrainte sur `vol` seule — validée côté application
  (`SiteHorsBaseError`).
- `motif` obligatoire pour `convoyage`/`divers` (`ck_vol_motif_requis`) ;
  `lieu_depart`/`lieu_arrivee` obligatoires pour `convoyage`
  (`ck_vol_lieux_convoyage`) — §5.3/§5.5 du document de cadrage.
- Pas de colonne durée : `heure_fin - heure_debut` est dérivée à la lecture,
  jamais stockée (même choix que `duree_implantation` sur `site_aerienne`,
  migration 0088).
- Aucun lien vers `traitement_aerien` ni `prospection` dans ce ticket — hors
  scope explicite de #608, séparé par un ticket bloqué par celui-ci.

Revision ID: 0092
Revises: 0091
Create Date: 2026-09-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0092"
down_revision = "0091"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vol",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("equipe_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "equipe_type",
            sa.Text(),
            sa.Computed("CASE WHEN equipe_id IS NULL THEN NULL ELSE 'aerien' END", persisted=True),
            nullable=True,
        ),
        sa.Column("aeronef_id", UUID(as_uuid=True), nullable=False),
        sa.Column("site_principal_id", UUID(as_uuid=True), nullable=True),
        sa.Column("stand_id", UUID(as_uuid=True), nullable=True),
        sa.Column("base_secondaire_id", UUID(as_uuid=True), nullable=True),
        sa.Column("date_vol", sa.Date(), nullable=False),
        sa.Column("heure_debut", sa.Time(), nullable=False),
        sa.Column("heure_fin", sa.Time(), nullable=False),
        sa.Column("motif", sa.Text(), nullable=True),
        sa.Column("lieu_depart", sa.Text(), nullable=True),
        sa.Column("lieu_arrivee", sa.Text(), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_vol_equipe_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["aeronef_id"],
            ["aeronef.id"],
            name="fk_vol_aeronef_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["site_principal_id"],
            ["site_aerienne.id"],
            name="fk_vol_site_principal_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stand_id"],
            ["site_aerienne.id"],
            name="fk_vol_stand_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["base_secondaire_id"],
            ["site_aerienne.id"],
            name="fk_vol_base_secondaire_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "type IN ('mise_en_place', 'application', 'convoyage', 'prospection', 'divers')",
            name="ck_vol_type",
        ),
        sa.CheckConstraint(
            "type NOT IN ('mise_en_place', 'application') OR "
            "(site_principal_id IS NOT NULL AND stand_id IS NOT NULL)",
            name="ck_vol_site_mise_en_place_application",
        ),
        sa.CheckConstraint(
            "type NOT IN ('convoyage', 'divers') OR motif IS NOT NULL",
            name="ck_vol_motif_requis",
        ),
        sa.CheckConstraint(
            "type != 'convoyage' OR (lieu_depart IS NOT NULL AND lieu_arrivee IS NOT NULL)",
            name="ck_vol_lieux_convoyage",
        ),
        sa.CheckConstraint("heure_fin > heure_debut", name="ck_vol_heures_coherentes"),
    )
    op.execute(
        "COMMENT ON COLUMN vol.equipe_type IS "
        "'Derivee de equipe_id (GENERATED STORED) : rend la FK vers equipe type-sure.'"
    )
    op.create_index("ix_vol_equipe_id", "vol", ["equipe_id"])
    op.create_index("ix_vol_aeronef_id", "vol", ["aeronef_id"])
    op.create_index("ix_vol_site_principal_id", "vol", ["site_principal_id"])
    op.create_index("ix_vol_stand_id", "vol", ["stand_id"])
    op.create_index("ix_vol_base_secondaire_id", "vol", ["base_secondaire_id"])
    op.create_index("ix_vol_date_vol", "vol", ["date_vol"])


def downgrade() -> None:
    op.drop_table("vol")
