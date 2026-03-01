import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runAdoptionCommand } from "./run-adoption.ts";

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
	tempDir = await mkdtemp(join(tmpdir(), "run-adoption-cmd-"));
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

describe("run-adoption command", () => {
	test("supports opencode runtime default for run lifecycle", async () => {
		await runAdoptionCommand(["start", "--blueprint", "bp-opencode", "--json"]);
		const startPayload = JSON.parse(output().trim()) as {
			run: { runId: string; blueprintId: string };
		};

		expect(startPayload.run.blueprintId).toBe("bp-opencode");

		chunks = [];
		await runAdoptionCommand(["report", "--id", startPayload.run.runId, "--json"]);
		const reportPayload = JSON.parse(output().trim()) as {
			report: { runId: string | null };
		};
		expect(reportPayload.report.runId).toBe(startPayload.run.runId);
	});

	test("supports start, resume, and report lifecycle", async () => {
		await runAdoptionCommand(["start", "--blueprint", "bp-1", "--json"]);
		const startPayload = JSON.parse(output().trim()) as {
			run: { runId: string; state: string };
		};
		expect(startPayload.run.state).toBe("active");

		chunks = [];
		await runAdoptionCommand(["resume", "--id", startPayload.run.runId, "--json"]);
		const resumePayload = JSON.parse(output().trim()) as {
			run: { runId: string; state: string; notes?: string };
		};
		expect(resumePayload.run.runId).toBe(startPayload.run.runId);
		expect(resumePayload.run.state).toBe("active");

		chunks = [];
		await runAdoptionCommand(["report", "--id", startPayload.run.runId, "--json"]);
		const reportPayload = JSON.parse(output().trim()) as {
			report: {
				runId: string;
				throughput: number;
				failureCount: number;
				qualityGatePassRate: number;
			};
		};
		expect(reportPayload.report.runId).toBe(startPayload.run.runId);
		expect(reportPayload.report.throughput).toBeGreaterThanOrEqual(0);
		expect(reportPayload.report.failureCount).toBeGreaterThanOrEqual(0);
		expect(reportPayload.report.qualityGatePassRate).toBeGreaterThanOrEqual(0);
	});
});
