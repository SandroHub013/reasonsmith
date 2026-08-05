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

import { For, Show, createMemo, createSignal } from "solid-js"
import type { RequirementResult } from "@reasonsmith/core"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"
import { ReportHeader } from "../ui/header.tsx"
import { VerdictChip } from "../ui/verdict-chip.tsx"

export function Findings() {
  const t = useTheme()
  const report = useReport()
  const route = useRoute()
  const [filter, setFilter] = createSignal("")

  const filtered = createMemo(() => {
    const query = filter().trim().toLowerCase()
    if (query === "") return report.results()
    return report.results().filter((r) => r.requirement_id.toLowerCase().includes(query))
  })

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      minHeight={0}
      width="100%"
      borderStyle="rounded"
      borderColor={t.color.border}
      backgroundColor={t.color.surface}
      paddingLeft={1}
      paddingRight={1}
      title={`Findings (${report.results().length})`}
      titleAlignment="left"
    >
      <ReportHeader />
      <box
        flexDirection="row"
        flexShrink={0}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        gap={1}
      >
        <text fg={t.color.textMuted} attributes={t.attr.dim} wrapMode="none" content="filter:" />
        <input
          flexGrow={1}
          minWidth={0}
          placeholder="requirement id substring…"
          backgroundColor={t.color.surface}
          focusedBackgroundColor={t.color.surfaceRaised}
          textColor={t.color.text}
          cursorColor={t.color.info}
          value={filter()}
          onInput={(value) => setFilter(value)}
        />
      </box>
      <scrollbox
        flexGrow={1}
        minHeight={0}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={t.color.bg}
        verticalScrollbarOptions={{
          showArrows: true,
          trackOptions: {
            foregroundColor: t.color.info,
            backgroundColor: t.color.surface,
          },
        }}
        scrollbarOptions={{
          showArrows: true,
          trackOptions: {
            foregroundColor: t.color.info,
            backgroundColor: t.color.surface,
          },
        }}
      >
        <Show
          when={filtered().length > 0}
          fallback={
            <text
              fg={t.color.textMuted}
              attributes={t.attr.dim}
              wrapMode="none"
              content={`no requirement matches "${filter()}"`}
            />
          }
        >
          <For each={filtered()}>
            {(result, index) => (
              <Row
                result={result}
                selected={report.results().indexOf(result) === report.selected()}
                onHover={() => report.select(report.results().indexOf(result))}
                onOpen={() => route.navigate({ type: "detail" })}
              />
            )}
          </For>
        </Show>
      </scrollbox>
    </box>
  )
}

function Row(props: { result: RequirementResult; selected: boolean; onHover: () => void; onOpen: () => void }) {
  const t = useTheme()
  const report = useReport()

  return (
    <box
      flexDirection="row"
      gap={1}
      height={1}
      width="100%"
      backgroundColor={props.selected ? t.color.surfaceRaised : undefined}
      onMouseOver={props.onHover}
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
        The `<span>` inside the row's `<text>` is the inline-styling primitive: `b` (bold) on the
        selected row brightens the active row, and `<span>` wraps the bold toggle so the unselected
        rows stay at the dim secondary colour while the selected row's id is bolded.
      */}
      <text
        fg={props.selected ? t.color.text : t.color.textSecondary}
        wrapMode="none"
        flexGrow={1}
        minWidth={0}
      >
        <span>
          {props.selected ? <b>{props.result.requirement_id}</b> : props.result.requirement_id}
        </span>
      </text>
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