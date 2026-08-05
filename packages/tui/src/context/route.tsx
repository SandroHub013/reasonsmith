/**
 * The route context: which of the three screens is showing.
 *
 * Three routes, matching nikcli's `RouteProvider` shape (a store of one tagged union, plus
 * `navigate`), reduced to what this UI has to show:
 *
 *   - `findings` — every requirement result, one row each. The landing screen.
 *   - `detail` — one result, opened from the list.
 *   - `limits` — what this report does not claim.
 *
 * What a reader must not break: **`limits` is a route and not a footnote.** `report.limits` states
 * that the report is not a compliance guarantee and that a requirement reported without a strength
 * was not evaluated. `docs/semantics.md` §7 makes it a rule that no audience projection may drop a
 * word of it, and a rendering that buried it below a scroll would be dropping it in practice while
 * passing any test that only asks whether the string is present. So it gets a key of its own, named
 * in the footer of every screen.
 */

import { createSignal } from "solid-js"
import { createSimpleContext } from "./helper.tsx"

export type Route = { type: "findings" } | { type: "detail" } | { type: "limits" }

export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [route, setRoute] = createSignal<Route>({ type: "findings" })
    return {
      route,
      navigate: (next: Route) => setRoute(next),
      /** Back is always to the findings list — the only screen that is a starting point. */
      back: () => setRoute({ type: "findings" }),
    }
  },
})
