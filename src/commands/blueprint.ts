import { join } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { ValidationError } from "../errors.ts";
import { createBlueprintRepository } from "../adoption/blueprint/repository.ts";
import { initBlueprint } from "../adoption/blueprint/init-service.ts";
import { renderBlueprintInit, renderBlueprintValidation } from "../adoption/blueprint/output.ts";
import { validateBlueprint } from "../adoption/blueprint/validate-service.ts";

function resolveAdoptionDbPath(projectRoot: string): string {
	return join(projectRoot, ".overstory", "adoption.db");
}

export function createBlueprintCommand(): Command {
	const command = new Command("blueprint").description(
		"Manage adoption blueprints for orchestration flows",
	);

	command
		.command("init")
		.description("Initialize an adoption blueprint")
		.option("--project <name>", "Project identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { project?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (opts.project === undefined || opts.project.trim().length === 0) {
				throw new ValidationError("--project is required", {
					field: "project",
					value: opts.project,
				});
			}

			const config = await loadConfig(process.cwd());
			const repository = createBlueprintRepository(resolveAdoptionDbPath(config.project.root));

			try {
				const blueprint = initBlueprint(repository, {
					projectName: opts.project,
				});
				renderBlueprintInit(blueprint, json);
			} finally {
				repository.close();
			}
		});

	command
		.command("validate")
		.description("Validate an adoption blueprint")
		.option("--id <blueprint-id>", "Blueprint identifier")
		.option("--json", "Output as JSON")
		.action(async (opts: { id?: string; json?: boolean }, subcmd: Command) => {
			const json = opts.json ?? (subcmd.optsWithGlobals().json as boolean | undefined) ?? false;
			if (opts.id === undefined || opts.id.trim().length === 0) {
				throw new ValidationError("--id is required", {
					field: "id",
					value: opts.id,
				});
			}

			const config = await loadConfig(process.cwd());
			const repository = createBlueprintRepository(resolveAdoptionDbPath(config.project.root));

			try {
				const result = validateBlueprint(repository, opts.id);
				renderBlueprintValidation(result, json);
				if (!result.valid) {
					process.exitCode = 1;
				}
			} finally {
				repository.close();
			}
		});

	return command;
}

export async function blueprintCommand(args: string[]): Promise<void> {
	const cmd = createBlueprintCommand();
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
