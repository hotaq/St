import { randomUUID } from "node:crypto";
import type { AdoptionStateStore } from "../state/store.ts";
import type { CoordinationMessage, CoordinationMessageType, CoordinationUrgency } from "../types.ts";
import { validateEscalationLinkage } from "../state/validators.ts";

export function sendCoordinationMessage(
	store: AdoptionStateStore,
	input: {
		runId: string;
		fromRoleId: string;
		toRoleId: string;
		messageType: CoordinationMessageType;
		urgency?: CoordinationUrgency;
		contextRef?: string;
		body: string;
	},
): CoordinationMessage {
	const message: CoordinationMessage = {
		messageId: randomUUID(),
		runId: input.runId,
		fromRoleId: input.fromRoleId,
		toRoleId: input.toRoleId,
		messageType: input.messageType,
		urgency: input.urgency ?? "normal",
		contextRef: input.contextRef,
		body: input.body,
		createdAt: new Date().toISOString(),
	};

	validateEscalationLinkage(message);

	store.appendEvent({
		eventType: "message.upsert",
		aggregateType: "message",
		aggregateId: message.messageId,
		payload: message as unknown as Record<string, unknown>,
		occurredAt: message.createdAt,
	});

	return message;
}
