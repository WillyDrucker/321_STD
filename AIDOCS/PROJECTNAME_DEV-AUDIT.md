# PROJECTNAME - Dev Audit

**Purpose:** Audit reference. Loaded by `/321 -DevAudit`. The anchor principles, hard rules, and audit dimensions here apply to every project. Stack-specific and project-tied rules live in `## Project specifics` at the bottom. Not a workflow document - the audit is a gate, not iteration guidance.

## Anchor principles

These override every individual rule below.

1. **Cohesion over count.** One concept per file. If the file's job needs "and" to describe, inspect. A 600-line cohesive file beats three fragmented 200-line files.
2. **Names are contracts.** Intuitive domain vocabulary. A name should let a reader predict the function's signature before opening it. No generic labels (`utils`, `helpers`, `misc`).
3. **One canonical home per concern.** A rule, token, or pattern lives in exactly one file. Cross-reference, do not duplicate. Promote a shared helper when the same logic appears in two places.
4. **Index registries as the spine.** `_index.json` owns paths, sizes, skill bodies, customizations, release profile. Code reads from it. Nothing hardcodes a path.
5. **Greppable + intuitive structure.** When grep alone falls short, parent-folder plus filename compensates. Folder names carry domain too.
6. **Fail at gates, not everywhere.** Loud failures concentrated at boundaries (validator, pre-flight checks, strict-uniqueness matches). Normal logic stays quiet.
7. **Anti-speculation.** No half-finished implementations. No design for hypothetical future requirements. Cut events with no subscriber, exports with no caller, abstractions for the imagined third instance. Reach for an abstraction when the third concrete instance lands.

## Hard rules

Audit-facing copy of the auto-memory inventory in `AIDOCS/automemory`. The audit applies these whether or not the rules loaded at session start. Same inventory, audit-facing wording.

- [Code comments](feedback_code_comments.md) - comments that earn their space. Worth writing: module headers, constraints, failure modes, contracts. Surplus context goes to a doc.
- [Doc purpose header](feedback_doc_purpose_header.md) - every project MD file gets a **Purpose:** callout after the H1.
- [Lean docs](feedback_lean_docs.md) - top tiers stay lean. Size targets live in this file under Code structure.
- [No subagents for review](feedback_no_subagents_for_review.md) - inspect manually with Read/Grep/Glob.
- [No versions in code](feedback_no_versions_in_code.md) - versions live in package.json, dates live in git.
- [TEMP folder usage](feedback_temp_folder_usage.md) - TEMP/ at project root for all temporary files.
- [No em dashes](feedback_no_em_dashes.md) - no em dashes or semicolons in any prose under our authorship.
- [No dates in memory](feedback_no_dates_in_memory.md) - no dates or version stamps in memory or session files. LIFO carries time signal.
- [Naming and renaming](feedback_naming.md) - names own their domain. Renames stay in-domain and propagate name, key, and references in one pass.

## Audit dimensions

### Code structure

- **Module index.** A registry doc lists every module and its key exports. Update on add or rename.
- **File sizes.** Soft 200 (inspection trigger). Hard 400 (split or justify cohesion). Cohesive 600 (ceiling). `-FULL` mode sweeps everything over 300 for a cohesion review regardless.
- **Directory size.** Soft 12 files. Above that, can you predict each file's job from the name alone? If not, consolidate.
- **Cohesion test.** One sentence with no "and" describes the file's job. "And" is an inspection trigger, not an automatic split.
- **Split heuristics.** Only when the result yields two semantically distinct names. Reaching for `-helpers` or `-main` is a "don't split" signal.
- **Prefer direct imports over barrel re-exports.** Re-export indexes hide the real home. Use barrels only where the framework expects them (package public API, framework convention).
- **No dead exports.** Every export has a caller.

### File organization

- **One-way dependency only.** Higher tier imports lower tier, never the reverse. Type-only imports count - a type import from a higher tier is still a tier inversion.
- **Feature-based over type-based** for shells with many features. Related code lives together in `features/<name>/`. Type-based folders (`components/`, `services/`, `hooks/`) are fine when the count stays small.
- **Pure helpers stay pure.** `lib/` / `shared/` never import from `services/` or `features/`. Direction enforced at the boundary.
- **Documented exceptions live in MEMORY.** Grandfathered tier inversions are project-specific. Don't list them here.

### Naming

See `feedback_naming` in auto-memory for the always-on naming and renaming principle.

- **Filenames carry full responsibility.** A file that owns multiple concerns names them. `settingsPicker.ts` (owns theme + locale + timezone), not `themePicker.ts`.
- **Split by domain concept, never numeric suffix.** `threadPersistence.ts` -> `threadRecord.ts` + `threadNaming.ts`. Never `threadPersistence1.ts`.
- **Pre-write check.** "What does this file own?" If the answer is "utility stuff" or "common helpers", sharpen the concept first.
- **Booleans read as predicates.** `isLoaded`, `hasAnchor`, `shouldPrune`, `isPaused`.
- **No generic dumping grounds.** Never `utils.ts`, `helpers.ts`, `misc.ts`, `common.ts`. Reinforces anchor principle #2.
- **Rename in-domain, propagate in one pass.** A rename stays within the thing's domain and moves the name, its `_index.json` key, and every reference together. A surviving reference to the old name is a finding.

### Comments policy

See `feedback_code_comments` in auto-memory for the principle and the worth-writing / delete-on-sight rules.

- **Module headers.** Four to six lines at the top of every code file. File's job + load-bearing invariants. Forward-facing voice.
- **Source-true only.** Do not encode unproven theories as fact. If you do not have wire-level proof, log the observation, verify, then promote to a comment.
- **Best-effort contract.** `// best-effort` is the explicit contract for any `try { ... } catch { /* ... */ }` that intentionally swallows failure. The comment makes the swallow read as deliberate.
- **Error messages.** Passive, friendly, short, no jargon. Never imply the user must act.

### Modern patterns

Baseline conventions every project inherits.

- **ES modules.** No CommonJS in new code.
- **Async / await** over callback chains.
- **Strict null handling.** No `any` escapes. Optional chaining + nullish coalescing where they reduce noise.
- **Discriminated unions** over optional-field soup. State shapes use a discriminator tag (`{ status: "loading" }` / `{ status: "ok", data }`) so null-handling is compile-time, not runtime.
- **Pure functions** where possible. I/O at boundaries.
- **Prefer immutable updates** for shared state unless the framework owns mutation.

Reference Context7 or current library docs when modernizing. Patterns move. The audit catches up by suggesting DEV-AUDIT updates.

---

## Project specifics

Stack-specific conventions, framework patterns, deployment idioms, language-specific style rules below this line. The baseline above applies to every project using this template. Architecture / decisions / rules tied to the codebase identity live in `PROJECTNAME_MEMORY.md`, not here.

(fill in)
