import type { AdoptionStateSnapshot, RunRecord } from "../types.ts";

export function reconcileRunForResume(
	snapshot: AdoptionStateSnapshot,
	runId: string,
): RunRecord {
	if (!snapshot.run || snapshot.run.runId !== runId) {
		throw new Error("Run not found");
	}

	const unresolvedHealth = snapshot.healthSignals.filter((s) => s.resolvedAt === undefined).length;

	return {
		...snapshot.run,
		state: "active",
		notes: unresolvedHealth > 0 ? `resumed-with-${unresolvedHealth}-open-signals` : "resumed",
	};
}
