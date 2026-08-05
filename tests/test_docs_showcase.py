"""Holds the showcase artefacts to the builder and to the run they claim to be measured from.

What this module is for:
  `docs/build_showcase.py` writes the two figures the README opens with and the page they live
  on. They exist to carry one measured result — a notice stating one reason where the decision's
  own inference used five — to a reader who has not yet decided to read anything else. Two things
  would quietly make them worthless. The numbers on them can stop being the run's numbers, which
  is what happens to every figure whose values are typed beside the code that produced them; and
  the terminal recording can stop being real stdout, which is what happens to every cast recorded
  by hand. One test here pins each.

What a reader must not break:
  - The builder is loaded by path and run, never re-implemented, exactly as
    `tests/test_html_report.py` loads `docs/build_example.py` and `tests/test_docs_audiences.py`
    loads `docs/build_audiences.py`. `docs/` is not an import package.
  - `test_the_figure_states_only_the_run_s_own_numbers` reads the certificate out of the run and
    then asserts the builder's own source carries none of those labels. A figure is allowed to
    print a measured reason; it is not allowed to *hold* one, because a literal there survives
    the measurement changing.
  - `test_the_cast_shows_real_stdout_and_counts_what_it_leaves_out` re-runs both commands and
    holds every output row to a line the CLI actually printed. An excerpt may elide lines and
    must say how many; it may never edit one.
  - The two SVGs are inlined into an HTML page, where an SVG `<style>` block is document-scoped.
    `test_the_figures_style_nothing_but_themselves` is what stops a class in either of them
    restyling the conformance report the page carries below.
"""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
README = REPO_ROOT / "README.md"


