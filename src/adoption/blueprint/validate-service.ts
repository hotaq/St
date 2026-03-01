import type { AdoptionBlueprint } from "../types.ts";
import type { BlueprintRepository } from "./repository.ts";

export interface BlueprintValidationResult {
	valid: boolean;
	errors: string[];
	blueprint: AdoptionBlueprint | null;
}

export function validateBlueprint(
	repository: BlueprintRepository,
	blueprintId: string,
): BlueprintValidationResult {
	const blueprint = repository.getBlueprint(blueprintId);
	if (!blueprint) {
		return {
			valid: false,
			errors: ["Blueprint not found"],
			blueprint: null,
		};
	}

	const errors: string[] = [];
	if (blueprint.roles.length < 2) {
		errors.push("Blueprint requires at least 2 roles");
	}

	const roleIds = new Set(blueprint.roles.map((r) => r.roleId));
	if (!roleIds.has("coordinator")) {
		errors.push("Blueprint must define coordinator role");
	}

	if (blueprint.workflowStages.length < 3) {
		errors.push("Blueprint requires at least 3 workflow stages");
	}

	if (blueprint.qualityGatePolicy.trim().length === 0) {
		errors.push("Blueprint requires qualityGatePolicy");
	}

	if (blueprint.guardrailPolicy.trim().length === 0) {
		errors.push("Blueprint requires guardrailPolicy");
	}

	return {
		valid: errors.length === 0,
		errors,
		blueprint,
	};
}
