/**
 * Theme picker dialog — enterprise palette selection, nikcli settings shape.
 */

import { For } from "solid-js"
import { useDialog } from "./dialog.tsx"
import { useTheme } from "../context/theme.tsx"
import { Clickable } from "./clickable.tsx"
import type { PaletteId } from "../theme/palettes.ts"

export function DialogTheme() {
  const dialog = useDialog()
  const theme = useTheme()

  const select = (id: PaletteId) => {
    theme.setPalette(id)
    dialog.clear()
  }

  return (
    <box flexDirection="column" gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.color.text} attributes={theme.attr.bold} wrapMode="none">
          Theme
        </text>
        <text fg={theme.color.textMuted} wrapMode="none">
          esc to close
        </text>
      </box>

      <For each={theme.palettes()}>
        {(palette) => {
          const active = () => theme.paletteId() === palette.id
          return (
            <Clickable
              cursor="pointer"
              flexDirection="row"
              gap={1}
              paddingLeft={1}
              paddingRight={1}
              active={active()}
              onClick={() => select(palette.id)}
            >
              <text
                fg={active() ? theme.color.info : theme.color.textMuted}
                wrapMode="none"
                width={2}
                content={active() ? "●" : "○"}
              />
              <text
                fg={active() ? theme.color.text : theme.color.textSecondary}
                attributes={active() ? theme.attr.bold : theme.attr.none}
                wrapMode="none"
                width={18}
                content={palette.label}
              />
              <text
                fg={theme.color.textMuted}
                attributes={theme.attr.dim}
                wrapMode="none"
                flexGrow={1}
                content={palette.description}
              />
            </Clickable>
          )
        }}
      </For>
    </box>
  )
}
