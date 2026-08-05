/**
 * `@reasonsmith/systems` — the demonstration systems, and the answer to "how does any model get
 * into this tool?"
 *
 * Three systems, checked against the *same* binding duty, reaching different rungs — because which
 * rung a duty reaches is a fact about what the system exposes and not about which word a pack author
 * typed:
 *
 *   - `neuralScorer` — a log and nothing else. `observed` is its ceiling, and raising it means
 *     changing the *system*, never the adapter.
 *   - `probabilisticScorer` — replayable through `decide()`, so it reaches `probed`.
 *   - `deployedCreditSystem` — exposes `artifact()`, so the reason-adequacy duty reaches the
 *     certificate rung and comes back **violated** while the *form* duty on the same clause passes.
 *
 * That last one is the point of the set: before it, a reader who ran every shipped example never saw
 * the tool report a breach. `truncating-credit-system.test.ts` pins it.
 *
 * **Python's third system is not this one, and the difference is a limit of this build.** There the
 * trio ends with a symbolic rule set reaching `proved`, over every input its declared constraints
 * admit. That rung needs an SMT solver and there is none here, so porting that system would have
 * demonstrated a ceiling of `probed` under a name promising more. The rung ladder shipped here is
 * `observed` / `probed`, and `@reasonsmith/engines`' `MISSING_RUNGS` says which rungs are absent and
 * why. Nothing weaker stands in for them.
 */

export * from "./ground-program.ts"
export * from "./truncating-credit-system.ts"
export * from "./neural-scorer.ts"
export * from "./probabilistic-scorer.ts"
