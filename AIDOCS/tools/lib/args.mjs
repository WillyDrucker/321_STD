// args.mjs - CLI argument helpers shared by the engine commands. One home for
// reading an argv flag so every command parses the same way (DEV-AUDIT: one
// canonical home per concern).

// The value following `--name` in the argv slice, or undefined when the flag is
// absent or has no value after it.
export function flag(args, name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }
