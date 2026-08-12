"""The required dependency closure of reasonsmith stays permissively licensed.

reasonsmith is MIT and may see commercial use, so everything a plain ``pip install
reasonsmith`` brings in — the required closure, never the extras — must stay permissive.
A dependency that changes its licence in a future release, or a new required dependency
that arrives copyleft, would otherwise pass silently.

This test reads the **installed** distribution metadata with ``importlib.metadata`` (no
network), walks the transitive closure from reasonsmith's own ``Requires-Dist``, and
fails on any copyleft token or on any licence it cannot determine — an undeterminable
licence is not evidence of a permissive one. The verified baseline closure (2026-08-06)
is nesyarena (MIT), numpy (BSD), rtamt (BSD), antlr4-python3-runtime (BSD) and z3-solver
(MIT).
"""

import importlib.metadata as md
import re

from packaging.requirements import Requirement

# SPDX-style tokens. Word boundaries keep "LGPL" from ever matching as plain "GPL"
# (neither may be in the required set, but the reported token should be the one there)
# and keep a permissive name from matching by accident.
_COPYLEFT = re.compile(r"\b(?:AGPL|LGPL|GPL|MPL|EPL|CDDL)\b")
_PERMISSIVE = re.compile(r"\b(?:MIT|BSD|Apache|ISC|Zlib|CC0|Unlicense|0BSD|X11|WTFPL|PSF)\b")


def _required_closure():
    """Names a plain ``pip install reasonsmith`` pulls in, transitively."""
    seen = set()
    stack = [Requirement(r) for r in (md.distribution("reasonsmith").requires or [])]
    closure = []
    while stack:
        req = stack.pop()
        if req.marker is not None and not req.marker.evaluate():
            continue  # an opt-in extra or a marker false on this interpreter
        key = req.name.lower()
        if key in seen:
            continue
        seen.add(key)
        closure.append(req.name)
        dist = md.distribution(req.name)
        stack.extend(Requirement(r) for r in (dist.requires or []))
    return closure


def _licence_problems(dist):
    """One problem string per licence defect, or [] for a permissively licensed package."""
    name, version = dist.metadata["Name"], dist.version
    expression = dist.metadata.get("License-Expression")
    licence = (dist.metadata.get("License") or "").strip()
    # A long multi-line `License` value is a pasted licence *text* (numpy's lists the
    # GPL-licensed libraries it bundles — a bundled-component note, not the package's own
    # licence), so read it as a designation only when it is a short single line.
    designation = licence if licence and "\n" not in licence and len(licence) <= 200 else ""
    classifiers = [
        c for c in (dist.metadata.get_all("Classifier") or []) if c.startswith("License ::")
    ]
    text = "\n".join(x for x in (expression, designation, *classifiers) if x)
    found = _COPYLEFT.findall(text)
    if found:
        return [f"{name} {version}: copyleft licence ({', '.join(sorted(set(found)))})"]
    if not text:
        return [
            f"{name} {version}: licence cannot be determined "
            "(License-Expression, License and License :: classifiers are all empty)"
        ]
    if not _PERMISSIVE.search(text):
        return [f"{name} {version}: licence not identified as permissive: {text!r}"]
    return []


def test_required_dependency_closure_is_permissively_licensed():
    problems = []
    for name in _required_closure():
        try:
            dist = md.distribution(name)
        except md.PackageNotFoundError:
            problems.append(f"{name}: required but not installed; its licence cannot be determined")
        else:
            problems.extend(_licence_problems(dist))
    msg = "every required dependency must be permissively licensed:\n" + "\n".join(problems)
    assert not problems, msg
