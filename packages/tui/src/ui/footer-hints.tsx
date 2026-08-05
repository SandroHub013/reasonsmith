/**
 * The footer hint bar, in nikcli's shape: a key in bold, its label dimmed, `·` between.
 *
 * The hints are read out of `BINDINGS` in the keybind context rather than written here, so a key
 * that works and a key that is advertised cannot drift apart — which is the same reason nikcli's
 * `FooterHintAction` looks its keybind up instead of taking a string.
 *
 * The current audience is shown here too, because it changes what every other panel withholds, and a
 * reader who cannot see which projection they are in cannot tell a field that is absent from a field
 * that was suppressed.
 */

import { For, Show, createSignal } from "solid-js"
import { useKeybind } from "../context/keybind.tsx"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"

export function FooterHints() {
  const t = useTheme()
  const keybind = useKeybind()
  const route = useRoute()
  const report = useReport()
  const [hovered, setHovered] = createSignal<number | null>(null)

  const shown = () => keybind.bindings.filter((b) => b.on.includes(route.route().type))

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      gap={1}
      borderStyle="rounded"
      borderColor={t.color.borderSubtle}
      title="keys"
      titleAlignment="left"
    >
      <For each={shown()}>
        {(binding, index) => (
          <box
            flexDirection="row"
            gap={1}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={hovered() === index() ? t.color.surfaceRaised : undefined}
            onMouseOver={() => setHovered(index())}
            onMouseOut={() => setHovered((cur) => (cur === index() ? null : cur))}
            onMouseUp={() => keybind.click(binding.label)}
          >
            <text fg={t.color.text} wrapMode="none">
              <b>{binding.keys}</b>
            </text>
            <text fg={t.color.textMuted} wrapMode="none">
              <i>{binding.label}</i>
            </text>
            <Show when={index() < shown().length - 1}>
              <text fg={t.color.borderSubtle} wrapMode="none" content="·" />
            </Show>
          </box>
        )}
      </For>
      <box flexGrow={1} />
      <text fg={t.color.info} wrapMode="none">
        for: <b>{report.audience()}</b>
      </text>
    </box>
  )
}
