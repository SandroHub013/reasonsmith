"""Tests for spec read-whole verification across rulelang and all 7 engines."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from reasonsmith.adapters.rules import RulesAdapter
from reasonsmith.engines.certificate import CertificateEngine
from reasonsmith.engines.counterfactual import CounterfactualProofEngine
from reasonsmith.engines.observed import ObservedEngine
from reasonsmith.engines.probed import ProbedEngine
from reasonsmith.engines.proved import ProvedEngine
from reasonsmith.engines.record import RecordEngine
from reasonsmith.engines.temporal import TemporalProofEngine
from reasonsmith.rulelang import UnsupportedConstructError, verify_parsed_whole
from reasonsmith.spec import Requirement, list_packs, load_pack
from reasonsmith.verdict import Verdict


def test_verify_parsed_whole_accepts_valid_specs() -> None:
    """verify_parsed_whole accepts valid specifications without dropping text."""
    valid_specs = [
        "a and b",
        "a   and   b",
        "(a and b)",
        "((a and b))",
        "a -> b",
        "a <=> b",
        'present(x) and contains(y, "foo")',
        'contains(y, "foo#bar")',
        "x >= 100",
        "always(x >= 100)",
        "counterfactually_invariant(outcome, protected)",
    ]
    for spec in valid_specs:
        verify_parsed_whole(spec)


def test_verify_parsed_whole_refuses_dropped_text_triggers() -> None:
    """verify_parsed_whole refuses specs where text is dropped by Python AST parsing."""
    # Trigger 1: # comments
    with pytest.raises(UnsupportedConstructError, match="was not read whole"):
        verify_parsed_whole("a and b # and c")

    with pytest.raises(UnsupportedConstructError, match="was not read whole"):
        verify_parsed_whole("a and b #")

    with pytest.raises(UnsupportedConstructError, match="was not read whole"):
        verify_parsed_whole("a and b\n# comment")

    # Trigger 2 (not #): implicit string literal concatenation
    with pytest.raises(UnsupportedConstructError, match="was not read whole"):
        verify_parsed_whole('contains(x, "foo" "bar")')


def test_all_shipped_pack_formulas_pass_read_whole_check() -> None:
    """Every shipped pack formula passes verify_parsed_whole."""
    count = 0
    for pack_name in list_packs():
        pack = load_pack(pack_name)
        for req in pack.requirements:
            count += 1
            verify_parsed_whole(req.spec)
    assert count > 0


@pytest.mark.parametrize(
    "engine_cls, formalism, spec, requires",
    [
        (ProvedEngine, "logical", "a and b # and c", ("a", "b", "c")),
        (ProbedEngine, "logical", "a and b # and c", ("a", "b", "c")),
        (ObservedEngine, "temporal", "always(a and b # and c)", ("a", "b", "c")),
        (RecordEngine, "record", "present(a) and present(b) # and present(c)", ("a", "b", "c")),
        (
            CertificateEngine,
            "logical",
            "artifact_logs_deleted_reason_count <= 0 # and c",
            ("artifact_logs_deleted_reason_count",),
        ),
        (
            CounterfactualProofEngine,
            "counterfactual",
            "counterfactually_invariant(approved, protected) # and c",
            ("approved", "protected"),
        ),
        (TemporalProofEngine, "temporal", "always(a and b # and c)", ("a", "b", "c")),
    ],
)
def test_spec_truncation_comment_refused_on_all_seven_engines(
    engine_cls: type, formalism: str, spec: str, requires: tuple[str, ...]
) -> None:
    """A specification truncated by '#' is reported 'not evaluated' on all seven engines."""
    req = Requirement(
        id="test_req",
        source_document="DOC",
        article_clause="1.1",
        verbatim_text="Text",
        stakeholder="Auditor",
        formalism=formalism,
        spec=spec,
        rationale="Rationale",
        requires=requires,
        binding=True,
        scope="",
        domains=(),
        deontic_type="obligation",
        defeasibility="strict",
    )
    sut = RulesAdapter(
        rules=["approved = a and b"],
        variables={
            "a": "bool",
            "b": "bool",
            "c": "bool",
            "approved": "bool",
            "protected": "int",
            "artifact_logs_deleted_reason_count": "int",
        },
    )
    if engine_cls is CertificateEngine:
        mock_art = MagicMock()
        sut.artifact = MagicMock(return_value=mock_art)

    records = [
        {
            "a": True,
            "b": True,
            "c": True,
            "approved": True,
            "protected": 1,
            "artifact_logs_deleted_reason_count": 0,
        }
    ]
    res = engine_cls.evaluate(req, sut, records)

    assert res.verdict == Verdict.INCONCLUSIVE
    assert res.strength is None
    assert res.evidence_summary.startswith("Not evaluated:")


@pytest.mark.parametrize(
    "engine_cls, formalism, spec, requires",
    [
        (ProvedEngine, "logical", 'contains(reason, "foo" "bar")', ("reason",)),
        (ProbedEngine, "logical", 'contains(reason, "foo" "bar")', ("reason",)),
        (ObservedEngine, "logical", 'contains(reason, "foo" "bar")', ("reason",)),
        (RecordEngine, "record", 'present(a) and present(b) "c"', ("a", "b")),
        (
            CertificateEngine,
            "logical",
            'artifact_logs_deleted_reason_count <= 0 "c"',
            ("artifact_logs_deleted_reason_count",),
        ),
        (
            CounterfactualProofEngine,
            "counterfactual",
            'counterfactually_invariant(approved, protected) "c"',
            ("approved", "protected"),
        ),
        (TemporalProofEngine, "temporal", 'always(contains(reason, "foo" "bar"))', ("reason",)),
    ],
)
def test_spec_truncation_second_trigger_refused_on_all_seven_engines(
    engine_cls: type, formalism: str, spec: str, requires: tuple[str, ...]
) -> None:
    """A spec truncated by implicit string concatenation is reported 'not evaluated'."""
    req = Requirement(
        id="test_req",
        source_document="DOC",
        article_clause="1.1",
        verbatim_text="Text",
        stakeholder="Auditor",
        formalism=formalism,
        spec=spec,
        rationale="Rationale",
        requires=requires,
        binding=True,
        scope="",
        domains=(),
        deontic_type="obligation",
        defeasibility="strict",
    )
    sut = RulesAdapter(
        rules=['approved = True', 'reason = "foobar"'],
        variables={
            "a": "bool",
            "b": "bool",
            "approved": "bool",
            "reason": "str",
            "protected": "int",
            "artifact_logs_deleted_reason_count": "int",
        },
    )
    if engine_cls is CertificateEngine:
        mock_art = MagicMock()
        sut.artifact = MagicMock(return_value=mock_art)

    records = [
        {
            "a": True,
            "b": True,
            "approved": True,
            "reason": "foobar",
            "protected": 1,
            "artifact_logs_deleted_reason_count": 0,
        }
    ]
    res = engine_cls.evaluate(req, sut, records)

    assert res.verdict == Verdict.INCONCLUSIVE
    assert res.strength is None
    assert res.evidence_summary.startswith("Not evaluated:")


# --------------------------------------------------------------------------------------------
# What the check must not refuse: the pure syntax `ast.unparse` normalises away
# --------------------------------------------------------------------------------------------

#: A one-duty pack whose spec the test supplies, so that a formula can be put to `load_pack` the
#: way a pack author puts one to it, rather than to `verify_parsed_whole` alone: the refusal is
#: raised out of the loader, and what it costs is the whole pack, not the one duty.
_PACK_TEMPLATE = '''
[pack]
id = "trailing_comma"
title = "Trailing comma probe"
description = "A throwaway pack for one regression test. Its single duty is not domain-limited."

[source]
document = "None — test fixture"
publication = "None"
url = "https://example.invalid/"

[[requirement]]
id = "probe_trailing_comma"
source_document = "None — test fixture"
article_clause = "n/a"
verbatim_text = "Where adverse action is taken, a reason count shall be recorded."
stakeholder = "affected individual"
formalism = "logical"
spec = """SPEC"""
rationale = "The spec under test; what it is written as is the point of each test below."
requires = ["adverse_action_taken", "artifact_logs_deleted_reason_count"]
binding = true
scope = ""
domains = []
deontic_type = "obligation"
defeasibility = "strict"
'''

#: The way a pack author writes a long call in TOML: across lines, with a trailing comma.
#: `ast.unparse` normalises both the line breaks and the comma away, so a token *count* saw one
#: token fewer out than in and refused the whole pack.
TRAILING_COMMA_SPEC = (
    "implies(\n    adverse_action_taken,\n    artifact_logs_deleted_reason_count >= 0,\n)"
)


def _pack_file(tmp_path, spec: str, name: str = "probe.toml"):
    path = tmp_path / name
    path.write_text(_PACK_TEMPLATE.replace("SPEC", spec), encoding="utf-8")
    return path


def test_a_trailing_comma_is_not_dropped_text(tmp_path) -> None:
    """The refusal that blamed an author for text `ast.unparse` normalised away.

    A trailing comma carries no meaning, in Python or in this language, exactly as the redundant
    parentheses the check already exempted carry none. Counting it made `verify_parsed_whole` fire
    on a correct formula — and because the refusal is raised out of `load_pack`, the whole pack
    failed to load and every duty in it left the audit at once.
    """
    verify_parsed_whole(TRAILING_COMMA_SPEC)
    verify_parsed_whole("min(a, b,)")

    pack = load_pack(str(_pack_file(tmp_path, TRAILING_COMMA_SPEC)))

    req = pack.get_requirement("probe_trailing_comma")
    sut = RulesAdapter(
        rules=["adverse_action_taken = True", "artifact_logs_deleted_reason_count = 0"],
        variables={"adverse_action_taken": "bool", "artifact_logs_deleted_reason_count": "int"},
    )
    res = ProvedEngine.evaluate(req, sut, [])

    # It loads *and* it answers: a spec accepted at load and refused at every engine would be the
    # same duty missing from the audit, one layer down. (The rung is `proved` rather than the
    # trace: `engines/observed` hands rtamt the spec as written, and rtamt has no `implies(...)`.)
    assert res.verdict == Verdict.SATISFIED
    assert res.strength is not None


def test_the_exemption_did_not_widen_into_a_hole(tmp_path) -> None:
    """The half that matters: both shapes that really do drop text are still refused, at load.

    The comma is exempt because `unparse` normalises it. A `#` comment and an implicit string
    concatenation are not normalised — they are text the parser discarded — and a check that let
    those through would answer a truncated formula, which is the whole failure it exists to close.
    """
    for spec in (
        "adverse_action_taken # and artifact_logs_deleted_reason_count >= 0",
        "adverse_action_taken and 'foo' 'bar'",
    ):
        with pytest.raises(UnsupportedConstructError, match="was not read whole"):
            verify_parsed_whole(spec)

        with pytest.raises(ValueError, match="was not read whole"):
            load_pack(str(_pack_file(tmp_path, spec, "truncated.toml")))
