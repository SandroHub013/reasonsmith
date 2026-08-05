/**
 * The keybind context — OpenTUI keyboard + enterprise leader-key mode.
 */

import { createSignal } from "solid-js"
import type { KeyEvent } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/solid"
import { createSimpleContext } from "./helper.tsx"
import { useReport } from "./report.tsx"
import { useRoute } from "./route.tsx"
import { useTheme } from "./theme.tsx"
import { useDialog } from "../ui/dialog.tsx"
import { DialogHelp } from "../ui/dialog-help.tsx"
import { DialogTheme } from "../ui/dialog-theme.tsx"
import { Keybind } from "../util/keybind.ts"

export interface Binding {
  readonly keys: string
  readonly label: string
  readonly on: ReadonlyArray<"findings" | "detail" | "limits" | "packs" | "systems" | "settings">
  readonly leader?: boolean
}

export const BINDINGS: readonly Binding[] = [
  { keys: "j/k ↑↓", label: "move", on: ["findings"] },
  { keys: "enter", label: "open", on: ["findings"] },
  { keys: "esc", label: "back", on: ["detail", "limits", "packs", "systems", "settings"] },
  { keys: "a", label: "audience", on: ["findings", "detail", "limits", "packs", "systems", "settings"] },
  { keys: "L", label: "limits", on: ["findings", "detail", "packs", "systems", "settings"] },
  { keys: "p", label: "packs", on: ["findings"] },
  { keys: "s", label: "systems", on: ["findings"] },
  { keys: "t", label: "theme", on: ["findings", "detail", "limits", "packs", "systems", "settings"], leader: true },
  { keys: "h", label: "help", on: ["findings", "detail", "limits", "packs", "systems", "settings"], leader: true },
  { keys: "q", label: "quit", on: ["findings", "detail", "limits", "packs", "systems", "settings"] },
  { keys: "?", label: "help", on: ["findings", "detail", "limits", "packs", "systems", "settings"] },
]


export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const renderer = useRenderer()
    const report = useReport()
    const route = useRoute()
    const theme = useTheme()
    const dialog = useDialog()
    const [leader, setLeader] = createSignal(false)

    let leaderTimeout: ReturnType<typeof setTimeout> | undefined
    const LEADER_TIMEOUT_MS = 2000

    const openHelp = () => dialog.replace(() => <DialogHelp />)
    const openTheme = () => dialog.replace(() => <DialogTheme />)
    const quit = () => renderer.stop()

    const activateLeader = () => {
      setLeader(true)
      if (leaderTimeout) clearTimeout(leaderTimeout)
      leaderTimeout = setTimeout(() => setLeader(false), LEADER_TIMEOUT_MS)
    }

    const deactivateLeader = () => {
      setLeader(false)
      if (leaderTimeout) clearTimeout(leaderTimeout)
    }

    const dispatchLeader = (name: string) => {
      deactivateLeader()
      switch (name) {
        case "h":
          openHelp()
          return
        case "t":
          openTheme()
          return
        case "a":
          report.cycleAudience()
          return
        case "l":
          route.navigate({ type: "limits" })
          return
        case "p":
          route.navigate({ type: "packs" })
          return
        case "s":
          route.navigate({ type: "systems" })
          return
        case "q":
          quit()
          return
      }
    }

    const matches = (spec: string, event: KeyEvent, inLeader: boolean): boolean => {
      const parsed = Keybind.fromParsedKey(event, inLeader)
      return Keybind.parse(spec).some((candidate) => Keybind.match(candidate, parsed))
    }

    useKeyboard((event) => {
      if (Keybind.isRepeat(event)) return

      if (matches("ctrl+c", event, false)) {
        quit()
        return
      }

      if (matches("ctrl+x", event, false) && !leader()) {
        activateLeader()
        return
      }

      if (leader() && event.name && !event.ctrl) {
        dispatchLeader(event.name)
        return
      }

      switch (event.name) {
        case "q":
          quit()
          return
        case "?":
          openHelp()
          return
        case "t":
          if (!event.ctrl) {
            theme.cyclePalette()
            return
          }
          break
        case "escape":
          if (leader()) {
            deactivateLeader()
            return
          }
          route.back()
          return
        case "a":
          report.cycleAudience()
          return
        case "l":
          if (event.shift) route.navigate({ type: "limits" })
          return
        case "p":
          route.navigate({ type: "packs" })
          return
        case "s":
          route.navigate({ type: "systems" })
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

    function click(action: string): void {
      switch (action) {
        case "quit":
          quit()
          return
        case "help":
          openHelp()
          return
        case "theme":
          openTheme()
          return
        case "back":
          route.back()
          return
        case "audience":
          report.cycleAudience()
          return
        case "limits":
          route.navigate({ type: "limits" })
          return
        case "packs":
          route.navigate({ type: "packs" })
          return
        case "systems":
          route.navigate({ type: "systems" })
          return
        case "open":
          route.navigate({ type: "detail" })
          return
        case "move":
          return
      }
    }

    return {
      bindings: BINDINGS,
      leader,
      printFor(action: string): string {
        const match = BINDINGS.find((b) => b.label === action)
        if (!match) return ""
        if (match.leader) return `ctrl+x ${match.keys.split(" ")[0] ?? match.keys}`
        return match.keys
      },
      quit,
      click,
    }
  },
})
