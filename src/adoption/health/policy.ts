import { randomUUID } from "node:crypto";
import type { HealthSignal, RunRecord } from "../types.ts";

export function createStallWarningSignal(runId: string, sourceRoleId: string): HealthSignal {
	return {
		signalId: randomUUID(),
		runId,
		sourceRoleId,
		signalType: "stall_warning",
		severity: "warning",
		description: "Detected stalled execution activity",
		createdAt: new Date().toISOString(),
	};
}

export function shouldEscalate(signal: HealthSignal): boolean {
	if (signal.signalType === "failure") {
		return true;
	}

	if (signal.signalType === "stall_warning") {
		return signal.severity === "critical";
	}

	return false;
}

export function summarizeRunHealth(run: RunRecord | null, signals: HealthSignal[]): {
	status: "healthy" | "warning" | "critical";
	openSignals: number;
} {
	if (!run) {
		return { status: "warning", openSignals: 0 };
	}

	const openSignals = signals.filter((s) => s.resolvedAt === undefined).length;
	const hasCritical = signals.some((s) => s.severity === "critical" && s.resolvedAt === undefined);
	if (hasCritical) {
		return { status: "critical", openSignals };
	}

	if (openSignals > 0) {
		return { status: "warning", openSignals };
	}

	return { status: "healthy", openSignals };
}
