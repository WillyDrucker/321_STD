# PROJECTNAME - Dev Audit

**Purpose:** Audit reference. Loaded by `/321 -DevAudit`. Holds this project's **measurable contracts** - anchor principles, structural rules, quality gates, and the exceptions that are deliberate. Always-on authoring preferences (comment length, naming, casing, house voice) live in auto-memory and are NOT restated here. Not a workflow document. The audit is a gate.

## The split

**Auto-memory owns how you write.** It loads on every session, so it holds the always-on preferences: comment discipline, naming, casing, no release stamps in source, no freshness stamps in memory, house voice.

**This file owns what this project contracts to.** Rules that can be measured against the source and would otherwise be argued about. **If a rule is already in auto-memory, it does not appear here.** Duplication is what lets a file like this rot while its copy stays right, and a rotted audit file is worse than none - it re-flags settled questions and trains everyone to skim.

## Anchor principles

These override every individual rule below.

1. **Small files win, cohesion shapes the cut.** At or under ~300 lines. Past 300 the model's edit accuracy drops and regressions cluster, so 10 x 300 beats 5 x 600. Cohesion decides HOW to split (along a real seam, into distinctly named modules), never WHETHER. Never fragment for the number alone, never keep a 400+ file whole for cohesion alone.
2. **One canonical home per concern.** A rule, token, or constant lives in exactly one file. Cross-reference, never duplicate.
3. **Anti-speculation.** No half-finished implementations, no design for hypothetical requirements. Cut exports with no caller, events with no subscriber, and abstractions built for the imagined third instance.
4. **Framework standards win first, ours adopt after.** The framework's idiom is the default. Our conventions apply in the space it leaves open, never over the top of it. **A framework-mandated file location, name, or API shape is never a finding.**
5. **Index registries as the spine.** `_index.json` owns AIDOCS paths, file keys, size budgets, and skill dispatch. Code reads from it. Nothing hardcodes one of those paths. (It is not a source-module registry - a source rename has no key here.)
6. **Fail at gates, not everywhere.** Loud failures concentrated at boundaries (validators, pre-flight checks, strict-uniqueness matches). Normal logic stays quiet.

**The duplication rule.** A canonical table, mapping, or business rule centralizes on the **second** copy - two tables that must never disagree is the most repeated defect there is. A generic *abstraction* waits for the **third** concrete instance. These are different thresholds on purpose.

## Contracts

Express a contract as a command with an expected count, so it can graduate into a lint gate instead of staying an argument. Fill this in as the project's real boundaries settle.

| Gate | Command | Expected |
|---|---|---|
| (fill in) | (fill in) | (fill in) |

## Sanctioned exceptions

Deliberate choices, written down **so the audit stops re-flagging them every pass.** This section is what makes an audit converge instead of oscillating. Add to it whenever a finding is examined and declined on the merits.

- **Engine-synced code is outside the size census.** `AIDOCS/tools` is owned by `/321 -UpdateSync`. A local trim there fights the next upstream sync, so an oversize engine file is upstream's fix, not this project's.
- **Justified wholes.** A file past 300 may stay whole when a lockstep test pins its source text - a parity test that reads the file as text makes a split churn the gate for no cohesion gain. Record the justification and re-judge it each `-FULL`.
- (fill in the project's own: barrels that are a real public API, schema versions in source, gated exports parked behind a user decision, timers that legitimately schedule.)

## Audit dimensions

### Code structure

- **File sizes.** ~300 is the target, not a cliff. 200 is an inspection trigger. 300-400: keep if genuinely cohesive. **400+: split outright.** Never split just to cross 300 - reaching for `-helpers` or `-main` is a "do not split" signal.
- **Directory size.** Soft 12 files. **A smell threshold, not a rule.** Above it, ask whether you can still predict each file's job from its name alone. If yes, leave it - a subfolder move that churns import paths for no lookup gain is the wrong fix.
- **Cohesion test.** One sentence with no "and" describes the file's job. "And" triggers inspection, not an automatic split.
- **Re-export on extraction.** Splitting a module others import keeps the original path as the public face. The split is an internal seam, never an API break.
- **Prefer direct imports over barrels.** A re-export index hides the real home. Barrels only where the framework expects one.
- **No dead exports.** Every export has a caller, unless the exception section says otherwise.

### File organization

- **One-way dependencies only.** A higher tier imports a lower tier, never the reverse. **Type-only imports count** - a type imported from a higher tier is still a tier inversion.
- **Pure helpers stay pure.** A shared lib layer never imports from services or features.

### Comments

Length and why-first discipline live in auto-memory. Project-specific only:

- **Source-true.** Never encode an unproven theory as fact. Log the observation, verify, then promote it to a comment.
- **`// best-effort`** is the explicit contract for a `try / catch` that intentionally swallows failure, so the swallow reads as deliberate rather than forgotten.
- **State the invariant the code cannot show.** When a comment states an invariant, check the code actually holds it.

### Error messages

Short, plain, no jargon. **Say what the user must do when they must do something.** An error whose whole job is "your password is too short" must say so.

### Modern patterns

- **ES modules.** No CommonJS in new code unless a runtime constraint demands it, and the exception documents itself in the module header.
- **Strict null handling.** No `any` escapes outside a documented framework shim carrying a why-comment.
- **Discriminated unions** over optional-field soup, so null-handling is compile-time.
- **Pure functions** where possible. I/O at boundaries.

Reference current library docs when modernizing. Patterns move, and the audit catches up by proposing an update to this file.

---

## Project specifics

Stack, quality gates, framework patterns, and deployment idioms below this line. The baseline above applies to every project using this template. Identity and architecture live in `PROJECTNAME_MEMORY.md`, not here.

**Quality gates.** (fill in the exact commands, and name any command that does NOT exist so nobody invents one.)

**Change impact map.** When you change X, update Y and Z. The single highest-value thing a mature project hands a cold session.

- (fill in: "new DB column" -> migration -> types -> query layer -> display)

(fill in the rest: styling, types, data access, naming, test policy)

## Open findings

Live, unresolved, and not doc problems. A finding examined and **declined** stays here with its reason, so the same argument does not reopen every sweep.

(none yet)
