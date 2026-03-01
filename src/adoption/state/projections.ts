import type { AdoptionStateSnapshot } from "../types.ts";

export interface WorkOwnershipProjection {
	workUnitId: string;
	ownerRole: string;
	status: string;
	latestActivityAt: string;
}

export function projectWorkOwnership(snapshot: AdoptionStateSnapshot): WorkOwnershipProjection[] {
	return snapshot.workUnits
		.map((w) => ({
			workUnitId: w.workUnitId,
			ownerRole: w.ownerRole,
			status: w.status,
			latestActivityAt: w.updatedAt,
		}))
		.sort((a, b) => (a.latestActivityAt < b.latestActivityAt ? 1 : -1));
}