def _load_builder():
    spec = importlib.util.spec_from_file_location(
        "build_showcase", REPO_ROOT / "docs" / "build_showcase.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build_showcase = _load_builder()


def test_docs_showcase_matches_the_builder():
    """All three committed files are what the one command they name writes, byte for byte.

    Regenerate them with `python docs/build_showcase.py`.
    """
    figure, cast, page = build_showcase.render()

    assert build_showcase.SHOWCASE_FIGURE.read_text(encoding="utf-8") == figure
    assert build_showcase.SHOWCASE_CAST.read_text(encoding="utf-8") == cast
    assert build_showcase.SHOWCASE_HTML.read_text(encoding="utf-8") == page


def test_the_page_names_a_provenance_command_that_reproduces_it():
    """A command the page cannot be reproduced from is decoration, not provenance."""
    page = build_showcase.SHOWCASE_HTML.read_text(encoding="utf-8")

    assert f"Command: <code>{build_showcase.BUILD_COMMAND}</code>" in page
    assert "test_docs_showcase_matches_the_builder" in build_showcase.PROVENANCE_NOTE
    assert build_showcase.PROVENANCE_NOTE in page


def test_the_figure_states_only_the_run_s_own_numbers():
    """Every reason and every count on the figure is the run's, and none of them is a literal.

    The figure's whole claim is that the four struck reasons were *measured* — enumerated from
    the inference artefact and then established, one deletion at a time, to be reasons the
    system's answer did not depend on. A label typed into the builder would look identical on
    the page and would survive the measurement changing underneath it, which is the one failure
    this artefact cannot afford.
    """
    report = build_showcase.showcase_run()
    audit = build_showcase._reason_audit(report)
    figure = build_showcase.SHOWCASE_FIGURE.read_text(encoding="utf-8")
    source = (REPO_ROOT / "docs" / "build_showcase.py").read_text(encoding="utf-8")

    assert audit["found"] > len(audit["stated"]), (
        "the figure is about a decision that used more reasons than its notice stated"
    )
    assert len(audit["deleted"]) == audit["found"] - len(audit["stated"])

    for label in audit["stated"] + audit["deleted"]:
        assert label.replace("—", "&#8212;") in figure or label in figure, (
            f"{label!r} is measured by the run and missing from the figure"
        )
        assert label not in source, (
            f"{label!r} is written into docs/build_showcase.py — every reason on the figure must "
            "come from the certificate the run produced, not from a literal beside it"
        )
    assert audit["decision_id"] in figure
    assert audit["decision_id"] not in source

    struck = figure.count('class="rs-fig-strike"')
    assert struck == len(audit["deleted"]), (
        f"{struck} reason(s) struck on the figure against {len(audit['deleted'])} the deletion "
        "probe reported"
    )


def test_the_cast_shows_real_stdout_and_counts_what_it_leaves_out():
    """Every output row of the cast is a line the CLI printed, and the elisions are counted.

    A cast is an excerpt, so it leaves lines out; what it may not do is edit one or leave one
    out silently. Each kept row must appear verbatim in the run's own stdout — wrapped at
    `COLUMNS` the way a terminal wraps it and in no other way — and the number in each elision
    marker must be the number of lines actually skipped.
    """
    rows = build_showcase._terminal_lines()
    kinds = {kind for kind, _ in rows}
    assert {"prompt", "out", "elision", "exit"} <= kinds

    outputs = []
    for command, _ in build_showcase.CAST_STEPS:
        stdout, exit_code = build_showcase.stdout_of(command)
        outputs.append(stdout)
        assert f"  [exit status {exit_code}]" in [text for _, text in rows]
        assert any(text == f"$ {command}" for kind, text in rows if kind == "prompt"), (
            "a prompt row shows a command the cast did not run"
        )

    printed = {
        chunk
        for stdout in outputs
        for line in stdout.splitlines()
        for chunk in build_showcase._wrap(line)
    }
    for kind, text in rows:
        if kind == "out":
            assert text in printed, f"{text!r} is on the cast and in neither run's stdout"

    for _, text in rows:
        match = re.fullmatch(r"  ⋯ (\d+) line\(s\) not shown", text)
        if match:
            assert int(match[1]) > 0, "an elision marker that hides nothing is noise"

    elided = sum(
        int(match[1])
        for _, text in rows
        if (match := re.fullmatch(r"  ⋯ (\d+) line\(s\) not shown", text))
    )
    shown = sum(1 for kind, _ in rows if kind == "out")
    assert elided + shown == sum(len(stdout.splitlines()) for stdout in outputs), (
        "the cast's shown and elided lines do not add up to the runs it excerpts, so it is "
        "leaving lines out without saying so"
    )


def test_a_cast_rule_that_matches_nothing_raises():
    """A selection rule matching no line raises rather than quietly showing less.

    This is `docs/build_readme_transcripts.py`'s defect in the shape it takes here: a rule keyed
    to wording the CLI has since changed would drop the violation off the cast and report
    success. `_select` refuses instead, and the artefact is left as it was.
    """
    import pytest

    lines = ["CONFORMANCE REPORT", "headline: 1 requirement"]

    assert build_showcase._select(lines, (("prefix", "headline:"),)) == [1]
    with pytest.raises(RuntimeError, match="matches no line"):
        build_showcase._select(lines, (("prefix", "a wording the CLI stopped printing"),))


def test_the_figures_style_nothing_but_themselves():
    """Both SVGs are inlined into an HTML page, where their `<style>` is document-scoped.

    An unprefixed selector in either file would restyle the conformance report the showcase page
    carries below it, and would do so silently — the byte-for-byte pin passes just as happily on
    a page whose report has been restyled by a figure.
    """
    for path in (build_showcase.SHOWCASE_FIGURE, build_showcase.SHOWCASE_CAST):
        style = re.search(r"<style>(.*?)</style>", path.read_text(encoding="utf-8"), re.DOTALL)
        assert style, f"{path.name} carries no stylesheet"
        selectors = re.findall(r"^\s*([.@][^{]*)\{", style[1], re.MULTILINE)
        for selector in selectors:
            selector = selector.strip()
            if selector.startswith("@"):
                continue
            for part in selector.split(","):
                assert part.strip().startswith(".rs-"), (
                    f"{path.name} styles {part.strip()!r}, which is not one of its own prefixed "
                    "classes and would reach the page it is inlined into"
                )


def test_the_readme_opens_with_both_artefacts():
    """The README embeds the figure and the cast, and embeds the generated files.

    They are the front page's first screen. A README that stopped pointing at them would leave
    two generated files pinned to a builder nobody looks at, which is how a showcase rots.
    """
    readme = README.read_text(encoding="utf-8")

    for path in (build_showcase.SHOWCASE_FIGURE, build_showcase.SHOWCASE_CAST):
        reference = str(path.relative_to(REPO_ROOT))
        assert reference in readme, f"README.md no longer embeds {reference}"
    assert "docs/build_showcase.py" in readme
