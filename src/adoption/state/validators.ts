import type { CoordinationMessage, WorkUnit } from "../types.ts";

export function validateOwnership(workUnit: WorkUnit): void {
	if (workUnit.ownerRole.trim().length === 0) {
		throw new Error("Work unit must have a non-empty owner role");
	}
}

export function validateCompletionEvidence(workUnit: WorkUnit): void {
	if (workUnit.status === "completed") {
		if (!workUnit.completionEvidence || workUnit.completionEvidence.length === 0) {
			throw new Error("Completed work units require completion evidence");
		}
	}
}

export function validateEscalationLinkage(message: CoordinationMessage): void {
	if (message.messageType === "escalation") {
		if (message.contextRef === undefined || message.contextRef.trim().length === 0) {
			throw new Error("Escalation messages must include a context reference");
		}
		if (message.urgency !== "high" && message.urgency !== "urgent") {
			throw new Error("Escalation messages must be high or urgent priority");
		}
	}
}

export function validateSecretSafePayload(payload: Record<string, unknown>): void {
	const serialized = JSON.stringify(payload).toLowerCase();
	const blockedMarkers = [
		"api_key",
		"apikey",
		"private_key",
		"secret",
		"authorization",
		"bearer ",
	];

	for (const marker of blockedMarkers) {
		if (serialized.includes(marker)) {
			throw new Error(`Payload contains restricted secret marker: ${marker}`);
		}
	}
}
