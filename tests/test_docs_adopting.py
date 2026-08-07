"""Holds `docs/adopting.md` to the runs it prints.

What this module is for:
  `docs/adopting.md` is the on-ramp for a reader who arrives with a system of their own, and its
  argument is carried by two runs of the CLI against a log the page prints: one that refuses four
  duties for missing signals, and the same log plus one field, on which a duty that was
  unattainable comes back violated. The argument is only worth anything while the printed output
  is the real output, so every command block on the page is re-run and compared.

What a reader must not break:
  - The pairing is positional, one ```sh block then the ```text block it produced, the same way
    `test_docs_three_systems.py` and `test_docs_example_output.py` pair theirs. Comparison is
    byte-for-byte: normalising whitespace or matching substrings would let a stale transcript
    pass, which is the one failure this exists to catch.
  - The page shows its decision log as a ```jsonl block rather than as a shell recipe that
    writes one, and this module writes each such block to `decisions.jsonl` before running the
    command under it. That is what a reader does, and it is also the only portable spelling: a
    heredoc is a Unix construct, and every command on this page has to run on Windows too, which
    is where it first did not.
  - Commands run in a temporary directory, because the page's log lands in the working
    directory. A reader following the page does that in their own directory; the test must not
    do it in the checkout.
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

#: Every fenced block on the page, in order, as (language, body). A `jsonl` block is the decision
#: log the command under it reads; an `sh` block is a command, and the `text` block after it is
#: that command's stdout.
BLOCK_RE = re.compile(r"```(sh|text|jsonl)\n(.*?)```\n", re.DOTALL)

#: 0 is a clean run and 2 is a run reporting a violation. The page commits one of each.
REPORTING_EXIT_CODES = (0, 2)


def _blocks() -> list[tuple[str, str]]:
    return BLOCK_RE.findall(ADOPTING.read_text(encoding="utf-8"))


def test_committed_transcripts_are_the_real_stdout(tmp_path):
    blocks = _blocks()
    assert [lang for lang, _ in blocks] == [
        "sh",
        "text",
        "jsonl",
        "sh",
        "text",
        "jsonl",
        "sh",
        "text",
    ], "docs/adopting.md no longer reads as log, command, transcript"

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
    for index, (language, body) in enumerate(blocks):
        if language == "jsonl":
            (tmp_path / "decisions.jsonl").write_text(body, encoding="utf-8")
            continue
        if language != "sh":
            continue
        command = body.rstrip("\n")
        transcript = blocks[index + 1][1]
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

    assert len(exit_codes) == 3, "expected three commands on the page"
    assert exit_codes[-1] == 2, (
        "the page's second check run is the one that reports a violation once the extra signal "
        "is supplied; a run that no longer does makes the document's argument false"
    )


def test_no_command_on_the_page_is_unix_only(tmp_path):
    """The page's commands run on Windows too, which is where they first did not.

    A `cat > file <<EOF` heredoc is a Unix construct and returns 1 under `cmd.exe`, so the page
    showed a reader a recipe that fails on their machine and the CI job that runs this module on
    Windows went red. The log is shown as a ```jsonl block instead. This is the check that the
    shell recipe does not come back, stated on the constructs rather than on the platform, so it
    fails on the machine an author is actually using.
    """
    unix_only = ("<<", "cat ", "$(", "&&", "|", ";", "'", "export ")
    for language, body in _blocks():
        if language != "sh":
            continue
        for construct in unix_only:
            assert construct not in body, (
                f"docs/adopting.md runs `{body.strip()}`, which uses {construct!r} — a shell "
                "construct that does not run under cmd.exe. Every command on the page must be a "
                "plain invocation, and any file it reads must be shown as a block the reader "
                "saves rather than built by a shell recipe."
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
    first_log = next(body for language, body in _blocks() if language == "jsonl")
    log.write_text(first_log, encoding="utf-8")

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
