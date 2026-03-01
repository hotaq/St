import { randomUUID } from "node:crypto";
import type { AdoptionBlueprint, RoleProfile } from "../types.ts";
import { createAdoptionStateStore } from "../state/store.ts";

export interface BlueprintRepository {
	upsertBlueprint(input: {
		projectName: string;
		workflowStages?: string[];
		qualityGatePolicy?: string;
		guardrailPolicy?: string;
		roles?: RoleProfile[];
	}): AdoptionBlueprint;
	getBlueprint(blueprintId: string): AdoptionBlueprint | null;
	close(): void;
}

const DEFAULT_STAGES = ["intake", "assignment", "execution", "review", "close"];

const DEFAULT_ROLES: RoleProfile[] = [
	{
		roleId: "coordinator",
		name: "Coordinator",
		responsibilities: ["Intake work", "Assign owners", "Track run health"],
		decisionBoundary: "Can assign/reassign work and trigger escalations",
		active: true,
	},
	{
		roleId: "worker",
		name: "Worker",
		responsibilities: ["Execute assigned work", "Report status", "Attach evidence"],
		decisionBoundary: "Can modify only assigned work scope",
		escalationTargetRoleId: "coordinator",
		active: true,
	},
];

export function createBlueprintRepository(dbPath: string): BlueprintRepository {
	const store = createAdoptionStateStore(dbPath);

	return {
		upsertBlueprint(input): AdoptionBlueprint {
			const now = new Date().toISOString();
			const blueprint: AdoptionBlueprint = {
				blueprintId: randomUUID(),
				projectName: input.projectName,
				roles: input.roles ?? DEFAULT_ROLES,
				workflowStages: input.workflowStages ?? DEFAULT_STAGES,
				qualityGatePolicy: input.qualityGatePolicy ?? "required-evidence",
				guardrailPolicy: input.guardrailPolicy ?? "bounded-concurrency",
				createdAt: now,
				updatedAt: now,
			};

			store.appendEvent({
				eventType: "blueprint.upsert",
				aggregateType: "blueprint",
				aggregateId: blueprint.blueprintId,
				payload: blueprint as unknown as Record<string, unknown>,
				occurredAt: now,
			});

			for (const role of blueprint.roles) {
				store.appendEvent({
					eventType: "role.upsert",
					aggregateType: "blueprint",
					aggregateId: blueprint.blueprintId,
					payload: role as unknown as Record<string, unknown>,
					occurredAt: now,
				});
			}

			return blueprint;
		},

		getBlueprint(blueprintId: string): AdoptionBlueprint | null {
			const snapshot = store.buildSnapshot();
			if (snapshot.blueprint?.blueprintId !== blueprintId) {
				return null;
			}
			return snapshot.blueprint;
		},

		close(): void {
			store.close();
		},
	};
}
