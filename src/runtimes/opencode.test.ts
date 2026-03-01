import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolvedModel } from "../types.ts";
import { OpenCodeRuntime } from "./opencode.ts";
import type { SpawnOpts } from "./types.ts";

describe("OpenCodeRuntime", () => {
	const runtime = new OpenCodeRuntime();

	test("id and instructionPath", () => {
		expect(runtime.id).toBe("opencode");
		expect(runtime.instructionPath).toBe("AGENTS.md");
	});

	describe("buildSpawnCommand", () => {
		test("builds base command with model", () => {
			const opts: SpawnOpts = {
				model: "anthropic/claude-sonnet-4-5",
				permissionMode: "bypass",
				cwd: "/tmp/worktree",
				env: {},
			};
			expect(runtime.buildSpawnCommand(opts)).toBe("opencode --model anthropic/claude-sonnet-4-5");
		});

		test("appends prompt from inline appendSystemPrompt", () => {
			const opts: SpawnOpts = {
				model: "openai/gpt-5.1-codex",
				permissionMode: "ask",
				cwd: "/tmp/worktree",
				env: {},
				appendSystemPrompt: "You are a builder",
			};
			expect(runtime.buildSpawnCommand(opts)).toBe(
				"opencode --model openai/gpt-5.1-codex --prompt 'You are a builder'",
			);
		});

		test("appendSystemPromptFile takes precedence over appendSystemPrompt", () => {
			const opts: SpawnOpts = {
				model: "anthropic/claude-sonnet-4-5",
				permissionMode: "bypass",
				cwd: "/tmp/worktree",
				env: {},
				appendSystemPromptFile: "/project/.overstory/agent-defs/lead.md",
				appendSystemPrompt: "ignore me",
			};
			expect(runtime.buildSpawnCommand(opts)).toContain(
				"--prompt \"$(cat '/project/.overstory/agent-defs/lead.md')\"",
			);
			expect(runtime.buildSpawnCommand(opts)).not.toContain("ignore me");
		});
	});

	describe("buildPrintCommand", () => {
		test("builds run command without model", () => {
			expect(runtime.buildPrintCommand("Summarize this")).toEqual([
				"opencode",
				"run",
				"Summarize this",
			]);
		});

		test("builds run command with model", () => {
			expect(runtime.buildPrintCommand("Summarize this", "openai/gpt-5.1-codex")).toEqual([
				"opencode",
				"run",
				"--model",
				"openai/gpt-5.1-codex",
				"Summarize this",
			]);
		});
	});

	describe("detectReady", () => {
		test("returns loading for empty pane", () => {
			expect(runtime.detectReady("")).toEqual({ phase: "loading" });
		});

		test("returns ready when OpenCode UI hints are present", () => {
			expect(runtime.detectReady("OpenCode\nTab to switch agent\nCtrl+K")).toEqual({
				phase: "ready",
			});
		});

		test("requiresBeaconVerification is false", () => {
			expect(runtime.requiresBeaconVerification()).toBe(false);
		});
	});

	describe("buildEnv", () => {
		test("returns empty object when model has no env", () => {
			const model: ResolvedModel = { model: "anthropic/claude-sonnet-4-5" };
			expect(runtime.buildEnv(model)).toEqual({});
		});

		test("returns model.env when present", () => {
			const env = { OPENAI_API_KEY: "sk-test", OPENAI_BASE_URL: "https://openrouter.ai/api/v1" };
			const model: ResolvedModel = {
				model: "openrouter/openai/gpt-5",
				env,
			};
			expect(runtime.buildEnv(model)).toEqual(env);
		});
	});

	describe("deployConfig and parseTranscript", () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await mkdtemp(join(tmpdir(), "overstory-opencode-test-"));
		});

		afterEach(async () => {
			await rm(tempDir, { recursive: true, force: true });
		});

		test("deployConfig writes AGENTS.md when overlay exists", async () => {
			const worktreePath = join(tempDir, "worktree");
			await runtime.deployConfig(
				worktreePath,
				{ content: "# Agent\nDo work" },
				{ agentName: "builder-1", capability: "builder", worktreePath },
			);
			const content = await readFile(join(worktreePath, "AGENTS.md"), "utf8");
			expect(content).toBe("# Agent\nDo work");
		});

		test("deployConfig does nothing when overlay is undefined", async () => {
			const worktreePath = join(tempDir, "worktree");
			await runtime.deployConfig(worktreePath, undefined, {
				agentName: "builder-1",
				capability: "builder",
				worktreePath,
			});
			let exists = true;
			try {
				await access(join(worktreePath, "AGENTS.md"));
			} catch {
				exists = false;
			}
			expect(exists).toBe(false);
		});

		test("parseTranscript supports claude-style entries", async () => {
			const transcriptPath = join(tempDir, "session.jsonl");
			const entry = JSON.stringify({
				type: "assistant",
				message: {
					model: "anthropic/claude-sonnet-4-5",
					usage: { input_tokens: 100, output_tokens: 40 },
				},
			});
			await writeFile(transcriptPath, `${entry}\n`);
			const parsed = await runtime.parseTranscript(transcriptPath);
			expect(parsed?.inputTokens).toBe(100);
			expect(parsed?.outputTokens).toBe(40);
			expect(parsed?.model).toBe("anthropic/claude-sonnet-4-5");
		});

		test("parseTranscript supports message_end entries", async () => {
			const transcriptPath = join(tempDir, "session.jsonl");
			const entry = JSON.stringify({ type: "message_end", inputTokens: 33, outputTokens: 22 });
			await writeFile(transcriptPath, `${entry}\n`);
			const parsed = await runtime.parseTranscript(transcriptPath);
			expect(parsed?.inputTokens).toBe(33);
			expect(parsed?.outputTokens).toBe(22);
		});

		test("parseTranscript returns null for non-existent file", async () => {
			expect(await runtime.parseTranscript(join(tempDir, "missing.jsonl"))).toBeNull();
		});
	});
});

describe("OpenCodeRuntime integration", () => {
	test("getRuntime('opencode') returns OpenCodeRuntime", async () => {
		const { getRuntime } = await import("./registry.ts");
		const rt = getRuntime("opencode");
		expect(rt).toBeInstanceOf(OpenCodeRuntime);
		expect(rt.id).toBe("opencode");
		expect(rt.instructionPath).toBe("AGENTS.md");
	});
});
