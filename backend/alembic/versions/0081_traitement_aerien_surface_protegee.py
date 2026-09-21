"""traitement_aerien : sépare surface_traitee_ha (choc) et surface_protegee_ha (barrière)

Règle métier (#surface-bloc-mode-infestee, déjà appliquée aux blocs par la migration 0064/0068) :
un produit de choc (`mode_traitement` TOTAL) *traite* la surface infestée ; un produit de barrière
(BARRIERE) la *protège*. Jusqu'ici `traitement_aerien.surface_traitee_ha` — somme des
`traitement_rotation.surface_ha` — mélangeait les deux : une fiche en barrière y déclarait une
surface « traitée ».

Modèle : `traitement_aerien` porte désormais deux colonnes, jamais renseignées ensemble.

- `surface_traitee_ha`  : somme des rotations si le mode n'est PAS BARRIERE
  (TOTAL, IRREGULIER ou NULL) ;
- `surface_protegee_ha` : somme des rotations si le mode est BARRIERE.

Le mode vivant sur `traitement` (et non sur `traitement_aerien`), l'exclusion ne peut pas être
exprimée en SQL contre le mode ; la CHECK garantit au moins l'invariant local « pas les deux à la
fois », la répartition selon le mode restant écrite par `TraitementAerien.recalculer_totaux`
(seul chemin d'écriture, comme les autres champs dérivés depuis la migration 0047).

`surface_cumulee_ha` (chaînage de reprise, 0050) reste la surface *couverte* cumulée : précédente +
traitée + protégée. Aucune valeur à réécrire : la somme, elle, ne change pas.

Données existantes : pour les fiches en BARRIERE, la valeur de `surface_traitee_ha` est déplacée
vers `surface_protegee_ha` (et `surface_traitee_ha` repasse à 0).

Le terrestre n'est pas concerné (pas de subdivision de mode côté terrain).

Revision ID: 0081
Revises: 0080
Create Date: 2026-09-21
"""

import sqlalchemy as sa

from alembic import op

revision = "0081"
down_revision = "0080"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_aerien",
        sa.Column("surface_protegee_ha", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.execute(
        """
        UPDATE traitement_aerien
        SET surface_protegee_ha = surface_traitee_ha,
            surface_traitee_ha = 0
        FROM traitement
        WHERE traitement.id = traitement_aerien.traitement_id
          AND traitement.mode_traitement = 'BARRIERE'
        """
    )
    op.create_check_constraint(
        "ck_traitement_aerien_surface_exclusive",
        "traitement_aerien",
        "surface_traitee_ha = 0 OR surface_protegee_ha = 0",
    )
    op.execute(
        "COMMENT ON COLUMN traitement_aerien.surface_traitee_ha IS "
        "'Somme des rotations si produit de choc (mode_traitement hors BARRIERE).'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_aerien.surface_protegee_ha IS "
        "'Somme des rotations si produit de barriere (mode_traitement BARRIERE).'"
    )


def downgrade() -> None:
    op.drop_constraint("ck_traitement_aerien_surface_exclusive", "traitement_aerien")
    # Remet la somme (l'une des deux colonnes est toujours à 0) dans l'ancienne colonne unique.
    op.execute(
        "UPDATE traitement_aerien SET surface_traitee_ha = surface_traitee_ha + surface_protegee_ha"
    )
    op.execute("COMMENT ON COLUMN traitement_aerien.surface_traitee_ha IS NULL")
    op.drop_column("traitement_aerien", "surface_protegee_ha")
