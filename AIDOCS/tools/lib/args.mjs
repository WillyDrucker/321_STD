// args.mjs - CLI argument helpers shared by the engine commands. One home for
// reading an argv flag so every command parses the same way (DEV-AUDIT: one
// canonical home per concern).

// The value following `--name` in the argv slice, or undefined when the flag is
// absent or has no value after it.
export function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }

// A filename-safe project name: starts with a letter, then letters / digits / _ / -.
// Shared so every --name consumer (init, migrate-archive, migrate-restore, verdict)
// rejects a path-bearing name the same way, before it is interpolated into a path like
// AIDOCS/<name>_SETUP_ARCHIVE (a separator could redirect the archive out of the tree).
export function validName(name) { return typeof name === "string" && /^[A-Za-z][A-Za-z0-9_-]*$/.test(name); }
