"""traitement_evaluation_risque_population : évaluation du risque pour la population

Slide « Impact et risque » (Traitement Aérien ET Terrestre, écran commun
impacts.tsx) — ajoute juste au-dessus d'Observations une liste dynamique
("+") d'évaluations : habitat le plus proche (texte libre), distance en km
(numérique), sensibilisation (OUI/NON).

Nouvelle table relationnelle, liée directement à `traitement` (pas à
`traitement_aerien`/`traitement_terrestre`, le slide étant identique pour
les deux types) — même patron que `traitement_signature`, pas une chaîne
JSON ni une extension du champ `evaluation_risque` existant (JSONB, axes de
risque environnemental eau/sol/faune/abeilles — objet sémantiquement
différent, une évaluation par axe fixe, pas une liste ouverte).

Remplacée en bloc à chaque enregistrement de la fiche (même sémantique que
`prospection_population` côté prospection) plutôt qu'une sous-ressource à
endpoints dédiés comme `traitement_rotation` : plus simple, suffisant ici
(pas de contrainte d'unicité dérivée entre lignes, pas de recalcul agrégé).

Migration additive pure (CREATE TABLE) : aucune colonne existante touchée,
aucune fiche déjà en base affectée, downgrade = DROP TABLE sans perte pour
les fiches qui n'avaient pas encore cette section.

Revision ID: 0055
Revises: 0054
Create Date: 2026-09-09

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "traitement_evaluation_risque_population",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "traitement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ordre", sa.Integer(), nullable=False),
        sa.Column("habitat_proche", sa.Text(), nullable=True),
        sa.Column("distance_km", sa.Numeric(6, 2), nullable=True),
        sa.Column("sensibilisation", sa.Boolean(), nullable=True),
        sa.UniqueConstraint(
            "traitement_id", "ordre", name="uq_traitement_evaluation_risque_population_ordre"
        ),
    )
    op.create_index(
        "ix_traitement_evaluation_risque_population_traitement_id",
        "traitement_evaluation_risque_population",
        ["traitement_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_traitement_evaluation_risque_population_traitement_id",
        table_name="traitement_evaluation_risque_population",
    )
    op.drop_table("traitement_evaluation_risque_population")
