/**
 * The settings route: enterprise configuration panel summarising the surface.
 */

import { For } from "solid-js"
import { useDialog } from "../ui/dialog.tsx"
import { DialogHelp } from "../ui/dialog-help.tsx"
import { DialogTheme } from "../ui/dialog-theme.tsx"
import { AUDIENCE_HELP, AUDIENCE_LABELS } from "../ui/audiences.ts"
import { Clickable } from "../ui/clickable.tsx"
import { useKeybind } from "../context/keybind.tsx"
import { useReport } from "../context/report.tsx"
import { useRoute } from "../context/route.tsx"
import { useTheme } from "../context/theme.tsx"

export function Settings() {
  const theme = useTheme()
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
        borderColor={theme.color.border}
        backgroundColor={theme.color.surface}
        paddingLeft={1}
        paddingRight={1}
        title="Settings"
        titleAlignment="left"
      >
        <Section heading="Theme">
          <Row label="palette" value={theme.paletteId()} />
          <Row label="cycle  (t)" value="next enterprise palette" onClick={() => theme.cyclePalette()} />
          <Row
            label={`picker  (${keybind.printFor("theme")})`}
            value="open theme dialog"
            onClick={() => dialog.replace(() => <DialogTheme />)}
          />
          <Row label="audience" value={audienceName()} onClick={() => report.cycleAudience()} />
          <Row label={`cycle  (${audienceKey()})`} value="next audience" onClick={() => report.cycleAudience()} />
          <Row label="role" value={audienceRole()} />
        </Section>

        <Section heading="Leader key">
          <Row label="activate" value="ctrl+x" />
          <Row label="shortcuts" value="h help · t theme · a audience · L limits · p packs · s systems · q quit" />
        </Section>

        <Section heading="Packs">
          <Row label="active pack" value={report.report.pack_id} />
          <Row label="system declaration" value={scopeDomains()} />
          <Row label={`open  (${packsKey()})`} value="open pack picker" onClick={openPacks} />
        </Section>

        <Section heading="Systems">
          <Row label="active system" value={report.report.system_name} />
          <Row label={`open  (${systemsKey()})`} value="open system picker" onClick={openSystems} />
        </Section>

        <Section heading="Navigation">
          <For each={keybind.bindings}>{(binding) => <Row label={binding.keys} value={binding.label} />}</For>
        </Section>

        <Section heading="Help">
          <Row label={`open  (${helpKey()})`} value="keybindings and audiences" onClick={openHelp} />
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
  if (props.onClick) {
    return (
      <Clickable cursor="pointer" flexDirection="row" gap={1} height={1} width="100%" onClick={props.onClick}>
        <text fg={t.color.text} attributes={t.attr.bold} wrapMode="none" width={20} content={props.label} />
        <text
          fg={t.color.info}
          attributes={t.attr.underline}
          wrapMode="none"
          flexGrow={1}
          minWidth={0}
          content={props.value}
        />
      </Clickable>
    )
  }
  return (
    <box flexDirection="row" gap={1} height={1} width="100%">
      <text fg={t.color.text} attributes={t.attr.bold} wrapMode="none" width={20} content={props.label} />
      <text fg={t.color.textSecondary} wrapMode="none" flexGrow={1} minWidth={0} content={props.value} />
    </box>
  )
}
