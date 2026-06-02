# Skill patterns

**Purpose:** Reference for skill body authoring conventions, beyond the canonical baseline a fresh `init` lays. Loaded on demand when adding a new custom skill or evolving an existing one. Not loaded at session start.

The naming convention is the foundation - filename, flag, and dispatch key stay in sync mechanically. The three patterns after cover the recurring authoring shapes that earn their place in custom skills.

## Naming convention

A skill has three forms. The body filename carries the domain. The engine `sync` command derives the flag and the dispatch key from it.

| Form | Pattern | Example |
|---|---|---|
| Body filename | `SKILL_<DOMAIN>[-<SUBDOMAIN>].md` in `AIDOCS/SKILL/` | `SKILL_UPDATE-SESSION.md` |
| Flag (display) | `-<CamelCase>` (each domain word capitalized, no internal hyphen) | `-UpdateSession` |
| Dispatch key | lowercase concat, no hyphen | `updatesession` |

Hyphens between domain words exist for readability in the filename only. They disappear in the flag and the key. A reader scanning any one form can derive the other two without lookup.

### Canonical inventory

| Filename | Flag | Key |
|---|---|---|
| `SKILL_UPDATE.md` | `-Update` | `update` |
| `SKILL_UPDATE-SESSION.md` | `-UpdateSession` | `updatesession` |
| `SKILL_UPDATE-MEMORY.md` | `-UpdateMemory` | `updatememory` |
| `SKILL_UPDATE-SYNC.md` | `-UpdateSync` | `updatesync` |
| `SKILL_AUTO-PUSH.md` | `-AutoPush` | `autopush` |
| `SKILL_DEV-AUDIT.md` | `-DevAudit` | `devaudit` |
| `SKILL_SETUP.md` | `-Setup` | `setup` |
| `SKILL_COMPACT.md` | `-Compact` | `compact` |

### Ordering compound names

Lead with the action, follow with the target. `-UpdateScraper`, not `-ScraperUpdate`. The canonical update lanes (`-UpdateSession`, `-UpdateMemory`, `-UpdateSync`) all read action-first, and custom update skills follow the same shape.

| Filename | Flag | Key |
|---|---|---|
| `SKILL_UPDATE-SCRAPER.md` | `-UpdateScraper` | `updatescraper` |
| `SKILL_DB-BACKUP.md` | `-DbBackup` | `dbbackup` |
| `SKILL_KILL-SWITCH.md` | `-KillSwitch` | `killswitch` |
| `SKILL_PUSH-LIVE.md` | `-PushLive` | `pushlive` |

### Variant suffixes

Variant flags that modify a skill's behavior - `-FULL` for a complete rebuild, `-CHECK` for a dry-run audit, and similar - use ALL CAPS. The contrast with the camelCase skill flag keeps the modifier visually distinct. `-UpdateSession -FULL` reads as skill plus modifier, not two equal-weight tokens. The router parses the skill flag first, then passes remaining tokens to the skill body as arguments. The router is case-insensitive and hyphen-tolerant on input (`-updatesession`, `-UPDATESESSION`, `-Update-Session` all resolve to the same skill), but documentation and authored prose use the canonical camelCase form.

### Frontmatter

The body's YAML frontmatter carries `name:` (matches the dispatch key), `description:` (the router displays this in the help list), and optionally `flag:` (overrides the derived display flag). Sync reads the description verbatim. It reads the flag only when the override is present, otherwise it uses the derivation.

The `flag:` override is rarely needed and rarely correct. Once a project commits to the convention, the derivation is right by construction.

### Setup migration

When `-Setup` runs on a project with archived legacy skill bodies (a project that predates the action-first convention), it scans each archived body's frontmatter for older target-first names (e.g., `-MemoryUpdate`, `-ScraperUpdate`) and proposes the action-first form (`-UpdateMemory`, `-UpdateScraper`). The user approves or modifies. Setup surfaces the candidate, it does not force the rename.

### Legacy to canonical mapping

Pre-engine 321 projects shipped target-first skill bodies under `AIDOCS/SKILLS/` (plural). The reconcile pass's skill-body fold reads the archived bodies (under `<PROJECT>_SETUP_ARCHIVE/AIDOCS/SKILLS_legacy/`) and reasons about each in terms of the canonical body it folds into. This table is the explicit pre-engine to canonical map. Extend at each rename so the next migration's AI does not re-derive it from rename history.

| Legacy body (archived) | Canonical body (current) |
|---|---|
| `SKILLS_SESSION-UPDATE.md` | `SKILL_UPDATE-SESSION.md` |
| `SKILLS_MEMORY-UPDATE.md` | `SKILL_UPDATE-MEMORY.md` |
| `SKILLS_DEV-STANDARDS.md` | `SKILL_DEV-AUDIT.md` |
| `SKILLS_AUTO-PUSH.md` | `SKILL_AUTO-PUSH.md` |
| `SKILLS_SETUP.md` | `SKILL_SETUP.md` |
| `SKILLS_SYNC.md` | `SKILL_UPDATE-SYNC.md` |
| `SKILLS_UPDATE.md` | `SKILL_UPDATE.md` |
| `SKILLS_COMPACT.md` | `SKILL_COMPACT.md` |

