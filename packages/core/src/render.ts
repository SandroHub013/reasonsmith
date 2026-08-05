/**
 * The renderings of a conformance report.
 *
 * Ported from the text half of `src/reasonsmith/render.py`. The renderer lives here rather than on
 * `ConformanceReport` for the reason it does in Python: a rendering edit should be a `render.ts`
 * edit and nothing in the result model.
 *
 * Two conventions bear stating because breaking either is silent:
 *
 *   - A violated finding names the offending decision record by the record's **own** `decision_id`,
 *     the same identifier the JSON rendering uses, and falls back to the step index only when a
 *     record carries no identifier — so a reader is never handed an empty name. That line lives on
 *     the text surface and was deliberately not moved into an engine summary, because
 *     `evidence_summary` travels into the JSON, so editing an engine to fix a redaction would change
 *     a second rendering.
 *   - `basisSentence` is the one place any rendering words an evidence basis, and the lay projection
 *     is shown **no basis** on the flag that already withholds the strength.
 */

import { DECISION_RECORD_SIGNAL, type ConformanceReport, type RequirementResult } from "./report.ts"
import { PROBE_BUDGET_KEY, TRUTH_DEGREE_KEY, VACUOUS_TRIGGER_KEY } from "./report.ts"
import { BASIS_RUNGS, type EvidenceBasis } from "./verdict.ts"

/** The five audiences a report may be projected for. */
export const AUDIENCES = [
  "expert",
  "compliance-officer",
  "engineer",
  "executive",
  "affected-individual",
] as const
export type Audience = (typeof AUDIENCES)[number]

export interface AudienceProjection {
  /** Show each result's evidence strength. Withheld from the lay projection. */
  readonly strength: boolean
  /** Show the engine's own account of the evidence. */
  readonly evidence: boolean
  /** Show the search budget, the probe counts and the raw details. */
  readonly mechanism: boolean
  /** Show the clause text the duty was drawn from. */
  readonly clause: boolean
  /**
   * The one field that *emits* rather than suppresses: the plain account of what the log said,
   * quoted and never paraphrased.
   */
  readonly plainAccount: boolean
}

export const PROJECTIONS: Record<Audience, AudienceProjection> = {
  expert: { strength: true, evidence: true, mechanism: true, clause: true, plainAccount: false },
  "compliance-officer": {
    strength: true,
    evidence: true,
    mechanism: false,
    clause: true,
    plainAccount: false,
  },
  engineer: { strength: true, evidence: true, mechanism: true, clause: false, plainAccount: false },
  executive: { strength: true, evidence: false, mechanism: false, clause: false, plainAccount: false },
  "affected-individual": {
    strength: false,
    evidence: false,
    mechanism: false,
    clause: false,
    plainAccount: true,
  },
}

const VERDICT_MARK: Record<string, string> = {
  satisfied: "PASS",
  violated: "FAIL",
  inconclusive: "----",
  not_applicable: "n/a ",
}

/**
 * How a basis is worded, once. A ceiling reads as the *duty's* rather than as an exposure the system
 * withheld, which is the whole reason the basis is a second coordinate and not four more rungs.
 */
export function basisSentence(basis: EvidenceBasis): string {
  const rungs = BASIS_RUNGS[basis]
  switch (basis) {
    case "behavioural":
      return `evidence about the system's own executions, one at a time (rungs: ${rungs.join(", ")})`
    case "relational":
      return `evidence about a pair of executions — a 2-safety property, which no trace establishes (rungs: ${rungs.join(", ")})`
    case "artifact":
      return `evidence measured against the inference artefact behind a decision (rungs: ${rungs.join(", ")})`
    case "assessment":
      return "a predicate an authority applies rather than anything measured from the system (no rung on the lattice)"
  }
}

/** The offending record's own identifier, or the step index when it carries none. */
function offendingName(result: RequirementResult): string | null {
  const segment = result.details.offending_trace_segment
  const indices = result.details.violation_step_indices
  if (!Array.isArray(segment) || segment.length === 0) return null
  const first = segment[0] as Record<string, unknown>
  const id = first?.decision_id ?? first?.[DECISION_RECORD_SIGNAL]
  if (typeof id === "string" && id.trim()) return id.trim()
  if (Array.isArray(indices) && indices.length > 0) return `decision #${String(indices[0])}`
  return "decision #0"
}

function rule(width = 78): string {
  return "─".repeat(width)
}

