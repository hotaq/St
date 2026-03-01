# Overstory (St fork)

Multi-agent orchestration for AI coding agents.

This repository is a fork we "claimed" as our main working copy:

- Main repo: https://github.com/hotaq/St
- Upstream inspiration/source: https://github.com/jayminwest/overstory

## What This Fork Adds

- OpenCode runtime adapter (`runtime.default: opencode`) alongside Claude Code.
- Adoption CLI flows (local-first, SQLite-backed):
  - `ov blueprint init|validate`
  - `ov work create|assign|close`
  - `ov run-adoption start|status|resume|report`
- Real CLI `--json` behavior verified for the new commands.

## Install

Prereqs: Bun, git, tmux. At least one runtime installed (Claude Code, OpenCode, Pi, Copilot).

### Install This Fork (Recommended)

```bash
bun add -g "git+https://github.com/hotaq/St.git#main"
ov --version --json
```

### Install Upstream (npm)

If you want the official upstream release instead of this fork:

```bash
bun install -g @os-eco/overstory-cli
ov --version --json
```

## Quick Start

Initialize Overstory state inside your project:

```bash
cd your-project
ov init
```

If you want OpenCode as default runtime, set it in `.overstory/config.yaml`:

```yaml
runtime:
  default: opencode
```

Start coordinator or spawn agents:

```bash
ov coordinator start
ov sling <task-id> --capability builder --name my-builder
ov status
```

## Adoption Commands (This Fork)

Blueprint lifecycle:

```bash
ov blueprint init --project "my-project" --json
ov blueprint validate --id <blueprint-id> --json
```

Run + work lifecycle:

```bash
ov run-adoption start --blueprint <blueprint-id> --json
ov work create --title "Task A" --objective "Do X" --scope "scope" --owner worker --json
ov work assign --id <work-id> --owner coordinator --json
ov work close --id <work-id> --evidence "tests-passed" --json
ov run-adoption status --id <run-id> --json
ov run-adoption report --id <run-id> --json
ov run-adoption resume --id <run-id> --json
```

Local state is stored in `.overstory/adoption.db` in the target project.

## Runtime Adapters

Overstory is runtime-agnostic. Configure the default runtime in `.overstory/config.yaml`:

```yaml
runtime:
  default: claude   # or: opencode | pi | copilot
```

Runtime registry: `src/runtimes/registry.ts`

## Development

```bash
bun install
bun test
bun run typecheck
```

## Upstream Sync (Optional)

This fork tracks upstream as a separate git remote named `upstream`.

```bash
git remote -v
git fetch upstream
```

## License

MIT. See `LICENSE`.

## Credits

This fork is based on Overstory by Jaymin West and contributors:
https://github.com/jayminwest/overstory