A legacy body the table does not cover is a project-custom skill the user named themselves. Fold its content the same way (data into the right `<PROJECT>_*.md`, never back into a canonical body) and add an entry to the table if the project keeps the skill.

## Pattern 1: Thin body, fat data file (registered)

When a skill's substance is too large for the body and lives near the code it documents, register a data file in `_index.json` under `paths.files` with a dotted key `<skillname>.<role>` and point the skill body at it. The body becomes a thin loader: load the registered file, run what it says.

### Registry shape

```json
"files": {
  "updatememory.memory": "./AIDOCS/PROJECTNAME_MEMORY.md",
  "updatesession.session": "./AIDOCS/PROJECTNAME_SESSION.md",
  "autopush.config": "./AIDOCS/PROJECTNAME_AUTO-PUSH.md",
  "myskill.reference": "./apps/myservice/PROJECTNAME_MY-REFERENCE.md"
}
```

The path can point anywhere in the project tree, not just `./AIDOCS/`. A reference doc that documents a specific code module sits naturally next to that module.

### Skill body shape

```markdown
# /321 -MySkill

**Purpose:** <one line>.

When invoked, load the `myskill.reference` file (per `_index.json` paths.files) and run it.
```

The body is short on purpose. The substance is in the reference, where the AI can read it once at invocation rather than carrying it in context at session start.

### Why register vs hardcode the path

`doctor` validates that registered paths exist and scans them for banned prose. A path hardcoded inside the skill body skips both checks. Registration also lets the file move (under a rename, a code reorg) with a one-line registry edit instead of grepping every skill body.

### Example in the wild

GLP321-web registers `scrapeprovider.reference: ./apps/scraper/GLP321-web_SCRAPE-PROVIDER.md`. The skill body is short, the reference file is 200+ lines covering modeling scope, modes, the process at a glance, and AI direction. The reference lives with the scraper code it documents, not in `AIDOCS/`.

## Pattern 2: "When called from X" composition

When a skill is invoked both standalone AND from another skill (a common case for capture / lint / publish skills called from a release skill), name the cross-skill protocol explicitly in the body:

```markdown
## When called from /321 -AutoPush

Use `--skip-confirm`: `bash scripts/db-sync.sh --skip-confirm`.
```

The section is short - one or two lines naming the flag or mode shift the caller wants. The default behavior is documented above as the standalone shape, and this section only documents the deviation.

### Why an explicit section

Composition contracts hide easily. A skill called by another skill that asks for interactive confirmation will hang the caller. The section forces the contract to be visible to the AI driving the caller, so it knows to pass `--skip-confirm` or `--mode=parent-driven` or whatever flag the called skill needs.

## Pattern 3: Monitoring (exit-code map)

When a skill wraps a script with multiple failure modes, follow the standalone shape with a Monitoring section that maps exit codes to root causes:

```markdown
## Monitoring

**Success (exit 0):** `RESULT=success`. Report the backup paths and verified table count.

**Failure (exit 1):** read the `[FAIL]` line:
- No valid sqlite file - check `db/v3/d1/miniflare-D1DatabaseObject/` for 0-byte files.
- Wrangler auth expired - `npx wrangler login`.
- Push failed mid-rebuild - the script prints the restore command, run it.

**Count or schema mismatch (exit 2 / `[DRIFT]`):** the listed table did not land. Inspect the mirror file named in the output, then restore and retry.
```

### Why an explicit map

A bare "script failed" turns into a multi-turn investigation. An exit-code map turns it into one read. The AI running the skill knows immediately whether to investigate, retry, or escalate. Most operational skills earn the map after the second incident, when the first taught what the codes mean.

### Optional companion: Rollback

If the skill makes destructive changes, include a Rollback section after Monitoring:

```markdown
## Rollback

`scripts/db-restore.sh` replays a prior backup (drops current state, restores the captured one):

[commands]
```

## Combining the patterns

A real custom skill often uses all three: register a thin-body data file, name the cross-skill protocol, and map exit codes. The order in the body is:

1. Frontmatter (the skill router reads this)
2. `# Heading` + **Purpose:** callout
3. Standalone shape (the default invocation)
4. `## When called from X` (composition deviations)
5. `## Monitoring` (exit codes)
6. `## Rollback` (if destructive)
7. `## Notes` (operational gotchas)

Each section is optional - omit any that does not apply. The order is the convention, so a reader scanning multiple custom skills can find each part in the same place every time.
