import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runAdoptionCommand } from "./run-adoption.ts";
import { workCommand } from "./work.ts";

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
	tempDir = await mkdtemp(join(tmpdir(), "work-cmd-"));
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

describe("work + run-adoption flow", () => {
	test("supports opencode runtime default for work lifecycle", async () => {
		await runAdoptionCommand(["start", "--blueprint", "bp-1", "--json"]);
		const runPayload = JSON.parse(output().trim()) as {
			run: { runId: string };
		};

		chunks = [];
		await workCommand([
			"create",
			"--title",
			"Opencode Task",
			"--objective",
			"Validate runtime parity",
			"--scope",
			"runtime",
			"--owner",
			"worker",
			"--json",
		]);
		const createPayload = JSON.parse(output().trim()) as {
			work: { workUnitId: string };
		};

		chunks = [];
		await runAdoptionCommand(["status", "--id", runPayload.run.runId, "--json"]);
		const statusPayload = JSON.parse(output().trim()) as {
			ownership: Array<{ workUnitId: string }>;
		};
		expect(statusPayload.ownership[0]?.workUnitId).toBe(createPayload.work.workUnitId);
	});

	test("creates, assigns, closes work and exposes status projection", async () => {
		await runAdoptionCommand(["start", "--blueprint", "bp-1", "--json"]);
		const runPayload = JSON.parse(output().trim()) as {
			run: { runId: string };
		};

		chunks = [];
		await workCommand([
			"create",
			"--title",
			"Task A",
			"--objective",
			"Objective A",
			"--scope",
			"scope-a",
			"--owner",
			"worker",
			"--priority",
			"high",
			"--json",
		]);
		const createPayload = JSON.parse(output().trim()) as {
			work: { workUnitId: string; ownerRole: string; status: string };
		};
		expect(createPayload.work.ownerRole).toBe("worker");
		expect(createPayload.work.status).toBe("pending");

		chunks = [];
		await workCommand([
			"assign",
			"--id",
			createPayload.work.workUnitId,
			"--owner",
			"coordinator",
			"--json",
		]);
		const assignPayload = JSON.parse(output().trim()) as {
			work: { ownerRole: string; status: string };
		};
		expect(assignPayload.work.ownerRole).toBe("coordinator");
		expect(assignPayload.work.status).toBe("in_progress");

		chunks = [];
		await workCommand([
			"close",
			"--id",
			createPayload.work.workUnitId,
			"--evidence",
			"tests-passed",
			"--json",
		]);
		const closePayload = JSON.parse(output().trim()) as {
			work: { status: string; completionEvidence: string[] };
		};
		expect(closePayload.work.status).toBe("completed");
		expect(closePayload.work.completionEvidence.length).toBeGreaterThan(0);

		chunks = [];
		await runAdoptionCommand(["status", "--id", runPayload.run.runId, "--json"]);
		const statusPayload = JSON.parse(output().trim()) as {
			ownership: Array<{ workUnitId: string; ownerRole: string; status: string }>;
		};
		expect(statusPayload.ownership.length).toBe(1);
		expect(statusPayload.ownership[0]?.ownerRole).toBe("coordinator");
		expect(statusPayload.ownership[0]?.status).toBe("completed");
	});
});
