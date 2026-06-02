# DEV-AUDIT customization patterns

**Purpose:** Optional sub-section shapes that earn their place under `## Project specifics` in `<PROJECT>_DEV-AUDIT.md`. Loaded on demand when a project's audit notes grow beyond the baseline. Not loaded at session start.

The baseline DEV-AUDIT template ships with anchor principles, hard rules, audit dimensions, and a `## Project specifics` placeholder. The four patterns below cover the recurring shapes projects add under that placeholder. Each is optional. A project earns the section by having something concrete to say.

## Pattern 1: Change impact map

Cross-cutting touchpoints code does not enforce. When X changes, also update Y and Z. Captures conventions that move together but live in different files. Useful when the codebase has chains of "if you touch this, also touch that" steps the type system cannot guard.

### Shape

```markdown
### Change impact map

When making these changes, update all affected files:

- **New DB column:** schema -> types -> service layer -> the provider extract -> display component.
- **New cross-island state:** add atom to filterStore.ts -> consume via useStore() in islands.
- **Scraper pipeline change:** runbook -> contract -> per-provider folder if affected.
```

### When to add

When a feature change naturally touches three or more files in a predictable chain. If the chain is two files, a comment or named export usually carries the contract. The map earns its space at three-or-more.

## Pattern 2: Project invariant sweeps

Machine-checkable rules the audit verifies on a focused pass. Grep patterns, structural cross-references, banned syntax. Each entry names the rule and the command or check that verifies it.

### Shape

```markdown
### Project invariant sweeps

- Em-dash / arrow scan: `git grep -nP '[\x{2014}\x{2192}\x{2190}]'` over src/. None in code comments or any prose under our authorship.
- Settings dual-anchoring: every "scope": "application" key in package.json must appear in BOTH src/shared/workspaceScopeHeal.ts AND src/shared/resetSettings.ts.
- Persistent writes go through shared/fs/atomicWrite.ts, never raw writeFileSync.
- console.log is banned in src/. The .appendLine( call is allowed only at the designated logger entry points.
```

### When to add

When the project has a rule that can be expressed as a one-liner check (a grep, a structural mirror, a banned identifier). The sweep section gives the audit a concrete list to run on a focused pass.

## Pattern 3: Do not refactor

Files that look like split / refactor candidates but have constraints (runtime bundling, isolated dep resolution, vendored code). Each entry names the file and the constraint, so an AI doing a `-DevAudit` pass does not propose to refactor them.

### Shape

```markdown
### Do not refactor

- src/myproject/bin/ is runtime-bundled. channel.mjs ships to ~/.myproject/ and resolves its own deps.
- src/vendor/some-lib.ts is vendored. Refresh from upstream, never edit in place.
```

### When to add

When at least one file in the project would be a natural refactor target but has a constraint that makes refactoring it wrong. Without this section, every `-DevAudit` pass re-proposes the same refactor.

## Pattern 4: File-size posture override

Project-specific override of the baseline file-size cap with rationale. The baseline anchor principle leans toward smaller files (~300 lines target). A project where the natural code grain runs larger (single cohesive state machines, generated code, complex parsers) can override with a documented reason.

### Shape

```markdown
### File-size posture

Files at 400-550 LoC are typically single cohesive state machines (statusBarItem, phaseParser, usageServiceBase, turnMonitor, appServerClient). Default to leaving them above that threshold unless a genuinely new concern emerges.
```

### When to add

When a project has documented exceptions to the anchor principle. Empty otherwise. This formalizes that anchor principles are defaults projects can refine with cause, not absolute rules.
