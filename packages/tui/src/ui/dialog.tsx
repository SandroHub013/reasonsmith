/**
 * The dialog overlay system, in nikcli's shape.
 *
 * A stack of dialogs, not a single one: nikcli's `DialogProvider` keeps a `stack` array so a dialog
 * can open another (the command palette opens the settings dialog, which opens the theme dialog,
 * and so on) without the second one replacing the first's focus state. `replace` clears the stack and
 * pushes one; `clear` empties it; `stack` exposes the top entry for the renderer.
 *
 * Escape closes only the top, and a top dialog's interactive children (the ones with a focused
 * textarea) let Ctrl-C propagate rather than closing the stack — same rule nikcli states, because a
 * user mid-typing in a prompt who hits Ctrl-C is cancelling the prompt, not the whole UI.
 *
 * What a reader must not break: the overlay is rendered **outside** the route subtree, by the
 * `DialogProvider` itself, so a route that has no notion of dialogs does not have to mount one.
 * The route subtree is the panel; the dialog stack floats above it. A panel that paints over the
 * overlay is a bug in the panel.
 */

import { type JSX, type ParentProps, Show, createContext, useContext } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard } from "@opentui/solid"
import { createSimpleContext } from "../context/helper.tsx"
import { useTheme } from "../context/theme.tsx"
import { GlassBorder } from "./border.ts"

export type DialogSize = "small" | "medium" | "large"

interface DialogEntry {
  element: JSX.Element | (() => JSX.Element)
  size: DialogSize
  onClose?: () => void
}

export interface DialogContext {
  readonly stack: () => readonly DialogEntry[]
  replace(input: JSX.Element | (() => JSX.Element), options?: { size?: DialogSize }): void
  clear(): void
}

const DialogCtx = createContext<DialogContext>()

export const { use: useDialog, provider: DialogProvider } = createSimpleContext({
  name: "Dialog",
  init: () => {
    const [store, setStore] = createStore<{ stack: DialogEntry[] }>({ stack: [] })

    function closeTop() {
      const top = store.stack.at(-1)
      if (!top) return
      const next = store.stack.slice(0, -1)
      setStore("stack", next)
      top.onClose?.()
    }

    useKeyboard((evt) => {
      if (store.stack.length === 0) return
      if (evt.name === "escape") {
        evt.preventDefault()
        evt.stopPropagation()
        closeTop()
        return
      }
      if (evt.ctrl && evt.name === "c") {
        evt.preventDefault()
        evt.stopPropagation()
        setStore("stack", [])
      }
    })

    return {
      get stack() {
        return () => store.stack
      },
      replace(input, options) {
        const size: DialogSize = options?.size ?? "medium"
        const top = store.stack.at(-1)
        setStore("stack", [...store.stack, { element: input, size, onClose: top?.onClose }])
      },
      clear() {
        setStore("stack", [])
      },
    } satisfies DialogContext as DialogContext
  },
})

/**
 * The overlay frame. One `box` at the screen extent that dims the panel beneath, then one panel with
 * `GlassBorder` rounded rules that holds the top dialog. The dim colour is the theme's `bg` at half
 * opacity, the same way nikcli does it.
 */
function Overlay(props: { children: JSX.Element; size: DialogSize }) {
  const t = useTheme()

  const width = () => {
    switch (props.size) {
      case "large":
        return 80
      case "small":
        return 40
      default:
        return 60
    }
  }

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      backgroundColor={t.color.bg}
    >
      <box
        width={width()}
        flexDirection="column"
        backgroundColor={t.color.surface}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        border={[...GlassBorder.border]}
        customBorderChars={GlassBorder.customBorderChars}
      >
        {props.children}
      </box>
    </box>
  )
}

/**
 * The provider extension: in addition to putting the context value on the tree, it renders the top
 * dialog as an overlay. The route subtree is mounted as `props.children`; the overlay sits on top,
 * separately.
 *
 * Implementation note: this component cannot call `useDialog()` itself — at the moment that hook
 * is evaluated, the `<DialogProvider>` above has not yet set the context, and the hook returns
 * `undefined`. This is the same bug nikcli's `DialogProviderWithOverlay` solves by composing the
 * base provider transparently: we mount the base `<DialogProvider>` (which owns the context), then
 * render the overlay as a sibling, outside the children subtree but inside the same parent.
 */
export function DialogProviderWithOverlay(props: ParentProps) {
  return (
    <DialogProvider>
      <DialogConsumers>
        {props.children}
      </DialogConsumers>
    </DialogProvider>
  )
}

/**
 * The inner component that runs *inside* the DialogProvider so `useDialog()` returns the value.
 * It mounts the overlay using the consumer's view of the stack.
 */
function DialogConsumers(props: { children: JSX.Element }) {
  const value = useDialog()
  const top = () => value.stack().at(-1)
  return (
    <>
      {props.children}
      <Show when={top()}>
        {(entry) => {
          const e = entry()
          const node = e.element
          const rendered: JSX.Element =
            typeof node === "function" ? (node as () => JSX.Element)() : node
          return <Overlay size={e.size}>{rendered}</Overlay>
        }}
      </Show>
    </>
  )
}