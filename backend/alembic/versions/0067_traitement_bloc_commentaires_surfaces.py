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

Revision ID: 0067
Revises: 0066
Create Date: 2026-09-17
"""

from alembic import op

revision = "0067"
down_revision = "0066"
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
