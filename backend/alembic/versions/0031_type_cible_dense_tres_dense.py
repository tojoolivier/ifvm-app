"""type_cible : remplacer 'essaim' par 'dense'/'tres_dense'

Le type de cible générique "essaim" était sous-classifié par un champ séparé
`prospection_infestation_imago.type_essaim` (vol_clair/dense/tres_dense, cf. migration
0022). En pratique la densité de l'essaim EST le type de cible observé sur le terrain
(§3.2 du manuel) : "Dense" et "Très dense" deviennent donc des valeurs de `type_cible`
à part entière, au même niveau que "Vol clair", "Tache larvaire" et "Bande larvaire" —
"essaim" disparaît de la liste.

Mapping fiable (pas un renommage à l'aveugle, cf. 0026) : chaque ligne existante avec
type_cible='essaim' est reclassée d'après son propre type_essaim déjà enregistré
(vol_clair -> reste 'vol_clair' ; dense/tres_dense -> devient le type_cible). Une ligne
'essaim' sans sous-classification connue (pas de ligne imago, ou type_essaim NULL) est
reclassée 'vol_clair' par défaut (valeur la moins spécifique des trois, cf. logique du
questionnaire séquentiel côté mobile où l'absence de classification pointe vers "non
classable"). La colonne `type_essaim` n'est pas supprimée : elle continue d'être
alimentée par le questionnaire séquentiel mobile comme confirmation détaillée,
redondante avec `type_cible` mais sans perte d'information.

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-25

"""

from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Reclasser d'après la sous-classification déjà connue (imago.type_essaim).
    op.execute(
        """
        UPDATE prospection_infestation AS pi
        SET type_cible = imago.type_essaim
        FROM prospection_infestation_imago AS imago
        WHERE imago.infestation_id = pi.id
          AND pi.type_cible = 'essaim'
          AND imago.type_essaim IN ('dense', 'tres_dense')
        """
    )

    # 2) Reste ('essaim' sans sous-classification dense/tres_dense connue, y compris
    #    type_essaim = 'vol_clair' ou NULL) -> 'vol_clair' par défaut.
    op.execute(
        "UPDATE prospection_infestation SET type_cible = 'vol_clair' WHERE type_cible = 'essaim'"
    )

    op.drop_constraint(
        "ck_prospection_infestation_type_cible",
        "prospection_infestation",
        type_="check",
    )
    op.create_check_constraint(
        "ck_prospection_infestation_type_cible",
        "prospection_infestation",
        "type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','dense','tres_dense')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_prospection_infestation_type_cible",
        "prospection_infestation",
        type_="check",
    )
    op.create_check_constraint(
        "ck_prospection_infestation_type_cible",
        "prospection_infestation",
        "type_cible IN ('tache_larvaire','bande_larvaire','vol_clair','essaim')",
    )

    # type_essaim (jamais modifié par upgrade()) porte toujours dense/tres_dense pour ces
    # lignes : on peut donc revenir à 'essaim' sans perte d'information. Limite connue
    # (symétrique à 0026) : les lignes reclassées 'vol_clair' par défaut à l'étape 2 de
    # upgrade() (essaim sans sous-classification connue) restent 'vol_clair' ici — elles
    # sont indiscernables des lignes qui étaient déjà 'vol_clair' avant la migration.
    op.execute(
        "UPDATE prospection_infestation SET type_cible = 'essaim' "
        "WHERE type_cible IN ('dense', 'tres_dense')"
    )
