"""The two guards on the BLACK boundary that need no BLACK, and must run where it is absent.

`tests/test_ltlf_backend.py` is gated on `ltlf.available()`, which is right for every question it
asks the solver. These two are not questions for the solver — they are the boundary in front of it —
and gating them was backwards:

  - The decoy guard is about a machine where BLACK is *not* installed and `black` on `PATH` is the
    code formatter. Under the backend module's `skipif` it ran only where a real BLACK was already
    found, which is the one case it cannot fail in.
  - The `pin(σ)` guard's load-bearing claim is that each `λ_i` is a **complete** literal over all of
    `AP` — a partial valuation would not pin the position — and that is a fact about the formula
    `accepts()` builds, decided before any solver reads it.
"""

from __future__ import annotations

import os
import re
import subprocess

import pytest

from reasonsmith import ltlf


def _top_level_conjuncts(formula: str) -> list[str]:
    """Split on ` & ` at paren depth zero — the literals inside a `λ_i` use the same connective."""
    parts, depth, start = [], 0, 0
    for i, ch in enumerate(formula):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "&" and depth == 0:
            parts.append(formula[start:i].strip())
            start = i + 1
    parts.append(formula[start:].strip())
    return parts


def test_decoy_black_on_path_is_rejected(tmp_path, monkeypatch):
    """A decoy executable named `black` (e.g. code formatter) is rejected rather than invoked."""
    decoy = tmp_path / "black"
    decoy.write_text("#!/bin/sh\necho 'black, version 24.4.2'\n", encoding="utf-8")
    decoy.chmod(0o755)

    monkeypatch.setenv("PATH", f"{tmp_path}:{os.environ.get('PATH', '')}")
    monkeypatch.delenv("BLACK_SAT_PATH", raising=False)
    monkeypatch.delenv("BLACK_PATH", raising=False)
    monkeypatch.delenv("BLACK_EXECUTABLE", raising=False)
    ltlf._verify_black_binary.cache_clear()

    assert ltlf._verify_black_binary(str(decoy)) is False
    assert ltlf._get_black_path() != str(decoy)

    ltlf._verify_black_binary.cache_clear()


def test_the_pinning_formula_states_every_atom_at_every_position(monkeypatch):
    """`pin(σ) := ⋀_i Xⁱ λ_i ∧ X^(n−1) Last`, each `λ_i` complete over all of `AP`.

    A `λ_i` naming only the atoms the valuation happens to carry would leave the rest free, so the
    conjunction would be satisfied by traces other than σ and `accepts()` would answer about a set
    of traces rather than about the one it was given.
    """
    asked: list[str] = []
    monkeypatch.setattr(ltlf, "_run_black", lambda formula, **kw: asked.append(formula) or True)

    # `p2` appears in the formula and in no valuation; `p0`/`p1` appear in the valuations only
    # partially. Every one of the three is part of AP and must be stated at every position.
    formula = "p0 & X(p2)"
    sigma = [{"p0": True}, {"p1": True}]
    ltlf.accepts(formula, sigma)

    assert len(asked) == 1
    combined = asked[0]
    assert combined.startswith(f"({formula}) & ")
    pinning = combined[len(f"({formula}) & ") :]
    assert pinning.startswith("(") and pinning.endswith(")")
    parts = _top_level_conjuncts(pinning[1:-1])

    # One conjunct per position, plus the last-position conjunct.
    assert len(parts) == len(sigma) + 1

    for i, valuation in enumerate(sigma):
        conjunct = parts[i]
        assert conjunct.count("X (") == i, f"position {i} is not reached by Xⁱ: {conjunct!r}"
        literals = {re.sub(r"^[X\s(]+|[\s)]+$", "", lit) for lit in conjunct.split("&")}
        for atom in ("p0", "p1", "p2"):
            expected = atom if valuation.get(atom, False) else f"!{atom}"
            assert expected in literals, (
                f"position {i} does not state {expected}; λ_{i} is not complete over AP: "
                f"{sorted(literals)}"
            )

    last = parts[-1]
    assert "!(X True)" in last
    assert last.count("X (") == len(sigma) - 1


@pytest.mark.parametrize(
    "stdout",
    ["", "sat", "SATISFIABLE", "SAT\nUNSAT", "UNKNOWN", "TIMEOUT", "error: bad formula"],
)
def test_anything_but_an_unambiguous_answer_is_a_refusal_and_never_a_guess(monkeypatch, stdout):
    """`SAT` and `UNSAT` exactly, or nothing. A near-miss read as either is the silent wrong answer.

    Nothing else in this package reads the solver's stdout, so this is the only place the
    distinction between *the procedure answered* and *something else came back* is made.
    """
    monkeypatch.setattr(ltlf, "_get_black_path", lambda: "/nonexistent/black-sat")
    monkeypatch.setattr(
        ltlf.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a[0], 0, stdout=stdout, stderr=""),
    )
    with pytest.raises(RuntimeError, match="Unexpected output"):
        ltlf._run_black("p0")


def test_a_nonzero_exit_is_a_refusal_rather_than_an_unsat(monkeypatch):
    """A solver that failed did not answer `UNSAT`, and must never be read as one."""
    monkeypatch.setattr(ltlf, "_get_black_path", lambda: "/nonexistent/black-sat")
    monkeypatch.setattr(
        ltlf.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a[0], 2, stdout="", stderr="parse error"),
    )
    with pytest.raises(RuntimeError, match="exit code 2"):
        ltlf._run_black("p0")


def test_an_empty_trace_is_refused_before_the_solver_is_asked(monkeypatch):
    """No question is asked over the empty trace — §2.9's refusal of the empty meet."""
    monkeypatch.setattr(
        ltlf,
        "_run_black",
        lambda formula, **kw: (_ for _ in ()).throw(AssertionError("solver was asked")),
    )
    assert ltlf.accepts("p0", []) is False
