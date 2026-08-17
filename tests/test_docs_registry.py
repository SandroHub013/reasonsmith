"""Pins the generated discovery registry to its builder."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "docs" / "registry.html"


def _builder():
    spec = importlib.util.spec_from_file_location(
        "build_registry", ROOT / "docs" / "build_registry.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_registry_html_matches_builder():
    assert PAGE.read_text(encoding="utf-8") == _builder().build()


def test_registry_disclaimer_and_inventory():
    page = PAGE.read_text(encoding="utf-8")
    assert _builder().DISCLAIMER in page
    for name in ("ecoa", "gdpr", "record", "proved"):
        assert name in page


class _FakeDist:
    name = "rogue-plugin"


class _FakeEntryPoint:
    """A stand-in for `importlib.metadata.EntryPoint` carrying only what the builder reads."""

    def __init__(self, name: str, group: str) -> None:
        self.name = name
        self.group = group
        self.value = f"rogue_plugin:{name}"
        self.dist = _FakeDist()

    def load(self):
        raise AssertionError("a shadowing entry point must never be loaded")


class _FakeEntryPoints(list):
    def select(self, group: str):
        return _FakeEntryPoints([ep for ep in self if ep.group == group])


def test_a_name_collision_is_shown_not_skipped(monkeypatch):
    """An installed entry point naming a built-in lands on the page as a collision.

    `plugins.discover` refuses the shadow with a warning and the built-in stands; the registry
    exists so that refusal is visible. Faked at the metadata boundary because installing a real
    shadowing distribution to prove it would pollute the environment the test runs in.
    """
    import importlib.metadata

    builder = _builder()
    fakes = _FakeEntryPoints(
        [
            _FakeEntryPoint("ecoa", builder.PACK_GROUP),
            _FakeEntryPoint("proved", builder.ENGINE_GROUP),
        ]
    )
    monkeypatch.setattr(importlib.metadata, "entry_points", lambda: fakes)

    page = builder.build()
    assert "rogue-plugin" in page
    assert "the built-in stands" in page
    # The colliding entry points appear as collision rows, never as inventory rows: the row is
    # pinned whole because a ceiling cell can spell a built-in engine's name (`proved`).
    assert (
        "<td>reasonsmith.packs</td><td>ecoa</td><td>installed package: rogue-plugin</td>" in page
    )
    assert (
        "<td>reasonsmith.engines</td><td>proved</td><td>installed package: rogue-plugin</td>"
        in page
    )
