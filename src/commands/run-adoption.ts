import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { ValidationError } from "../errors.ts";
import { jsonOutput } from "../json.ts";
import { createAdoptionStateStore } from "../adoption/state/store.ts";
import { projectWorkOwnership } from "../adoption/state/projections.ts";
import { summarizeRunHealth } from "../adoption/health/policy.ts";
import { enforceWorkerLimit, resolveEscalationRoute } from "../adoption/health/guardrails.ts";
import { aggregateRunReport } from "../adoption/run/report-service.ts";
import { reconcileRunForResume } from "../adoption/run/resume-service.ts";
import type { RunRecord } from "../adoption/types.ts";

function resolveAdoptionDbPath(projectRoot: string): string {
	return join(projectRoot, ".overstory", "adoption.db");
}

export function createRunAdoptionCommand(): Command {
	const command = new Command("run-adoption").description(
		"Manage adoption orchestration runs",
	);

	command
		.command("start")
		.description("Start an adoption run")
		.option("--blueprint <blueprint-id>", "Blueprint identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { blueprint?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.blueprint) {
				throw new ValidationError("--blueprint is required", {
					field: "run-adoption.start",
				});
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const run: RunRecord = {
					runId: randomUUID(),
					blueprintId: opts.blueprint,
					startedAt: new Date().toISOString(),
					state: "active",
					workerCount: 0,
					completedWorkUnits: 0,
					failedWorkUnits: 0,
					qualityGatePassRate: 1,
					estimatedCostTotal: 0,
				};

				enforceWorkerLimit(run.workerCount, 20);

				store.appendEvent({
					eventType: "run.upsert",
					aggregateType: "run",
					aggregateId: run.runId,
					payload: run as unknown as Record<string, unknown>,
					occurredAt: run.startedAt,
				});

				if (json) {
					jsonOutput("run-adoption", { action: "start", run });
				} else {
					process.stdout.write(`Started adoption run ${run.runId}\n`);
				}
			} finally {
				store.close();
			}
		});

	command
		.command("status")
		.description("Show current adoption run status")
		.option("--id <run-id>", "Run identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.id) {
				throw new ValidationError("--id is required", {
					field: "run-adoption.status",
				});
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const snapshot = store.buildSnapshot();
				if (snapshot.run?.runId !== opts.id) {
					throw new ValidationError("Run not found", {
						field: "run-adoption.status",
						value: opts.id,
					});
				}

				const ownership = projectWorkOwnership(snapshot);
				const health = summarizeRunHealth(snapshot.run, snapshot.healthSignals);
				const escalationRoute = resolveEscalationRoute(
					health.status === "critical" ? "critical" : "warning",
				);
				if (json) {
					jsonOutput("run-adoption", {
						action: "status",
						run: snapshot.run,
						health,
						escalationRoute,
						ownership,
						messages: snapshot.messages,
					});
				} else {
					process.stdout.write(`Run ${snapshot.run.runId} is ${snapshot.run.state}\n`);
					process.stdout.write(`Health: ${health.status} (${health.openSignals} open signals)\n`);
					process.stdout.write(`Work units: ${ownership.length}\n`);
				}
			} finally {
				store.close();
			}
		});

	command
		.command("resume")
		.description("Resume a paused adoption run")
		.option("--id <run-id>", "Run identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.id) {
				throw new ValidationError("--id is required", {
					field: "run-adoption.resume",
				});
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const snapshot = store.buildSnapshot();
				const resumed = reconcileRunForResume(snapshot, opts.id);

				store.appendEvent({
					eventType: "run.upsert",
					aggregateType: "run",
					aggregateId: resumed.runId,
					payload: resumed as unknown as Record<string, unknown>,
					occurredAt: new Date().toISOString(),
				});

				if (json) {
					jsonOutput("run-adoption", { action: "resume", run: resumed });
				} else {
					process.stdout.write(`Resumed run ${resumed.runId}\n`);
				}
			} finally {
				store.close();
			}
		});

	command
		.command("report")
		.description("Generate run-level report")
		.option("--id <run-id>", "Run identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.id) {
				throw new ValidationError("--id is required", {
					field: "run-adoption.report",
				});
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const snapshot = store.buildSnapshot();
				if (snapshot.run?.runId !== opts.id) {
					throw new ValidationError("Run not found", {
						field: "run-adoption.report",
						value: opts.id,
					});
				}

				const report = aggregateRunReport(snapshot);
				if (json) {
					jsonOutput("run-adoption", { action: "report", report });
				} else {
					process.stdout.write(
						`Run ${report.runId}: throughput=${report.throughput}, failures=${report.failureCount}, cost=${report.estimatedCostTotal}\n`,
					);
				}
			} finally {
				store.close();
			}
		});

	return command;
}

export async function runAdoptionCommand(args: string[]): Promise<void> {
	const cmd = createRunAdoptionCommand();
	cmd.exitOverride();

	try {
		await cmd.parseAsync(args, { from: "user" });
	} catch (err: unknown) {
		if (err && typeof err === "object" && "code" in err) {
			const code = (err as { code: string }).code;
			if (code === "commander.helpDisplayed" || code === "commander.version") {
				return;
			}
		}
		throw err;
	}
}
