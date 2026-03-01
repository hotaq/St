# OpenCode Runtime PRD

## Context

Overstory already has a runtime abstraction (`src/runtimes/types.ts`) and multiple adapters (`claude`, `pi`, `copilot`), but it does not yet register or support `opencode` in the runtime registry (`src/runtimes/registry.ts`).

Today, several operational paths still assume Claude-oriented defaults (instruction path, hooks location, transcript discovery, user-facing command text), even when core orchestration is runtime-agnostic.

## Problem

Teams that want to run Overstory on OpenCode cannot do so end-to-end because:

- `opencode` is missing as a first-class runtime adapter.
- runtime-dependent UX and docs still lean Claude-first in key command surfaces.
- verification and cost analysis paths are not fully validated for OpenCode transcript/config behavior.

## Goals

1. Add first-class OpenCode runtime support to Overstory.
2. Preserve compatibility with existing Claude, Pi, and Copilot runtimes.
3. Upgrade runtime UX so instruction paths, startup guidance, and config deployment are runtime-correct.
4. Optimize maintainability by reducing remaining Claude-specific assumptions in shared flows.

## Non-Goals

- Replacing or removing existing runtimes (`claude`, `pi`, `copilot`).
- Re-architecting the entire orchestration model.
- Introducing breaking changes to existing CLI commands unless required for correctness.

## Users

- Overstory maintainers expanding runtime support.
- Teams currently using OpenCode as their coding runtime.
- Contributors maintaining runtime adapters, verification, and docs.

## Product Requirements

### Functional Requirements

- FR-001: Overstory must accept `opencode` as a runtime in configuration and runtime resolution.
- FR-002: Runtime selection (`default` and command-level overrides) must instantiate a dedicated OpenCode adapter.
- FR-003: Agent spawn/startup flow must render instruction path and startup text using runtime-provided paths.
- FR-004: Runtime config deployment must use an OpenCode-appropriate mechanism (no implicit Claude hook assumptions).
- FR-005: Cost/transcript pathways must support OpenCode runtime behavior or fail with explicit runtime-specific guidance.
- FR-006: `ov doctor` and related health checks must surface OpenCode readiness signals where relevant.

### Quality Requirements

- QR-001: Existing runtimes must continue to pass existing test suites.
- QR-002: New OpenCode adapter must include parity tests for spawn, readiness detection, print command, and transcript parsing behavior.
- QR-003: Runtime-specific behavior must be isolated inside adapter and adapter-specific utilities, not scattered across command modules.

## Success Metrics

- OpenCode runtime can be selected and used in `ov sling` without manual patching.
- New OpenCode runtime tests pass and existing runtime tests remain green.
- No new regressions in commands currently depending on runtime abstraction (`sling`, `costs`, `merge`, `watchdog`).

## Risks and Mitigations

- Risk: OpenCode config/hook model differs from Claude/Pi assumptions.
  - Mitigation: Keep adapter contract strict and runtime-specific deployment encapsulated in OpenCode adapter code path.
- Risk: Transcript format divergence can break cost estimation.
  - Mitigation: Add adapter-level transcript parsing tests and runtime-aware fallback messaging.
- Risk: Migration confusion due to stale Claude-oriented docs.
  - Mitigation: update runtime docs and command help text in same release.

## Rollout Plan

1. Implement OpenCode adapter + registry wiring.
2. Wire runtime-aware deployment and instruction path messaging end-to-end.
3. Add/adjust tests for OpenCode and cross-runtime regressions.
4. Update docs and migration notes.
5. Release behind normal semantic version increment with changelog entry.
