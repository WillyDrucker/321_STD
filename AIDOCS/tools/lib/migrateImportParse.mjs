// migrateImportParse.mjs - the text half of migrate-import: split an archived doc into
// entries (one per ##/### heading with a body, one per H2-child bold-lead), elide fenced
// code to a marker the validator accepts, and recognize an empty placeholder scaffold so
// the import no-ops honestly instead of manufacturing an entry from the H1 and Purpose.
// The command, the staging it writes, and the landing report live in migrateImport.mjs.

// Headings that are an EXTENDED file's own authoring guide, not durable content - plus
// the Big-6 mirror headings a legacy EXTENDED carried at its top (overview ... conventions),
// which are schema scaffold, so a legacy import never lands them as new LIFO bullets.
const META_HEADING = /^(what goes in|what doesn't|what does not|pruning.*|purpose|lifo|overview|stack|architecture|environment|pipeline|conventions)$/i;
// Sub-label H3 patterns under a numbered H2 parent ("Why:", "What:", "Status:",
// "Files touched:"). A legacy EXTENDED that uses these as a fixed sub-structure
// would otherwise scavenge as one top-level LIFO bullet per label per parent,
// over-splitting a 4-arc SESSION into ~16 fragments most of which are meaningless
// ("Status:", "Why: (3)"). Folding them keeps the heading inline in the parent
// entry's body so the structure survives without polluting LIFO.
const SUB_LABEL = /^[A-Z][A-Za-z0-9\s/_-]{0,40}:$/;
// No code in EXTENDED. A fenced block becomes this marker so a code-only entry does
// not collapse to an empty body, and the validator's no-fence rule on body_md holds.
export const CODE_MARKER = "(code example elided on import - summarize the takeaway in prose)";

export function stripTrailingPeriod(s) { return s.endsWith(".") ? s.slice(0, -1) : s; }

// Replace each fenced code block with a one-line marker. Used for the blob fallback,
// where parseEntries' line walk does not run.
export function elideFences(text) {
  let inFence = false;
  return text.split("\n").map((line) => {
    if (/^```/.test(line.trim())) { const opening = !inFence; inFence = !inFence; return opening ? CODE_MARKER : null; }
    return inFence ? null : line;
  }).filter((l) => l !== null).join("\n");
}

// Walk the normalized content. Emit one entry per archive heading (##/###) with a
// body, and one per H2-child bold-lead ("**Title.** body"). List-item bolds and inline
// bold stay in the current entry's body. Meta headings and the H1 are skipped. Fenced
// code is elided so a "**" inside a fence never starts an entry.
export function parseEntries(content) {
  const lines = content.split("\n");
  const entries = [];
  let current = null, skipping = false, inFence = false, currentDepth = 0;

  const flush = () => {
    if (current) {
      current.body = current.bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      delete current.bodyLines;
      entries.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      const opening = !inFence;
      inFence = !inFence;
      if (opening && current && !skipping) current.bodyLines.push(CODE_MARKER);
      continue;
    }
    if (inFence) continue;

    const h1 = line.match(/^#\s+/);
    const heading = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    const boldLead = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);

    if (h1) { flush(); skipping = true; continue; }
    if (heading) {
      const depth = heading[1].length;
      const title = heading[2].trim();
      // Fold sub-label H3s (Why:, Status:, Files touched:) under their H2 parent
      // instead of promoting them to their own LIFO bullets. Recognized only when
      // we are inside a non-skipped H2 entry, so a structured EXTENDED with real H3
      // topics is unaffected. The heading line is kept verbatim in the parent body
      // so the structure reads when the entry renders.
      if (current && !skipping && depth === 3 && currentDepth === 2 && SUB_LABEL.test(title)) {
        current.bodyLines.push(line);
        continue;
      }
      flush();
      currentDepth = depth;
      if (META_HEADING.test(title)) { skipping = true; continue; }
      skipping = false;
      current = { title: stripTrailingPeriod(title), bodyLines: [] };
      continue;
    }
    if (line.trim() === "---") continue;

    // A bold-lead becomes its own entry only as a direct child of an H2 (a flat
    // multi-entry section). Under an H3 the ### sub-section is the coherent unit, so
    // bold-leads inside it stay as body and the narrative holds.
    if (boldLead && !skipping && currentDepth === 2) {
      flush();
      currentDepth = 2;
      current = { title: stripTrailingPeriod(boldLead[1].trim()), bodyLines: [] };
      if (boldLead[2].trim()) current.bodyLines.push(boldLead[2].trim());
      continue;
    }
    if (current && !skipping) current.bodyLines.push(line);
  }
  flush();

  // Drop contentless group headers (a heading with no prose of its own) - their
  // bold-lead children were captured as their own entries, so no detail is lost.
  return entries.filter((e) => e.title.length > 0 && e.body.length > 0);
}

// True when the doc is a fresh-install scaffold with no captured content: only the H1, a
// **Purpose:** callout (one or more lines until the next blank), --- dividers, the empty
// canonical section headers (## LIFO, ## Current State, the Big-6), and parenthetical
// "(no entries yet)" / "(fill in ...)" annotations. Anything else is real content. Lets
// migrate-import no-op honestly on an empty EXTENDED rather than manufacture a phantom
// entry from the H1/Purpose that --audit would later flag as a lost entry.
export function isPlaceholderScaffold(content) {
  const SECTION = /^##\s+(LIFO|Current State|Overview|Stack|Architecture|Environment|Pipeline|Conventions)\s*$/i;
  // Only the canonical scaffold annotations, NOT any parenthetical line: a "(no ... yet ...)"
  // placeholder under an empty section, or a "(fill in ...)" placeholder in a Big-6 slot. A
  // real parenthetical note (genuine captured content) must not read as scaffold and get dropped.
  const PLACEHOLDER_NOTE = /^\((no\b[^)]*\byet\b|fill in\b)[^)]*\)$/i;
  let inPurpose = false;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "") { inPurpose = false; continue; }
    if (inPurpose) continue;                                              // wrapped Purpose continuation
    if (/^#\s+/.test(line)) continue;                                    // H1 title
    if (/^\*\*Purpose:\*\*/.test(line)) { inPurpose = true; continue; }  // Purpose callout
    if (line === "---") continue;                                        // divider
    if (SECTION.test(line)) continue;                                    // empty canonical section header
    if (PLACEHOLDER_NOTE.test(line)) continue;                           // scaffold placeholder annotation
    return false;                                                        // real content found
  }
  return true;
}
