"""bases aériennes/stands, équipe (FK utilisateur), pesticides & rotations

Traduction en schéma de la décision produit "bases aériennes / stands / équipe /
pesticides" (interview + modélisation ER validées avec l'utilisateur) :

- `lieu_aerien` : nouvelle table référentielle unique, typée par `type_lieu` IN
  ('principale','secondaire','stand') plutôt que trois tables séparées — même
  choix que `prospection.type_prospection` (ADR-006). Durable, indépendante de
  la campagne, soft-delete via `actif` (pattern déjà en place pour
  pesticide/culture/poste_acridien/station_fixe).
- `utilisateur.peut_se_connecter` : distingue les comptes applicatifs des
  comptes créés à la volée depuis une fiche de traitement (pilote, mécanicien,
  consultant) pour identifier une personne sans lui donner d'accès. Rôle
  `consultant_international` ajouté au vocabulaire `ROLES`.
- `prospection.lieu_base_id` (nullable, remplace `base`/`base_secondaire` en
  texte libre) : nullable car la prospection extensive aérienne "généralisée"
  (début/fin de campagne) n'est rattachée à aucune base. Pas de base
  secondaire côté prospection — ce concept n'existe que pour le traitement.
- `traitement_aerien` : `lieu_base_principale_id` (NOT NULL, aucune exception
  pour le traitement contrairement à la prospection), `lieu_stand_id` et
  `lieu_base_secondaire_id` (nullable — absence de stand = ravitaillement fait
  directement à une des deux bases). `pilote_id`/`mecanicien_id`/
  `consultant_id` remplacent les colonnes texte libres `pilote`/`mecanicien`/
  `consultant_international` ; `chef_de_base_id` reste inchangée (déjà NOT
  NULL). CHECK `ck_traitement_aerien_roles_distincts` : chef de base, pilote
  et mécanicien deux-à-deux distincts (consultant exempté). `immatricule_aeronef`
  devient NOT NULL. `total_pesticide_l` se scinde en deux cumuls par unité
  (`total_pesticide_l`/`total_pesticide_kg`, jamais additionnés ensemble) ;
  `surface_traitee_ha` devient un champ dérivé (somme des rotations), toujours
  stocké/recalculé à l'écriture — même philosophie que l'existant, pas un
  changement de doctrine.
- `traitement_rotation` : `quantite_l` renommée `quantite` + `unite` ajoutée
  (CHECK IN ('L','kg')) ; `surface_ha` ajoutée (superficie couverte par cette
  rotation) ; `heure_ouverture_vanne`/`heure_fermeture_vanne` ajoutées,
  distinctes de `heure_debut`/`heure_fin` existants qui bornent la rotation
  entière (mise en place + application) — la durée d'application, la durée
  totale et la durée de mise en place se dérivent de ces 4 horodatages côté
  application, aucune des trois n'est stockée. `numero_cuve` n'est plus saisi
  librement : dérivé de `numero` côté application (colonne inchangée en base).

Garde-fou données existantes : les nouvelles colonnes FK/obligatoires sans
valeur par défaut sensée (`lieu_base_principale_id`, `pilote_id`,
`mecanicien_id`, `immatricule_aeronef` sur `traitement_aerien` ;
`surface_ha`, `heure_ouverture_vanne`, `heure_fermeture_vanne` sur
`traitement_rotation`) ne peuvent pas être back-fillées automatiquement avec
une valeur correcte. Cette migration ajoute ces colonnes nullable puis les
bascule en NOT NULL uniquement si la table est vide ; si des lignes existent
déjà (un environnement avec des traitements aériens antérieurs à cette
migration), elle échoue explicitement avec un message d'instructions plutôt
que d'inventer des valeurs ou de laisser la contrainte non appliquée en
silence. `quantite`/`unite` sur `traitement_rotation` sont, elles,
back-fillées automatiquement (`quantite = quantite_l`, `unite = 'L'`) car
toutes les rotations existantes étaient implicitement en litres.

Revision ID: 0046
Revises: 0045
Create Date: 2026-09-03

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import context, op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def _require_empty(conn, table: str, colonnes_bloquees: str) -> None:
    if context.is_offline_mode():
        # Génération de SQL hors-ligne (`alembic upgrade --sql`) : pas de
        # connexion vivante pour compter les lignes, donc pas de garde
        # possible ici. Le garde-fou ne s'applique qu'à une exécution réelle
        # (`alembic upgrade`) contre une base connectée.
        return
    n = conn.execute(sa.text(f"SELECT count(*) FROM {table}")).scalar()
    if n:
        raise RuntimeError(
            f"Migration 0046 : la table `{table}` contient déjà {n} ligne(s). "
            f"Impossible de rendre {colonnes_bloquees} NOT NULL sans backfill manuel. "
            "Backfillez ces colonnes à la main sur les lignes existantes, puis relancez "
            "cette migration (ou adaptez-la) — voir la docstring de 0046 pour le détail."
        )


def upgrade() -> None:
    conn = op.get_bind()

    # ==========================================
    # lieu_aerien (référentiel)
    # ==========================================
    op.create_table(
        "lieu_aerien",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("type_lieu", sa.Text(), nullable=False),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=False),
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
        sa.CheckConstraint(
            "type_lieu IN ('principale','secondaire','stand')", name="ck_lieu_aerien_type"
        ),
    )

    # ==========================================
    # utilisateur : compte non-authentifiable
    # ==========================================
    op.add_column(
        "utilisateur",
        sa.Column("peut_se_connecter", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # ==========================================
    # prospection : base principale (FK, nullable) remplace base/base_secondaire (texte)
    # ==========================================
    op.add_column(
        "prospection",
        sa.Column(
            "lieu_base_id", UUID(as_uuid=True), sa.ForeignKey("lieu_aerien.id"), nullable=True
        ),
    )
    op.drop_column("prospection", "base")
    op.drop_column("prospection", "base_secondaire")

    # ==========================================
    # traitement_aerien : lieux + équipe (FK) + cumuls pesticide/surface
    # ==========================================
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_base_principale_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lieu_aerien.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_stand_id", UUID(as_uuid=True), sa.ForeignKey("lieu_aerien.id"), nullable=True
        ),
    )
    op.add_column(
        "traitement_aerien",
        sa.Column(
            "lieu_base_secondaire_id",
            UUID(as_uuid=True),
            sa.ForeignKey("lieu_aerien.id"),
            nullable=True,
        ),
    )
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
    op.add_column(
        "traitement_aerien",
        sa.Column("total_pesticide_kg", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.execute("UPDATE traitement_aerien SET total_pesticide_l = 0 WHERE total_pesticide_l IS NULL")
    op.execute(
        "UPDATE traitement_aerien SET surface_traitee_ha = 0 WHERE surface_traitee_ha IS NULL"
    )
    op.alter_column("traitement_aerien", "total_pesticide_l", nullable=False, server_default="0")
    op.alter_column("traitement_aerien", "surface_traitee_ha", nullable=False, server_default="0")

    _require_empty(
        conn,
        "traitement_aerien",
        "lieu_base_principale_id / pilote_id / mecanicien_id / immatricule_aeronef",
    )
    op.alter_column("traitement_aerien", "lieu_base_principale_id", nullable=False)
    op.alter_column("traitement_aerien", "pilote_id", nullable=False)
    op.alter_column("traitement_aerien", "mecanicien_id", nullable=False)
    op.alter_column("traitement_aerien", "immatricule_aeronef", nullable=False)

    op.drop_column("traitement_aerien", "pilote")
    op.drop_column("traitement_aerien", "mecanicien")
    op.drop_column("traitement_aerien", "consultant_international")

    op.create_check_constraint(
        "ck_traitement_aerien_roles_distincts",
        "traitement_aerien",
        "chef_de_base_id <> pilote_id "
        "AND chef_de_base_id <> mecanicien_id "
        "AND pilote_id <> mecanicien_id",
    )

    # ==========================================
    # traitement_rotation : unité, surface, vanne
    # ==========================================
    op.add_column("traitement_rotation", sa.Column("quantite", sa.Numeric(10, 2), nullable=True))
    op.execute("UPDATE traitement_rotation SET quantite = quantite_l")
    op.alter_column("traitement_rotation", "quantite", nullable=False)
    op.drop_column("traitement_rotation", "quantite_l")

    op.add_column(
        "traitement_rotation",
        sa.Column("unite", sa.String(2), nullable=False, server_default="L"),
    )
    op.create_check_constraint(
        "ck_traitement_rotation_unite", "traitement_rotation", "unite IN ('L','kg')"
    )

    op.add_column("traitement_rotation", sa.Column("surface_ha", sa.Numeric(10, 2), nullable=True))
    op.add_column(
        "traitement_rotation", sa.Column("heure_ouverture_vanne", sa.Time(), nullable=True)
    )
    op.add_column(
        "traitement_rotation", sa.Column("heure_fermeture_vanne", sa.Time(), nullable=True)
    )

    _require_empty(
        conn,
        "traitement_rotation",
        "surface_ha / heure_ouverture_vanne / heure_fermeture_vanne",
    )
    op.alter_column("traitement_rotation", "surface_ha", nullable=False)
    op.alter_column("traitement_rotation", "heure_ouverture_vanne", nullable=False)
    op.alter_column("traitement_rotation", "heure_fermeture_vanne", nullable=False)

    op.create_check_constraint(
        "ck_traitement_rotation_vanne_ordre",
        "traitement_rotation",
        "heure_debut <= heure_ouverture_vanne "
        "AND heure_ouverture_vanne <= heure_fermeture_vanne "
        "AND heure_fermeture_vanne <= heure_fin",
    )
    op.create_unique_constraint(
        "uq_traitement_rotation_numero_cuve",
        "traitement_rotation",
        ["traitement_aerien_id", "numero_cuve"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_traitement_rotation_numero_cuve", "traitement_rotation", type_="unique")
    op.drop_constraint("ck_traitement_rotation_vanne_ordre", "traitement_rotation", type_="check")
    op.drop_column("traitement_rotation", "heure_fermeture_vanne")
    op.drop_column("traitement_rotation", "heure_ouverture_vanne")
    op.drop_column("traitement_rotation", "surface_ha")

    op.drop_constraint("ck_traitement_rotation_unite", "traitement_rotation", type_="check")
    op.drop_column("traitement_rotation", "unite")

    op.add_column("traitement_rotation", sa.Column("quantite_l", sa.Numeric(10, 2), nullable=True))
    op.execute("UPDATE traitement_rotation SET quantite_l = quantite")
    op.alter_column("traitement_rotation", "quantite_l", nullable=False)
    op.drop_column("traitement_rotation", "quantite")

    op.drop_constraint("ck_traitement_aerien_roles_distincts", "traitement_aerien", type_="check")

    op.add_column(
        "traitement_aerien", sa.Column("consultant_international", sa.String(255), nullable=True)
    )
    op.add_column("traitement_aerien", sa.Column("mecanicien", sa.String(255), nullable=True))
    op.add_column("traitement_aerien", sa.Column("pilote", sa.String(255), nullable=True))

    op.alter_column("traitement_aerien", "immatricule_aeronef", nullable=True)
    op.alter_column("traitement_aerien", "surface_traitee_ha", nullable=True, server_default=None)
    op.alter_column("traitement_aerien", "total_pesticide_l", nullable=True, server_default=None)

    op.drop_column("traitement_aerien", "total_pesticide_kg")
    op.drop_column("traitement_aerien", "consultant_id")
    op.drop_column("traitement_aerien", "mecanicien_id")
    op.drop_column("traitement_aerien", "pilote_id")
    op.drop_column("traitement_aerien", "lieu_base_secondaire_id")
    op.drop_column("traitement_aerien", "lieu_stand_id")
    op.drop_column("traitement_aerien", "lieu_base_principale_id")

    op.add_column("prospection", sa.Column("base_secondaire", sa.Text(), nullable=True))
    op.add_column("prospection", sa.Column("base", sa.Text(), nullable=True))
    op.drop_column("prospection", "lieu_base_id")

    op.drop_column("utilisateur", "peut_se_connecter")

    op.drop_table("lieu_aerien")
