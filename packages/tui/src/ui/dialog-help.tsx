/**
 * The help dialog: every keybinding and audience, in nikcli's three-column shape.
 *
 * Three columns: shortcuts, slash commands, audiences. The columns share the same line counts so a
 * reader scanning left-to-right sees the full key surface at once, which is what makes the dialog a
 * single screen of *help* and not a menu to walk through.
 *
 * What a reader must not break: the lists come from the `KeybindProvider` `bindings` table, the
 * `ReportProvider` `audiences` list, and the audience labels baked into the help dialog itself.
 * Editing any of those in one place must update this dialog automatically — a help dialog that
 * disagrees with the footer hints is worse than no help dialog at all.
 */

import { For, Show, createMemo, onMount } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import type { Audience } from "@reasonsmith/core"
import { useDialog } from "./dialog.tsx"
import { useKeybind } from "../context/keybind.tsx"
import { useReport } from "../context/report.tsx"
import { useTheme } from "../context/theme.tsx"
import { AUDIENCE_HELP, AUDIENCE_LABELS } from "./audiences.ts"
import { Button } from "./button.tsx"
import { Clickable } from "./clickable.tsx"

const SHORTCUT_BINDINGS = ["move", "open", "back", "audience", "limits", "quit"] as const

export function DialogHelp() {
  const dialog = useDialog()
  const keybind = useKeybind()
  const report = useReport()
  const t = useTheme()
  const dimensions = useTerminalDimensions()

  onMount(() => {
    if (dimensions().width >= 110) dialog.replace(() => null, { size: "large" })
  })

  const shortcutRows = createMemo(() =>
    SHORTCUT_BINDINGS.map((action) => {
      const keys = keybind.printFor(action)
      const binding = keybind.bindings.find((b) => b.label === action)
      return { keys, label: binding?.label ?? action }
    }).filter((row) => row.keys !== ""),
  )

  const audienceRows = createMemo(() =>
    report.audiences.map((a) => ({
      name: AUDIENCE_LABELS[a as Audience] ?? a,
      description: AUDIENCE_HELP[a as Audience] ?? "",
    })),
  )

  return (
    <box flexDirection="column" gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={t.color.text} attributes={t.attr.bold} wrapMode="none">
          Help
        </text>
        <text fg={t.color.textMuted} wrapMode="none">
          esc/enter to close
        </text>
      </box>

      <box flexDirection="row" gap={3} paddingTop={1}>
        <box flexDirection="column" gap={1}>
          <text fg={t.color.info} attributes={t.attr.bold} wrapMode="none">
            Shortcuts
          </text>
          <Show
            when={shortcutRows().length > 0}
            fallback={
              <text fg={t.color.textMuted} wrapMode="none">
                no bindings
              </text>
            }
          >
            <For each={shortcutRows()}>
              {(row) => (
                <box flexDirection="row" gap={1}>
                  <text
                    fg={t.color.text}
                    attributes={TextAttributes.BOLD}
                    wrapMode="none"
                    width={12}
                    content={row.keys}
                  />
                  <text fg={t.color.textMuted} wrapMode="none">
                    {row.label}
                  </text>
                </box>
              )}
            </For>
          </Show>
        </box>

        <box flexDirection="column" gap={1}>
          <text fg={t.color.info} attributes={t.attr.bold} wrapMode="none">
            Audiences
          </text>
          <For each={audienceRows()}>
            {(row, index) => (
              <Clickable
                cursor="pointer"
                flexDirection="column"
                onClick={() => {
                  const audience = report.audiences[index()]!
                  report.setAudience(audience)
                }}
              >
                <text
                  fg={t.color.text}
                  attributes={TextAttributes.BOLD}
                  wrapMode="none"
                  content={row.name}
                />
                <text fg={t.color.textMuted} wrapMode="none">
                  {row.description}
                </text>
              </Clickable>
            )}
          </For>
        </box>
      </box>

      <box flexDirection="row" justifyContent="flex-end" paddingTop={1}>
        <Button label="OK" onClick={() => dialog.clear()} />
      </box>
    </box>
  )
}