# PROJECTNAME - Dev Audit

**Purpose:** Audit reference. Loaded by `/321 -DevAudit`. Holds this project's **measurable contracts** - anchor principles, structural rules, quality gates, and the exceptions that are deliberate. Always-on authoring preferences (comment length, naming, casing, house voice) live in auto-memory and are NOT restated here. Not a workflow document. The audit is a gate.

## The split

**Auto-memory owns how you write.** It loads on every session, so it holds the always-on preferences: comment discipline, naming, casing, no release stamps in source, no freshness stamps in memory, house voice.

**This file owns what this project contracts to.** Rules that can be measured against the source and would otherwise be argued about. **If a rule is already in auto-memory, it does not appear here.** Duplication is what lets a file like this rot while its copy stays right, and a rotted audit file is worse than none - it re-flags settled questions and trains everyone to skim.

## How to audit

Steering, not a checklist.

- **Every finding names the contract it breaks and the concrete cost.** A pattern match with no named contract and no traced defect is not a finding.
- **Judgment beats enumeration.** This file steers decisions rather than pre-deciding every case. A situation it does not cover is reasoned from the anchor principles and surfaced as a proposal, never asserted as a violation.
- **A gate that is not running is not a gate.** Never quote a check as covering what it does not run against, and never trust a new gate until a planted violation makes it fail.
- **Sanctioned exceptions are settled.** Re-flagging one is a finding against this file, not the code.

## Anchor principles

These override every individual rule below.

1. **Small files win, cohesion shapes the cut.** 300 lines is the target and 350 the ceiling. Past 300 the model's edit accuracy drops and regressions cluster, so 10 x 300 beats 5 x 600. Cohesion decides HOW to split (along a real seam, into distinctly named modules), never WHETHER: 300 to 350 stays whole only when the split would break continuity, past 350 it splits. Reaching for `-helpers` or `-main` is a "do not split" signal. A split that leaves no rule for where new code lands regrows, so name the destination file for the next feature in the area. The ceiling is judged here, at the audit, never mid-change.
2. **One canonical home per concern.** A rule, token, or constant lives in exactly one file. Cross-reference, never duplicate.
3. **Anti-speculation.** No half-finished implementations, no design for hypothetical requirements. Cut exports with no caller, events with no subscriber, and abstractions built for the imagined third instance.
4. **Framework standards win first, ours adopt after.** The framework's idiom is the default. Our conventions apply in the space it leaves open, never over the top of it. **A framework-mandated file location, name, or API shape is never a finding.**
5. **Index registries as the spine.** `_index.json` owns AIDOCS paths, file keys, size budgets, and skill dispatch. Code reads from it. Nothing hardcodes one of those paths. (It is not a source-module registry - a source rename has no key here.)
6. **Fail at gates, not everywhere.** Loud failures concentrated at boundaries (validators, pre-flight checks, strict-uniqueness matches). Normal logic stays quiet.

**The duplication rule.** A canonical table, mapping, or business rule centralizes on the **second** copy - two tables that must never disagree is the most repeated defect there is. A generic *abstraction* waits for the **third** concrete instance. These are different thresholds on purpose.

## Contracts

Express a contract as a command with an expected count, so it can graduate into a lint gate instead of staying an argument. The first three hold for every project. Add the project's own as its real boundaries settle.

| Gate | Command | Expected |
|---|---|---|
| Registry, structure, publish gate | `node AIDOCS/tools/engine.mjs doctor` | exit 0 |
| House voice | `node AIDOCS/tools/engine.mjs scrub --check` | clean |
| File size | the project's census over its source | no file past 350 lines |
| (fill in) | (fill in) | (fill in) |

## Sanctioned exceptions

Deliberate choices, written down **so the audit stops re-flagging them every pass.** This section is what makes an audit converge instead of oscillating. Add to it whenever a finding is examined and declined on the merits.

- **Engine-synced code is outside the size census.** `AIDOCS/tools` is owned by `/321 -UpdateSync`. A local trim there fights the next upstream sync, so an oversize engine file is upstream's fix, not this project's.
- **Justified wholes.** A file past 350 may stay whole when a lockstep test pins its source text - a parity test that reads the file as text makes a split churn the gate for no cohesion gain. Record the justification and re-judge it each `-FULL`.
- (fill in the project's own: barrels that are a real public API, schema versions in source, gated exports parked behind a user decision, timers that legitimately schedule.)

## Audit dimensions

### Code structure

- **File sizes.** 300 is the target, 350 the ceiling, 200 an inspection trigger. Never split just to cross 300.
- **Directory size.** Soft 12 files. **A smell threshold, not a rule.** Above it, ask whether you can still predict each file's job from its name alone. If yes, leave it - a subfolder move that churns import paths for no lookup gain is the wrong fix.
- **Cohesion test.** One sentence with no "and" describes the file's job. "And" triggers inspection, not an automatic split.
- **Repoint on extraction.** Splitting a module others import moves every importer to the new home in the same pass. A re-export at the old path lives only while a move is in flight, never as the public face: a barrel hides the real home. Barrels only where the framework expects one.
- **No dead exports.** Every export has a caller, unless the exception section says otherwise.

### File organization

- **One-way dependencies only.** A higher tier imports a lower tier, never the reverse. **Type-only imports count** - a type imported from a higher tier is still a tier inversion.
- **Pure helpers stay pure.** A shared lib layer never imports from services or features.

### Comments

Length and why-first discipline live in auto-memory. Project-specific only:

- **Source-true.** Never encode an unproven theory as fact. Log the observation, verify, then promote it to a comment.
- **`// best-effort`** is the explicit contract for a `try / catch` that intentionally swallows failure, so the swallow reads as deliberate rather than forgotten.
- **State the invariant the code cannot show.** When a comment states an invariant, check the code actually holds it.
- **History only where there is friction.** A comment may say what used to be true only where a reader would otherwise repeat a mistake, and it opens with `history:` so a chronology scan knows it is deliberate.

### Error messages

Short, plain, no jargon. **Say what the user must do when they must do something.** An error whose whole job is "your password is too short" must say so. A refusal that lists accepted values lists all of them.

### Modern patterns

- **ES modules.** No CommonJS in new code unless a runtime constraint demands it, and the exception documents itself in the module header.
- **Strict null handling.** No `any` escapes outside a documented framework shim carrying a why-comment.
- **Discriminated unions** over optional-field soup, so null-handling is compile-time.
- **Pure functions** where possible. I/O at boundaries.

Reference current library docs when modernizing. Patterns move, and the audit catches up by proposing an update to this file.

## Docs are source too

The anchor principles applied to the project's docs, each in the place it actually fails.

- **One canonical home, and prose is where it breaks.** A threshold, table, or ordering lives in one doc and every other doc points at it. A number restated for the reader's convenience is a number that will disagree with itself.
- **Source-true, checked against the code rather than remembered.** A doc that asserts an invariant states what the code holds. A doc that is wrong is not out of date, and someone will eventually "fix" the code to match it.
- **A proposal must look like a proposal.** Designed-but-unbuilt material sits in a visibly non-contractual section, or a reader builds against it.
- **Build-phase archaeology never lands in a doc.** Phase ids, pass numbers, and narration of a codebase that no longer exists belong to git. A doc owns what is true now. When a plan is archived, sweep the references to it in the same pass.
- **A list needs an exit rule.** A settled entry leaves the open list, and a status label is reconciled against the thing it describes, or the list only ever grows.

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
