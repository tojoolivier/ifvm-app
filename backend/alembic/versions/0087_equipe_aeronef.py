"""multi-aéronef : `equipe.aeronef_id` -> `equipe_aeronef` borné dans le temps

ADR-018 §2, ticket #603. Une équipe aérienne dispose en réalité de 2 à 3 appareils,
affectés l'un après l'autre pendant la campagne. Le modèle ne savait en dire qu'un :
`equipe.aeronef_id` était une FK nullable sous `UNIQUE` (migration 0078, reprise telle
quelle par 0082), donc un 1:1 strict — impossible de remplacer un hélicoptère sans
effacer la trace du précédent.

Avant :

- `equipe(… aeronef_id FK UNIQUE, CHECK aeronef_id IS NULL OR type = 'aerien')`.

Après :

- `equipe_aeronef(id, equipe_id, aeronef_id, date_debut, date_fin, created_at)`, une
  ligne par période d'affectation, `date_fin IS NULL` pour l'affectation en cours.

Trois points structurants :

1. **`date_debut` des affectations reprises est une approximation assumée.** L'ancien
   modèle ne datait pas l'affectation : il n'existe aucune date à reprendre. On retient
   `equipe.created_at` — la seule borne inférieure que la base connaisse, et la plus
   proche de la vérité tant qu'aucun appareil n'a encore été remplacé (ce que le 1:1
   garantissait justement). Une affectation reprise est donc ouverte
   (`date_fin IS NULL`) et commence à la création de son équipe.
2. **La règle « un aéronef sur une seule équipe à la fois » est temporelle**, pas un
   `UNIQUE` : elle porte sur le chevauchement des intervalles `[date_debut, date_fin)`.
   Seul `EXCLUDE USING gist` l'exprimerait en SQL, et il est hors scope (ADR-018,
   « hors scope ») : la validation est **applicative**. Les deux index partiels posés
   ici n'en couvrent que le cas le plus fréquent — deux affectations *ouvertes*
   simultanées — et servent de garde-fou en base, pas de contrainte complète.
3. **La FK vers l'équipe est composite et type-sûre**, comme les quatre FK entrantes
   retargetées par 0082 : `(equipe_id, equipe_type) -> equipe(id, type)`, avec
   `equipe_type` en `GENERATED ALWAYS … STORED`. Aucune écriture applicative, donc
   aucune dérive possible : une équipe terrestre ne peut pas recevoir d'appareil, ce
   que portait auparavant `ck_equipe_aeronef_reserve_aerien`.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0087"
down_revision = "0086"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _creer_table()
    _reprendre_affectations()
    _demonter_colonne_equipe()


def _creer_table() -> None:
    op.create_table(
        "equipe_aeronef",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("equipe_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "equipe_type",
            sa.Text(),
            # Constante déguisée en expression dépendant de la colonne, comme dans 0082 :
            # une affectation ne vise qu'une équipe aérienne.
            sa.Computed("CASE WHEN equipe_id IS NULL THEN NULL ELSE 'aerien' END", persisted=True),
            nullable=True,
        ),
        sa.Column("aeronef_id", UUID(as_uuid=True), nullable=False),
        sa.Column("date_debut", sa.Date(), nullable=False),
        sa.Column("date_fin", sa.Date(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["equipe_id", "equipe_type"],
            ["equipe.id", "equipe.type"],
            name="fk_equipe_aeronef_equipe_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["aeronef_id"],
            ["aeronef.id"],
            name="fk_equipe_aeronef_aeronef_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "date_fin IS NULL OR date_fin >= date_debut", name="ck_equipe_aeronef_periode"
        ),
    )
    op.execute(
        "COMMENT ON COLUMN equipe_aeronef.equipe_type IS "
        "'Derivee de equipe_id (GENERATED STORED) : rend la FK vers equipe type-sure.'"
    )
    # Garde-fous partiels : deux affectations *ouvertes* pour la même équipe ou le même
    # appareil sont toujours un chevauchement, quel que soit le reste de l'historique.
    op.create_index(
        "uq_equipe_aeronef_ouverte_par_equipe",
        "equipe_aeronef",
        ["equipe_id"],
        unique=True,
        postgresql_where=sa.text("date_fin IS NULL"),
    )
    op.create_index(
        "uq_equipe_aeronef_ouverte_par_aeronef",
        "equipe_aeronef",
        ["aeronef_id"],
        unique=True,
        postgresql_where=sa.text("date_fin IS NULL"),
    )
    op.create_index("ix_equipe_aeronef_aeronef_id", "equipe_aeronef", ["aeronef_id"])


def _reprendre_affectations() -> None:
    """Chaque `equipe.aeronef_id` non nul devient une affectation ouverte (point 1)."""
    op.execute(
        """
        INSERT INTO equipe_aeronef (id, equipe_id, aeronef_id, date_debut, date_fin, created_at)
        SELECT gen_random_uuid(), id, aeronef_id, created_at::date, NULL, now()
        FROM equipe
        WHERE aeronef_id IS NOT NULL
        """
    )


def _demonter_colonne_equipe() -> None:
    op.drop_constraint("ck_equipe_aeronef_reserve_aerien", "equipe", type_="check")
    op.drop_constraint("uq_equipe_aeronef_id", "equipe", type_="unique")
    op.drop_constraint("fk_equipe_aeronef_id", "equipe", type_="foreignkey")
    op.drop_column("equipe", "aeronef_id")


def downgrade() -> None:
    """Réversible, mais lossy — et c'est inévitable : la colonne ne peut porter qu'une
    affectation. Seule l'affectation ouverte est restituée ; l'historique clos est perdu
    avec la table, et les dates d'affectation avec lui.

    Une équipe dont l'appareil a été retiré sans remplaçant (aucune affectation ouverte)
    retrouve donc `aeronef_id IS NULL`, ce que l'ancien modèle ne distinguait pas d'une
    équipe n'en ayant jamais eu.
    """
    op.add_column("equipe", sa.Column("aeronef_id", UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE equipe e
        SET aeronef_id = ea.aeronef_id
        FROM equipe_aeronef ea
        WHERE ea.equipe_id = e.id AND ea.date_fin IS NULL
        """
    )
    op.create_foreign_key(
        "fk_equipe_aeronef_id", "equipe", "aeronef", ["aeronef_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_unique_constraint("uq_equipe_aeronef_id", "equipe", ["aeronef_id"])
    op.create_check_constraint(
        "ck_equipe_aeronef_reserve_aerien", "equipe", "aeronef_id IS NULL OR type = 'aerien'"
    )
    op.drop_table("equipe_aeronef")
