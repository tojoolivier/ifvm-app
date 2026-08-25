"""Le référentiel des stades devient l'autorité, grilles de saisie comprises (#201).

Avant : `prospection_capture.stade` était contraint par `ck_prospection_capture_stade`,
qui énumérait à la main le domaine que `code_stade` contenait déjà — deux autorités que
rien ne synchronisait. Le mobile, qui portait sa propre troisième liste, envoyait des
sous-stades A3 absents du CHECK ; l'insertion échouait, et le backend traduisait cette
violation en « station_id n'existe pas ».

Après, deux tables au lieu d'une, parce qu'un stade et sa place dans une grille sont
deux faits distincts :

- `stade` — le vocabulaire : un code, un libellé. C'est ce que
  `prospection_capture.stade` référence par clé étrangère.
- `code_stade` — où ce code apparaît à la saisie : catégorie, sexe, espèce, ordre. Un
  même code y figure plusieurs fois (A1 est un stade femelle *et* mâle ; L1 vaut pour
  les deux espèces), ce que l'ancien `UNIQUE (code)` interdisait. C'est cette table que
  les tablettes synchronisent et à partir de laquelle elles construisent leurs grilles.

`espece = NULL` : applicable aux deux espèces. `sexe = NULL` : stade larvaire, non sexé.

Les listes sont recopiées ici plutôt qu'importées d'`app.domain.stades` : une migration
est un instantané figé et ne doit pas changer de sens quand le code évolue.

Revision ID: 0030
Revises: 0029
"""

import sqlalchemy as sa

from alembic import op

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None

VOCABULAIRE = [
    ("A1", "Imago stade A1"),
    ("A2", "Imago stade A2"),
    ("A3", "Imago stade A3"),
    ("A3-1/4", "Imago stade A3 ¼"),
    ("A3-1/2", "Imago stade A3 ½"),
    ("A3-3/4", "Imago stade A3 ¾"),
    ("A3-4/4", "Imago stade A3 4/4"),
    ("A4", "Imago stade A4"),
    ("A5", "Imago stade A5"),
    ("A234", "Imago stades A2-A3-A4 groupés"),
    *((f"L{n}", f"Larve stade L{n}") for n in range(1, 8)),
]

_LIBELLES = dict(VOCABULAIRE)
_FEMELLES = ["A1", "A2", "A3", "A3-1/4", "A3-1/2", "A3-3/4", "A3-4/4", "A4", "A5"]
_MALES = ["A1", "A234", "A5"]

# (code, categorie, sexe, espece, libelle, ordre)
GRILLES = (
    [(c, "imago", "F", None, f"♀ {_LIBELLES[c]}", i) for i, c in enumerate(_FEMELLES)]
    + [(c, "imago", "M", None, f"♂ {_LIBELLES[c]}", i) for i, c in enumerate(_MALES)]
    + [
        (f"L{n}", "larve", None, None if n <= 5 else "NSE", _LIBELLES[f"L{n}"], n - 1)
        for n in range(1, 8)
    ]
)

# Codes mâles hérités du premier modèle (un suffixe « b » par stade), remplacés par le
# stade groupé A234. Conservés inactifs : des tablettes les ont déjà synchronisés.
CODES_INACTIFS = ["A1b", "A2b", "A5b"]

ANCIEN_CHECK = """
    ALTER TABLE prospection_capture
    ADD CONSTRAINT ck_prospection_capture_stade
    CHECK (
        stade IN (
            'A1', 'A2', 'A3', 'A4', 'A5', 'A1b', 'A2b', 'A5b',
            'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'
        )
    )
"""


