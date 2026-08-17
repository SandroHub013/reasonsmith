"""Golden fixtures for the temporal formula shapes the observed/rtamt monitor reads.

What this module is for:
  The property language admits ten temporal operators (`rulelang.TEMPORAL_OPERATORS`) and the
  observed engine hands them to the rtamt discrete-time monitor. Until now their coverage was
  differential — hypothesis traces asserting the Boolean fold agrees with the robustness sign
  (`test_strict_comparison_boundary.py`) — which catches disagreement but pins no shape to an
  answer a reader can look up. This module adds the golden half the issue asks for (#237): for
  each shape, one satisfying trace and one violating trace with the verdict spelled out, plus the
  refusal fixtures for the shapes the monitor misreads or cannot parse. It adds coverage, not
  semantics: nothing here changes what any shipped duty reports.

  The verdict of a temporal formula is its value at the first trace position
  (`rulelang.eval_temporal_trace`), and the fixtures are written to make that rule visible rather
  than to work around it: `once`, `historically` and `rise` read the first record only, `fall`
  reads its negation, `since(a, b)` reads `b` at the first record, and `prev(f)` is vacuously true
  there — so `prev` is the one shape with no violating trace, and the test that says so pins the
  vacuity instead of fabricating a violation. Under an outer `always` the same operators quantify
  over the whole trace again, which is what the two nested fixtures show.

What a reader must not break:
  - Every trace is at least `MINIMUM_TRACE_LENGTH` records: the two-record authoring prerequisite
    is pinned by `test_a_one_record_trace_is_not_evaluated`, not assumed.
  - The refusal fixtures pin *not evaluated* (`INCONCLUSIVE`, no strength), never a pass: the
    three shapes rtamt reads under a different semantics (`%`, chained comparison, `Iff`) are
    refused in the rendering, and `!=` is refused because rtamt's grammar rejects it. A fixture
    that starts passing here means the monitor began answering a formula it misreads.
  - Fixture traces use measured magnitudes (`x > 0`), not presence flags, so the comparison the
    monitor scores is the one the fixture names.
"""

from __future__ import annotations

import pytest

from reasonsmith.engines.observed import MINIMUM_TRACE_LENGTH, ObservedEngine
from reasonsmith.spec import Requirement
from reasonsmith.sut import BaseSUT
from reasonsmith.verdict import Strength, Verdict

#: (spec, signals, satisfying trace, violating trace). None for the violating trace marks the
#: one shape that cannot be violated at the verdict position; the vacuity test below pins that
#: instead.
GOLDEN_SHAPES: list[tuple[str, tuple[str, ...], list[dict], list[dict] | None]] = [
    # Future quantifiers read the whole trace from the first position.
    ("always(x > 0)", ("x",), [{"x": 1}, {"x": 1}, {"x": 1}], [{"x": 1}, {"x": -1}, {"x": 1}]),
    (
        "eventually(x > 0)", ("x",),
        [{"x": -1}, {"x": 1}, {"x": -1}], [{"x": -1}, {"x": -1}, {"x": -1}],
    ),
    # Past quantifiers at the first position see only the first record.
    ("once(x > 0)", ("x",), [{"x": 1}, {"x": -1}, {"x": -1}], [{"x": -1}, {"x": -1}, {"x": 1}]),
    (
        "historically(x > 0)", ("x",),
        [{"x": 1}, {"x": -1}, {"x": -1}], [{"x": -1}, {"x": 1}, {"x": 1}],
    ),
    # The unit-step operators at the first position.
    ("next(x > 0)", ("x",), [{"x": -1}, {"x": 1}], [{"x": -1}, {"x": -1}]),
    ("prev(x > 0)", ("x",), [{"x": -1}, {"x": -1}], None),
    # The edge operators at the first position: rise reads the operand, fall its negation.
    ("rise(x > 0)", ("x",), [{"x": 1}, {"x": -1}], [{"x": -1}, {"x": 1}]),
    ("fall(x > 0)", ("x",), [{"x": -1}, {"x": 1}], [{"x": 1}, {"x": -1}]),
    # The binary operators: until scans forward, since reads its second operand at position 0.
    (
        "until(x > 0, y > 0)",
        ("x", "y"),
        [{"x": 1, "y": 0}, {"x": 1, "y": 0}, {"x": 0, "y": 1}],
        [{"x": 1, "y": 0}, {"x": -1, "y": 0}, {"x": 0, "y": 1}],
    ),
    (
        "since(x > 0, y > 0)",
        ("x", "y"),
        [{"x": 0, "y": 1}, {"x": 1, "y": 0}],
        [{"x": 0, "y": -1}, {"x": 1, "y": 1}],
    ),
    # Under an outer `always` the same operators quantify over the whole trace again.
    (
        "always(once(x > 0))", ("x",),
        [{"x": 1}, {"x": -1}, {"x": -1}], [{"x": -1}, {"x": -1}, {"x": 1}],
    ),
    (
        "always(next(x > 0))", ("x",),
        [{"x": 0}, {"x": 1}, {"x": 1}], [{"x": 0}, {"x": 1}, {"x": -1}],
    ),
]

