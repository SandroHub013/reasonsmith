/**
 * The findings route: every requirement result, one row each.
 *
 * A row carries the verdict mark, the rung, whether the duty is binding, and the requirement id.
 * Everything else is the detail route's job — a list that tried to show an evidence summary stops
 * being scannable, and scanning is what this screen is for.
 *
 * What a reader must not break:
 *
 *   - **The rung is shown only where the projection allows it.** `view.strength` is false for the
 *     `affected-individual` projection, and the chip takes the flag rather than deciding for itself.
 *   - **`binding` vs `interpretive` is shown.** A recital informs how a duty is read but creates no
 *     obligation of its own, and `ConformanceReport.counts` keeps the two halves apart precisely so
 *     neither number can be read as the other. A list that flattened them would undo that.
 *   - **The undeclared-domain notice is not tucked away.** A run that skipped domain-limited duties
 *     exits exactly as a clean run does, so the report has to carry what the exit code cannot; the
 *     header prints it in full whenever it is present.
 */

import { For, Show } from "solid-js"
import type { RequirementResult } from "@reasonsmith/core"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"
import { VerdictChip } from "../ui/verdict-chip.tsx"
import { wrap } from "../theme.ts"

export function Findings() {
  const t = useTheme()
  const report = useReport()
  const route = useRoute()

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} width="100%">
      <Header />
      <scrollbox
        flexGrow={1}
        minHeight={0}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={t.color.bg}
      >
        <For each={report.results()}>
          {(result, index) => (
            <Row result={result} selected={index() === report.selected()} onOpen={() => route.navigate({ type: "detail" })} />
          )}
        </For>
      </scrollbox>
    </box>
  )
}

function Header() {
  const t = useTheme()
  const report = useReport()
  const notice = () => report.report.undeclaredDomainNotice

  return (
    <box flexDirection="column" width="100%" paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" gap={1} height={1}>
        <text fg={t.color.info} attributes={t.attr.bold} wrapMode="none" content="reasonsmith" />
        <text fg={t.color.borderSubtle} wrapMode="none" content="·" />
        <text fg={t.color.text} wrapMode="none" content={report.report.system_name} />
        <text fg={t.color.borderSubtle} wrapMode="none" content="·" />
        <text
          fg={t.color.textSecondary}
          wrapMode="none"
          content={`pack ${report.report.pack_id}`}
        />
      </box>

      {/*
        `headline` is the projection table's own row — "declared scope/domains, headline, counts" —
        and it is its own flag rather than a shade of `strength`. It is withheld from the lay reader
        for the same reason the rung is: a count of rungs reached is this tool's evidence model, not
        an answer about their decision.
      */}
      <Show when={report.view().headline}>
        <box flexDirection="row" height={1}>
          <text
            fg={t.color.textSecondary}
            wrapMode="none"
            content={report.report.headline}
          />
        </box>
        <box flexDirection="row" gap={1} height={1}>
          <text
            fg={t.color.textMuted}
            attributes={t.attr.dim}
            wrapMode="none"
            content={`scope ${report.report.system_scope ?? "undeclared"}`}
          />
          <text fg={t.color.borderSubtle} wrapMode="none" content="·" />
          <text
            fg={
              report.report.system_domains.length > 0 ? t.color.textMuted : t.color.warn
            }
            attributes={t.attr.dim}
            wrapMode="none"
            content={`domains ${
              report.report.system_domains.length > 0
                ? report.report.system_domains.join(", ")
                : "undeclared"
            }`}
          />
        </box>
      </Show>

      <Show when={notice()}>
        {(text) => (
          <box flexDirection="column" marginTop={1} marginBottom={1}>
            <For each={wrap(text(), 96)}>
              {(line) => <text fg={t.color.warn} wrapMode="none" content={line} />}
            </For>
          </box>
        )}
      </Show>
    </box>
  )
}

function Row(props: { result: RequirementResult; selected: boolean; onOpen: () => void }) {
  const t = useTheme()
  const report = useReport()

  return (
    <box
      flexDirection="row"
      gap={1}
      height={1}
      width="100%"
      backgroundColor={props.selected ? t.color.surfaceRaised : undefined}
      onMouseUp={props.onOpen}
    >
      <text
        fg={props.selected ? t.color.info : t.color.borderSubtle}
        wrapMode="none"
        content={props.selected ? "▌" : " "}
      />
      <VerdictChip
        verdict={props.result.verdict}
        strength={props.result.strength}
        showStrength={report.view().strength}
        bold={props.selected}
      />
      {/*
        The id takes the slack and is the only thing that gives way when the terminal is narrow, so
        the columns either side of it stay aligned. `minWidth={0}` is what lets it shrink at all —
        without it the flex row overflows and the classification tag is drawn over the id's tail.
      */}
      <text
        fg={props.selected ? t.color.text : t.color.textSecondary}
        attributes={props.selected ? t.attr.bold : t.attr.none}
        wrapMode="none"
        flexGrow={1}
        minWidth={0}
        content={props.result.requirement_id}
      />
      <Show when={report.view().classification}>
        <text
          fg={t.color.textMuted}
          attributes={t.attr.dim}
          wrapMode="none"
          flexShrink={0}
          width={12}
          content={props.result.binding ? "binding" : "interpretive"}
        />
      </Show>
    </box>
  )
}