def upgrade() -> None:
    op.create_table(
        "stade",
        sa.Column("code", sa.Text(), primary_key=True),
        sa.Column("libelle", sa.Text(), nullable=False),
        sa.Column("actif", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    for code, libelle in VOCABULAIRE:
        op.execute(
            sa.text(
                "INSERT INTO stade (code, libelle) VALUES (:code, :libelle) "
                "ON CONFLICT (code) DO NOTHING"
            ).bindparams(code=code, libelle=libelle)
        )
    for code in CODES_INACTIFS:
        op.execute(
            sa.text(
                "INSERT INTO stade (code, libelle, actif) "
                "VALUES (:code, :code, false) ON CONFLICT (code) DO NOTHING"
            ).bindparams(code=code)
        )

    op.add_column("code_stade", sa.Column("categorie", sa.Text(), nullable=True))
    op.add_column("code_stade", sa.Column("sexe", sa.Text(), nullable=True))
    op.add_column("code_stade", sa.Column("ordre", sa.Integer(), nullable=True))
    op.alter_column("code_stade", "espece", existing_type=sa.Text(), nullable=True)

    # Un même code apparaît désormais dans plusieurs grilles : l'unicité porte sur la
    # place dans la grille, plus sur le code seul.
    op.drop_constraint("code_stade_code_key", "code_stade", type_="unique")
    op.execute("DELETE FROM code_stade")

    for code, categorie, sexe, espece, libelle, ordre in GRILLES:
        op.execute(
            sa.text(
                "INSERT INTO code_stade (code, categorie, sexe, espece, libelle, ordre) "
                "VALUES (:code, :categorie, :sexe, :espece, :libelle, :ordre)"
            ).bindparams(
                code=code,
                categorie=categorie,
                sexe=sexe,
                espece=espece,
                libelle=libelle,
                ordre=ordre,
            )
        )

    op.alter_column("code_stade", "categorie", existing_type=sa.Text(), nullable=False)
    op.alter_column("code_stade", "ordre", existing_type=sa.Integer(), nullable=False)
    op.create_check_constraint(
        "ck_code_stade_categorie", "code_stade", "categorie IN ('imago', 'larve')"
    )
    op.create_check_constraint("ck_code_stade_sexe", "code_stade", "sexe IN ('F', 'M')")
    op.create_foreign_key("fk_code_stade_code", "code_stade", "stade", ["code"], ["code"])
    # NULLS NOT DISTINCT : sans cela, `espece IS NULL` échapperait à l'unicité et un même
    # stade pourrait être semé deux fois dans la même grille.
    op.execute(
        "ALTER TABLE code_stade ADD CONSTRAINT uq_code_stade_grille "
        "UNIQUE NULLS NOT DISTINCT (code, categorie, sexe, espece)"
    )

    op.drop_constraint("ck_prospection_capture_stade", "prospection_capture", type_="check")
    op.create_foreign_key(
        "fk_prospection_capture_stade", "prospection_capture", "stade", ["stade"], ["code"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_prospection_capture_stade", "prospection_capture", type_="foreignkey")
    op.execute(ANCIEN_CHECK)

    op.drop_constraint("uq_code_stade_grille", "code_stade", type_="unique")
    op.drop_constraint("fk_code_stade_code", "code_stade", type_="foreignkey")
    op.drop_constraint("ck_code_stade_sexe", "code_stade", type_="check")
    op.drop_constraint("ck_code_stade_categorie", "code_stade", type_="check")

    op.execute("DELETE FROM code_stade")
    for code, libelle in VOCABULAIRE:
        if "/" in code or code == "A234":
            continue
        espece = "NSE" if code.startswith("L") else "LMC"
        op.execute(
            sa.text(
                "INSERT INTO code_stade (code, espece, libelle) VALUES (:code, :espece, :libelle)"
            ).bindparams(code=code, espece=espece, libelle=libelle)
        )

    op.drop_column("code_stade", "ordre")
    op.drop_column("code_stade", "sexe")
    op.drop_column("code_stade", "categorie")
    op.alter_column("code_stade", "espece", existing_type=sa.Text(), nullable=False)
    op.create_unique_constraint("code_stade_code_key", "code_stade", ["code"])

    op.drop_table("stade")
