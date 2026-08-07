"""Every rung that counts a trigger counts the same triggers for the same trace.

What this module is for:
  `report.not_evaluated_for_unreachable_trigger` takes a duty out of the audit entirely when
  nothing in an engine's evidence made the implication's antecedent true. Which records made it
  true is therefore not a detail of one engine: it decides whether a binding duty is answered at
  all, and two rungs disagreeing about it means the same log is audited or not audited depending
  on which engine the ladder happened to reach.

  The certificate rung read the antecedent's *object* — `eval_expression(...) is True` — where its
  sibling in `engines/observed.py` read its *value*. So a trigger logged as `1` rather than `True`
  — a JSONL log, a pandas column, a SQL `TINYINT`, a numpy output — was counted as never fired,
  and the engine printed a sentence saying nothing made the antecedent true about a trace whose
  every record did, having evaluated that same implication with the antecedent true one line
  above.

What a reader must not break:
  The shape of this test is the point, and it is the shape
  `test_the_solvers_fold_is_the_interpreters_fold` already gives `contains()`: it is
  **differential**, across the rungs, over one trace. A test pinning `certificate.py` alone would
  not have caught this defect, because the sibling site was already correct — what was wrong was
  that the two disagreed. Adding a rung that counts triggers means adding it here.

  `proved` is deliberately absent: it counts over the encoded input space rather than over a
  trace, so there is no logged value whose Python type could move its answer.
"""

from __future__ import annotations

import pytest
from nesyarena.adapters.base import ReferenceAdapter
from nesyarena.suts import ExactWMC

from reasonsmith import demo
from reasonsmith.engines.certificate import CertificateEngine
from reasonsmith.engines.observed import ObservedEngine
from reasonsmith.engines.probed import ProbedEngine
from reasonsmith.report import VACUOUS_TRIGGER_KEY
from reasonsmith.rulelang import (
    eval_expression,
    implication_antecedent,
    kleene_value,
    parse_property,
)
from reasonsmith.spec import Requirement
from reasonsmith.verdict import Strength, Verdict

TRIGGER = "adverse_action_taken"
COUNT = "artifact_logs_deleted_reason_count"
DUTY = f"{TRIGGER} -> ({COUNT} >= 0)"

#: The two ways the same fact reaches a decision record. Under the language's own reading
#: (`rulelang.kleene_value`) they are the same truth value; only their Python type differs.
TRUE_VALUES = [True, 1]


def _req() -> Requirement:
    return Requirement(
        id="trigger_differential",
        source_document="Internal Policy",
        article_clause="Section 1.1",
        verbatim_text="Where adverse action is taken, the reasons given shall be all the reasons.",
        stakeholder="Compliance",
        formalism="logical",
        spec=DUTY,
        rationale="Why this duty exists, in English.",
        requires=(TRIGGER, COUNT),
        binding=True,
        scope="",
        domains=(),
        deontic_type="obligation",
        defeasibility="strict",
    )


class _LoggedCredit:
    """A log-only creditor whose adverse-action flag is whatever the test hands it."""

    system_domains = ("consumer-credit",)

    def __init__(self, flag: object):
        self._flag = flag

    def capabilities(self) -> set[str]:
        return {"decision_id", TRIGGER, COUNT}

    def decisions(self) -> list[dict]:
        return [
            {"decision_id": "APP-1042", TRIGGER: self._flag, COUNT: 0},
            {"decision_id": "APP-1043", TRIGGER: self._flag, COUNT: 0},
        ]

    def decide(self, case: dict) -> dict:
        return {**case, TRIGGER: self._flag, COUNT: 0}

    def logic(self):
        return None


