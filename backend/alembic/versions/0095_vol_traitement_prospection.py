"""vol.traitement_id et prospection.vol_id : relier le vol aux faits qu'il produit

Ticket #610 (parent #592, bloqué par #608). Un vol d'application réalise un
traitement aérien ; un vol de prospection produit des relevés de prospection.

## Ce que fait cette migration

- Ajoute `vol.traitement_id`, FK nullable vers `traitement_aerien.traitement_id`
  (sa clé primaire, elle-même FK 1:1 vers `traitement.id`) : un vol porte au plus
  un traitement (0..1), le vol porte la logistique/les heures, le traitement
  porte l'agronomique — les deux restent des tables distinctes (cf. ticket).
  `ondelete=RESTRICT`, même politique que les autres FK de `vol` (migration
  0092) : un vol référençant un traitement empêche sa suppression plutôt que de
  silencieusement délier le rattachement.
  `ck_vol_traitement_type` exprime en CHECK SQL la moitié de la cohérence de
  type qui l'est : seul un vol `type='application'` peut porter un traitement.
  L'autre moitié (« le traitement référencé est bien un traitement aérien, pas
  seulement une ligne `traitement` ») est hors de portée d'un CHECK sur `vol`
  seule (elle suppose une jointure vers `traitement_aerien`) — validée côté
  application.
  **Nullable, et volontairement non renseignée à la création du vol** : le
  compte-rendu de traitement est souvent rédigé en fin de journée, après les
  vols, parfois sur un autre appareil que celui du pilote (cf. ADR-014, question
  9, qui avait piégé l'ancienne `vol.rotation_id`) — le rattachement se fait
  donc toujours après coup, via une mise à jour du vol.
- Ajoute `prospection.vol_id`, FK nullable vers `vol.id`, `ondelete=RESTRICT` :
  1:N, porté par `prospection` (pas par `vol`) parce qu'une seule sortie
  aérienne balaie typiquement plusieurs zones et produit plusieurs fiches — en
  particulier lors des prospections généralisées de début/fin de campagne. La
  cohérence de type (« le vol référencé est de type `prospection` ») est elle
  aussi inter-tables, donc hors CHECK SQL — validée côté application.

Les colonnes texte redondantes (`traitement_aerien.stand`/`base_secondaire`,
`prospection.base`/`base_numero`/`base_secondaire`) sont volontairement
inchangées — leur suppression est un ticket ultérieur, une fois l'adoption du
vol mesurée sur données réelles.

Revision ID: 0095
Revises: 0094
Create Date: 2026-09-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0095"
down_revision = "0094"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vol", sa.Column("traitement_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_vol_traitement_id",
        "vol",
        "traitement_aerien",
        ["traitement_id"],
        ["traitement_id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_vol_traitement_type",
        "vol",
        "traitement_id IS NULL OR type = 'application'",
    )
    op.create_index("ix_vol_traitement_id", "vol", ["traitement_id"])

    op.add_column("prospection", sa.Column("vol_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_prospection_vol_id",
        "prospection",
        "vol",
        ["vol_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_prospection_vol_id", "prospection", ["vol_id"])


def downgrade() -> None:
    op.drop_index("ix_prospection_vol_id", table_name="prospection")
    op.drop_constraint("fk_prospection_vol_id", "prospection", type_="foreignkey")
    op.drop_column("prospection", "vol_id")

    op.drop_index("ix_vol_traitement_id", table_name="vol")
    op.drop_constraint("ck_vol_traitement_type", "vol", type_="check")
    op.drop_constraint("fk_vol_traitement_id", "vol", type_="foreignkey")
    op.drop_column("vol", "traitement_id")