function wrap(text: string, width: number, indent: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(indent + line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(indent + line)
  return lines
}

function renderResult(result: RequirementResult, view: AudienceProjection): string[] {
  const lines: string[] = []
  const mark = VERDICT_MARK[result.verdict] ?? "????"
  const strength = view.strength ? ` [${result.strength ?? "not evaluated"}]` : ""
  lines.push(`  ${mark}  ${result.requirement_id}${strength}`)
  if (view.clause) lines.push(`        ${result.source_clause}`)
  if (view.strength) lines.push(`        basis: ${basisSentence(result.basis)}`)
  if (result.signals_missing.length > 0) {
    lines.push(`        missing signals: ${result.signals_missing.join(", ")}`)
  }
  const offending = offendingName(result)
  if (offending && result.verdict === "violated") {
    lines.push(`        first offending decision: ${offending}`)
  }
  if (view.evidence && result.evidence_summary) {
    lines.push(...wrap(result.evidence_summary, 68, "        "))
  }
  if (view.mechanism) {
    const budget = result.details[PROBE_BUDGET_KEY] as Record<string, unknown> | undefined
    if (budget) {
      lines.push(`        probe budget: ${String(budget.trials)} trial(s); seed ${String(budget.seed)}`)
      const space = budget.input_space
      if (space && typeof space === "object") {
        for (const [key, value] of Object.entries(space as Record<string, unknown>)) {
          lines.push(`          ${key}: ${String(value)}`)
        }
      }
    }
    const vacuous = result.details[VACUOUS_TRIGGER_KEY] as Record<string, unknown> | undefined
    if (vacuous) {
      lines.push(`        trigger never fired: ${String(vacuous.antecedent)} over ${String(vacuous.domain)}`)
    }
    const degree = result.details[TRUTH_DEGREE_KEY] as Record<string, unknown> | undefined
    if (degree) {
      lines.push(`        truth degree: ${String(degree.degree)} over the ${String(degree.algebra)} algebra`)
    }
  }
  return lines
}

/**
 * The lay projection's own sections: the decision and the reason, quoted out of the log, and the
 * reasons a measurement found the notice left unstated. It paraphrases no statute and explains no
 * decision.
 */
function laySections(report: ConformanceReport): string[] {
  const lines: string[] = []
  lines.push("", "WHAT THE SYSTEM RECORDED ABOUT THE DECISIONS", rule())
  if (report.decisions.length === 0) {
    lines.push("  This run read no decision log, so there is nothing here to quote.")
  }
  for (const account of report.decisions) {
    if (account.decision) lines.push(`  Decision: ${account.decision}`)
    if (account.reason) lines.push(`  Reason given: ${account.reason}`)
    lines.push("")
  }
  const measured = report.results.filter(
    (r) => r.verdict === "violated" && r.basis === "artifact",
  )
  if (measured.length > 0) {
    lines.push("REASONS THE MEASUREMENT FOUND LEFT UNSTATED", rule())
    for (const result of measured) {
      const certificates = result.details.certificates
      if (!Array.isArray(certificates)) continue
      for (const cert of certificates as Record<string, unknown>[]) {
        const missing = cert.missing_reasons
        if (Array.isArray(missing) && missing.length > 0) {
          for (const reason of missing) lines.push(`  · ${String(reason)}`)
        }
      }
    }
    lines.push("")
  }
  return lines
}

/** The text rendering, projected for `audience`. */
export function renderText(report: ConformanceReport, audience: Audience = "expert"): string {
  const view = PROJECTIONS[audience] ?? PROJECTIONS.expert
  const lines: string[] = []

  lines.push(rule("=".length * 78))
  lines.push("REASONSMITH CONFORMANCE REPORT")
  lines.push(rule())
  lines.push(`System:      ${report.system_name}`)
  lines.push(`Pack:        ${report.pack_id}`)
  lines.push(`Scope:       ${report.system_scope ?? "undeclared"}`)
  lines.push(
    `Domains:     ${report.system_domains.length > 0 ? report.system_domains.join(", ") : "undeclared"}`,
  )
  lines.push(`Time domain: ${report.time_domain}`)
  lines.push("")
  lines.push(report.headline)
  lines.push("")

  lines.push("FINDINGS")
  lines.push(rule())
  for (const result of report.results) {
    lines.push(...renderResult(result, view))
    lines.push("")
  }

  const notice = report.undeclaredDomainNotice
  if (notice) {
    lines.push("NOTICE")
    lines.push(rule())
    lines.push(...wrap(notice, 76, "  "))
    lines.push("")
  }

  if (view.plainAccount) lines.push(...laySections(report))

  lines.push("LIMITS")
  lines.push(rule())
  lines.push(...wrap(report.limits, 76, "  "))
  return lines.join("\n")
}
