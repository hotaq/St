import { join } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { ValidationError } from "../errors.ts";
import { jsonOutput } from "../json.ts";
import { createAdoptionStateStore } from "../adoption/state/store.ts";
import { assignWorkUnit, closeWorkUnit, createWorkUnit } from "../adoption/work/service.ts";

function resolveAdoptionDbPath(projectRoot: string): string {
	return join(projectRoot, ".overstory", "adoption.db");
}

export function createWorkCommand(): Command {
	const command = new Command("work").description("Manage adoption work units");

	command
		.command("create")
		.description("Create a new work unit")
		.option("--title <title>", "Work unit title")
		.option("--objective <objective>", "Work unit objective")
		.option("--scope <scope>", "Scope boundaries")
		.option("--owner <role>", "Owner role")
		.option("--priority <priority>", "Priority (low|medium|high|urgent)")
		.option("--json", "Output as JSON")
		.action(
			async (opts: {
				title?: string;
				objective?: string;
				scope?: string;
				owner?: string;
				priority?: "low" | "medium" | "high" | "urgent";
				json?: boolean;
			}, subcmd: Command) => {
				const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
				if (!opts.title || !opts.objective || !opts.owner || !opts.scope) {
					throw new ValidationError(
						"--title, --objective, --scope, and --owner are required",
						{ field: "work.create" },
					);
				}

				const config = await loadConfig(process.cwd());
				const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
				try {
					const work = createWorkUnit(store, {
						title: opts.title,
						objective: opts.objective,
						scopeBoundaries: opts.scope,
						ownerRole: opts.owner,
						priority: opts.priority,
					});

					if (json) {
						jsonOutput("work", { action: "create", work });
					} else {
						process.stdout.write(`Created work unit ${work.workUnitId}\n`);
					}
				} finally {
					store.close();
				}
			},
		);

	command
		.command("assign")
		.description("Assign or reassign a work unit")
		.option("--id <work-id>", "Work unit ID")
		.option("--owner <role>", "Owner role")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; owner?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.id || !opts.owner) {
				throw new ValidationError("--id and --owner are required", { field: "work.assign" });
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const work = assignWorkUnit(store, {
					workUnitId: opts.id,
					ownerRole: opts.owner,
				});

				if (json) {
					jsonOutput("work", { action: "assign", work });
				} else {
					process.stdout.write(`Assigned work unit ${work.workUnitId} to ${work.ownerRole}\n`);
				}
			} finally {
				store.close();
			}
		});

	command
		.command("close")
		.description("Close a work unit")
		.option("--id <work-id>", "Work unit ID")
		.option("--evidence <text>", "Completion evidence")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; evidence?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (!opts.id || !opts.evidence) {
				throw new ValidationError("--id and --evidence are required", { field: "work.close" });
			}

			const config = await loadConfig(process.cwd());
			const store = createAdoptionStateStore(resolveAdoptionDbPath(config.project.root));
			try {
				const work = closeWorkUnit(store, {
					workUnitId: opts.id,
					evidence: opts.evidence,
				});

				if (json) {
					jsonOutput("work", { action: "close", work });
				} else {
					process.stdout.write(`Closed work unit ${work.workUnitId}\n`);
				}
			} finally {
				store.close();
			}
		});

	return command;
}

export async function workCommand(args: string[]): Promise<void> {
	const cmd = createWorkCommand();
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
