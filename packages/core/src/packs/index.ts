/**
 * The built-in packs, registered with the loader.
 *
 * `src/reasonsmith/packs/*.toml` are *derived, not authored*: the ECOA pack quotes
 * `docs/legal-sources.md`, which is the retrieval record for the official statutory text. These
 * modules restate the same rows, and the fields are kept verbatim on purpose — a quote checked
 * against the print is the only thing keeping a pack attached to the law it names.
 */

import { Pack, registerPack } from "../spec.ts"
import { ecoaPack } from "./ecoa.ts"

let installed = false

/** Register every built-in pack. Idempotent; called by the package barrel. */
export function registerBuiltinPacks(): void {
  if (installed) return
  installed = true
  registerPack("ecoa", () => new Pack(ecoaPack()))
}

export { ecoaPack }
