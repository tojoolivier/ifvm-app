"""traitement_bloc : corrige les commentaires inversés de surface_protegee_ha/surface_traitee_ha

Règle métier confirmée avec l'utilisateur le 2026-09-17 (#surface-bloc-mode-infestee) :

- `mode_traitement` TOTAL (produit de choc) renseigne `surface_traitee_ha`,
  `surface_protegee_ha` reste à zéro/vide.
- `mode_traitement` BARRIERE (produit de barrière) renseigne
  `surface_protegee_ha`, `surface_traitee_ha` reste à zéro/vide.

La migration 0064 avait posé les `COMMENT ON COLUMN` **inversés** par rapport à
cette règle (`surface_protegee_ha` commentée "si produit de choc",
`surface_traitee_ha` commentée "si produit de barrière"). Purement cosmétique
(ces commentaires ne sont lus par aucun code, cf. `app.domain.traitement.
valider_surfaces_bloc`, qui applique la règle correcte ci-dessus) — cette
migration ne fait que corriger le texte pour qu'il cesse de contredire le
comportement réel.

Revision ID: 0068
Revises: 0067
Create Date: 2026-09-17

Renumérotée 0067 -> 0068 (2026-09-17) : collision avec
`0067_cible_detail_par_espece.py`, fusionnée entre-temps depuis `main` — deux
migrations avaient indépendamment pris le numéro 0067 après 0066_equipe_aerienne.
"""

from alembic import op

revision = "0068"
down_revision = "0067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_protegee_ha IS "
        "'Renseignee si produit de barriere (mode_traitement BARRIERE).'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_traitee_ha IS "
        "'Renseignee si produit de choc (mode_traitement TOTAL).'"
    )


def downgrade() -> None:
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_protegee_ha IS 'Renseignee si produit de choc.'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_traitee_ha IS "
        "'Renseignee si produit de barriere.'"
    )
