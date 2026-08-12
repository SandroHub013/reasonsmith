"""Tests for `reasonsmith explain`, the command that shows a clause becoming a formula.

What a reader must not break:
  - Every line the command prints is a field of the pack or a cell of `docs/refinement.md`.
    A test here that asserts a literal the command types itself would defeat the point, so each
    assertion below reads the requirement it explains and looks for *that* requirement's own
    text.
  - The command must work with `docs/` absent, because `docs/` is not in the wheel. It says
    where the record lives instead, and never silently drops the section.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from reasonsmith.cli import main
from reasonsmith.explain import (
    REFINEMENT_ABSENT,
    find_requirement,
    refinement_notes,
    render_explanation,
)
from reasonsmith.spec import list_packs, load_pack

REPO_ROOT = Path(__file__).resolve().parent.parent
PACKS_DIR = REPO_ROOT / "src" / "reasonsmith" / "packs"

SECTIONS = ("CLAUSE", "FORMULA", "RATIONALE", "FRAGMENT", "REQUIRES", "REFINEMENT")


def _shipped():
    return [(name, req) for name in list_packs() for req in load_pack(name).requirements]


@pytest.mark.parametrize("pack_name,req", _shipped(), ids=lambda v: getattr(v, "id", v))
def test_every_shipped_requirement_can_be_explained(pack_name, req, capsys):
    """A duty the command cannot explain is a duty whose translation stays unreadable."""
    assert main(["explain", req.id]) == 0
    out = capsys.readouterr().out
    for section in SECTIONS:
        assert section in out, f"{req.id}: the explanation has no {section} section"
    assert req.spec in out, f"{req.id}: the formula is not printed as authored"
    for signal in req.requires:
        assert signal in out, f"{req.id}: required signal {signal} is not printed"
    assert req.formalism in out
    assert req.article_clause in out


def test_the_explanation_prints_the_requirements_own_fields():
    """Nothing is retyped: the clause, the formula and the rationale come from the pack."""
    req, pack_id = find_requirement("ecoa_reg_b_1002_9_b_2_specific_reasons")
    assert pack_id == "ecoa"
    text = render_explanation(req, pack_id, refinement_notes())
    assert req.verbatim_text.split(". ")[0] in " ".join(text.split())
    assert req.rationale.split(". ")[0] in " ".join(text.split())
    assert req.source_document in text


def test_an_unknown_id_names_the_packs_it_searched(capsys):
    """An id that matches nothing must never print an empty frame."""
    assert main(["explain", "no_such_requirement"]) == 1
    err = capsys.readouterr().err
    assert "no_such_requirement" in err
    for name in list_packs():
        assert name in err
    assert "CLAUSE" not in err


def test_a_pack_that_does_not_load_is_a_usage_error(capsys):
    """`--pack` naming nothing loadable is reported, not raised at the reader."""
    assert main(["explain", "anything", "--pack", "no_such_pack"]) == 1
    assert "no_such_pack" in capsys.readouterr().err


def test_an_external_pack_file_is_searched_by_path(capsys):
    """A pack given as a TOML path works, so an external pack's author can use the command."""
    pack_file = PACKS_DIR / "gdpr.toml"
    req = load_pack(pack_file).requirements[0]
    assert main(["explain", req.id, "--pack", str(pack_file)]) == 0
    assert req.spec in capsys.readouterr().out


def test_the_refinement_section_says_where_the_record_is_when_it_is_absent(tmp_path):
    """`docs/` is not in the wheel, so an installed reader is pointed at the repository."""
    req, pack_id = find_requirement("gdpr_recital71_error_risk_minimised")
    absent = render_explanation(req, pack_id, refinement_notes(tmp_path / "nothing.md"))
    assert "REFINEMENT" in absent
    assert "refinement.md" in absent
    assert REFINEMENT_ABSENT.split(" — ")[0] in " ".join(absent.split())

    present = render_explanation(req, pack_id, refinement_notes())
    assert present != absent, "the record on disk must change what the section says"


def test_the_refinement_notes_read_the_records_fourth_column():
    """The section quotes what the refinement did not capture, not the property beside it."""
    notes = refinement_notes()
    note = notes["gdpr_recital71_error_risk_minimised"]
    assert "not formalised" in note
    assert "always(" not in note, "the third column (the property) is not the fourth"
