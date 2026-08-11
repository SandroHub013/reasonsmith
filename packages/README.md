# reasonsmith, in TypeScript

A renderer and a recording harness, not a re-implementation. The conformance engine — every pack,
every rung, every engine, every reason-deletion certificate — is the Python package in
`src/reasonsmith/`. The TypeScript tree here renders what the Python produces, and records itself
producing it. **There is exactly one place a duty is defined, and it is the Python.**

```
packages/
  tui/               the OpenTUI renderer; reads one JSON record over a subprocess
  terminal-control/  the recording harness; produces the .termctrl evidence files
  cli/               a thin launcher that starts the TUI binary
```

Install and run:

```sh
bun install
bun run typecheck   # turbo, every package
bun test            # turbo, every package
```

## What this build does

The TUI is one process. It spawns `python -m reasonsmith.cli check ... --json`, parses the record,
and renders it. There is no second copy of a pack, no second copy of an engine, no second copy of a
verdict: every box on the screen is something the Python said, over stdout, in a single call.

The recording harness (`terminal-control`) captures a TUI session into a `.termctrl` file and renders
it back to screenshots, GIFs, video, and a structured screen.json. The shipped `artifacts/tui/`
directory holds the recording, not its rendered outputs — those are release assets.

## What this build does not have

**Engines.** All four rungs the Python can reach (`proved`, `probed`, `recounted`, `observed`)
belong to the Python. The TUI never asks an engine a question. A run that the Python reports at
`proved` arrives at the TUI as `proved`; the TUI does not re-derive it.

**Packs.** No `.toml` is loaded in the TypeScript process. The TUI's report header carries whatever
the Python's run printed, and the active pack appears in the settings panel as `pack_id`.

**Systems.** No system under test is built in this build. A user supplies `--system`, either a
`decisions.jsonl` path or a `module:attribute` reference to a Python system, and the Python loads
it. The TUI takes one flag for both and forwards the module form to the Python as
`--system-module`; it has no `--system-module` flag of its own, and `packages/tui/src/args.ts`
refuses any argument it does not list.

**Audiences.** Five audience projections (`developer`, `deployer`, `auditor`, `regulator`,
`affected-individual`) are declared in `packages/tui/src/types/audiences.ts`. They are the same five
the Python ships, with the same flags, and they are passed to the Python through `--audience`. The
TUI does not implement its own projection logic for an audience it does not pass through; the
Python owns the projection and emits the projected report.

## The data contract

`reasonsmith check --json` emits the contract. One subprocess call, one parse, one render. The full
shape is documented in `packages/tui/src/types/schema.ts`, and the parser refuses anything whose
`schema_version` does not match.

`schema_version` is the shape's, not the package's, and it does **not** move when a key is added —
so the version alone cannot tell a record carrying `undeclared_domain_notice` from one emitted
before that key existed. The parser therefore names a missing additive key in its own error and says
which Python emits it, rather than rendering a report that quietly says less than the run measured.

Four things the record carries that the renderer reads rather than derives:

- `undeclared_domain_notice` — the sentence a run owes a reader when domain-limited duties went
  unchecked, `null` when none did. The TUI rebuilt this from `details` once and drifted from the
  Python's wording; it is read now.
- `results[].findings` — findings reported beside a verdict. A `certificate` `FAIL` here may sit
  next to a `satisfied` duty, and the detail pane shows both: the duty was cleared on what its
  engine could check, and the certificate measurement over the same decision failed.
- `results[].verbatim_text` — the clause as the regulation writes it, quoted in the detail pane
  behind the same flag as the rest of the legal metadata.
- `audience` — the projection the run was asked for, declared rather than applied. The TUI keeps
  its own projection table because audience cycling is local and the subprocess ran once, and
  `checkAudienceBlock` refuses a run whose flags disagree with it.

## What a reader must not break

- **No duty, rung, verdict, or spec is defined in TypeScript.** `rg -l "packs|Strength|verdict"
  packages/` returns nothing outside `packages/tui/src/types/`.
- **No statutory text lives in this repository twice.** `grep -rn "12 CFR\|GDPR Art\|Regulation B"
  packages/` returns nothing.
- **The TUI's only data path is the subprocess.** `runReasonsmith()` in
  `packages/tui/src/subprocess.ts` is the one place a Python interpreter is spawned.
- **A run that reports `not evaluated` renders visibly differently from one that reports
  `satisfied`.** The status bar, the verdict chip, and the detail page all carry that distinction,
  and the test in `packages/tui/src/index.test.ts` pins it.
