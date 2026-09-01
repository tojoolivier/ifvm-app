"""Verifie que l'historique Alembic est une chaine lineaire, sans DB ni import de env.py.

Trois collisions possibles quand deux branches ajoutent une migration en parallele :
  - deux fichiers qui declarent le meme `revision`
  - deux fichiers qui declarent le meme `down_revision` (fork -> 2 heads)
  - plusieurs heads (revisions dont personne n'est l'enfant)

Le 3e cas est celui qui casse `alembic upgrade head` au demarrage du backend :
    Multiple head revisions are present for given argument 'head'

Parse statique volontaire (regex sur les fichiers) : le check doit tourner en CI
sans Postgres ni variables d'environnement applicatives.

Usage:
    python scripts/check_migration_linearity.py [chemin/vers/alembic/versions]
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_VERSIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"

# `revision = "0035"` / `down_revision = None` / `down_revision: str | None = "0034"`
FIELD_RE = r'^{field}(?::[^=]+)?\s*=\s*(?:"([^"]+)"|\'([^\']+)\'|(None))'


def read_field(source: str, field: str) -> str | None:
    match = re.search(FIELD_RE.format(field=field), source, re.MULTILINE)
    if match is None:
        return None
    return match.group(1) or match.group(2)


def main(argv: list[str]) -> int:
    versions_dir = Path(argv[0]) if argv else DEFAULT_VERSIONS_DIR
    if not versions_dir.is_dir():
        print(f"ERREUR: repertoire introuvable: {versions_dir}", file=sys.stderr)
        return 1

    by_revision: dict[str, list[str]] = defaultdict(list)
    by_parent: dict[str, list[str]] = defaultdict(list)
    revisions: set[str] = set()
    errors: list[str] = []

    paths = sorted(p for p in versions_dir.glob("*.py") if p.name != "__init__.py")
    if not paths:
        print(f"ERREUR: aucune migration dans {versions_dir}", file=sys.stderr)
        return 1

    for path in paths:
        source = path.read_text(encoding="utf-8")
        revision = read_field(source, "revision")
        if revision is None:
            errors.append(f"{path.name}: pas de `revision` exploitable")
            continue
        revisions.add(revision)
        by_revision[revision].append(path.name)
        parent = read_field(source, "down_revision")
        if parent is not None:
            by_parent[parent].append(path.name)

    for revision, files in sorted(by_revision.items()):
        if len(files) > 1:
            errors.append(f"revision {revision!r} declaree {len(files)} fois: {', '.join(files)}")

    for parent, files in sorted(by_parent.items()):
        if len(files) > 1:
            errors.append(
                f"fork: {len(files)} migrations ont down_revision={parent!r}: {', '.join(files)}"
            )

    # Une head = une revision dont aucune autre migration n'est l'enfant.
    heads = sorted(revisions - set(by_parent))
    if len(heads) > 1:
        errors.append(
            f"{len(heads)} heads ({', '.join(heads)}) — `alembic upgrade head` echouera au boot"
        )

    # Un down_revision qui ne correspond a aucune revision = chainon manquant.
    for parent, files in sorted(by_parent.items()):
        if parent not in revisions:
            errors.append(
                f"down_revision {parent!r} introuvable (reference par {', '.join(files)})"
            )

    if errors:
        print("Historique Alembic non lineaire :", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        print(
            "\nCorrection: renumeroter la migration en conflit et rechainer son `down_revision`.",
            file=sys.stderr,
        )
        return 1

    print(f"OK: {len(paths)} migrations, chaine lineaire, head unique ({heads[0]}).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
