# OpenCode Runtime Technical Spec

## Objective

Implement OpenCode as a first-class `AgentRuntime` in Overstory, then upgrade runtime-sensitive command paths to remove remaining Claude-oriented assumptions in shared flows.

## Current State (Verified)

- Runtime abstraction already exists: `src/runtimes/types.ts`.
- Runtime registry currently includes `claude`, `pi`, `copilot`: `src/runtimes/registry.ts`.
- Runtime-dependent paths already threaded through critical commands (`sling`, `costs`, `merge`, `watchdog`) but some defaults/messages still skew Claude-first.
- Hooks and guard deployment are Claude-focused in `.claude/settings.local.json` paths (`src/agents/hooks-deployer.ts`, `src/commands/hooks.ts`).

## Scope

### In Scope

- Add `src/runtimes/opencode.ts` implementing `AgentRuntime`.
- Register OpenCode in runtime registry and runtime resolution.
- Ensure runtime-specific instruction path and startup messaging are OpenCode-safe.
- Define OpenCode config deployment behavior under adapter contract.
- Extend tests and docs for OpenCode support.

### Out of Scope

- Redesigning the full hook/guard framework for all runtimes.
- Removing Claude-specific capabilities where they are correctly runtime-local.
- Major tracker/mail/database schema changes unrelated to runtime integration.

## Design

## 1) Runtime Adapter

Create `src/runtimes/opencode.ts` with parity to existing adapters.

Adapter must implement:

- `id`: `opencode`
- `instructionPath`: OpenCode instruction target (runtime-owned path)
- `buildSpawnCommand(opts)`
- `buildPrintCommand(input, opts)`
- `buildEnv(opts)`
- `detectReady(paneContent)`
- `deployConfig(worktreePath, agentName, capability, qualityGates?)`
- `parseTranscript(transcriptPath)`

Notes:

- Keep all runtime behavior inside adapter; avoid adding OpenCode branches in higher-level command modules when contract already supports adapter polymorphism.
- If an OpenCode feature is not available (for example transcript format uncertainty), return explicit runtime-aware errors/guidance instead of silent fallback.

## 2) Registry and Config

Update:

- `src/runtimes/registry.ts`: add `opencode` constructor mapping.
- `src/config.ts` + config validation paths: accept `opencode` in runtime fields.
- Any runtime listing/help surfaces to include OpenCode.

## 3) Startup and Instruction Path Consistency

Validate and enforce runtime-provided instruction path in:

- `src/commands/sling.ts`
- `src/agents/overlay.ts`
- `src/commands/prime.ts`
- `src/commands/agents.ts`

Requirement: user-facing startup messages and generated overlays must reference `runtime.instructionPath` only.

## 4) Config/Guard Deployment Strategy

Current behavior:

- Claude runtime uses `.claude/settings.local.json` hooks and guard scripts.

OpenCode behavior (target):

- Implement adapter-specific deployment in `OpenCodeRuntime.deployConfig(...)`.
- Do not rely on Claude-specific file paths unless explicitly needed for compatibility mode.
- If OpenCode equivalent guard mechanism differs, codify minimal secure baseline and document any known gap.

## 5) Transcript and Cost Support

Touchpoints:

- `src/commands/costs.ts`
- adapter-level `parseTranscript(...)`

Requirement:

- `ov costs --self` must produce either:
  - valid OpenCode cost output, or
  - clear runtime-specific unsupported guidance with no crash.

## 6) Health and Diagnostics

Touchpoints:

- `src/doctor/providers.ts`
- related doctor categories/surfaces as needed.

Requirement:

- OpenCode readiness checks should be visible where practical (binary presence, env/config expectations).

## Implementation Plan

1. Add OpenCode runtime adapter and unit tests.
2. Register runtime + config validation updates.
3. Enforce runtime-correct instruction path output across command surfaces.
4. Implement adapter-specific deploy config semantics.
5. Validate `costs`, `merge`, `watchdog` runtime interactions.
6. Update docs/changelog.

## File-Level Change List (Expected)

- `src/runtimes/opencode.ts` (new)
- `src/runtimes/opencode.test.ts` (new)
- `src/runtimes/registry.ts`
- `src/config.ts`
- `src/types.ts` (if config typing extensions are required)
- `src/commands/sling.ts`
- `src/agents/overlay.ts`
- `src/commands/prime.ts`
- `src/commands/agents.ts`
- `src/commands/costs.ts`
- `src/doctor/providers.ts`
- docs/changelog files

## Verification Plan

- Unit tests:
  - runtime adapter parity tests for OpenCode (spawn/print/env/ready/deploy/parse).
  - regression tests for registry/runtime resolution.
- Integration-level checks:
  - `ov sling ... --runtime opencode` startup behavior.
  - runtime-correct instruction path in generated overlay and startup output.
  - `ov costs --self` OpenCode behavior (success or explicit unsupported message).
- Project quality gates:
  - `bun test`
  - `bun run lint`
  - `bun run typecheck`

## Rollback Strategy

- Keep OpenCode support additive; existing runtime code paths remain unchanged.
- If OpenCode deploy/transcript behavior is unstable, keep adapter available behind explicit runtime opt-in and ship with known limitations documented.

## Open Questions

1. What exact OpenCode CLI flags should map to Overstory spawn/print semantics?
2. What is the canonical OpenCode instruction file path for project/worktree overlays?
3. What is OpenCode's stable transcript location/format for cost extraction?
4. Does OpenCode provide a native equivalent to Claude PreToolUse hooks, or should guarding stay primarily at Overstory orchestration level?
