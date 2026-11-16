# Environment docs pattern

**Purpose:** Reference for organizing `AIDOCS/ENV/` documentation. Loaded on demand when a project's environment docs grow beyond a single install guide. Not loaded at session start.

`AIDOCS/ENV/` holds setup, commands, where each secret lives, and platform notes - operational documentation an AI reads when the question is operational, not when reasoning about code. A fresh project often starts with one install guide and grows from there.

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

ENV/ docs carry operational detail (account names, hosts, the commands that reach them), never a secret itself. A password, key or token lives in `.env`, a platform's secret store or a machine-local key file, and the doc names where. Whether git tracks the docs follows the privacy mode in `_index.json`:

- **`private`** - `AIDOCS/ENV/` docs are tracked, so they travel with the private repo and recover with it when a workstation dies.
- **`public`** - `AIDOCS/ENV/` contents are gitignored and live on the dev workstation only. Never commit env docs from a public repo.
- **`full`** - the template repository's own hand-maintained mode, refused for a project. ENV/ contents stay ignored there.

Two things stay local in every mode: a credential file dropped into the folder (`.key`, `.pem`, `.p12`, `.pfx`, `.env`, an SSH private key) and the code page channel doc (`<PROJECT>_ENV_CODE.md`), which names machine paths and the page's address. `doctor` reads what git tracks and would add, so it reports a gated path that slipped through and a secret-shaped string in any tracked doc.

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
