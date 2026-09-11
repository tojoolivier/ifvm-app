"""traitement_terrestre/traitement_aerien : efficacité (taux de mortalité)

Ajoute le bloc « Efficacité » de la fiche CRT papier (section « Traitement »,
juste après Condition de traitement — Début/Fin heure, Vent, Température) :
taux de mortalité observé quelques heures après le traitement, délai de
l'évaluation (en heures) et méthode d'évaluation. Trois colonnes nullables
simples, sur le même patron que les autres champs scalaires facultatifs déjà
présents sur ces deux tables (`pesticide_recu_l`, `essence_litres`, etc.) —
aucune table séparée n'est justifiée : un seul triplet de valeurs par fiche,
jamais répété (une seule évaluation d'efficacité par traitement, pas par
rotation aérienne).

`methode_evaluation_efficacite` est stockée en texte libre (pas de contrainte
CHECK) : le référentiel des valeurs possibles ("ESTIMATION_VISUELLE",
"COMPTAGES_PRE_POST") est validé côté schéma Pydantic (`MethodeEvaluationEfficacite`),
même choix que les autres enums de ce module (`ModeTraitement`,
`EmpoisonnementType`, ...) qui ne sont pas non plus contraints en base.

Revision ID: 0058
Revises: 0057
Create Date: 2026-09-11

"""

import sqlalchemy as sa

from alembic import op

revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("traitement_terrestre", "traitement_aerien"):
        op.add_column(table, sa.Column("taux_mortalite_pourcent", sa.Numeric(5, 2), nullable=True))
        op.add_column(
            table,
            sa.Column("evaluation_efficacite_heures_apres", sa.Numeric(5, 2), nullable=True),
        )
        op.add_column(
            table, sa.Column("methode_evaluation_efficacite", sa.String(50), nullable=True)
        )


def downgrade() -> None:
    for table in ("traitement_terrestre", "traitement_aerien"):
        op.drop_column(table, "methode_evaluation_efficacite")
        op.drop_column(table, "evaluation_efficacite_heures_apres")
        op.drop_column(table, "taux_mortalite_pourcent")
