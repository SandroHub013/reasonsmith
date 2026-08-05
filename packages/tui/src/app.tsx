/**
 * The app shell: the renderer, the provider stack, and the route switch.
 *
 * The shape is nikcli's — `createCliRenderer(config)`, then `render(() => <tree/>, renderer)` with an
 * `ErrorBoundary` outermost and the contexts stacked inside it, and an `App` component that reads the
 * route and switches on it. The stack order matters and is not alphabetical: `ReportProvider` and
 * `RouteProvider` are both above `KeybindProvider`, because the keyboard moves the selection and
 * changes the route, so the keybind context reaches for both.
 *
 * What a reader must not break:
 *
 *   - **`tui()` resolves when the renderer stops, and the caller decides the exit code.** The exit
 *     code is a contract (`2` on a violation) and belongs with the run, not with the UI, so this
 *     module never touches `process.exitCode`.
 *   - **The error boundary stops the renderer before it prints.** A TUI that throws mid-render and
 *     keeps the alternate screen leaves the reader with no terminal and no error; stopping first is
 *     what makes the message visible.
 */

import { type CliRendererConfig, createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import { ErrorBoundary, Match, Switch } from "solid-js"
import type { ConformanceReport } from "@reasonsmith/core"
import { KeybindProvider } from "./context/keybind.tsx"
import { ReportProvider } from "./context/report.tsx"
import { RouteProvider, useRoute } from "./context/route.tsx"
import { ThemeProvider, useTheme } from "./context/theme.tsx"
import { Detail } from "./routes/detail.tsx"
import { Findings } from "./routes/findings.tsx"
import { Limits } from "./routes/limits.tsx"
import { FooterHints } from "./ui/footer-hints.tsx"

function rendererConfig(): CliRendererConfig {
  return {
    targetFps: 30,
    gatherStats: false,
    // Ctrl-C is handled in the keybind context, which stops the renderer so the terminal is
    // restored; letting the runtime exit on it instead would skip that.
    exitOnCtrlC: false,
    useMouse: true,
    consoleMode: "disabled",
  }
}

/** Mount the TUI over `report` and resolve once the renderer has stopped. */
export async function tui(report: ConformanceReport): Promise<void> {
  const renderer = await createCliRenderer(rendererConfig())

  await render(
    () => (
      <ErrorBoundary
        fallback={(error) => {
          renderer.stop()
          process.stderr.write(
            `reasonsmith tui: ${
              error instanceof Error ? (error.stack ?? error.message) : String(error)
            }\n`,
          )
          return null
        }}
      >
        <ThemeProvider>
          <ReportProvider report={report}>
            <RouteProvider>
              <KeybindProvider>
                <App />
              </KeybindProvider>
            </RouteProvider>
          </ReportProvider>
        </ThemeProvider>
      </ErrorBoundary>
    ),
    renderer,
  )

  await new Promise<void>((resolve) => {
    const poll = setInterval(() => {
      if (!renderer.isRunning) {
        clearInterval(poll)
        resolve()
      }
    }, 50)
  })
}

function App() {
  const t = useTheme()
  const route = useRoute()

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={t.color.bg}>
      <box flexGrow={1} minHeight={0} width="100%">
        <Switch>
          <Match when={route.route().type === "findings"}>
            <Findings />
          </Match>
          <Match when={route.route().type === "detail"}>
            <Detail />
          </Match>
          <Match when={route.route().type === "limits"}>
            <Limits />
          </Match>
        </Switch>
      </box>
      <box flexShrink={0} width="100%">
        <FooterHints />
      </box>
    </box>
  )
}
