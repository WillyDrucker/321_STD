# Environment docs pattern

**Purpose:** Reference for organizing `AIDOCS/ENV/` documentation. Loaded on demand when a project's environment docs grow beyond a single install guide. Not loaded at session start.

`AIDOCS/ENV/` holds setup, commands, secrets, and platform notes - operational documentation an AI reads when the question is operational, not when reasoning about code. A fresh project often starts with one install guide and grows from there.

## Naming convention

Top-level files use `<PROJECT>_ENV_<TOPIC>.md`:

- `PROJECTNAME_ENV_DEVELOPMENT.md` - dev workstation install + toolchain
- `PROJECTNAME_ENV_CLOUDFLARE.md` - Cloudflare account and project config
- `PROJECTNAME_ENV_MCP-SERVERS.md` - MCP server registration + config
- `PROJECTNAME_ENV_REBUILD-GUIDE.md` - cold-machine bootstrap walkthrough

The `<PROJECT>_ENV_<TOPIC>` prefix mirrors the data-doc pattern (`<PROJECT>_MEMORY.md`, `<PROJECT>_SESSION.md`). A consistent prefix lets grep find every env doc with one match.

## Subfolders for topic groups

When a topic cluster has three or more related docs, fold them into a topic subfolder:

```
AIDOCS/ENV/
  PROJECTNAME_ENV_DEVELOPMENT.md
  PROJECTNAME_ENV_MCP-SERVERS.md
  CF-WORKERS/
    PROJECTNAME_ENV_CF-WORKERS_BUILD-GUIDE.md
    PROJECTNAME_ENV_CF-WORKERS_ACCESS.md
  MCP-PW/
    PROJECTNAME_ENV_MCP-PW_SERVER-ACCESS.md
    PROJECTNAME_ENV_MCP-PW_SERVER-BUILD-GUIDE.md
    PROJECTNAME_ENV_MCP-PW_PLAYWRIGHT-CLI-EVAL.md
```

Folder name is the topic group identifier (`CF-WORKERS`, `MCP-PW`). Files inside use `<PROJECT>_ENV_<GROUP>_<DETAIL>.md`. The double-namespace lets the file name carry the topic without the folder reading it twice.

## When to promote a topic to a subfolder

Promote when:
- Three or more related docs cover the same topic
- The topic has distinct sub-concerns (build vs access vs runtime)
- The flat list at ENV/ root would obscure the structure

Keep flat (no subfolder) when:
- One or two docs cover the topic
- The docs are read together as one concept (a single install guide reads as one)

## Privacy gates

ENV/ docs frequently carry secrets (account IDs, server hostnames, credential patterns). No privacy mode in `_index.json` tracks them:

- **`private`** - `AIDOCS/ENV/` contents are gitignored. Docs live on the dev workstation only.
- **`public`** - same gate as private. Never commit env docs from a public repo.
- **`full`** - the template repository's own hand-maintained mode, refused for a project. ENV/ contents stay ignored there too.

A doc that names a real account ID, a real API endpoint, or a real password never ships. The `.gitignore` rule on `AIDOCS/ENV/` is the gate in every mode, and `doctor` reports an ENV doc that git tracks or would add anyway.

## What kinds of docs belong here

- **Install walkthroughs.** Sectioned, prerequisite-named, command-verifiable. The recovery doc when the workstation dies.
- **Account / project config maps.** Account IDs, project bindings, resource layouts (databases, workers, custom domains).
- **Access docs.** SSH config, MCP server registration, OAuth flows.
- **Rebuild guides.** Cold-machine order-of-operations: install A, then B, then connect C.

## What does NOT belong here

- Domain logic, architecture decisions, conventions - those live in MEMORY.
- Code-standard rules - those live in DEV-AUDIT.
- Tickets, in-flight work, future features - those live in BACKLOG or SESSION.
- The runtime source of truth - that lives in the running tool's state directory (e.g. `~/.tool-name/`), not in docs.

## Doc shape

Each ENV doc opens with a `# Heading` and a `**Purpose:**` callout, like every other authored MD file in the project. Section structure is project-defined - install walkthroughs typically use numbered sections, account maps use named blocks, access docs use one-paragraph-per-resource.

Where a doc captures values that vary by environment (account IDs, dev vs prod hostnames), name the environment in the section header rather than mixing values inline. A reader scanning for the production endpoint should not have to parse a dev block first.
