/**
 * The keybind context: every key this TUI answers to, in one place.
 *
 * nikcli's keybind context resolves user-configured bindings and owns a leader-key mode. This one
 * has no configuration and no leader — the surface is a report browser, not an editor — but it keeps
 * the same two properties, and both are the reason it is a context rather than a `useKeyboard` call
 * scattered through the routes:
 *
 *   - **One handler owns the keyboard.** Two `useKeyboard` subscriptions racing over `j` is a bug
 *     that only appears once a route is mounted twice, and the footer would still print the hint.
 *   - **The bindings are data, so the footer can print them.** `BINDINGS` is what the hint bar reads,
 *     so a key that works and a key that is advertised cannot drift apart.
 *
 * What a reader must not break: `q` and `Ctrl-C` stop the *renderer* rather than calling
 * `process.exit`. `renderer.stop()` restores the terminal — cursor, alternate screen, mouse
 * reporting — and an exit that skips it leaves the reader's shell in a state they have to `reset`.
 */

import { useKeyboard, useRenderer } from "@opentui/solid"
import { createSimpleContext } from "./helper.tsx"
import { useReport } from "./report.tsx"
import { useRoute } from "./route.tsx"

export interface Binding {
  readonly keys: string
  readonly label: string
  /** The routes this binding is advertised on. */
  readonly on: ReadonlyArray<"findings" | "detail" | "limits">
}

export const BINDINGS: readonly Binding[] = [
  { keys: "j/k ↑↓", label: "move", on: ["findings"] },
  { keys: "enter", label: "open", on: ["findings"] },
  { keys: "esc", label: "back", on: ["detail", "limits"] },
  { keys: "a", label: "audience", on: ["findings", "detail", "limits"] },
  { keys: "L", label: "limits", on: ["findings", "detail"] },
  { keys: "q", label: "quit", on: ["findings", "detail", "limits"] },
]

export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const renderer = useRenderer()
    const report = useReport()
    const route = useRoute()

    const quit = () => {
      renderer.stop()
    }

    useKeyboard((event) => {
      if (event.ctrl && event.name === "c") {
        quit()
        return
      }

      switch (event.name) {
        case "q":
          quit()
          return
        case "escape":
          route.back()
          return
        case "a":
          report.cycleAudience()
          return
        // Shift-l. `name` is the lowercase key and `shift` carries the modifier, so an unshifted
        // `l` is left free rather than quietly doing the same thing.
        case "l":
          if (event.shift) route.navigate({ type: "limits" })
          return
      }

      if (route.route().type !== "findings") return

      switch (event.name) {
        case "j":
        case "down":
          report.next()
          return
        case "k":
        case "up":
          report.previous()
          return
        case "g":
          if (event.shift) report.last()
          else report.first()
          return
        case "home":
          report.first()
          return
        case "end":
          report.last()
          return
        case "return":
        case "enter":
          route.navigate({ type: "detail" })
          return
      }
    })

    return { bindings: BINDINGS, quit }
  },
})
