import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, 'shiftsmart.db');

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      clock_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      misses INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      session_median_ms REAL,
      session_mean_ms REAL,
      should_alert INTEGER NOT NULL DEFAULT 0,
      alert_reasons TEXT
    );

    CREATE TABLE IF NOT EXISTS session_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      click_index INTEGER NOT NULL,
      reaction_time_ms REAL NOT NULL,
      target_size_px REAL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_company ON sessions(company_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_clock ON sessions(clock_number);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_alert ON sessions(should_alert);
    CREATE INDEX IF NOT EXISTS idx_clicks_session ON session_clicks(session_id);

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL,
      clock_number TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      message TEXT NOT NULL,
      reasons_json TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_read ON admin_notifications(read_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON admin_notifications(created_at);
  `);

  const notifCols = database.prepare(`PRAGMA table_info(admin_notifications)`).all();
  if (!notifCols.some((c) => c.name === 'severity')) {
    database.exec(`ALTER TABLE admin_notifications ADD COLUMN severity TEXT NOT NULL DEFAULT 'green'`);
  }

  const sessionCols = database.prepare(`PRAGMA table_info(sessions)`).all();
  if (!sessionCols.some((c) => c.name === 'severity')) {
    database.exec(`ALTER TABLE sessions ADD COLUMN severity TEXT NOT NULL DEFAULT 'green'`);
  }
  if (!sessionCols.some((c) => c.name === 'slow_hits')) {
    database.exec(`ALTER TABLE sessions ADD COLUMN slow_hits INTEGER NOT NULL DEFAULT 0`);
  }
  if (!sessionCols.some((c) => c.name === 'site')) {
    database.exec(`ALTER TABLE sessions ADD COLUMN site TEXT NOT NULL DEFAULT ''`);
  }

  if (!notifCols.some((c) => c.name === 'site')) {
    database.exec(`ALTER TABLE admin_notifications ADD COLUMN site TEXT NOT NULL DEFAULT ''`);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      ip TEXT,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_sessions_site ON sessions(site);
  `);
}

export function migrateSessionsFromJsonIfNeeded() {
  const jsonPath = path.join(DATA_DIR, 'sessions.json');
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) AS c FROM sessions').get().c;
  if (count > 0 || !fs.existsSync(jsonPath)) return { migrated: 0 };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return { migrated: 0 };
  }

  const sessions = parsed.sessions ?? [];
  if (sessions.length === 0) return { migrated: 0 };

  const insertSession = database.prepare(`
    INSERT OR IGNORE INTO sessions (
      id, company_id, clock_number, driver_name, duration_ms, misses,
      started_at, ended_at, created_at, session_median_ms, session_mean_ms,
      should_alert, alert_reasons
    ) VALUES (
      @id, @company_id, @clock_number, @driver_name, @duration_ms, @misses,
      @started_at, @ended_at, @created_at, @session_median_ms, @session_mean_ms,
      @should_alert, @alert_reasons
    )
  `);

  const insertClick = database.prepare(`
    INSERT INTO session_clicks (session_id, click_index, reaction_time_ms, target_size_px)
    VALUES (@session_id, @click_index, @reaction_time_ms, @target_size_px)
  `);

  const tx = database.transaction((rows) => {
    for (const s of rows) {
      insertSession.run({
        id: s.id,
        company_id: s.companyId,
        clock_number: s.clockNumber,
        driver_name: s.employeeName ?? s.driverName,
        duration_ms: s.durationMs ?? 30000,
        misses: s.misses ?? 0,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        created_at: s.createdAt ?? s.endedAt,
        session_median_ms: null,
        session_mean_ms: null,
        should_alert: 0,
        alert_reasons: null,
      });
      for (const c of s.clicks ?? []) {
        insertClick.run({
          session_id: s.id,
          click_index: c.index ?? 0,
          reaction_time_ms: c.reactionTimeMs,
          target_size_px: c.targetSizePx ?? null,
        });
      }
    }
  });

  tx(sessions);
  return { migrated: sessions.length };
}
