/**
 * The settings route: a single dialog-styled panel that summarises the surface.
 *
 * Five sections, each a labelled heading plus a short list of rows:
 *
 *   - **Theme** — the active audience, the cycle key, and the audience's role (its purpose, from
 *     `AUDIENCE_HELP`). The audience *is* the theme — a projection changes what is shown and never
 *     what is claimed, and a reader who is not told which one they are in cannot tell a field that
 *     is absent from a field that was suppressed.
 *   - **Packs** — the active pack id, the system's declared scope and domains, and the cycle key
 *     for the picker.
 *   - **Systems** — the cycle key for the system picker. The currently-loaded system is shown in
 *     the masthead and is not repeated here, the same way the packs route reads.
 *   - **Navigation** — every binding the keybind context knows about, key beside label, read from
 *     `useKeybind().bindings` so the panel cannot drift out of step with the footer.
 *   - **Help** — the key that opens the help dialog. The dialog itself is the source of detail;
 *     this row names the shortcut.
 *
 * What a reader must not break:
 *
 *   - **The panel is dialog-styled.** Every panel in this TUI is a rounded-border box over the
 *     surface colour, matching the packs and systems routes beside it.
 *   - **The audience role comes from `AUDIENCE_HELP`.** A settings panel that paraphrased the role
 *     would be this TUI making a claim about the projections in its own voice, which is the move
 *     every rule in this repository is written to prevent. The wording is the audience help
 *     dialog's own.
 */

import { For } from "solid-js"
import { useDialog } from "../ui/dialog.tsx"
import { DialogHelp } from "../ui/dialog-help.tsx"
import { AUDIENCE_HELP, AUDIENCE_LABELS } from "../ui/audiences.ts"
import { useKeybind } from "../context/keybind.tsx"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"

export function Settings() {
  const t = useTheme()
  const report = useReport()
  const route = useRoute()
  const keybind = useKeybind()
  const dialog = useDialog()

  const audienceName = () => AUDIENCE_LABELS[report.audience()] ?? report.audience()
  const audienceRole = () => AUDIENCE_HELP[report.audience()] ?? ""

  const audienceKey = () => keybind.printFor("audience")
  const packsKey = () => keybind.printFor("packs")
  const systemsKey = () => keybind.printFor("systems")
  const helpKey = () => keybind.printFor("help")

  const scopeDomains = () => {
    const parts: string[] = []
    const scope = report.report.system_scope
    if (scope) parts.push(`scope ${scope}`)
    const domains = report.report.system_domains
    if (domains.length > 0) parts.push(`domains ${domains.join(", ")}`)
    return parts.length > 0 ? parts.join("  ·  ") : "undeclared"
  }

  const openPacks = () => route.navigate({ type: "packs" })
  const openSystems = () => route.navigate({ type: "systems" })
  const openHelp = () => dialog.replace(() => <DialogHelp />)

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
        title="Settings"
        titleAlignment="left"
      >
        <Section heading="Theme">
          <Row label="audience" value={audienceName()} />
          <Row label={`cycle  (${audienceKey()})`} value="next audience" />
          <Row label="role" value={audienceRole()} />
        </Section>

        <Section heading="Packs">
          <Row label="active pack" value={report.report.pack_id} />
          <Row label="system declaration" value={scopeDomains()} />
          <Row
            label={`open  (${packsKey()})`}
            value="open pack picker"
            onClick={openPacks}
          />
        </Section>

        <Section heading="Systems">
          <Row label="active system" value={report.report.system_name} />
          <Row
            label={`open  (${systemsKey()})`}
            value="open system picker"
            onClick={openSystems}
          />
        </Section>

        <Section heading="Navigation">
          <For each={keybind.bindings}>
            {(binding) => (
              <Row label={binding.keys} value={binding.label} />
            )}
          </For>
        </Section>

        <Section heading="Help">
          <Row
            label={`open  (${helpKey()})`}
            value="keybindings and audiences"
            onClick={openHelp}
          />
        </Section>
      </box>
    </box>
  )
}

function Section(props: { heading: string; children: import("solid-js").JSX.Element }) {
  const t = useTheme()
  return (
    <box
      flexDirection="column"
      marginTop={1}
      borderStyle="rounded"
      borderColor={t.color.borderSubtle}
      title={props.heading}
      titleAlignment="left"
      paddingLeft={1}
      paddingRight={1}
    >
      {props.children}
    </box>
  )
}

function Row(props: { label: string; value: string; onClick?: () => void }) {
  const t = useTheme()
  return (
    <box
      flexDirection="row"
      gap={1}
      height={1}
      width="100%"
      onMouseUp={() => props.onClick?.()}
    >
      <text
        fg={t.color.text}
        attributes={t.attr.bold}
        wrapMode="none"
        width={20}
        content={props.label}
      />
      <text
        fg={props.onClick ? t.color.info : t.color.textSecondary}
        attributes={props.onClick ? t.attr.underline : t.attr.none}
        wrapMode="none"
        flexGrow={1}
        minWidth={0}
        content={props.value}
      />
    </box>
  )
}