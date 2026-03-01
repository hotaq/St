import { randomUUID } from "node:crypto";
import type { AdoptionStateStore } from "../state/store.ts";
import type { WorkUnit, WorkUnitPriority } from "../types.ts";
import { validateCompletionEvidence, validateOwnership } from "../state/validators.ts";

export function createWorkUnit(
	store: AdoptionStateStore,
	input: {
		title: string;
		objective: string;
		scopeBoundaries: string;
		ownerRole: string;
		priority?: WorkUnitPriority;
	},
): WorkUnit {
	const now = new Date().toISOString();
	const work: WorkUnit = {
		workUnitId: randomUUID(),
		title: input.title,
		objective: input.objective,
		scopeBoundaries: input.scopeBoundaries,
		ownerRole: input.ownerRole,
		status: "pending",
		priority: input.priority ?? "medium",
		createdAt: now,
		updatedAt: now,
	};

	validateOwnership(work);

	store.appendEvent({
		eventType: "work.upsert",
		aggregateType: "work",
		aggregateId: work.workUnitId,
		payload: work as unknown as Record<string, unknown>,
		occurredAt: now,
	});

	return work;
}

export function assignWorkUnit(
	store: AdoptionStateStore,
	input: {
		workUnitId: string;
		ownerRole: string;
	},
): WorkUnit {
	const snapshot = store.buildSnapshot();
	const existing = snapshot.workUnits.find((w) => w.workUnitId === input.workUnitId);
	if (!existing) {
		throw new Error("Work unit not found");
	}

	const updated: WorkUnit = {
		...existing,
		ownerRole: input.ownerRole,
		status: existing.status === "pending" ? "in_progress" : existing.status,
		updatedAt: new Date().toISOString(),
	};

	validateOwnership(updated);

	store.appendEvent({
		eventType: "work.upsert",
		aggregateType: "work",
		aggregateId: updated.workUnitId,
		payload: updated as unknown as Record<string, unknown>,
		occurredAt: updated.updatedAt,
	});

	return updated;
}

export function closeWorkUnit(
	store: AdoptionStateStore,
	input: {
		workUnitId: string;
		evidence: string;
	},
): WorkUnit {
	const snapshot = store.buildSnapshot();
	const existing = snapshot.workUnits.find((w) => w.workUnitId === input.workUnitId);
	if (!existing) {
		throw new Error("Work unit not found");
	}

	const updated: WorkUnit = {
		...existing,
		status: "completed",
		completionEvidence: [...(existing.completionEvidence ?? []), input.evidence],
		updatedAt: new Date().toISOString(),
	};

	validateCompletionEvidence(updated);

	store.appendEvent({
		eventType: "work.upsert",
		aggregateType: "work",
		aggregateId: updated.workUnitId,
		payload: updated as unknown as Record<string, unknown>,
		occurredAt: updated.updatedAt,
	});

	return updated;
}
