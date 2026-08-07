"""Holds `docs/adopting.md` to the runs it prints.

What this module is for:
  `docs/adopting.md` is the on-ramp for a reader who arrives with a system of their own, and its
  argument is carried by two runs of the CLI against a log the page itself writes: one that
  refuses four duties for missing signals, and the same log plus one field, on which a duty that
  was unattainable comes back violated. The argument is only worth anything while the printed
  output is the real output, so every command block on the page is re-run and compared.

What a reader must not break:
  - The pairing is positional, one ```sh block then the ```text block it produced, the same way
    `test_docs_three_systems.py` and `test_docs_example_output.py` pair theirs. Comparison is
    byte-for-byte: normalising whitespace or matching substrings would let a stale transcript
    pass, which is the one failure this exists to catch.
  - Commands run in a temporary directory, because the page's first line writes `decisions.jsonl`
    into the working directory. A reader following the page does that in their own directory; the
    test must not do it in the checkout.
  - The second run exits 2, and that is the page's point: supplying one more field turned a duty
    the tool could not answer into a breach it could. `REPORTING_EXIT_CODES` admits it, so a
    change that silently stops reporting the violation fails here rather than reading as a pass.
  - `test_the_pages_unattainable_claims_are_the_set_difference_it_describes` holds §2's claim to
    `report.analyze_unattainable` itself: the page tells an adopter that a missing signal is a set
    difference computed without executing the system, and that is the sentence the whole document
    turns on.
"""

import os
import re
import subprocess
import sys
from pathlib import Path

from reasonsmith.report import analyze_unattainable
from reasonsmith.spec import load_pack
from reasonsmith.sut import SystemUnderTest

REPO_ROOT = Path(__file__).resolve().parents[1]
ADOPTING = REPO_ROOT / "docs" / "adopting.md"

PAIR_RE = re.compile(r"```sh\n(.*?)\n```\n\n```text\n(.*?)```\n", re.DOTALL)

#: 0 is a clean run and 2 is a run reporting a violation. The page commits one of each.
REPORTING_EXIT_CODES = (0, 2)


def test_committed_transcripts_are_the_real_stdout(tmp_path):
    text = ADOPTING.read_text(encoding="utf-8")
    pairs = PAIR_RE.findall(text)
    assert len(pairs) == 3, "expected three command/transcript pairs in docs/adopting.md"

    # COVERAGE_RCFILE is not about this document: these commands run in a temporary directory,
    # where a coverage-measured subprocess finds no pyproject.toml and so drops its `omit`, which
    # pulls `reasonsmith.examples` into the measured set at 0% and moves the project total. The
    # sibling doc tests run in the checkout and never had to say this.
    env = {
        **os.environ,
        "PYTHONPATH": str(REPO_ROOT / "src"),
        "PYTHONIOENCODING": "utf-8",
        "COVERAGE_RCFILE": str(REPO_ROOT / "pyproject.toml"),
    }
    exit_codes = []
    for command, transcript in pairs:
        run = subprocess.run(
            command.replace("python ", f"{sys.executable} ", 1),
            shell=True,
            cwd=tmp_path,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        )
        assert run.returncode in REPORTING_EXIT_CODES, (
            f"{command} exited {run.returncode}: {run.stderr}"
        )
        assert (
            run.stdout.replace("\r\n", "\n") == transcript.replace("\r\n", "\n")
        ), f"transcript for `{command}` is stale"
        exit_codes.append(run.returncode)

    assert exit_codes[-1] == 2, (
        "the page's second check run is the one that reports a violation once the extra signal "
        "is supplied; a run that no longer does makes the document's argument false"
    )


def test_the_pages_unattainable_claims_are_the_set_difference_it_describes(tmp_path):
    """§2's claim, asserted against the function it names, with the page's own log.

    The page tells an adopter that `unattainable` is the signals a duty needs minus the ones the
    system declares, computed without running the system. Both halves are checked here: the four
    duties the transcript reports unattainable are exactly the ones with a missing signal, and
    the system's `decisions()` is never called to find that out.
    """
    from reasonsmith.adapters.jsonl import JSONLAdapter

    log = tmp_path / "decisions.jsonl"
    text = ADOPTING.read_text(encoding="utf-8")
    first_block = PAIR_RE.findall(text)[1][0]
    records = [line for line in first_block.splitlines() if line.startswith("{")]
    log.write_text("\n".join(records) + "\n", encoding="utf-8")

    class CountingAdapter(JSONLAdapter):
        reads = 0

        def decisions(self):
            type(self).reads += 1
            return super().decisions()

    sut = CountingAdapter(str(log))
    assert isinstance(sut, SystemUnderTest)

    unattainable = {
        req.id: missing
        for req in load_pack("ecoa").requirements
        for is_unattainable, missing in [analyze_unattainable(req, sut)]
        if is_unattainable
    }
    assert unattainable == {
        "ecoa_reg_b_1002_9_a_1_timing_of_notice": ("artifact_logs_counteroffer_not_accepted",),
        "ecoa_reg_b_1002_9_b_2_specific_reasons": ("scope_statements_local_vs_global",),
        "ecoa_reg_b_1002_9_b_2_principal_reasons_complete": (
            "artifact_logs_deleted_reason_count",
        ),
        "ecoa_reg_b_1002_9_c_2_incompleteness_notice_runs_out": (
            "artifact_logs_incompleteness_notice_sent",
        ),
    }
    assert CountingAdapter.reads == 0, (
        "analyze_unattainable must answer without executing the system, which is what lets the "
        "page tell an adopter the answer is a set difference"
    )
