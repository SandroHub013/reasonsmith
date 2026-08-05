/**
 * The theme context.
 *
 * nikcli's theme provider loads one of sixty JSON palettes and tracks the terminal's light/dark
 * mode. This one carries a single palette, because the tokens here are not decoration to be swapped:
 * `resultTone` maps a verdict to a hue, and a user-selectable palette would let a reader choose one
 * in which satisfied and violated are the same colour. The provider exists anyway, in the same shape,
 * so components reach for colour through a context rather than importing a module-level constant —
 * which is what makes a second palette a change to *this* file rather than to twenty components.
 */

import { createSimpleContext } from "./helper.tsx"
import { A, c, resultTone, strengthWord } from "../theme.ts"

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: () => ({
    color: c,
    attr: A,
    resultTone,
    strengthWord,
  }),
})
