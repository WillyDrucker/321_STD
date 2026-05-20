// cli.mjs - CLI parsing helpers + stderr writer. Shared by memory.mjs and the
// command modules. Exit codes are stable - the test suite asserts on them.

import process from "node:process";

export function err(msg) {
  process.stderr.write(`memory.mjs: ${msg}\n`);
}

export function parseFlags(args, allowed) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (!allowed.includes(key)) {
      err(`Unknown flag --${key}. Allowed: ${allowed.map(k => `--${k}`).join(", ")}`);
      process.exit(7);
    }
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function requireOpt(opts, key) {
  if (opts[key] === undefined) {
    err(`Missing required flag --${key}.`);
    process.exit(8);
  }
}
