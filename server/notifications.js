import { getDb } from './db.js';

export function createAdminNotification({ session, evaluation }) {
  const db = getDb();
  const id = crypto.randomUUID();
  const name = session.employeeName ?? session.driverName;
  const severity = evaluation.severity === 'red' ? 'red' : 'green';
  const message =
    severity === 'red'
      ? `Review required: ${name} (#${session.clockNumber})`
      : `Session complete: ${name} (#${session.clockNumber}) — within range`;

  db.prepare(
    `INSERT INTO admin_notifications (
      id, session_id, company_id, clock_number, driver_name, message, reasons_json, severity, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    session.id,
    session.companyId,
    session.clockNumber,
    name,
    message,
    JSON.stringify(evaluation.alertReasons),
    severity,
    new Date().toISOString(),
  );

  return { id, message, severity };
}

export function listNotifications({ unreadOnly = false, limit = 100 } = {}) {
  const db = getDb();
  let sql = `SELECT * FROM admin_notifications`;
  if (unreadOnly) sql += ` WHERE read_at IS NULL`;
  sql += ` ORDER BY datetime(created_at) DESC LIMIT ?`;

  return db.prepare(sql).all(limit).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    companyId: row.company_id,
    clockNumber: row.clock_number,
    employeeName: row.driver_name,
    message: row.message,
    reasons: JSON.parse(row.reasons_json),
    severity: row.severity === 'red' ? 'red' : 'green',
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export function markNotificationRead(id) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(`UPDATE admin_notifications SET read_at = ? WHERE id = ? AND read_at IS NULL`)
    .run(now, id);
  return result.changes > 0;
}

export function markAllNotificationsRead() {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(`UPDATE admin_notifications SET read_at = ? WHERE read_at IS NULL`)
    .run(now);
  return result.changes;
}

export function countUnreadNotifications() {
  const db = getDb();
  return db
    .prepare(`SELECT COUNT(*) AS c FROM admin_notifications WHERE read_at IS NULL`)
    .get().c;
}

export function countUnreadRedNotifications() {
  const db = getDb();
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM admin_notifications WHERE read_at IS NULL AND severity = 'red'`,
    )
    .get().c;
}
