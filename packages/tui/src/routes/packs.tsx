/**
 * The packs route: a `<select>` picker over every built-in conformance pack.
 *
 * Each option is `{ name, value: packId, description }` — `SelectOption`'s shape is `name` and not
 * `title`, so the field is named here rather than aliased. The `description` is the pack's own
 * one-line gloss from `Pack.description` and is never reworded here, so the picker agrees with the
 * pack the loader would load and with the report header that would name it.
 *
 * What a reader must not break:
 *
 *   - **The header is `Conformance packs`.** It is the section this screen is the picker for, not a
 *     place to advertise the report this run already produced. The currently-loaded pack is shown in
 *     the findings header and is not repeated here.
 *   - **The panel is dialog-styled.** Every panel in this TUI is a rounded-border box over the
 *     surface colour, so a panel that did not match would read as a different surface to the reader.
 *   - **`onSelect` is wired even though no route reloads the run.** The picker is informational here
 *     — the conformance run happens once before the renderer mounts (`index.tsx`) — but the callback
 *     is plumbed so a future change that does reload can plug into the same `<select>` without
 *     rewriting the route.
 */

import { listPacks, loadPack } from "@reasonsmith/core"
import { useTheme } from "../context/theme.tsx"

export function Packs() {
  const t = useTheme()

  const options = () =>
    listPacks().map((packId) => {
      const pack = loadPack(packId)
      return {
        name: packId,
        value: packId,
        description: pack.description,
      }
    })

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0} width="100%">
      <box
        flexDirection="column"
        flexGrow={1}
        minHeight={0}
        width="100%"
        borderStyle="rounded"
        borderColor={t.color.border}
        backgroundColor={t.color.surface}
        paddingLeft={1}
        paddingRight={1}
        title="Conformance packs"
        titleAlignment="left"
      >
        <select
          options={options()}
          flexGrow={1}
          minHeight={0}
          width="100%"
          backgroundColor={t.color.surface}
          textColor={t.color.text}
          focusedBackgroundColor={t.color.surfaceRaised}
          focusedTextColor={t.color.text}
          selectedBackgroundColor={t.color.surfaceRaised}
          selectedTextColor={t.color.text}
          descriptionColor={t.color.textSecondary}
          selectedDescriptionColor={t.color.text}
          showScrollIndicator
          showDescription
          showSelectionIndicator
          onSelect={(_index, option) => {
            // The conformance run happens once before the renderer mounts (`index.tsx`); selecting
            // a new pack here is a no-op in the current build. The callback is plumbed so a future
            // change that does reload can plug into the same `<select>` without rewriting the
            // route, and a reader gets immediate feedback that the selection was registered.
            if (option?.value !== undefined) {
              loadPack(String(option.value))
            }
          }}
        />
      </box>
    </box>
  )
}