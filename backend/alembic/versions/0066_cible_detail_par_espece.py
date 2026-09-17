"""cible : detail par espece (LMC/NSE) pour petites/grandes larves et repartition

`cible` (snapshot fige a la creation du traitement, cf. construire_cible())
ne portait que des totaux agreges toutes especes confondues : une prospection
avec des lignes population LMC ET NSE (« MELANGE ») perdait le detail par
espece. Ajoute 8 colonnes nullables, une par (espece x indicateur), sans
toucher aux colonnes existantes (espece/petites_larves/grandes_larves/
repartition_population restent les totaux agreges, toujours utilises par
l'ecran Cibles cote Terrestre).

`espece`/`repartition_population` portent deja des CHECK constraints figees
sur un jeu de valeurs fixe (LMC/NSE/MELANGE, GROUPEE/DIFFUSE) : les stocker
en detail par espece necessiterait de les relacher, ce qui casserait ce
contrat pour les consommateurs existants (ecran Cibles, PDF) — d'ou des
colonnes dediees plutot qu'un format libre dans les colonnes agregees.

Pas de sous-table `cible_espece` : LMC/NSE forment un axe fixe a 2 valeurs
dans tout ce depot (`Espece = 'LMC' | 'NSE'`, jamais une liste dynamique) —
suit le meme parti pris que le reste du code (colonnes paralleles par
espece, cf. PopulationRow/intensive-imagos.tsx), pas une table enfant pour
une cardinalite bornee et connue.

Revision ID: 0066
Revises: 0065
Create Date: 2026-09-16

"""

import sqlalchemy as sa

from alembic import op

revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None

_COLONNES = (
    "petites_larves_lmc",
    "petites_larves_nse",
    "grandes_larves_lmc",
    "grandes_larves_nse",
    "densite_diffuse_lmc",
    "densite_groupee_lmc",
    "densite_diffuse_nse",
    "densite_groupee_nse",
)


def upgrade() -> None:
    for colonne in _COLONNES:
        op.add_column("cible", sa.Column(colonne, sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    for colonne in reversed(_COLONNES):
        op.drop_column("cible", colonne)
