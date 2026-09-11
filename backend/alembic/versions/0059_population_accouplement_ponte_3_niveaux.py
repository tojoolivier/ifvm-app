"""prospection_population : accouplement/ponte réduits à 3 niveaux

Réduit l'échelle Accouplement/Ponte de 5 niveaux LMC (Néant/Rare/Peu/Beaucoup/
Dominant) et 4 niveaux NSE (sans Dominant) à 3 niveaux communs aux deux
espèces : Néant/Rare/Beaucoup.

Remappe d'abord les lignes déjà enregistrées (Peu -> Rare, Dominant ->
Beaucoup) avant de durcir les contraintes CHECK — décision produit : aucune
ligne existante ne doit devenir invalide, l'historique est préservé sous la
nouvelle échelle plutôt que rejeté ou laissé incohérent avec le nouveau
référentiel de saisie mobile (ACCOUPLEMENT_OPTIONS_LMC/NSE).

Downgrade : restaure les anciennes contraintes CHECK (5/4 valeurs) mais ne
peut pas distinguer a posteriori quelles lignes remappées à 'rare'/'beaucoup'
étaient à l'origine 'peu'/'dominant' — remap non réversible, même
irréversibilité déjà acceptée par d'autres migrations de ce type dans ce
dépôt (ex. 0057 downgrade sans backfill).

Revision ID: 0059
Revises: 0058
Create Date: 2026-09-11

"""

from alembic import op

revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE prospection_population SET accouplement = 'rare' WHERE accouplement = 'peu'")
    op.execute(
        "UPDATE prospection_population SET accouplement = 'beaucoup' "
        "WHERE accouplement = 'dominant'"
    )
    op.execute("UPDATE prospection_population SET ponte = 'rare' WHERE ponte = 'peu'")
    op.execute("UPDATE prospection_population SET ponte = 'beaucoup' WHERE ponte = 'dominant'")

    op.drop_constraint(
        "ck_prospection_population_accouplement", "prospection_population", type_="check"
    )
    op.drop_constraint("ck_prospection_population_ponte", "prospection_population", type_="check")
    op.create_check_constraint(
        "ck_prospection_population_accouplement",
        "prospection_population",
        "accouplement IN ('neant','rare','beaucoup')",
    )
    op.create_check_constraint(
        "ck_prospection_population_ponte",
        "prospection_population",
        "ponte IN ('neant','rare','beaucoup')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_prospection_population_accouplement", "prospection_population", type_="check"
    )
    op.drop_constraint("ck_prospection_population_ponte", "prospection_population", type_="check")
    op.create_check_constraint(
        "ck_prospection_population_accouplement",
        "prospection_population",
        "accouplement IN ('neant','rare','peu','beaucoup','dominant')",
    )
    op.create_check_constraint(
        "ck_prospection_population_ponte",
        "prospection_population",
        "ponte IN ('neant','rare','peu','beaucoup','dominant')",
    )
