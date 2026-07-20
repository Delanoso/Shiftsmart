import { getDb } from './db.js';

function rowToSession(row, clicks) {
  return {
    id: row.id,
    companyId: row.company_id,
    clockNumber: row.clock_number,
    driverName: row.driver_name,
    durationMs: row.duration_ms,
    misses: row.misses,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    clicks: clicks.map((c) => ({
      index: c.click_index,
      reactionTimeMs: c.reaction_time_ms,
      targetSizePx: c.target_size_px,
    })),
  };
}

export function listSessionsForBaselines(companyId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM sessions WHERE company_id = ? ORDER BY datetime(created_at) ASC`,
    )
    .all(companyId);

  const clickStmt = db.prepare(
    `SELECT click_index, reaction_time_ms, target_size_px FROM session_clicks
     WHERE session_id = ? ORDER BY click_index ASC`,
  );

  return rows.map((row) => {
    const clicks = clickStmt.all(row.id);
    return rowToSession(row, clicks);
  });
}

export function insertSession(session, evaluation) {
  const db = getDb();

  const insertSessionStmt = db.prepare(`
    INSERT INTO sessions (
      id, company_id, clock_number, driver_name, duration_ms, misses,
      started_at, ended_at, created_at, session_median_ms, session_mean_ms,
      should_alert, alert_reasons
    ) VALUES (
      @id, @company_id, @clock_number, @driver_name, @duration_ms, @misses,
      @started_at, @ended_at, @created_at, @session_median_ms, @session_mean_ms,
      @should_alert, @alert_reasons
    )
  `);

  const insertClickStmt = db.prepare(`
    INSERT INTO session_clicks (session_id, click_index, reaction_time_ms, target_size_px)
    VALUES (@session_id, @click_index, @reaction_time_ms, @target_size_px)
  `);

  const tx = db.transaction(() => {
    insertSessionStmt.run({
      id: session.id,
      company_id: session.companyId,
      clock_number: session.clockNumber,
      driver_name: session.driverName,
      duration_ms: session.durationMs,
      misses: session.misses,
      started_at: session.startedAt,
      ended_at: session.endedAt,
      created_at: session.createdAt,
      session_median_ms: evaluation.sessionMedianReactionTimeMs,
      session_mean_ms: evaluation.sessionMeanReactionTimeMs,
      should_alert: evaluation.shouldAlert ? 1 : 0,
      alert_reasons: JSON.stringify(evaluation.alertReasons),
    });

    session.clicks.forEach((c, i) => {
      insertClickStmt.run({
        session_id: session.id,
        click_index: i,
        reaction_time_ms: c.reactionTimeMs,
        target_size_px: c.targetSizePx,
      });
    });
  });

  tx();
}

export function listAdminSessions({ flaggedOnly = false, limit = 200 } = {}) {
  const db = getDb();
  let sql = `SELECT * FROM sessions`;
  if (flaggedOnly) sql += ` WHERE should_alert = 1`;
  sql += ` ORDER BY datetime(created_at) DESC LIMIT ?`;

  const rows = db.prepare(sql).all(limit);
  const clickStmt = db.prepare(
    `SELECT click_index, reaction_time_ms, target_size_px FROM session_clicks
     WHERE session_id = ? ORDER BY click_index ASC`,
  );

  return rows.map((row) => ({
    ...rowToSession(row, clickStmt.all(row.id)),
    sessionMedianMs: row.session_median_ms,
    sessionMeanMs: row.session_mean_ms,
    shouldAlert: Boolean(row.should_alert),
    alertReasons: row.alert_reasons ? JSON.parse(row.alert_reasons) : [],
  }));
}

export function sessionsToCsv(sessions) {
  const header =
    'createdAt,clockNumber,driverName,misses,clickCount,medianMs,meanMs,shouldAlert,alertReasons';
  const lines = sessions.map((s) => {
    const reasons = (s.alertReasons ?? []).join(' | ').replace(/"/g, '""');
    return [
      s.createdAt,
      s.clockNumber,
      `"${s.driverName.replace(/"/g, '""')}"`,
      s.misses,
      s.clicks.length,
      s.sessionMedianMs ?? '',
      s.sessionMeanMs ?? '',
      s.shouldAlert ? 'yes' : 'no',
      `"${reasons}"`,
    ].join(',');
  });
  return [header, ...lines].join('\n');
}
