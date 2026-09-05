"""traitement_aerien : pilote/mécanicien/consultant redeviennent du texte libre

Défait la partie "équipe (FK utilisateur)" de la migration 0047 — décision produit
revenue en arrière après livraison : `pilote_id`/`mecanicien_id`/`consultant_id`
(FK vers `utilisateur`, avec création de compte à la volée) sont remplacées par
les colonnes texte libre `pilote`/`mecanicien`/`consultant_international`, sur le
même patron que `traitement_terrestre.consultant_international` (déjà en texte
libre, jamais touché par la 0047). `chef_de_base_id` reste seul en FK — seul rôle
de l'équipe aérienne dont l'appartenance au référentiel utilisateur est vérifiée.

`lieu_aerien`, `prospection.lieu_base_id` et les 3 FK de lieux sur
`traitement_aerien` (base principale/stand/base secondaire) ne sont PAS concernés
par ce retour en arrière : seule la partie "personnes" de la 0047 est défaite.

CHECK `ck_traitement_aerien_roles_distincts` supprimée : elle comparait trois FK
UUID, ce qui devient impossible à exprimer en SQL une fois pilote/mécanicien en
texte libre face à un chef de base resté en FK — la distinction (chef de base,
pilote, mécanicien deux-à-deux distincts, consultant exempté) est désormais
validée côté application (`app.domain.traitement.valider_roles_aerien_distincts`),
appelée par `CreateTraitementAerien`/`SyncPushTraitementAerien` avant toute
persistance.

Backfill (upgrade) : `pilote`/`mecanicien`/`consultant_international` sont
remplies depuis `utilisateur.prenom || ' ' || utilisateur.nom` via les FK
existantes avant que celles-ci ne soient supprimées — aucune perte d'information
pour les lignes déjà en base (contrairement à la 0047, où le sens inverse n'était
pas dérivable). `pilote`/`mecanicien` bascule en NOT NULL après ce backfill.

Downgrade : ré-ajoute `pilote_id`/`mecanicien_id`/`consultant_id` (FK nullable,
sans backfill — un nom en texte libre ne redonne pas un id de façon fiable, même
irréversibilité déjà acceptée par le downgrade de la 0047 dans l'autre sens) et
la CHECK `ck_traitement_aerien_roles_distincts` ; NOT NULL sur les deux FK
obligatoires n'est pas restauré automatiquement (colonnes NULL après downgrade),
pour ne pas échouer sur les lignes déjà écrites en texte libre entre-temps.

Revision ID: 0048
Revises: 0047
Create Date: 2026-09-05

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("traitement_aerien", sa.Column("pilote", sa.String(255), nullable=True))
    op.add_column("traitement_aerien", sa.Column("mecanicien", sa.String(255), nullable=True))
    op.add_column(
        "traitement_aerien", sa.Column("consultant_international", sa.String(255), nullable=True)
    )

    op.execute(
        "UPDATE traitement_aerien ta SET pilote = u.prenom || ' ' || u.nom "
        "FROM utilisateur u WHERE u.id = ta.pilote_id"
    )
    op.execute(
        "UPDATE traitement_aerien ta SET mecanicien = u.prenom || ' ' || u.nom "
        "FROM utilisateur u WHERE u.id = ta.mecanicien_id"
    )
    op.execute(
        "UPDATE traitement_aerien ta SET consultant_international = u.prenom || ' ' || u.nom "
        "FROM utilisateur u WHERE u.id = ta.consultant_id"
    )

    op.alter_column("traitement_aerien", "pilote", nullable=False)
    op.alter_column("traitement_aerien", "mecanicien", nullable=False)

    op.drop_constraint("ck_traitement_aerien_roles_distincts", "traitement_aerien", type_="check")

    op.drop_column("traitement_aerien", "consultant_id")
    op.drop_column("traitement_aerien", "mecanicien_id")
    op.drop_column("traitement_aerien", "pilote_id")


def downgrade() -> None:
    op.add_column(
        "traitement_aerien",
        sa.Column("pilote_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "mecanicien_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "consultant_id", UUID(as_uuid=True), sa.ForeignKey("utilisateur.id"), nullable=True
        ),
    )

    op.create_check_constraint(
        "ck_traitement_aerien_roles_distincts",
        "traitement_aerien",
        "chef_de_base_id <> pilote_id "
        "AND chef_de_base_id <> mecanicien_id "
        "AND pilote_id <> mecanicien_id",
    )

    op.drop_column("traitement_aerien", "consultant_international")
    op.drop_column("traitement_aerien", "mecanicien")
    op.drop_column("traitement_aerien", "pilote")
