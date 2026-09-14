"""prospection.revalide_de_id : chaînage de revalidation (fiche périmée)

Une fiche extensive/validation validée depuis plus de 5 jours sans traitement
associé n'est plus fiable (surface infestée et localisation des criquets
peuvent avoir changé) : elle doit être revalidée avant de pouvoir servir de
base à un traitement. La revalidation crée une NOUVELLE fiche prospection
(nouvel id, pré-remplie côté mobile avec les données de l'ancienne), jamais
une mise à jour en place — la prospection mobile ne sait aujourd'hui que
créer, pas mettre à jour+resynchroniser (contrairement au traitement, qui a
déjà `/traitements/sync` avec gestion de conflit).

`revalide_de_id` (auto-référence nullable vers `prospection.id`) chaîne la
nouvelle fiche à celle qu'elle remplace — mirroir exact de
`traitement.traitement_origine_id` (migrations 0012/0013/0050) pour la
reprise de traitement, jusqu'à l'index unique partiel : une fiche d'origine
ne peut être désignée comme revalidée que par UNE seule fiche suivante
(chaîne linéaire garantie par la DB), mais rien n'empêche de revalider une
revalidation (nouvelle chaîne). Contrairement au traitement, pas de flag
booléen séparé (`reprise_traitement`) : la fiche est créée en une seule
fois côté mobile, `revalide_de_id` renseigné ou non dès l'insertion, jamais
d'état intermédiaire "reprise=true mais origine pas encore choisie".

La péremption elle-même (validated_at + 5 jours, type_prospection, absence de
traitement, absence de revalidation déjà faite) n'est PAS stockée ici : c'est
un filtre SQL à la volée dans `ProspectionRepositoryImpl.list_by_filters`
(`disponible_pour_traitement`/nouveau `a_revalider`), même choix que
l'exclusion "déjà traitée" existante — pas de flag à tenir synchronisé.

Revision ID: 0062
Revises: 0061
Create Date: 2026-09-14

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0062"
down_revision = "0061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection",
        sa.Column(
            "revalide_de_id",
            UUID(as_uuid=True),
            sa.ForeignKey("prospection.id"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_prospection_revalide_de_id",
        "prospection",
        ["revalide_de_id"],
    )
    op.create_index(
        "uq_prospection_revalide_de_id",
        "prospection",
        ["revalide_de_id"],
        unique=True,
        postgresql_where=sa.text("revalide_de_id IS NOT NULL"),
    )
    op.execute(
        """
        COMMENT ON COLUMN prospection.revalide_de_id
        IS 'Auto-reference vers prospection.id : pointe vers la fiche perimee (validee
        depuis plus de 5 jours, jamais traitee) que CETTE fiche revalide - mirroir de
        traitement.traitement_origine_id, meme index unique partiel (chaine lineaire)'
        """
    )


def downgrade() -> None:
    op.drop_index("uq_prospection_revalide_de_id", table_name="prospection")
    op.drop_index("ix_prospection_revalide_de_id", table_name="prospection")
    op.drop_column("prospection", "revalide_de_id")
