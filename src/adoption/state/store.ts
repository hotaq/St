import { Database } from "bun:sqlite";
import type {
	AdoptionBlueprint,
	AdoptionEvent,
	AdoptionStateSnapshot,
	CoordinationMessage,
	HealthSignal,
	RoleProfile,
	RunRecord,
	WorkUnit,
} from "../types.ts";
import { ensureAdoptionSchema } from "./schema.ts";

interface AdoptionEventRow {
	id: number;
	event_type: string;
	aggregate_type: string;
	aggregate_id: string;
	payload: string;
	occurred_at: string;
}

export interface AdoptionStateStore {
	appendEvent(event: AdoptionEvent): number;
	listEvents(opts?: {
		aggregateType?: string;
		aggregateId?: string;
		limit?: number;
	}): AdoptionEvent[];
	buildSnapshot(): AdoptionStateSnapshot;
	close(): void;
}

function rowToEvent(row: AdoptionEventRow): AdoptionEvent {
	return {
		id: row.id,
		eventType: row.event_type,
		aggregateType: row.aggregate_type,
		aggregateId: row.aggregate_id,
		payload: JSON.parse(row.payload) as Record<string, unknown>,
		occurredAt: row.occurred_at,
	};
}

function buildSnapshotFromEvents(events: AdoptionEvent[]): AdoptionStateSnapshot {
	let blueprint: AdoptionBlueprint | null = null;
	const roleById = new Map<string, RoleProfile>();
	const workById = new Map<string, WorkUnit>();
	const messageById = new Map<string, CoordinationMessage>();
	const healthById = new Map<string, HealthSignal>();
	let run: RunRecord | null = null;

	for (const event of events) {
		switch (event.aggregateType) {
			case "blueprint": {
				if (event.eventType === "blueprint.upsert") {
					blueprint = event.payload as unknown as AdoptionBlueprint;
				}
				if (event.eventType === "role.upsert") {
					const role = event.payload as unknown as RoleProfile;
					roleById.set(role.roleId, role);
				}
				break;
			}
			case "work": {
				const work = event.payload as unknown as WorkUnit;
				workById.set(work.workUnitId, work);
				break;
			}
			case "message": {
				const message = event.payload as unknown as CoordinationMessage;
				messageById.set(message.messageId, message);
				break;
			}
			case "run": {
				run = event.payload as unknown as RunRecord;
				break;
			}
			case "health": {
				const signal = event.payload as unknown as HealthSignal;
				healthById.set(signal.signalId, signal);
				break;
			}
		}
	}

	if (blueprint) {
		blueprint.roles = [...roleById.values()];
	}

	return {
		blueprint,
		workUnits: [...workById.values()],
		run,
		healthSignals: [...healthById.values()],
		messages: [...messageById.values()],
	};
}

export function createAdoptionStateStore(dbPath: string): AdoptionStateStore {
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA busy_timeout = 5000");

	ensureAdoptionSchema(db);

	const insertStmt = db.prepare<
		{ id: number },
		{
			$event_type: string;
			$aggregate_type: string;
			$aggregate_id: string;
			$payload: string;
			$occurred_at: string;
		}
	>(`
		INSERT INTO adoption_events
			(event_type, aggregate_type, aggregate_id, payload, occurred_at)
		VALUES
			($event_type, $aggregate_type, $aggregate_id, $payload, $occurred_at)
		RETURNING id
	`);

	return {
		appendEvent(event: AdoptionEvent): number {
			const row = insertStmt.get({
				$event_type: event.eventType,
				$aggregate_type: event.aggregateType,
				$aggregate_id: event.aggregateId,
				$payload: JSON.stringify(event.payload),
				$occurred_at: event.occurredAt,
			});
			return row?.id ?? 0;
		},

		listEvents(opts?: {
			aggregateType?: string;
			aggregateId?: string;
			limit?: number;
		}): AdoptionEvent[] {
			const conditions: string[] = [];
			const params: Record<string, string> = {};

			if (opts?.aggregateType) {
				conditions.push("aggregate_type = $aggregate_type");
				params.$aggregate_type = opts.aggregateType;
			}

			if (opts?.aggregateId) {
				conditions.push("aggregate_id = $aggregate_id");
				params.$aggregate_id = opts.aggregateId;
			}

			const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
			const limitClause = opts?.limit !== undefined ? `LIMIT ${opts.limit}` : "";

			const query =
				`SELECT id, event_type, aggregate_type, aggregate_id, payload, occurred_at ` +
				`FROM adoption_events ${whereClause} ORDER BY id ASC ${limitClause}`;
			const rows = db.prepare<AdoptionEventRow, Record<string, string>>(query).all(params);
			return rows.map(rowToEvent);
		},

		buildSnapshot(): AdoptionStateSnapshot {
			const events = this.listEvents();
			return buildSnapshotFromEvents(events);
		},

		close(): void {
			db.exec("PRAGMA wal_checkpoint(PASSIVE)");
			db.close();
		},
	};
}
