import type { AdoptionBlueprint } from "../types.ts";
import type { BlueprintRepository } from "./repository.ts";

export interface InitBlueprintInput {
	projectName: string;
}

export function initBlueprint(
	repository: BlueprintRepository,
	input: InitBlueprintInput,
): AdoptionBlueprint {
	if (input.projectName.trim().length === 0) {
		throw new Error("Project name is required");
	}

	return repository.upsertBlueprint({ projectName: input.projectName.trim() });
}
