import type { Database } from "bun:sqlite";

const CREATE_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS adoption_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
)`;

const CREATE_EVENTS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_adoption_events_aggregate
  ON adoption_events(aggregate_type, aggregate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_adoption_events_type
  ON adoption_events(event_type, occurred_at)`;

function migrateAddEventTypeV2(db: Database): void {
	const rows = db
		.prepare("PRAGMA table_info(adoption_events)")
		.all() as Array<{ name: string }>;
	const existingColumns = new Set(rows.map((r) => r.name));
	if (!existingColumns.has("event_type_v2")) {
		db.exec("ALTER TABLE adoption_events ADD COLUMN event_type_v2 TEXT");
		db.exec("UPDATE adoption_events SET event_type_v2 = event_type WHERE event_type_v2 IS NULL");
	}
}

export function ensureAdoptionSchema(db: Database): void {
	db.exec(CREATE_EVENTS_TABLE);
	db.exec(CREATE_EVENTS_INDEXES);
	migrateAddEventTypeV2(db);
}
