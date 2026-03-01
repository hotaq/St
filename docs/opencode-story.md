# OpenCode Upgrade Story

## Epic

Enable OpenCode as a first-class runtime in Overstory while preserving existing runtime compatibility and reducing Claude-specific coupling in shared orchestration flows.

## Story 1: Runtime Registration

As a maintainer, I want OpenCode registered in runtime resolution so that `ov` commands can select and instantiate it like other runtimes.

### Acceptance Criteria

- `runtime.default` accepts `opencode` without unknown-runtime failures.
- Runtime registry resolves `opencode` to a concrete adapter.
- Existing runtime names (`claude`, `pi`, `copilot`) continue to resolve unchanged.

## Story 2: OpenCode Adapter Parity

As a maintainer, I want an OpenCode runtime adapter that satisfies the `AgentRuntime` contract so that orchestration works without special-case branching in command handlers.

### Acceptance Criteria

- Adapter provides spawn command construction, print command construction, environment handling, and readiness detection.
- Adapter defines an OpenCode instruction path compatible with overlay generation.
- Adapter contains transcript parsing strategy (or explicit unsupported handling with user-facing guidance).

## Story 3: Runtime-Correct Startup UX

As an operator, I want runtime-correct startup instructions and overlays so that agents always read the right instruction file for the selected runtime.

### Acceptance Criteria

- Startup/beacon text references `runtime.instructionPath` instead of Claude-assumed paths.
- Overlay generation always receives instruction path from runtime context.
- Runtime-specific docs and help text reflect OpenCode availability.

## Story 4: Runtime-Safe Config Deployment

As a maintainer, I want runtime config deployment to be adapter-specific so that Claude-only hook assumptions do not leak into OpenCode flows.

### Acceptance Criteria

- OpenCode deployment path does not write Claude-specific files unless explicitly required.
- Existing Claude hook deployment behavior remains intact for Claude runtime.
- Runtime deployment behavior is covered by unit tests.

## Story 5: Verification and Operations

As an operator, I want `ov costs`, health checks, and operational commands to handle OpenCode runtime behavior safely so that observability remains reliable.

### Acceptance Criteria

- `ov costs --self` handles OpenCode runtime with either valid transcript resolution or clear runtime-specific message.
- `ov doctor` includes meaningful OpenCode-related readiness signals where applicable.
- No regressions in merge/watchdog flows that rely on runtime print command and transcript data.

## Story 6: Migration Readiness

As a team lead, I want clear migration guidance from Claude-first setups to OpenCode so that adoption is predictable and low-risk.

### Acceptance Criteria

- Docs explain what is required to switch runtime defaults safely.
- Known limitations and fallback behavior are explicit.
- Release notes summarize cross-runtime impact and rollback path.

## Delivery Sequence

1. Story 1 and Story 2
2. Story 3 and Story 4
3. Story 5
4. Story 6

## Definition of Done

- All acceptance criteria above are met.
- Relevant tests pass for new and existing runtimes.
- Documentation updates are merged with implementation.
