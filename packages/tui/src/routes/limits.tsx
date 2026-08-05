/**
 * The limits route: what this report does not claim.
 *
 * Two blocks. The first is `report.limits` **verbatim and whole** — `docs/semantics.md` §7 makes it a
 * rule that no audience projection may drop a word of it, so this screen is reachable from every
 * route and prints the same text to every reader. The second quotes the four headings of
 * `docs/what-this-does-not-do.md`, which is that document's whole structure: four things this tool
 * cannot do, stated together.
 *
 * What a reader must not break:
 *
 *   - **The four headings are quoted, not summarised.** They are the document's own words. A
 *     paraphrase here would be this TUI making a claim about the tool's limits in its own voice,
 *     which is exactly the move every rule in this repository is written to prevent. The one-line
 *     glosses under them are quoted from the same document's body.
 *   - **This route is never gated by audience.** Every projection keeps the limits; there is no flag
 *     to consult, and adding one would be the drop the rule forbids.
 */

import { For } from "solid-js"
import { useReport } from "../context/report.tsx"
import { useTheme } from "../context/theme.tsx"
import { wrap } from "../theme.ts"

const WIDTH = 94

/**
 * The four headings of `docs/what-this-does-not-do.md`, with one quoted line each. Kept verbatim so
 * a reader who opens the document recognises what they were shown.
 */
const CANNOT = [
  {
    heading: "1. It takes the system's word about what it is",
    line:
      "Read a satisfied row as “the record has the fields”, never as “the system computes what it says it computes”.",
  },
  {
    heading: "2. Depth is uneven, and here is the shape of it",
    line:
      "Three quarters of the shipped duties are presence checks, and presence is not adequacy: a reason field that is filled in is not a reason that is sufficient.",
  },
  {
    heading: "3. A rung is not a grade",
    line:
      "The lattice ranks how a conclusion was reached and not what it was reached about, so a report full of proved verdicts is not a better report than one full of observed verdicts.",
  },
  {
    heading: "4. The strongest results need a system that exposes its inference, and most do not",
    line:
      "A system that is only a decision log reaches observed and no further, whatever the pack asks — and most audited systems are only a decision log.",
  },
] as const

export function Limits() {
  const t = useTheme()
  const report = useReport()

  return (
    <scrollbox
      flexGrow={1}
      minHeight={0}
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={t.color.bg}
    >
      <box flexDirection="column" width="100%">
        <text
          fg={t.color.text}
          attributes={t.attr.bold}
          wrapMode="none"
          content="LIMITS OF THIS REPORT"
        />
        <For each={wrap(report.report.limits, WIDTH)}>
          {(line) => <text fg={t.color.textSecondary} wrapMode="none" content={line} />}
        </For>

        <box flexDirection="column" marginTop={1}>
          <text
            fg={t.color.text}
            attributes={t.attr.bold}
            wrapMode="none"
            content="WHAT THIS TOOL DOES NOT DO"
          />
          <text
            fg={t.color.textMuted}
            attributes={t.attr.dim}
            wrapMode="none"
            content="quoted from docs/what-this-does-not-do.md"
          />
          <For each={CANNOT}>
            {(item) => (
              <box flexDirection="column" marginTop={1}>
                <text fg={t.color.warn} wrapMode="none" content={item.heading} />
                <For each={wrap(item.line, WIDTH - 2)}>
                  {(line) => (
                    <text fg={t.color.textSecondary} wrapMode="none" content={`  ${line}`} />
                  )}
                </For>
              </box>
            )}
          </For>
        </box>

        <box flexDirection="column" marginTop={1}>
          <For
            each={wrap(
              "And the standing one, on every report this tool prints: nothing here determines " +
                "whether a legal duty is discharged. It reports what a formal specification asks " +
                "and how the verdict was reached.",
              WIDTH,
            )}
          >
            {(line) => <text fg={t.color.textMuted} wrapMode="none" content={line} />}
          </For>
        </box>
      </box>
    </scrollbox>
  )
}
