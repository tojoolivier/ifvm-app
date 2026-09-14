"""fiche_vol : bloc de traitement, référentiel base/stand dédié, pesticide+fûts, numérotation

Cahier des charges « Fiche de vol » fourni par le porteur produit (exemple rempli à
l'appui) ; arbitrages du 2026-09-14/15 avec l'utilisateur, en continuité de l'ADR-011.

## Ce que cette migration ajoute

- **`base_aerienne`** : référentiel base principale / base secondaire, une seule table
  auto-référencée (`parent_base_id NULL` = principale, sinon secondaire) plutôt que deux
  tables — même raisonnement que `lieu_aerien.type_lieu` (migration 0047) : les deux
  n'ont que `numero`/`localite`/lat/lon/alt en commun, la hiérarchie en plus.
- **`stand_remplissage`** : référentiel du stand, même forme, sans hiérarchie.
- **`traitement_bloc`** : subdivision de la surface infestée d'un `traitement_aerien`
  donné (« une surface prospectée peut se répartir en un ou plusieurs blocs » — cahier
  des charges). `traitement_rotation.bloc_id` (nullable, N:1) rattache chaque rotation
  à son bloc : un bloc peut être traité en plusieurs rotations (confirmé par
  l'utilisateur), pas l'inverse.
- **`campagne_fiche_vol_compteur`** : compteur continu par campagne pour le nouveau
  format de numéro `NNN-date-equipe-immatriculation` (`NNN` = compteur 3 chiffres,
  jamais réinitialisé en cours de campagne, `equipe` = `base_aerienne.numero`).
  Centralisé dans une table dédiée plutôt qu'un `MAX(compteur)+1` : la saisie étant
  groupée en fin de journée (donc potentiellement hors-ligne), deux appareils
  déconnectés le même jour ne doivent pas pouvoir tirer le même compteur. L'attribution
  définitive du compteur se fait côté serveur (à la création/synchronisation), pas côté
  client — non couvert par cette migration, qui ne fait que poser la colonne et la
  table de verrouillage ; le mécanisme d'incrément atomique est une itération
  applicative (Phase 2).
- **Pesticide + fûts sur `fiche_vol`** : colonnes plates identiques à celles déjà en
  place sur `Prospection` en mode extensif aérien (`pesticide_nom_commercial`,
  `pesticide_quantite_disponible`, `pesticide_quantite_recue`, `futs_disponible`,
  `futs_recues`, `futs_pleins`, `futs_vides`) — même forme que l'existant plutôt qu'un
  format inventé. Hypothèse assumée : un seul produit pesticide par fiche de vol et par
  jour (comme sur `Prospection` et sur l'exemple rempli fourni, une seule ligne
  "Tefu"). `pesticide_quantite_utilisee`/`pesticide_quantite_restante` ne sont **pas**
  des colonnes : dérivées (somme de `traitement_rotation.quantite` des rotations
  couvertes par les vols de la fiche, resp. `disponible - utilisee`) — même philosophie
  que le reste de `fiche_vol` (« rien de dérivable n'est stocké »).
- **`fiche_vol.campagne_id`/`compteur`/`base_id`/`stand_id`** remplacent
  `base_code`/`base_nom`/`base_latitude`/`base_longitude`/`base_altitude`/`stand_nom`/
  `stand_latitude`/`stand_longitude`/`stand_altitude` (relevés ponctuels, ADR-011
  §7.6) par des FK vers les nouveaux référentiels.

## Écart assumé avec le précédent du dépôt — à lire avant de toucher à nouveau ce sujet

Les migrations 0054 (`traitement_aerien_lieux_texte_libre`) et **0063**
(`prospection_base_texte_libre`, la précédente sur cette branche) sont revenues sur le
même choix : imposer une base choisie dans un référentiel synchronisé (`lieu_aerien`,
migration 0047) s'est révélé être une contrainte terrain non voulue, et a été défait
deux fois. Cette migration réintroduit délibérément un référentiel structuré, mais
**pour la fiche de vol uniquement** — décision produit explicite de l'utilisateur,
maintenue en connaissance de ce précédent (voir échange du 2026-09-15). Si le même
problème terrain resurgit ici, le correctif est le même que 0054/0063 : redescendre
`base_id`/`stand_id` en colonnes texte libres, `lieu_aerien`/`base_aerienne`/
`stand_remplissage` restant disponibles sans y être liés par FK.

## Garde-fou données existantes

`fiche_vol` est une table récente (migration 0029) : `campagne_id`, `compteur`,
`base_id`, `stand_id` sont ajoutées nullable puis basculées en NOT NULL uniquement si
la table est vide, sur le même principe que le garde-fou de la migration 0047. Si des
fiches existent déjà, la migration échoue explicitement avec des instructions de
backfill manuel plutôt que d'inventer des valeurs.

Revision ID: 0064
Revises: 0063
Create Date: 2026-09-15
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def _require_empty(conn, table: str, colonnes_bloquees: str) -> None:
    if context.is_offline_mode():
        # Génération SQL hors-ligne : pas de connexion vivante pour compter les
        # lignes. Le garde-fou ne s'applique qu'à une exécution réelle.
        return
    n = conn.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar()
    if n:
        raise RuntimeError(
            f"Migration 0064 : la table `{table}` contient déjà {n} ligne(s). "
            f"Impossible de rendre {colonnes_bloquees} NOT NULL sans backfill manuel. "
            "Backfillez ces colonnes à la main sur les lignes existantes (en créant au "
            "besoin les lignes base_aerienne/stand_remplissage/campagne correspondantes), "
            "puis relancez cette migration — voir la docstring de 0064 pour le détail."
        )


def upgrade() -> None:
    conn = op.get_bind()

    # ==========================================
    # base_aerienne (référentiel, auto-référencé)
    # ==========================================
    op.create_table(
        "base_aerienne",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "parent_base_id",
            UUID(as_uuid=True),
            sa.ForeignKey("base_aerienne.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("localite", sa.String(255), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_base_aerienne_parent_base_id", "base_aerienne", ["parent_base_id"])
    op.execute(
        "COMMENT ON COLUMN base_aerienne.parent_base_id IS "
        "'NULL = base principale, sinon base secondaire de la base référencée. "
        "Un maximum de 2 niveaux (pas de secondaire d''une secondaire) n''est pas "
        "vérifiable par un CHECK inter-lignes — à valider côté application, même limite "
        "documentée pour chef_de_base_id sur traitement_aerien (data-model-traitement-v2.md).'"
    )

    # ==========================================
    # stand_remplissage (référentiel, sans hiérarchie)
    # ==========================================
    op.create_table(
        "stand_remplissage",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("localite", sa.String(255), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=True),
        sa.Column("altitude", sa.Numeric(8, 2), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ==========================================
    # traitement_bloc : subdivision de traitement_aerien
    # ==========================================
    op.create_table(
        "traitement_bloc",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "traitement_aerien_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement_aerien.traitement_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("nom", sa.String(60), nullable=False),
        sa.Column("localite", sa.String(255), nullable=True),
        sa.Column("surface_theorique_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_reelle_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_protegee_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("surface_traitee_ha", sa.Numeric(10, 2), nullable=True),
        sa.Column("largeur_andain_m", sa.Numeric(6, 2), nullable=True),
        sa.Column("interpasse_m", sa.Numeric(6, 2), nullable=True),
        sa.Column("hauteur_vol_min_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("hauteur_vol_max_m", sa.Numeric(5, 2), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.UniqueConstraint("traitement_aerien_id", "numero", name="uq_traitement_bloc_numero"),
    )
    op.create_index(
        "ix_traitement_bloc_traitement_aerien_id", "traitement_bloc", ["traitement_aerien_id"]
    )
    op.execute(
        "COMMENT ON TABLE traitement_bloc IS "
        "'Subdivision de la surface infestee d''un traitement aerien, decidee pour "
        "organiser le traitement. Espece (LMC/NSE/MELANGE) non dupliquee ici : lue par "
        "jointure sur cible.espece (memes 3 valeurs), pour eviter une meme information "
        "reecrite sur chaque bloc d''un traitement.'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_protegee_ha IS 'Renseignee si produit de choc.'"
    )
    op.execute(
        "COMMENT ON COLUMN traitement_bloc.surface_traitee_ha IS "
        "'Renseignee si produit de barriere.'"
    )

    # ==========================================
    # traitement_rotation : rattachement au bloc (1 bloc -> N rotations)
    # ==========================================
    op.add_column(
        "traitement_rotation",
        sa.Column(
            "bloc_id",
            UUID(as_uuid=True),
            sa.ForeignKey("traitement_bloc.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_traitement_rotation_bloc_id", "traitement_rotation", ["bloc_id"])

    # ==========================================
    # campagne_fiche_vol_compteur : verrou d'incrément par campagne
    # ==========================================
    op.create_table(
        "campagne_fiche_vol_compteur",
        sa.Column(
            "campagne_id",
            UUID(as_uuid=True),
            sa.ForeignKey("campagne.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("dernier_compteur", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        "COMMENT ON TABLE campagne_fiche_vol_compteur IS "
        "'Une ligne par campagne ; dernier_compteur incremente atomiquement (verrou de "
        "ligne cote serveur) a chaque nouvelle fiche_vol. Jamais reinitialise en cours de "
        "campagne. Alimentation applicative hors perimetre de cette migration.'"
    )

    # ==========================================
    # fiche_vol : référentiel base/stand, campagne+compteur, pesticide+fûts
    # ==========================================
    op.add_column("fiche_vol", sa.Column("campagne_id", UUID(as_uuid=True), nullable=True))
    op.add_column("fiche_vol", sa.Column("compteur", sa.Integer(), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_id", UUID(as_uuid=True), nullable=True))
    op.add_column("fiche_vol", sa.Column("stand_id", UUID(as_uuid=True), nullable=True))

    _require_empty(conn, "fiche_vol", "campagne_id / compteur / base_id / stand_id")

    op.create_foreign_key(
        "fk_fiche_vol_campagne_id", "fiche_vol", "campagne", ["campagne_id"], ["id"]
    )
    op.create_foreign_key("fk_fiche_vol_base_id", "fiche_vol", "base_aerienne", ["base_id"], ["id"])
    op.create_foreign_key(
        "fk_fiche_vol_stand_id", "fiche_vol", "stand_remplissage", ["stand_id"], ["id"]
    )
    op.alter_column("fiche_vol", "campagne_id", nullable=False)
    op.alter_column("fiche_vol", "compteur", nullable=False)
    op.alter_column("fiche_vol", "base_id", nullable=False)
    op.alter_column("fiche_vol", "stand_id", nullable=False)

    op.create_index("ix_fiche_vol_campagne_id", "fiche_vol", ["campagne_id"])
    op.create_index("ix_fiche_vol_base_id", "fiche_vol", ["base_id"])
    op.create_index("ix_fiche_vol_stand_id", "fiche_vol", ["stand_id"])
    op.create_unique_constraint(
        "uq_fiche_vol_campagne_compteur", "fiche_vol", ["campagne_id", "compteur"]
    )
    op.create_check_constraint("ck_fiche_vol_compteur_positif", "fiche_vol", "compteur > 0")

    op.drop_index("ix_fiche_vol_immatriculation", table_name="fiche_vol")
    op.drop_column("fiche_vol", "base_code")
    op.drop_column("fiche_vol", "base_nom")
    op.drop_column("fiche_vol", "base_latitude")
    op.drop_column("fiche_vol", "base_longitude")
    op.drop_column("fiche_vol", "base_altitude")
    op.drop_column("fiche_vol", "stand_nom")
    op.drop_column("fiche_vol", "stand_latitude")
    op.drop_column("fiche_vol", "stand_longitude")
    op.drop_column("fiche_vol", "stand_altitude")
    op.create_index("ix_fiche_vol_immatriculation", "fiche_vol", ["immatriculation"])

    op.add_column("fiche_vol", sa.Column("pesticide_nom_commercial", sa.Text(), nullable=True))
    op.add_column(
        "fiche_vol", sa.Column("pesticide_quantite_disponible", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column(
        "fiche_vol", sa.Column("pesticide_quantite_recue", sa.Numeric(10, 2), nullable=True)
    )
    op.add_column("fiche_vol", sa.Column("futs_disponible", sa.Integer(), nullable=True))
    op.add_column("fiche_vol", sa.Column("futs_recues", sa.Integer(), nullable=True))
    op.add_column("fiche_vol", sa.Column("futs_pleins", sa.Integer(), nullable=True))
    op.add_column("fiche_vol", sa.Column("futs_vides", sa.Integer(), nullable=True))

    op.execute(
        "COMMENT ON COLUMN fiche_vol.pesticide_nom_commercial IS "
        "'Meme forme que Prospection.pesticide_nom_commercial (mode extensif aerien) : "
        "un seul produit assume par fiche de vol et par jour, pas de table 1-N. A "
        "reconsiderer si le besoin d''un aeronef utilisant plusieurs produits le meme "
        "jour est confirme.'"
    )
    op.execute(
        "COMMENT ON COLUMN fiche_vol.compteur IS "
        "'Fragment NNN du numero_fiche (format NNN-date-equipe-immatriculation), "
        "unique par campagne (uq_fiche_vol_campagne_compteur), jamais reinitialise en "
        "cours de campagne. equipe = base_aerienne.numero de fiche_vol.base_id.'"
    )


def downgrade() -> None:
    op.drop_column("fiche_vol", "futs_vides")
    op.drop_column("fiche_vol", "futs_pleins")
    op.drop_column("fiche_vol", "futs_recues")
    op.drop_column("fiche_vol", "futs_disponible")
    op.drop_column("fiche_vol", "pesticide_quantite_recue")
    op.drop_column("fiche_vol", "pesticide_quantite_disponible")
    op.drop_column("fiche_vol", "pesticide_nom_commercial")

    op.add_column("fiche_vol", sa.Column("stand_altitude", sa.Numeric(8, 2), nullable=True))
    op.add_column("fiche_vol", sa.Column("stand_longitude", sa.Numeric(11, 8), nullable=True))
    op.add_column("fiche_vol", sa.Column("stand_latitude", sa.Numeric(10, 8), nullable=True))
    op.add_column("fiche_vol", sa.Column("stand_nom", sa.String(255), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_altitude", sa.Numeric(8, 2), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_longitude", sa.Numeric(11, 8), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_latitude", sa.Numeric(10, 8), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_nom", sa.String(255), nullable=True))
    op.add_column("fiche_vol", sa.Column("base_code", sa.String(20), nullable=True))

    op.drop_constraint("ck_fiche_vol_compteur_positif", "fiche_vol", type_="check")
    op.drop_constraint("uq_fiche_vol_campagne_compteur", "fiche_vol", type_="unique")
    op.drop_index("ix_fiche_vol_stand_id", table_name="fiche_vol")
    op.drop_index("ix_fiche_vol_base_id", table_name="fiche_vol")
    op.drop_index("ix_fiche_vol_campagne_id", table_name="fiche_vol")
    op.drop_constraint("fk_fiche_vol_stand_id", "fiche_vol", type_="foreignkey")
    op.drop_constraint("fk_fiche_vol_base_id", "fiche_vol", type_="foreignkey")
    op.drop_constraint("fk_fiche_vol_campagne_id", "fiche_vol", type_="foreignkey")
    op.drop_column("fiche_vol", "stand_id")
    op.drop_column("fiche_vol", "base_id")
    op.drop_column("fiche_vol", "compteur")
    op.drop_column("fiche_vol", "campagne_id")

    op.drop_table("campagne_fiche_vol_compteur")

    op.drop_index("ix_traitement_rotation_bloc_id", table_name="traitement_rotation")
    op.drop_column("traitement_rotation", "bloc_id")

    op.drop_index("ix_traitement_bloc_traitement_aerien_id", table_name="traitement_bloc")
    op.drop_table("traitement_bloc")

    op.drop_table("stand_remplissage")

    op.drop_index("ix_base_aerienne_parent_base_id", table_name="base_aerienne")
    op.drop_table("base_aerienne")
