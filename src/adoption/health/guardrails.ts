export function enforceWorkerLimit(currentWorkerCount: number, maxWorkers: number): void {
	if (maxWorkers < 1) {
		throw new Error("maxWorkers must be at least 1");
	}

	if (currentWorkerCount > maxWorkers) {
		throw new Error(
			`Worker concurrency limit exceeded: ${currentWorkerCount} > ${maxWorkers}`,
		);
	}
}

export function resolveEscalationRoute(severity: "warning" | "critical"): string {
	if (severity === "critical") {
		return "coordinator";
	}

	return "lead";
}
