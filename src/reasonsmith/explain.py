"""How a clause of law became a formula, for one requirement.

What this module is for:
  `reasonsmith explain <requirement-id>` prints the fields a `Requirement` already carries — the
  clause it quotes, the formula it was refined into, the rationale for that reading, the fragment
  the formula belongs to and the signals it needs — beside the record of what the refinement
  deliberately left out. Nothing here computes anything: every line is a field of the pack or a
  cell of `docs/refinement.md`, so this command can only ever restate what the tool already holds.

What a reader must not break:
  - `docs/` is not in the wheel (package data is `table7.toml`, `packs/*.toml` and
    `examples/*.jsonl`), so the refinement record is read when it is there and *named* when it is
    not. This command must keep working for a reader who only ran `pip install reasonsmith`.
    Why this matters: a command that works in the repository and breaks for an installed user
    would send that user looking for a bug in their install.
  - No rung ceiling is printed. Which rung a duty can reach is decided at run time by whichever
    engine served it (`report._engine_ladder`), not by its fragment, and no built-in engine
    declares the fragments it accepts. A table here would be a fourth hand-maintained claim with
    nothing to hold it to the dispatch.
    Why this matters: the whole point of the command is that every line it prints is derived.
"""

from __future__ import annotations

import re
import textwrap
from pathlib import Path

from reasonsmith.spec import Requirement, list_packs, load_pack

#: Where the refinement record lives, from a source checkout. Absent from an installed wheel.
REFINEMENT_PATH = Path(__file__).resolve().parents[2] / "docs" / "refinement.md"

#: Said when the record is not on disk, which is the normal case for an installed package.
REFINEMENT_ABSENT = (
    "docs/refinement.md records what this formalisation does not capture. It is not packaged "
    "in the wheel — read it in the source repository at "
    "https://github.com/eduardstan/reasonsmith/blob/main/docs/refinement.md"
)

_CODE_SPAN = re.compile(r"`([^`]+)`")

_WIDTH = 96


def refinement_notes(path: Path | None = None) -> dict[str, str]:
    """Map requirement id to the record's fourth column — what the refinement did not capture.

    A refinement row's first cell is the citation, a `<br>`, and the requirement id as its only
    code span; that `<br>` is what tells a refinement row from the census tables, whose first cell
    is a backticked classification name. An absent record is an empty mapping, never an error.
    """
    record = REFINEMENT_PATH if path is None else path
    if not record.is_file():
        return {}
    notes: dict[str, str] = {}
    for line in record.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = line.split("|")
        if len(cells) < 6 or "<br>" not in cells[1]:
            continue
        for requirement_id in _CODE_SPAN.findall(cells[1]):
            notes[requirement_id] = cells[4].strip()
    return notes


def find_requirement(
    requirement_id: str, packs: list[str] | None = None
) -> tuple[Requirement, str]:
    """Resolve a requirement id against the named packs, or against every built-in pack.

    Raises `LookupError` naming the packs searched: an id that matches nothing must say what was
    looked in, never print an empty frame.
    """
    searched = packs if packs else list_packs()
    for name in searched:
        for req in load_pack(name).requirements:
            if req.id == requirement_id:
                return req, name
    raise LookupError(
        f"No requirement with id {requirement_id!r}. Searched pack(s): {', '.join(searched)}. "
        "Give --pack with a pack name or a TOML file path to search an external pack, and "
        "`reasonsmith validate-pack <pack>` to list the ids a pack ships."
    )


def _block(text: str) -> list[str]:
    return textwrap.wrap(text, _WIDTH, initial_indent="  ", subsequent_indent="  ") or ["  "]


def render_explanation(req: Requirement, pack_id: str, notes: dict[str, str]) -> str:
    """The whole journey of one duty, in the sections the CLI documents."""
    lines = [
        f"REQUIREMENT {req.id}",
        f"pack: {pack_id}",
        "",
        "CLAUSE",
        f"  {req.source_document} {req.article_clause}",
        *_block(f'"{req.verbatim_text}"'),
        "",
        "FORMULA",
        f"  {req.spec}",
        "",
        "RATIONALE",
        *_block(req.rationale),
        "",
        "FRAGMENT",
        f"  {req.formalism}",
        "",
        # A requirement always names at least one signal — `Requirement.__post_init__` refuses one
        # that names none — so this section has no empty case to word.
        "REQUIRES",
        *(f"  {name}" for name in req.requires),
        "",
        "REFINEMENT",
    ]
    note = notes.get(req.id)
    if note:
        lines.append("  What this formalisation does not capture, from docs/refinement.md:")
        lines += _block(note)
    else:
        lines += _block(REFINEMENT_ABSENT)
    return "\n".join(lines)
