import type { AdoptionBlueprint } from "../types.ts";
import type { BlueprintValidationResult } from "./validate-service.ts";
import { jsonError, jsonOutput } from "../../json.ts";

export function renderBlueprintInit(blueprint: AdoptionBlueprint, json: boolean): void {
	if (json) {
		jsonOutput("blueprint", { action: "init", blueprint });
		return;
	}

	process.stdout.write(
		`Initialized blueprint ${blueprint.blueprintId} for project ${blueprint.projectName}\n`,
	);
	process.stdout.write(`Roles: ${blueprint.roles.map((r) => r.roleId).join(", ")}\n`);
	process.stdout.write(`Stages: ${blueprint.workflowStages.join(" -> ")}\n`);
}

export function renderBlueprintValidation(result: BlueprintValidationResult, json: boolean): void {
	if (json) {
		if (result.valid) {
			jsonOutput("blueprint", {
				action: "validate",
				valid: true,
				blueprintId: result.blueprint?.blueprintId,
			});
		} else {
			jsonError("blueprint", result.errors.join("; "));
		}
		return;
	}

	if (result.valid) {
		process.stdout.write(`Blueprint ${result.blueprint?.blueprintId ?? "unknown"} is valid\n`);
		return;
	}

	process.stderr.write(`Blueprint validation failed: ${result.errors.join("; ")}\n`);
}
