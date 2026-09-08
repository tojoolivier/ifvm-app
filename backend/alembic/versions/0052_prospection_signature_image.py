"""prospection.signature_{consultant_fao,pilote,chef_base}_image : tracé vectoriel

Même besoin, même solution que la migration 0049 (traitement_signature) : le
slide « Observations → Signatures » de la Prospection Extensive Aérienne ne
capturait jusqu'ici qu'un nom (saisi ou choisi) + un horodatage, jamais un
tracé — un bouton « Signer » qui posait juste `nom` et `now()`, pas une
signature au sens propre. Cette migration ajoute la donnée manquante pour
Consultant FAO, Pilote et Chef de Base : le tracé du pavé de signature
(mobile), sérialisé en chemin SVG (attribut `d`), exactement comme
`traitement_signature.signature_image` — même composant mobile réutilisé
(`SignaturePad`), même format, pour ne pas introduire un deuxième mécanisme
de signature numérique dans le projet.

`Text()`, nullable : mêmes raisons que 0049 (tracé multi-traits sans borne
raisonnable a priori ; rétrocompatibilité avec les fiches déjà signées avant
cette migration, qui n'ont qu'un nom+horodatage, sans tracé).

Le champ VISA est retiré du formulaire mobile par ce même chantier, mais ses
colonnes (`signature_visa_nom`, `signature_visa_horodatage`, migration 0036)
ne sont PAS supprimées ici : elles restent en base, inutilisées côté
formulaire, pour ne pas perdre l'historique des fiches déjà signées avec un
Visa — cf. la même décision prise pour d'autres champs retirés cette session
(colonnes mortes conservées, jamais de DROP COLUMN pour une simple
suppression d'usage applicatif).

Aucune nouvelle table, aucune colonne d'identifiant (`_id`) vers
`utilisateur` : ces 3 signatures restent, comme `traitement_signature`
avant elles, associées à un nom (texte), pas à une clé étrangère — la
correspondance avec un utilisateur réel du référentiel (rôles `pilote`,
`chef_de_base`, `consultant_international`, déjà utilisés pour peupler les
listes de sélection du mobile) est une résolution applicative au moment de
la signature, pas une contrainte de schéma. Même niveau de rigueur que
l'existant (`traitement_signature.signataire_nom`), pas un système parallèle
plus strict inventé pour l'occasion.

Revision ID: 0052
Revises: 0051
Create Date: 2026-09-08

"""

import sqlalchemy as sa

from alembic import op

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "prospection", sa.Column("signature_consultant_fao_image", sa.Text(), nullable=True)
    )
    op.add_column(
        "prospection", sa.Column("signature_pilote_image", sa.Text(), nullable=True)
    )
    op.add_column(
        "prospection", sa.Column("signature_chef_base_image", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("prospection", "signature_chef_base_image")
    op.drop_column("prospection", "signature_pilote_image")
    op.drop_column("prospection", "signature_consultant_fao_image")
