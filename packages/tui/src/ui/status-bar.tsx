/**
 * The status bar — the record's category counts, each one a filter, and the ladder.
 *
 * Every number here is `ConformanceReport.counts` read straight off the JSON. The bar counts
 * nothing itself, and the membership test behind each filter is `types/categories.ts`, shared with
 * the list the filter narrows: these counters are the *only* way into that list, so a bar with its
 * own copy of the test is a bar that can disagree with what clicking it shows. It had one, and the
 * two copies had already drifted.
 *
 * The counts are the unprefixed ones, which cover the binding requirements alone — so the filter
 * chip on the right says so rather than leaving the reader to work out why the list got shorter.
 */

import { For, Show } from "solid-js"
import { CATEGORY_LABELS } from "../types/audiences.ts"
import { matchesCategory } from "../types/categories.ts"
import { useLayout } from "../context/layout.tsx"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"
import { Clickable } from "./clickable.tsx"

interface CounterSpec {
  readonly key: string
  readonly label: string
  readonly colorKey: "textMuted" | "bad" | "ok" | "unattainable"
}

export function StatusBar() {
  const t = useTheme()
  const report = useReport()
  const route = useRoute()
  const layout = useLayout()

  const counters = (): CounterSpec[] => {
    const c = report.report.counts
    const specs: CounterSpec[] = []
    for (const [key, label] of CATEGORY_LABELS) {
      const count = c[key] ?? 0
      if (count === 0) continue
      let colorKey: CounterSpec["colorKey"] = "textMuted"
      if (key === "violated") colorKey = "bad"
      else if (key === "proved" || key === "probed" || key === "recounted" || key === "observed")
        colorKey = "ok"
      else if (key === "unattainable") colorKey = "unattainable"
      specs.push({ key, label, colorKey })
    }
    return specs
  }

  const total = () => report.report.counts.total ?? report.results().length
  const violated = () => report.report.counts.violated ?? 0
  const activeFilter = () => report.categoryFilter()

  const filterBy = (key: string) => {
    report.setCategoryFilter(activeFilter() === key ? null : key)
    route.navigate({ type: "findings" })
    const index = report.results().findIndex((r) => matchesCategory(r, key))
    if (index >= 0) report.select(index)
  }

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      flexShrink={0}
      paddingLeft={layout.pad()}
      paddingRight={layout.pad()}
      gap={1}
      borderStyle="single"
      borderColor={t.color.borderSubtle}
      backgroundColor={t.color.surface}
    >
      {/*
        This row used to open with the word ENTERPRISE, in the accent colour and bold — ten columns
        of brand adjective, held at the highest emphasis on the screen, in front of the counts it
        pushed rightward. It said nothing about the run and outranked everything that did.
      */}
      <text fg={t.color.textSecondary} wrapMode="none">
        {total()} req
      </text>
      <Show when={violated() > 0}>
        <Clickable cursor="pointer" onClick={() => filterBy("violated")} active={activeFilter() === "violated"}>
          <text fg={t.color.bad} attributes={t.attr.bold} wrapMode="none">
            {violated()} violated
          </text>
        </Clickable>
      </Show>
      <text fg={t.color.borderSubtle} wrapMode="none" content="│" />
      <For each={counters()}>
        {(counter, index) => (
          <>
            <Clickable
              cursor="pointer"
              active={activeFilter() === counter.key}
              onClick={() => filterBy(counter.key)}
            >
              {/*
                The number is never dropped and never abbreviated; the word beside it is, on a
                terminal too narrow to carry both. A count with no word is still a count a reader can
                click, and the filter chip on the right names the category they landed in.
              */}
              <text fg={t.color[counter.colorKey]} wrapMode="none">
                <b>{String(report.report.counts[counter.key] ?? 0)}</b>
                <Show when={layout.showCounterLabels()}>
                  {" "}
                  {counter.label}
                </Show>
              </text>
            </Clickable>
            <Show when={index() < counters().length - 1}>
              <text fg={t.color.borderSubtle} wrapMode="none" content="·" />
            </Show>
          </>
        )}
      </For>
      <box flexGrow={1} />
      <Show when={activeFilter()}>
        {(key) => (
          <Clickable cursor="pointer" onClick={() => report.clearCategoryFilter()}>
            <text fg={t.color.warn} wrapMode="none" content={`filter: ${key()} · binding ✕`} />
          </Clickable>
        )}
      </Show>
      {/* A caption, and the last thing on this row that is not a number. It goes first. */}
      <Show when={layout.showLadder()}>
        <text fg={t.color.textMuted} attributes={t.attr.dim} wrapMode="none">
          ladder: unattainable → observed → recounted → probed → proved
        </text>
      </Show>
    </box>
  )
}
