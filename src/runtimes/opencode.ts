import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ResolvedModel } from "../types.ts";
import type {
	AgentRuntime,
	HooksDef,
	OverlayContent,
	ReadyState,
	SpawnOpts,
	TranscriptSummary,
} from "./types.ts";

/**
 * OpenCode runtime adapter.
 *
 * Key traits:
 * - Uses `opencode` for interactive TUI sessions
 * - Uses `opencode run` for headless one-shot calls
 * - Uses `AGENTS.md` as the instruction file
 * - No Claude-style hook deployment
 */
export class OpenCodeRuntime implements AgentRuntime {
	readonly id = "opencode";
	readonly instructionPath = "AGENTS.md";

	buildSpawnCommand(opts: SpawnOpts): string {
		let cmd = `opencode --model ${opts.model}`;

		if (opts.appendSystemPromptFile) {
			const escaped = opts.appendSystemPromptFile.replace(/'/g, "'\\''");
			cmd += ` --prompt "$(cat '${escaped}')"`;
		} else if (opts.appendSystemPrompt) {
			const escaped = opts.appendSystemPrompt.replace(/'/g, "'\\''");
			cmd += ` --prompt '${escaped}'`;
		}

		return cmd;
	}

	buildPrintCommand(prompt: string, model?: string): string[] {
		const cmd = ["opencode", "run"];
		if (model !== undefined) {
			cmd.push("--model", model);
		}
		cmd.push(prompt);
		return cmd;
	}

	async deployConfig(
		worktreePath: string,
		overlay: OverlayContent | undefined,
		_hooks: HooksDef,
	): Promise<void> {
		if (!overlay) {
			return;
		}

		await mkdir(worktreePath, { recursive: true });
		await writeFile(join(worktreePath, "AGENTS.md"), overlay.content);
	}

	detectReady(paneContent: string): ReadyState {
		const lower = paneContent.toLowerCase();
		const hasBrand = lower.includes("opencode");
		const hasUiHint = lower.includes("tab") || lower.includes("ctrl") || lower.includes("session");

		if (hasBrand && hasUiHint) {
			return { phase: "ready" };
		}

		return { phase: "loading" };
	}

	requiresBeaconVerification(): boolean {
		return false;
	}

	async parseTranscript(path: string): Promise<TranscriptSummary | null> {
		try {
			await access(path);
		} catch {
			return null;
		}

		try {
			const text = await readFile(path, "utf8");
			const lines = text.split("\n").filter((line: string) => line.trim().length > 0);

			let inputTokens = 0;
			let outputTokens = 0;
			let model = "";

			for (const line of lines) {
				let entry: Record<string, unknown>;
				try {
					entry = JSON.parse(line) as Record<string, unknown>;
				} catch {
					continue;
				}

				if (typeof entry.model === "string" && entry.model) {
					model = entry.model;
				}

				if (entry.type === "assistant") {
					const message = entry.message as Record<string, unknown> | undefined;
					const usage = message?.usage as Record<string, unknown> | undefined;
					if (typeof usage?.input_tokens === "number") {
						inputTokens += usage.input_tokens;
					}
					if (typeof usage?.output_tokens === "number") {
						outputTokens += usage.output_tokens;
					}
					if (typeof message?.model === "string" && message.model) {
						model = message.model;
					}
				} else if (entry.type === "message_end") {
					if (typeof entry.inputTokens === "number") {
						inputTokens += entry.inputTokens;
					}
					if (typeof entry.outputTokens === "number") {
						outputTokens += entry.outputTokens;
					}
				}
			}

			return { inputTokens, outputTokens, model };
		} catch {
			return null;
		}
	}

	buildEnv(model: ResolvedModel): Record<string, string> {
		return model.env ?? {};
	}
}
