import type { AdoptionStateSnapshot } from "../types.ts";

export interface RunReport {
	runId: string | null;
	throughput: number;
	failureCount: number;
	qualityGatePassRate: number;
	estimatedCostTotal: number;
	activeWorkUnits: number;
	blockedWorkUnits: number;
}

export function aggregateRunReport(snapshot: AdoptionStateSnapshot): RunReport {
	if (!snapshot.run) {
		return {
			runId: null,
			throughput: 0,
			failureCount: 0,
			qualityGatePassRate: 0,
			estimatedCostTotal: 0,
			activeWorkUnits: 0,
			blockedWorkUnits: 0,
		};
	}

	const activeWorkUnits = snapshot.workUnits.filter((w) => w.status === "in_progress").length;
	const blockedWorkUnits = snapshot.workUnits.filter((w) => w.status === "blocked").length;

	return {
		runId: snapshot.run.runId,
		throughput: snapshot.run.completedWorkUnits,
		failureCount: snapshot.run.failedWorkUnits,
		qualityGatePassRate: snapshot.run.qualityGatePassRate,
		estimatedCostTotal: snapshot.run.estimatedCostTotal,
		activeWorkUnits,
		blockedWorkUnits,
	};
}
