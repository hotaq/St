import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAdoptionStateStore } from "./store.ts";
import {
	validateCompletionEvidence,
	validateEscalationLinkage,
	validateOwnership,
	validateSecretSafePayload,
} from "./validators.ts";
import type { CoordinationMessage, WorkUnit } from "../types.ts";

const tempDirs: string[] = [];

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await Bun.$`rm -rf ${dir}`.quiet();
	}
});

describe("adoption state store", () => {
	test("appends and lists events in order", async () => {
		const dir = await mkdtemp(join(tmpdir(), "adoption-store-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "adoption.db");
		const store = createAdoptionStateStore(dbPath);

		store.appendEvent({
			eventType: "blueprint.upsert",
			aggregateType: "blueprint",
			aggregateId: "bp-1",
			payload: {
				blueprintId: "bp-1",
				projectName: "demo",
				roles: [],
				workflowStages: ["intake", "assign", "execute"],
				qualityGatePolicy: "required",
				guardrailPolicy: "bounded",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			occurredAt: new Date().toISOString(),
		});

		store.appendEvent({
			eventType: "work.upsert",
			aggregateType: "work",
			aggregateId: "wk-1",
			payload: {
				workUnitId: "wk-1",
				title: "Implement baseline",
				objective: "Add core flow",
				scopeBoundaries: "phase-1",
				ownerRole: "coordinator",
				status: "in_progress",
				priority: "high",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			occurredAt: new Date().toISOString(),
		});

		const events = store.listEvents();
		expect(events.length).toBe(2);
		expect(events[0]?.aggregateType).toBe("blueprint");
		expect(events[1]?.aggregateType).toBe("work");

		const snapshot = store.buildSnapshot();
		expect(snapshot.blueprint?.blueprintId).toBe("bp-1");
		expect(snapshot.workUnits.length).toBe(1);

		store.close();
	});

	test("supports aggregate filtering and limits for projection reads", async () => {
		const dir = await mkdtemp(join(tmpdir(), "adoption-store-filter-"));
		tempDirs.push(dir);
		const dbPath = join(dir, "adoption.db");
		const store = createAdoptionStateStore(dbPath);

		for (let i = 0; i < 20; i++) {
			store.appendEvent({
				eventType: "work.upsert",
				aggregateType: "work",
				aggregateId: `wk-${i % 2}`,
				payload: { index: i },
				occurredAt: new Date(Date.now() + i).toISOString(),
			});
		}

		const filtered = store.listEvents({ aggregateType: "work", aggregateId: "wk-1", limit: 5 });
		expect(filtered.length).toBe(5);
		expect(filtered.every((e) => e.aggregateId === "wk-1")).toBeTrue();

		store.close();
	});
});

describe("adoption validators", () => {
	test("requires owner role", () => {
		const work: WorkUnit = {
			workUnitId: "wk-1",
			title: "x",
			objective: "x",
			scopeBoundaries: "x",
			ownerRole: "",
			status: "pending",
			priority: "low",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		expect(() => validateOwnership(work)).toThrow();
	});

	test("requires completion evidence for completed work", () => {
		const work: WorkUnit = {
			workUnitId: "wk-1",
			title: "x",
			objective: "x",
			scopeBoundaries: "x",
			ownerRole: "lead",
			status: "completed",
			priority: "low",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		expect(() => validateCompletionEvidence(work)).toThrow();
	});

	test("requires context and urgency rules for escalation messages", () => {
		const message: CoordinationMessage = {
			messageId: "msg-1",
			runId: "run-1",
			fromRoleId: "worker",
			toRoleId: "lead",
			messageType: "escalation",
			urgency: "normal",
			body: "blocked",
			createdAt: new Date().toISOString(),
		};

		expect(() => validateEscalationLinkage(message)).toThrow();
	});

	test("rejects secret-like payload markers", () => {
		expect(() =>
			validateSecretSafePayload({ api_key: "should-not-store", nested: { ok: true } }),
		).toThrow();
	});
});
