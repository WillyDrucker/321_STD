# Staging contract

**Purpose:** Durable reference for how `-UpdateSession` and `-UpdateMemory` write through the staging pipeline. Holds the JSON shape, the LIFO ordering rule, the slugify behavior that pairs `[+]` bullets with EXTENDED sub-sections, the body-length cap, and the `LOAD_BEARING` opt-out. The two update skill bodies link here so the routine `-Update` pass does not re-read this on every routine refresh. Lives in `AIDOCS/tools/` so it refreshes per the engine-class copy step.

## The staging file

Each update skill writes one staging file before `commit`:

- `AIDOCS/tools/staging/updatesession.json` (owned by `-UpdateSession`)
- `AIDOCS/tools/staging/updatememory.json` (owned by `-UpdateMemory`)

Never edit the target file directly. The staging file is the artifact, `commit` is the only writer. The staging file IS the draft: do not build a generator script to emit it.

## The action shapes

```json
{
  "actions": [
    { "op": "overwrite_section", "file": "<domain>.<key>", "section": "<Section>", "body": "<replacement body>" },
    { "op": "lifo_insert", "file": "<domain>.<key>", "section": "LIFO", "bullet": "<one event or observation>" },
    { "op": "lifo_insert", "file": "<domain>.<key>", "section": "LIFO", "bullet": "<entry that earns depth>", "extended_anchor": "<slug-of-bullet>" },
    { "op": "add", "file": "<domain>.<key>_extended", "anchor": "<slug-of-bullet>", "heading": "<same text as the bullet>", "body_md": "<why / how / what surprised us>" },
    { "op": "replace", "file": "<domain>.<key>_extended", "anchor": "<existing-slug>", "heading": "<heading>", "body_md": "<new body>" },
    { "op": "drop", "file": "<domain>.<key>_extended", "anchor": "<existing-slug>" }
  ]
}
```

`<domain>` is the skill key (`updatesession` or `updatememory`). The domain firewall enforced by the validator only lets a skill touch files keyed under its own domain.

## LIFO ordering (oldest-first in actions, newest lands on top)

Each `lifo_insert` PREPENDS to the section. The LAST insert in the `actions` array ends up on top of LIFO. **List this run's entries oldest-first** in `actions` so the newest one lands on top.

`overwrite_section` replaces the whole section body and **discards what was there**. On Current State it does NOT demote the outgoing snapshot into LIFO - overwritten state is not history, and treating it as history is how a file starts asserting facts that stopped being true long ago.

## `[+]` paired bullets and `slugify`

When a bullet earns more than a line or two of narrative, pair it: set `extended_anchor` on the `lifo_insert` (the engine renders `- [+] <bullet>`, no link) and emit an `add` on the matching `_extended` file whose `heading` is the same bullet text.

The validator pairs a `[+]` bullet with its sub-section by comparing `slugify(bullet)` to `slugify(heading)`. The `anchor` must equal that slug.

**`slugify` behavior:** lowercases, strips every character except `[a-z0-9\s-]`, trims, and collapses whitespace runs to single hyphens. Existing hyphens survive. A punctuation-heavy bullet ("Decision: pick X (over Y)") slugifies to `decision-pick-x-over-y`. **Keep `[+]` bullets short and punctuation-light.** Put the detail in `body_md` instead.

Use `drop` / `replace` (by anchor) to edit an existing sub-section. A `[+]` bullet with no matching sub-section fails commit (the orphan check), so always pair them.

## Body length (the maximum, not the target)

Aim for **3-6 non-blank lines of body prose** for a normal entry. The hard ceiling is **10 lines for a critical entry** that genuinely earns the depth. These are caps, not targets. If you can summarize the why in 3 lines, do that. Doctor's sub-section budget warns at >10 body lines.

A genuinely load-bearing entry (a catalog, an exception list, content where compression would lose the point) marks itself with `<!-- LOAD_BEARING -->` anywhere in the body to opt out of the cap forever. Use the marker rarely. It is for content that cannot summarize, not for narrative you do not feel like trimming.

**Re-summarize on `-FULL`.** When a `-FULL` pass re-walks an existing `[+]` entry whose EXTENDED body exceeds the cap, re-derive the entry under cap and `replace` its sub-section (by anchor). Do not let pre-existing bloat carry through. Doctor's warning is the trigger to summarize on the next pass.

`body_md` is prose. No code fences (the validator rejects them, code lives in source).

## Read what you need, not what you do not

For an `add`, the EXTENDED file does not need a prior read. The action carries the heading, anchor, and body. For `drop` / `replace` against an existing sub-section, the EXTENDED file is the source of the anchor you are targeting and needs a read.

## Commit (validate is optional)

```bash
node AIDOCS/tools/engine.mjs commit --skill updatesession
node AIDOCS/tools/engine.mjs commit --skill updatememory
```

`commit` runs the validator AND simulates every op first, aborting before any write on failure. So a standalone `validate` is optional. Skip it on a confident draft. Use `validate --skill <name>` only while iterating on a draft you expect to fail. The two-phase commit persists, stamps the watermark, records the run's bullet fingerprints, and clears staging.

## What the watermark gives you

`AIDOCS/tools/state.json` carries `<skill>.last_committed_at` (the timestamp of the last commit) and `<skill>.recent_captured` (a rolling window of the slugs of recent `lifo_insert` bullets, newest first, up to 8 entries). `engine.mjs watermark --skill <name>` prints both on demand.

Use them this way:

- The timestamp scopes the routine refresh to "conversation tail since the watermark."
- The fingerprints answer "did I capture this arc in the last few runs?" without re-reading SESSION / MEMORY. The rolling window accumulates across runs, so an arc captured two passes ago is still visible. Most useful after a pruning run or when SESSION / MEMORY itself has been archived.

The watermark is a script-internal marker. It is never written into SESSION / MEMORY content.
