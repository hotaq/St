export interface AdoptionBlueprint {
	blueprintId: string;
	projectName: string;
	roles: RoleProfile[];
	workflowStages: string[];
	qualityGatePolicy: string;
	guardrailPolicy: string;
	createdAt: string;
	updatedAt: string;
}

export interface WorkUnit {
	workUnitId: string;
	title: string;
	objective: string;
	scopeBoundaries: string;
	ownerRole: string;
	status: WorkUnitStatus;
	priority: WorkUnitPriority;
	dependencies?: string[];
	completionEvidence?: string[];
	createdAt: string;
	updatedAt: string;
}

export interface RoleProfile {
	roleId: string;
	name: string;
	responsibilities: string[];
	decisionBoundary: string;
	escalationTargetRoleId?: string;
	active: boolean;
}

export interface CoordinationMessage {
	messageId: string;
	runId: string;
	fromRoleId: string;
	toRoleId: string;
	messageType: CoordinationMessageType;
	urgency: CoordinationUrgency;
	contextRef?: string;
	body: string;
	createdAt: string;
	readAt?: string;
}

export interface RunRecord {
	runId: string;
	blueprintId: string;
	startedAt: string;
	endedAt?: string;
	state: RunState;
	workerCount: number;
	completedWorkUnits: number;
	failedWorkUnits: number;
	qualityGatePassRate: number;
	estimatedCostTotal: number;
	notes?: string;
}

export interface HealthSignal {
	signalId: string;
	runId: string;
	sourceRoleId: string;
	signalType: HealthSignalType;
	severity: HealthSignalSeverity;
	description: string;
	createdAt: string;
	resolvedAt?: string;
}

export type WorkUnitStatus =
	| "pending"
	| "in_progress"
	| "blocked"
	| "ready_for_review"
	| "completed"
	| "failed";

export type WorkUnitPriority = "low" | "medium" | "high" | "urgent";

export type CoordinationMessageType =
	| "status"
	| "question"
	| "result"
	| "error"
	| "dispatch"
	| "escalation"
	| "completion";

export type CoordinationUrgency = "low" | "normal" | "high" | "urgent";

export type RunState = "active" | "paused" | "completed" | "failed";

export type HealthSignalType =
	| "heartbeat"
	| "stall_warning"
	| "failure"
	| "recovery"
	| "capacity_warning";

export type HealthSignalSeverity = "info" | "warning" | "critical";

export interface AdoptionEvent {
	id?: number;
	eventType: string;
	aggregateType: string;
	aggregateId: string;
	payload: Record<string, unknown>;
	occurredAt: string;
}

export interface AdoptionErrorEnvelope {
	errorCode: string;
	message: string;
	hint: string;
	contextRef?: string;
}

export interface AdoptionStateSnapshot {
	blueprint: AdoptionBlueprint | null;
	workUnits: WorkUnit[];
	run: RunRecord | null;
	healthSignals: HealthSignal[];
	messages: CoordinationMessage[];
}
