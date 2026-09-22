"""equipe unifiée : `equipe_terrestre` + `equipe_aerienne` -> `equipe` + `equipe_membre`

ADR-018 §2, ticket #602. Deux tables asymétriques pour la même notion deviennent une
seule table typée, et les rôles nommés en dur deviennent des lignes de membres.

Avant :

- `equipe_aerienne(chef_de_base_id FK UNIQUE, pilote TEXT, mecanicien TEXT,
  consultant_international TEXT, aeronef_id)` ;
- `equipe_terrestre(chef_equipe_id FK UNIQUE)` ;
- `equipe_aerienne_membre(nom TEXT)` / `equipe_terrestre_membre(nom TEXT)`.

Après :

- `equipe(id, nom, type ∈ {terrestre, aerien}, aeronef_id, actif, …)` ;
- `equipe_membre(equipe_id, user_id, fonction)`, PK `(equipe_id, user_id)`.

Trois points structurants :

1. **Les identifiants d'équipe sont conservés.** Les lignes de `equipe` reprennent les
   `id` des anciennes tables : aucune FK entrante n'a de valeur à réécrire, seule leur
   *cible* change. C'est ce qui rend cette migration tenable malgré son empreinte.
2. **Les membres deviennent des comptes.** `equipe_membre.user_id` est NOT NULL : chaque
   `nom` en texte libre (membres, et rôles `pilote`/`mecanicien`/
   `consultant_international`) donne un compte « à la volée », sur le même principe que
   `POST /users/a-la-volee` : `peut_se_connecter = false` et e-mail généré. Le mot de
   passe, lui, est laissé vide plutôt que haché (hacher en SQL n'a pas de sens) — sans
   conséquence, `POST /auth/login` refusant le compte sur `peut_se_connecter` avant même
   de vérifier le mot de passe. Dédoublonnage par `(équipe, nom normalisé)`, chef
   compris : un même nom présent à la fois comme rôle nommé et comme membre ne crée
   qu'un compte, le rôle nommé l'emportant.
3. **Les FK entrantes deviennent composites et type-sûres.** `(equipe_id, equipe_type)
   -> equipe(id, type)`, la colonne `equipe_type` étant `GENERATED ALWAYS … STORED` à
   partir de la FK : aucune écriture applicative, donc aucune dérive possible. C'est ce
   qui interdit désormais en SQL qu'un `lieu_aerien` pointe vers une équipe terrestre.
   Les noms de contraintes existants (`fk_base_aerienne_equipe_id`,
   `fk_stand_remplissage_equipe_aerienne_id`, …) sont **conservés à l'identique** : les
   dépôts s'en servent pour distinguer une violation métier d'une erreur générique.

Les cardinalités actuelles sont préservées telles quelles : `base_aerienne.equipe_id`
reste UNIQUE (une équipe = une base principale), `poste_acridien.equipe_terrestre_id` et
`stand_remplissage.equipe_aerienne_id` ne le sont pas (équipe mobile, plusieurs stands).

`utilisateur.chef_de_base_id` / `chef_equipe_id` ne sont pas touchés : redondance
assumée avec `equipe_membre(fonction='chef')`, dette explicite (ADR-018 §2).

Revision ID: 0082
Revises: 0081
Create Date: 2026-09-22
"""

import sqlalchemy as sa

from alembic import op

revision = "0082"
down_revision = "0081"
branch_labels = None
depends_on = None


# Vocabulaires figés à la date de cette migration : une migration décrit un état passé,
# elle ne doit pas se mettre à jour toute seule quand `app.models.users.ROLES` évoluera —
# sinon le CHECK qu'elle pose changerait rétroactivement d'une exécution à l'autre.
_ROLES = (
    "prospecteur",
    "verificateur",
    "validation_finale",
    "chef_equipe",
    "agent_encadreur",
    "pilote",
    "mecanicien",
    "chef_de_base",
    "consultant_international",
    "membre",
    "admin",
)
_FONCTIONS_EQUIPE = ("chef", *_ROLES)

# Les quatre tables qui référencent une équipe, avec le type qu'elles imposent et le nom
# de contrainte à préserver (les dépôts lisent ces noms).
_FK_ENTRANTES = (
    ("lieu_aerien", "equipe_aerienne_id", "aerien", "fk_lieu_aerien_equipe_aerienne_id"),
    ("poste_acridien", "equipe_terrestre_id", "terrestre", "fk_poste_acridien_equipe_terrestre_id"),
    ("base_aerienne", "equipe_id", "aerien", "fk_base_aerienne_equipe_id"),
    (
        "stand_remplissage",
        "equipe_aerienne_id",
        "aerien",
        "fk_stand_remplissage_equipe_aerienne_id",
    ),
)


def upgrade() -> None:
    _elargir_roles()
    _creer_tables()
    _migrer_equipes()
    _migrer_membres()
    _retargeter_fk()
    _supprimer_anciennes_tables()


