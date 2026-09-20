"""traitement : moyens humains et matériels (fiche CRT papier §4.1/4.2)

Le gabarit PDF (`traitement_pdf.py::_section_moyens`) affiche depuis toujours
des cases "Nb agents permanents", "Nb agents temporaires", "Nb personnel
local", "Atomiseur", "Essence (litres)", "Disque rotatif", "Piles (nb)",
"Ulvamast (nb)" — jamais alimentées par aucun champ (issue #495, cases
volontairement vides). Cette migration comble ce trou.

Colonnes ajoutées à `traitement` (table commune Aérien/Terrestre, au même
titre que `kit_combinaison` et consorts) :
- `nb_agents_permanents`, `nb_agents_temporaires`, `nb_personnel_local` —
  section "Humains".
- `moyens_atomiseur_nb`, `moyens_essence_litres`, `moyens_disque_rotatif_nb`,
  `moyens_piles_nb`, `moyens_ulvamast_nb` — section "Matériels", comptage de
  matériel disponible sur le terrain. Préfixées `moyens_` pour éviter toute
  confusion avec les champs `TraitementTerrestre` de même racine mais de sens
  différent (`surface_atomiseur_ha`/`surface_disque_rotatif_ha` : surface
  traitée par équipement ; `essence_litres`/`nb_piles` : consommation liée à
  l'exécution du traitement — retirés de l'écran Équipe au profit de ceux-ci,
  #moyens-humains-materiels, colonnes conservées telles quelles, non migrées).

Revision ID: 0076
Revises: 0075
Create Date: 2026-09-21

"""

import sqlalchemy as sa

from alembic import op

revision = "0076"
down_revision = "0075"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("traitement", sa.Column("nb_agents_permanents", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("nb_agents_temporaires", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("nb_personnel_local", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("moyens_atomiseur_nb", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("moyens_essence_litres", sa.Numeric(10, 2), nullable=True))
    op.add_column("traitement", sa.Column("moyens_disque_rotatif_nb", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("moyens_piles_nb", sa.Integer(), nullable=True))
    op.add_column("traitement", sa.Column("moyens_ulvamast_nb", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("traitement", "moyens_ulvamast_nb")
    op.drop_column("traitement", "moyens_piles_nb")
    op.drop_column("traitement", "moyens_disque_rotatif_nb")
    op.drop_column("traitement", "moyens_essence_litres")
    op.drop_column("traitement", "moyens_atomiseur_nb")
    op.drop_column("traitement", "nb_personnel_local")
    op.drop_column("traitement", "nb_agents_temporaires")
    op.drop_column("traitement", "nb_agents_permanents")