class _CertifiedCredit(_LoggedCredit):
    """The same trace with an inference artefact behind each decision, which is the rung's gate."""

    def decisions(self) -> list[dict]:
        return [
            {"decision_id": case.case_id, TRIGGER: self._flag, COUNT: 0}
            for case in demo.DEPLOYED_CASES
        ]

    def artifact(self, decision: dict) -> dict | None:
        for case in demo.DEPLOYED_CASES:
            if case.case_id == decision.get("decision_id"):
                return {
                    "program": case.program,
                    "base": case.base,
                    "query": case.query,
                    "adapter": ReferenceAdapter(ExactWMC()),
                    "exact_depth": 1,
                    "monotone": True,
                    "labels": case.labels,
                }
        return None


#: One entry per rung that counts a trigger over a trace, with the system that rung can read.
RUNGS = {
    "observed": (ObservedEngine, _LoggedCredit),
    "probed": (ProbedEngine, _LoggedCredit),
    "certificate": (CertificateEngine, _CertifiedCredit),
}


@pytest.mark.parametrize("value", TRUE_VALUES, ids=["bool", "int"])
@pytest.mark.parametrize("rung", sorted(RUNGS))
def test_no_rung_calls_a_trigger_unreachable_that_the_language_reads_as_fired(rung, value):
    """The invariant that crosses the rungs, and the one the defect broke.

    Every record of this trace makes the antecedent true under `kleene_value`, the reading the
    implication itself is evaluated under. So no rung may take the duty out of the audit as an
    unreachable trigger, and none may print the sentence saying nothing made the antecedent true.

    It is stated as a prohibition rather than as an equality of verdicts because the rungs do not
    all *admit* an integer-valued Boolean atom: `observed` and `probed` refuse the formula for a
    kind that the trace establishes as a number, which is a stated refusal about the whole
    property and names itself as one. Refusing to answer is honest; answering with a false
    sentence about the trace is what this closes.
    """
    engine, system_cls = RUNGS[rung]
    system = system_cls(value)
    result = engine.evaluate(_req(), system, list(system.decisions()))

    assert VACUOUS_TRIGGER_KEY not in result.details, f"{rung}, trigger logged as {value!r}"
    assert "made its antecedent" not in result.evidence_summary


def test_the_certificate_rung_answers_a_bool_and_an_int_trigger_alike():
    """The witness itself: the rung that does admit both must not tell them apart.

    Same system, same trace, same duty — only the Python type of one logged flag moves. Before the
    fix the `int` run left the audit entirely, `inconclusive` with no strength, while the `bool`
    run came back `satisfied` at `probed`.
    """
    answers = []
    for value in TRUE_VALUES:
        system = _CertifiedCredit(value)
        result = CertificateEngine.evaluate(_req(), system, list(system.decisions()))
        answers.append((result.verdict, result.strength))

    assert answers[0] == (Verdict.SATISFIED, Strength.PROBED)
    assert answers[0] == answers[1], f"bool answered {answers[0]}, int answered {answers[1]}"


def test_a_trigger_no_record_makes_true_is_still_reported_as_never_fired():
    """The control: the guard must survive the fix, or a vacuous pass comes back with it."""
    for value in (False, 0):
        system = _CertifiedCredit(value)
        result = CertificateEngine.evaluate(_req(), system, list(system.decisions()))

        assert (result.verdict, result.strength) == (Verdict.INCONCLUSIVE, None)
        assert result.details[VACUOUS_TRIGGER_KEY]["antecedent"] == TRIGGER


def test_the_reading_a_rung_must_use_is_the_language_s_own():
    """Why `is True` was the defect, stated against the language rather than against an engine.

    `eval_expression` on a bare name returns the record's value verbatim. The truth of that value
    is `kleene_value`'s answer, and it is the answer the whole implication is already evaluated
    under — which is how one engine came to contradict itself about one record.
    """
    node = implication_antecedent(parse_property(DUTY))
    for value in TRUE_VALUES:
        raw = eval_expression(node, {TRIGGER: value, COUNT: 0})
        assert kleene_value(raw) is True
    assert eval_expression(node, {TRIGGER: 1, COUNT: 0}) is not True