#: Shapes the monitor must refuse, with the refusal wording each one earns: the first three the
#: language admits and rtamt reads differently (refused in the rendering), the last rtamt's
#: grammar rejects outright.
REFUSED_SHAPES: list[tuple[str, str]] = [
    ("always(x % 2 == 1)", "rtamt reads temporal property"),
    ("always(0 < x < 1)", "rtamt reads temporal property"),
    ("Iff(x > 0, y > 0)", "rtamt reads temporal property"),
    ("always(x != 0)", "rtamt cannot express or parse"),
]


def _requirement(spec: str, signals: tuple[str, ...]) -> Requirement:
    return Requirement(
        id="fixture",
        source_document="fixture",
        article_clause="fixture",
        verbatim_text="fixture",
        stakeholder="fixture",
        formalism="temporal",
        spec=spec,
        requires=signals,
        rationale="golden temporal fixture",
        binding=True,
        scope="",
        domains=(),
        deontic_type="obligation",
        defeasibility="strict",
    )


@pytest.mark.parametrize(
    "spec, signals, satisfying, violating",
    GOLDEN_SHAPES,
    ids=[spec for spec, _, _, _ in GOLDEN_SHAPES],
)
def test_satisfying_and_violating_traces(spec, signals, satisfying, violating):
    assert len(satisfying) >= MINIMUM_TRACE_LENGTH
    req = _requirement(spec, signals)
    sut = BaseSUT(set(signals))

    result = ObservedEngine.evaluate(req, sut, satisfying)
    assert (result.verdict, result.strength) == (Verdict.SATISFIED, Strength.OBSERVED)

    if violating is None:
        return
    assert len(violating) >= MINIMUM_TRACE_LENGTH
    result = ObservedEngine.evaluate(req, sut, violating)
    assert (result.verdict, result.strength) == (Verdict.VIOLATED, Strength.OBSERVED)


def test_prev_is_vacuous_at_the_verdict_position():
    """`prev(f)` at the first position has no past to read, so it is true there whatever f does.

    A violating fixture for `prev` would pin a bug, not a behaviour: the trace verdict is the
    value at the first position and that value is True by definition. Pinned so a semantics
    change that gives `prev` something to violate fails here loudly.
    """
    req = _requirement("prev(x > 0)", ("x",))
    sut = BaseSUT({"x"})
    for records in ([{"x": -1}, {"x": -1}], [{"x": -1}, {"x": 1}], [{"x": 1}, {"x": -1}]):
        result = ObservedEngine.evaluate(req, sut, records)
        assert (result.verdict, result.strength) == (Verdict.SATISFIED, Strength.OBSERVED)


@pytest.mark.parametrize(
    "spec, refusal",
    REFUSED_SHAPES,
    ids=[spec for spec, _ in REFUSED_SHAPES],
)
def test_unsupported_and_misread_shapes_are_refused(spec, refusal):
    req = _requirement(spec, ("x", "y"))
    result = ObservedEngine.evaluate(req, BaseSUT({"x", "y"}), [{"x": 1, "y": 1}, {"x": 1, "y": 1}])
    assert (result.verdict, result.strength) == (Verdict.INCONCLUSIVE, None)
    assert refusal in result.evidence_summary


def test_a_one_record_trace_is_not_evaluated():
    """The two-record authoring prerequisite: one sample is no cadence, and is reported as one."""
    req = _requirement("always(x > 0)", ("x",))
    result = ObservedEngine.evaluate(req, BaseSUT({"x"}), [{"x": 1}])
    assert (result.verdict, result.strength) == (Verdict.INCONCLUSIVE, None)
