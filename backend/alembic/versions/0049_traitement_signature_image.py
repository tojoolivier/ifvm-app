"""traitement_signature : trace vectoriel de la signature numérique

Le slide « Signatures » de la fiche de traitement ne capturait jusqu'ici qu'un
nom saisi manuellement (`signataire_nom`), sans aucun tracé — un simple bouton
« Signer » qui enregistrait un nom, jamais une signature au sens propre. Cette
migration ajoute la donnée qui manquait pour que la signature soit réellement
numérique : `signature_image`, le tracé du pavé de signature (mobile), sérialisé
en chemin SVG (attribut `d`, ex. "M12 34 L56 78 ...") — vectoriel, pas une image
raster : léger, fidèle au pixel près à l'affichage, ne nécessite aucune
dépendance native supplémentaire côté mobile (rendu via `react-native-svg`,
déjà inclus dans Expo Go).

`Text()` plutôt que `String(n)` : un tracé à plusieurs traits peut dépasser
largement 255 caractères, sans borne raisonnable à fixer a priori — même choix
que les autres colonnes de texte libre non bornées de ce schéma. Nullable : une
ligne `traitement_signature` reste valide sans tracé (rétrocompatibilité avec
les lignes déjà écrites avant cette migration, qui n'en ont pas), mais la
validation applicative (mobile + `Traitement.valider()`) exige désormais un
tracé avant d'accepter une signature — cf. `valider_roles_aerien_distincts`
pour le précédent d'une contrainte métier posée côté application plutôt qu'en
CHECK SQL quand la donnée ne s'y prête pas.

Aucune nouvelle table : le tracé est un attribut scalaire intrinsèque à la
signature elle-même (même ligne, même cardinalité 1:1 avec `(traitement_id,
role)`, déjà garantie par `uq_traitement_signature`) — pas une entité distincte,
donc pas de duplication ni de dénormalisation à surveiller ici.

Revision ID: 0049
Revises: 0048
Create Date: 2026-09-06

"""

import sqlalchemy as sa

from alembic import op

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traitement_signature", sa.Column("signature_image", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("traitement_signature", "signature_image")
