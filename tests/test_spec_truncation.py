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
