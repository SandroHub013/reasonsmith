/**
 * The alert dialog: a title, a message, and one OK button.
 *
 * The simplest dialog in the stack, and the one a reader is most likely to be looking at when they
 * need to look away — so the OK button is on the right, sized to its label, and Enter dismisses it
 * without needing to read the button text.
 *
 * What a reader must not break: `DialogAlert.show` is a promise. It resolves when the dialog is
 * dismissed, by either button or escape, so a caller can `await` it and keep its post-dialog code
 * in the same scope as the call. The promise resolves *once*; a second dismissal is a no-op.
 */

import { TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog, type DialogContext } from "./dialog.tsx"
import { useTheme } from "../context/theme.tsx"

export interface DialogAlertProps {
  title: string
  message: string
  onConfirm?: () => void
}

export function DialogAlert(props: DialogAlertProps) {
  const dialog = useDialog()
  const t = useTheme()

  function confirm() {
    props.onConfirm?.()
    dialog.clear()
  }

  useKeyboard((evt) => {
    if (evt.name === "return") {
      evt.preventDefault()
      confirm()
    }
  })

  return (
    <box flexDirection="column" gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={t.color.text} attributes={t.attr.bold} wrapMode="none">
          {props.title}
        </text>
        <text fg={t.color.textMuted} wrapMode="none">
          esc
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={t.color.textSecondary} wrapMode="none">
          {props.message}
        </text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box
          paddingLeft={3}
          paddingRight={3}
          backgroundColor={t.color.info}
          onMouseUp={confirm}
        >
          <text fg={t.color.bg} attributes={TextAttributes.BOLD} wrapMode="none">
            OK
          </text>
        </box>
      </box>
    </box>
  )
}

DialogAlert.show = (dialog: DialogContext, title: string, message: string): Promise<void> => {
  return new Promise<void>((resolve) => {
    dialog.replace(() => <DialogAlert title={title} message={message} onConfirm={() => resolve()} />, { size: "medium" })
  })
}