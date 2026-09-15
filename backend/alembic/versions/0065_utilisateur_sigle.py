"""utilisateur : sigle — identifiant court affiché dans le numéro de fiche

Demande explicite du 2026-09-15 : un admin peut attribuer un sigle court à
chaque utilisateur (ex. "ADM") depuis la page Utilisateurs du web. Ce sigle
s'insère dans le numéro de fiche généré côté mobile pour toute fiche créée
par cet utilisateur — entre la date et le suffixe final (ex.
`FI-20260915-ADM-A8DF4`), quel que soit le type de fiche (Prospection
Intensive/Extensive/Validation, Traitement).

Facultatif et non unique : un utilisateur sans sigle continue de générer des
numéros de fiche identiques à aujourd'hui (le sigle est simplement absent du
numéro, jamais une chaîne vide insérée).

Revision ID: 0065
Revises: 0064
Create Date: 2026-09-15

"""

import sqlalchemy as sa

from alembic import op

revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("utilisateur", sa.Column("sigle", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("utilisateur", "sigle")
