"""traitement_terrestre : sépare surface_traitee_ha (choc) et surface_protegee_ha (barrière)

Généralise au Terrestre la séparation déjà faite pour l'Aérien par la migration 0081
(#surface-bloc-mode-infestee) : un produit de choc (`mode_traitement` TOTAL) *traite* la
surface infestée ; un produit de barrière (BARRIERE) la *protège*. La migration 0081 avait
explicitement exclu le Terrestre ("pas de subdivision de mode côté terrain") — décision
revenue en arrière ici, à la demande du métier : une équipe au sol peut elle aussi appliquer
un produit de barrière, et `traitement_terrestre.surface_traitee_ha` (somme de
`surface_atomiseur_ha` + `surface_disque_rotatif_ha` + `surface_atomiseur_autoporte_ha`)
déclarait alors à tort cette surface comme « traitée ».

Modèle : `traitement_terrestre` porte désormais deux colonnes, jamais renseignées ensemble.

- `surface_traitee_ha`  : somme des 3 matériels si le mode n'est PAS BARRIERE
  (TOTAL, IRREGULIER ou NULL) ;
- `surface_protegee_ha` : somme des 3 matériels si le mode est BARRIERE.

Le mode vivant sur `traitement` (et non sur `traitement_terrestre`), l'exclusion ne peut pas
être exprimée en SQL contre le mode ; la CHECK garantit au moins l'invariant local « pas les
deux à la fois » — `COALESCE(..., 0)` plutôt que l'égalité stricte de la CHECK aérienne
(`ck_traitement_aerien_surface_exclusive`) car `surface_traitee_ha`/`surface_protegee_ha`
restent nullables ici (contrairement à l'Aérien, NOT NULL DEFAULT 0 depuis la migration 0047) :
une fiche jamais recalculée (les deux colonnes NULL) reste valide. La répartition selon le
mode reste écrite par `TraitementTerrestre.recalculer_surfaces` (seul chemin d'écriture,
comme les autres champs dérivés de ce domaine).

`surface_cumulee_ha` (chaînage de reprise, 0050) reste la surface *couverte* cumulée :
précédente + traitée + protégée. Aucune valeur à réécrire : la somme, elle, ne change pas.

Données existantes : pour les fiches en BARRIERE dont `surface_traitee_ha` est renseignée, la
valeur est déplacée vers `surface_protegee_ha` (et `surface_traitee_ha` repasse à 0) — même
traitement que la migration 0081 pour l'Aérien.

Revision ID: 0083
Revises: 0082
Create Date: 2026-09-22
"""

import sqlalchemy as sa

from alembic import op

revision = "0083"
down_revision = "0082"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_terrestre",
        sa.Column("surface_protegee_ha", sa.Numeric(10, 2), nullable=True),
    )
    op.execute(
        """
        UPDATE traitement_terrestre
        SET surface_protegee_ha = surface_traitee_ha,
            surface_traitee_ha = 0
        FROM traitement
        WHERE traitement.id = traitement_terrestre.traitement_id
          AND traitement.mode_traitement = 'BARRIERE'
          AND traitement_terrestre.surface_traitee_ha IS NOT NULL
        """
    )
    op.create_check_constraint(
        "ck_traitement_terrestre_surface_exclusive",
        "traitement_terrestre",
        "COALESCE(surface_traitee_ha, 0) = 0 OR COALESCE(surface_protegee_ha, 0) = 0",
    )
    op.execute(
        "COMMENT ON COLUMN traitement_terrestre.surface_traitee_ha IS "
        "'Somme atomiseur/disque rotatif/atomiseur autoporte si produit de choc "
        "(mode_traitement hors BARRIERE).'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_terrestre.surface_protegee_ha IS "
        "'Somme atomiseur/disque rotatif/atomiseur autoporte si produit de barriere "
        "(mode_traitement BARRIERE).'"
    )


def downgrade() -> None:
    op.drop_constraint("ck_traitement_terrestre_surface_exclusive", "traitement_terrestre")
    # Remet la somme (l'une des deux colonnes est toujours à 0 ou NULL) dans l'ancienne
    # colonne unique — COALESCE pour ne pas perdre une fiche jamais recalculée (les deux
    # colonnes NULL) : le résultat doit rester NULL dans ce cas, pas 0.
    op.execute(
        """
        UPDATE traitement_terrestre
        SET surface_traitee_ha = COALESCE(surface_traitee_ha, 0) + COALESCE(surface_protegee_ha, 0)
        WHERE surface_traitee_ha IS NOT NULL OR surface_protegee_ha IS NOT NULL
        """
    )
    op.execute("COMMENT ON COLUMN traitement_terrestre.surface_traitee_ha IS NULL")
    op.drop_column("traitement_terrestre", "surface_protegee_ha")
