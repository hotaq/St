import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blueprintCommand } from "./blueprint.ts";

let originalCwd: string;
let tempDir: string;
let chunks: string[] = [];
let originalStdoutWrite: typeof process.stdout.write;
let originalStderrWrite: typeof process.stderr.write;

function output(): string {
	return chunks.join("");
}

beforeEach(async () => {
	originalCwd = process.cwd();
	tempDir = await mkdtemp(join(tmpdir(), "blueprint-cmd-"));
	chunks = [];
	originalStdoutWrite = process.stdout.write;
	originalStderrWrite = process.stderr.write;

	process.stdout.write = ((chunk: string | Uint8Array) => {
		chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
		return true;
	}) as typeof process.stdout.write;

	process.stderr.write = ((chunk: string | Uint8Array) => {
		chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
		return true;
	}) as typeof process.stderr.write;

	await mkdir(join(tempDir, ".overstory"), { recursive: true });
	await Bun.write(
		join(tempDir, ".overstory", "config.yaml"),
		`project:\n  name: test\n  root: ${tempDir}\n  canonicalBranch: main\nruntime:\n  default: opencode\n`,
	);

	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	process.stdout.write = originalStdoutWrite;
	process.stderr.write = originalStderrWrite;
	await Bun.$`rm -rf ${tempDir}`.quiet();
});

describe("blueprint command", () => {
	test("supports opencode runtime default for blueprint init", async () => {
		await blueprintCommand(["init", "--project", "demo", "--json"]);
		const parsed = JSON.parse(output().trim()) as {
			success: boolean;
			blueprint: { projectName: string };
		};

		expect(parsed.success).toBeTrue();
		expect(parsed.blueprint.projectName).toBe("demo");
	});

	test("init emits blueprint data in JSON mode", async () => {
		await blueprintCommand(["init", "--project", "demo", "--json"]);
		const parsed = JSON.parse(output().trim()) as {
			success: boolean;
			command: string;
			action: string;
			blueprint: { blueprintId: string; projectName: string };
		};

		expect(parsed.success).toBeTrue();
		expect(parsed.command).toBe("blueprint");
		expect(parsed.action).toBe("init");
		expect(parsed.blueprint.projectName).toBe("demo");
		expect(parsed.blueprint.blueprintId.length).toBeGreaterThan(0);
	});

	test("validate succeeds for created blueprint", async () => {
		await blueprintCommand(["init", "--project", "demo", "--json"]);
		const initPayload = JSON.parse(output().trim()) as {
			blueprint: { blueprintId: string };
		};

		chunks = [];
		await blueprintCommand(["validate", "--id", initPayload.blueprint.blueprintId, "--json"]);
		const validatePayload = JSON.parse(output().trim()) as {
			success: boolean;
			action: string;
			valid: boolean;
		};

		expect(validatePayload.success).toBeTrue();
		expect(validatePayload.action).toBe("validate");
		expect(validatePayload.valid).toBeTrue();
	});
});
