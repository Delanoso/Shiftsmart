import { getDb } from './db.js';

export function writeAuditLog({
  action,
  actor = 'system',
  ip = '',
  details = {},
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (id, action, actor, ip, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    action,
    actor,
    ip || '',
    JSON.stringify(details ?? {}),
    new Date().toISOString(),
  );
}

export function listAuditLogs({ limit = 200 } = {}) {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`)
    .all(limit)
    .map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actor,
      ip: row.ip,
      details: JSON.parse(row.details_json || '{}'),
      createdAt: row.created_at,
    }));
}