def _elargir_roles() -> None:
    """Ajoute le rôle `membre` au vocabulaire de `utilisateur.role`.

    Les membres d'équipe n'étaient qu'un `nom` : ils deviennent des comptes, et il leur
    faut un rôle. Aucun des rôles existants ne convient — `membre` désigne exactement
    ça : une identité rattachée à une équipe, sans droit applicatif.
    """
    roles = ", ".join(f"'{r}'" for r in _ROLES)
    op.drop_constraint("ck_utilisateur_role", "utilisateur", type_="check")
    op.create_check_constraint("ck_utilisateur_role", "utilisateur", f"role IN ({roles})")


def _creer_tables() -> None:
    fonctions = ", ".join(f"'{f}'" for f in _FONCTIONS_EQUIPE)
    op.create_table(
        "equipe",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nom", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("aeronef_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.CheckConstraint("type IN ('terrestre','aerien')", name="ck_equipe_type"),
        # Redondant avec la PK, et c'est voulu : c'est la cible des FK composites.
        sa.UniqueConstraint("id", "type", name="uq_equipe_id_type"),
        sa.ForeignKeyConstraint(
            ["aeronef_id"], ["aeronef.id"], name="fk_equipe_aeronef_id", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("aeronef_id", name="uq_equipe_aeronef_id"),
        sa.CheckConstraint(
            "aeronef_id IS NULL OR type = 'aerien'", name="ck_equipe_aeronef_reserve_aerien"
        ),
    )
    op.create_table(
        "equipe_membre",
        sa.Column("equipe_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fonction", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("equipe_id", "user_id", name="equipe_membre_pkey"),
        sa.ForeignKeyConstraint(
            ["equipe_id"], ["equipe.id"], name="fk_equipe_membre_equipe_id", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["utilisateur.id"],
            name="fk_equipe_membre_user_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(f"fonction IN ({fonctions})", name="ck_equipe_membre_fonction"),
    )
    # Les deux règles métier des anciens UNIQUE `chef_de_base_id` / `chef_equipe_id` :
    # une équipe a un seul chef, un chef ne dirige qu'une équipe. Index *partiels* —
    # la contrainte ne vaut que pour `fonction = 'chef'`.
    op.create_index(
        "uq_equipe_membre_chef_par_equipe",
        "equipe_membre",
        ["equipe_id"],
        unique=True,
        postgresql_where=sa.text("fonction = 'chef'"),
    )
    op.create_index(
        "uq_equipe_membre_chef_par_utilisateur",
        "equipe_membre",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("fonction = 'chef'"),
    )
    op.create_index("ix_equipe_membre_user_id", "equipe_membre", ["user_id"])


def _migrer_equipes() -> None:
    op.execute(
        """
        INSERT INTO equipe (id, nom, type, aeronef_id, actif, created_at, updated_at)
        SELECT id, nom, 'aerien', aeronef_id, actif, created_at, updated_at
        FROM equipe_aerienne
        """
    )
    op.execute(
        """
        INSERT INTO equipe (id, nom, type, aeronef_id, actif, created_at, updated_at)
        SELECT id, nom, 'terrestre', NULL, actif, created_at, updated_at
        FROM equipe_terrestre
        """
    )


def _migrer_membres() -> None:
    # 1. Les chefs : ils ont déjà un compte, aucune identité à créer.
    #
    # `row_number()` n'est pas une précaution de principe : l'ancien schéma portait deux
    # UNIQUE indépendants, un par table, si bien qu'un même utilisateur pouvait diriger
    # une équipe aérienne *et* une terrestre (il suffisait d'un changement de rôle après
    # coup). Le nouvel index partiel l'interdit. Plutôt que d'avorter la migration ou de
    # perdre l'appartenance, le premier rattachement — le plus ancien — garde la
    # fonction `chef`, les suivants deviennent de simples membres de leur équipe.
    op.execute(
        """
        WITH chefs AS (
            SELECT id AS equipe_id, chef_de_base_id AS user_id, created_at
            FROM equipe_aerienne
            UNION ALL
            SELECT id, chef_equipe_id, created_at FROM equipe_terrestre
        ),
        classes AS (
            SELECT
                equipe_id,
                user_id,
                created_at,
                row_number() OVER (PARTITION BY user_id ORDER BY created_at, equipe_id) AS rang
            FROM chefs
        )
        INSERT INTO equipe_membre (equipe_id, user_id, fonction, created_at)
        SELECT equipe_id, user_id, CASE WHEN rang = 1 THEN 'chef' ELSE 'membre' END, created_at
        FROM classes
        """
    )

    # 2. Tout ce qui n'était qu'un nom : rôles nommés de `equipe_aerienne` et lignes des
    #    deux tables de membres. `priorite` départage un doublon de nom au sein d'une
    #    même équipe — le rôle nommé l'emporte sur le membre anonyme.
    op.execute(
        """
        CREATE TEMP TABLE _membre_texte_libre ON COMMIT DROP AS
        WITH brut AS (
            SELECT id AS equipe_id, pilote AS nom, 'pilote' AS fonction, 1 AS priorite
            FROM equipe_aerienne WHERE pilote IS NOT NULL AND btrim(pilote) <> ''
            UNION ALL
            SELECT id, mecanicien, 'mecanicien', 2
            FROM equipe_aerienne WHERE mecanicien IS NOT NULL AND btrim(mecanicien) <> ''
            UNION ALL
            SELECT id, consultant_international, 'consultant_international', 3
            FROM equipe_aerienne
            WHERE consultant_international IS NOT NULL
              AND btrim(consultant_international) <> ''
            UNION ALL
            SELECT equipe_aerienne_id, nom, 'membre', 4
            FROM equipe_aerienne_membre WHERE btrim(nom) <> ''
            UNION ALL
            SELECT equipe_terrestre_id, nom, 'membre', 4
            FROM equipe_terrestre_membre WHERE btrim(nom) <> ''
        )
        SELECT DISTINCT ON (equipe_id, lower(btrim(nom)))
            equipe_id,
            btrim(nom) AS nom_complet,
            fonction,
            gen_random_uuid() AS user_id
        FROM brut
        -- Le chef a déjà été inséré à l'étape 1, avec son vrai compte : s'il figure
        -- aussi en texte libre (comme pilote, ou dans la liste des membres), lui créer
        -- un second compte dédoublerait son identité dans sa propre équipe.
        WHERE NOT EXISTS (
            SELECT 1
            FROM equipe_membre em
            JOIN utilisateur u ON u.id = em.user_id
            WHERE em.equipe_id = brut.equipe_id
              AND lower(btrim(brut.nom)) IN (
                  lower(btrim(u.prenom || ' ' || u.nom)),
                  lower(btrim(u.nom || ' ' || u.prenom)),
                  lower(btrim(u.nom))
              )
        )
        ORDER BY equipe_id, lower(btrim(nom)), priorite
        """
    )

    # 3. Un compte « identité seule » par nom retenu : `peut_se_connecter = false`,
    #    e-mail généré, `password_hash` vide — donc aucun mot de passe ne peut
    #    correspondre, et `POST /auth/login` refuse de toute façon le compte.
    op.execute(
        """
        INSERT INTO utilisateur (
            id, nom, prenom, email, password_hash, role, actif, peut_se_connecter,
            created_at, updated_at
        )
        SELECT
            user_id,
            CASE
                WHEN position(' ' IN nom_complet) = 0 THEN nom_complet
                ELSE btrim(substr(nom_complet, position(' ' IN nom_complet) + 1))
            END,
            CASE
                WHEN position(' ' IN nom_complet) = 0 THEN ''
                ELSE substr(nom_complet, 1, position(' ' IN nom_complet) - 1)
            END,
            'a-la-volee.' || replace(user_id::text, '-', '') || '@ifvm.invalid',
            '',
            fonction,
            true,
            false,
            now(),
            now()
        FROM _membre_texte_libre
        """
    )
    op.execute(
        """
        INSERT INTO equipe_membre (equipe_id, user_id, fonction, created_at)
        SELECT equipe_id, user_id, fonction, now() FROM _membre_texte_libre
        """
    )


def _retargeter_fk() -> None:
    for table, colonne, type_equipe, nom_fk in _FK_ENTRANTES:
        op.drop_constraint(nom_fk, table, type_="foreignkey")
        op.add_column(
            table,
            sa.Column(
                "equipe_type",
                sa.Text(),
                sa.Computed(
                    f"CASE WHEN {colonne} IS NULL THEN NULL ELSE '{type_equipe}' END",
                    persisted=True,
                ),
                nullable=True,
            ),
        )
        op.create_foreign_key(
            nom_fk,
            table,
            "equipe",
            [colonne, "equipe_type"],
            ["id", "type"],
            ondelete="RESTRICT",
        )
        op.execute(
            f"COMMENT ON COLUMN {table}.equipe_type IS "
            f"'Derivee de {colonne} (GENERATED STORED) : rend la FK vers equipe type-sure.'"
        )


def _supprimer_anciennes_tables() -> None:
    op.drop_table("equipe_aerienne_membre")
    op.drop_table("equipe_terrestre_membre")
    op.drop_table("equipe_aerienne")
    op.drop_table("equipe_terrestre")


def downgrade() -> None:
    """Non réversible, même raison que la migration 0080.

    Le retour en arrière n'est pas une simple recomposition de colonnes : les membres
    en texte libre sont devenus des lignes de `utilisateur` qu'aucun critère ne permet
    de distinguer sûrement des comptes créés à la volée par le formulaire de traitement
    aérien (même forme d'e-mail, même `peut_se_connecter`). Les supprimer risquerait
    d'emporter des comptes légitimes ; les garder laisserait des orphelins. La marche
    arrière est la restauration d'un `pg_dump` antérieur.
    """
    raise NotImplementedError(
        "Migration 0082 non réversible : restaurer un pg_dump antérieur (cf. docstring)."
    )
