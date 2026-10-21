# The -FULL pass and the exceptions the routine run never meets

**Purpose:** The parts of `-Update`, `-UpdateSession`, and `-UpdateMemory` that a routine run never executes: both lanes' `-FULL` mode, the Setup-driven migration exceptions, the Big-6 blind spot and the guard that closes it, the BACKLOG tracker mirror, and the deferred promotion heuristic. Loaded on demand by a `-FULL` run, a Setup-driven capture, a `[Big-6 drift]` warning, or a project that mirrors its BACKLOG. Never loaded on the routine path, which is the point.

## -FULL from the chain

`/321 -Update -FULL` propagates the switch to both lanes: `-UpdateSession -FULL` first, then `-UpdateMemory -FULL`. The routing is unchanged, graduated still skips the gate and the reconciliation gate still takes priority. A mixed-mode run (one lane `-FULL`, the other default) is not supported from the chain. Run the single lane standalone instead.

Use `-FULL` when the surface has drifted: a long pause, a context switch, an interrupted prior pass, or a `[Big-6 drift]` warning. The lean default appends from the conversation tail and trusts the prior snapshot.

## -UpdateSession -FULL

Widens the read past the watermark, but **uses the existing SESSION.md bullets as a starting reference, not a discard.** Most arcs are already captured. Walk the conversation against the existing bullets and look for gaps (an arc that did not land), drift (a bullet whose framing is now stale), and over-cap EXTENDED bodies (a sub-section that grew past the cap).

- Re-derive Current State from current operational reality. The prior snapshot is suspect under `-FULL`.
- Add missing arcs with `lifo_insert` as the lean default would. A main-LIFO bullet that drifted takes `amend_bullet`, one bullet in place. `overwrite_section` rewrites the whole LIFO, so reach for it only when the LIFO has genuinely diverged enough to justify a full rewrite. Otherwise leave drifted bullets alone: the depth content is where `-FULL`'s real value lands.
- For depth drift (a `### sub-section` body bloated or stale) and over-cap EXTENDED entries, re-derive under cap and `replace` the sub-section by anchor. This is where `replace` belongs, EXTENDED only. A genuinely load-bearing entry marks itself `<!-- LOAD_BEARING -->` and rides the warning forever.

## -UpdateMemory -FULL

Widens the read past the watermark and re-derives populated Big-6 sections, but **uses the existing MEMORY.md bullets and Big-6 prose as a starting reference, not a discard.** Walk the codebase plus the conversation plus SESSION against the existing bullets for the same three things: gaps, drift, and over-cap EXTENDED bodies.

- Re-walk every Big-6 section against current evidence. The lean default only fills placeholders and corrects a sentence the run falsified. `-FULL` may `overwrite_section` a populated section whose prose has drifted.
- Add missing LIFO observations with `lifo_insert`. A drifted bullet takes `amend_bullet`. `overwrite_section` on the LIFO only for a genuine divergence.
- Depth drift and over-cap EXTENDED entries: re-derive under cap and `replace` by anchor, as in the session lane.

### The Big-6 blind spot, and the guard that closes it

**The lean pass only fills an EMPTY Big-6 section. It never re-derives a populated one.** So a Big-6 that is populated and WRONG is invisible to every routine run, forever. Only `-FULL` re-walks it. This is not hypothetical: a project's MEMORY described its pre-migration framework through an entire rebuild, and because the true facts had nowhere to live they climbed up into AGENTS.md, which is exactly what AGENTS.md must never hold.

`doctor` catches it. **`[Big-6 drift]` records the dependency-name set that Stack / Architecture / Environment / Pipeline were last written against, and warns when the project's dependency manifest has since added or removed a package, naming them.** Names not versions, so a routine version bump is correctly silent while a swapped framework is loud.

**A `[Big-6 drift]` warning is the trigger to run `-UpdateMemory -FULL`.** Committing all four code-bound Big-6 sections re-stamps the mark and clears the warning. Nothing else does, and nothing else should. So a `-FULL` run stages all four code-bound sections even when a body came back unchanged: an unchanged body is a confirmed body, and the commit is what lays the mark.

## Migration exceptions (Setup-driven capture only, never on a graduated project)

- **`-UpdateSession`:** capture additively (the DROP row and arc-level aggregation are routine-run rules), route ambiguous content to SESSION LIFO, and do not re-derive the SESSION_EXTENDED entries `migrate-import` already scavenged. Add only Current State and the bullets the import missed.
- **`-UpdateMemory`:** skip the auto-invoke of `-UpdateSession` (Setup already captured SESSION this pass), fill the Big 6 from code plus the archive, add the observations `migrate-import` did not scavenge, and leave BACKLOG alone (`migrate-restore` carried it, reconcile sweeps it).

Full steps in `INSTALL/setup.md`.

## The BACKLOG tracker mirror (opt-in, off by default)

```bash
node AIDOCS/tools/engine.mjs sync-backlog
```

**Inert until the project declares an issue.** With no `integrations.backlog_issue` in `_index.json` this is a clean no-op that prints one line and exits 0, so a project with no tracker workflow never turns it on. **Do not invent an issue number.** The user sets it, or the mirror stays off.

Once configured, run it **after** `commit`, unconditionally, even when the pass added nothing. It regenerates the issue body wholesale from `<PROJECT>_BACKLOG.md`: **the file is the source of truth, the issue is a generated copy.** Wholesale is deliberate, since LIFO ordering is already the file's shape and there is no diff to drift. Never hand-edit the issue body, the next run overwrites it. It **fails soft**: a missing or unauthenticated `gh` warns and exits 0, because `commit` has already persisted the real artifact.

## Deferred

The LIFO-to-static promotion heuristic (folding a stabilized LIFO entry into a Big-6 section's prose) is not built. The lean default writes new observations to LIFO. Promotion of mature LIFO entries into Big-6 prose remains a future capability.
