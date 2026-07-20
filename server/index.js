import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendSupervisorAlert } from './alert.js';
import {
  buildEmployeesCsvTemplate,
  importEmployeesFromCsv,
  parseEmployeesCsv,
  readEmployeesFile,
} from './employees.js';
import { loadCompanyConfig, syncEmployeesCompanyMeta, toPublicConfig } from './config.js';
import { migrateSessionsFromJsonIfNeeded } from './db.js';
import { computeBaselines } from './baselines.js';
import { evaluateSession } from './evaluate.js';
import {
  insertSession,
  listAdminSessions,
  listSessionsForBaselines,
  sessionsToCsv,
} from './sessionStore.js';
import {
  countUnreadNotifications,
  createAdminNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.js';
import { isAdminConfigured, requireAdmin } from './adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER ?? '';
const KIOSK_EXIT_PIN = process.env.KIOSK_EXIT_PIN ?? '';

async function deliverAlerts(session, evaluation) {
  if (!evaluation.shouldAlert) {
    return { sent: false, adminNotified: false };
  }

  const adminNotification = createAdminNotification({ session, evaluation });
  let webhookSent = false;
  let webhookError;

  if (process.env.ALERT_WEBHOOK_URL) {
    const payload = {
      employee: session.employeeName,
      clockNumber: session.clockNumber,
      companyId: session.companyId,
      sessionId: session.id,
      reasons: evaluation.alertReasons,
      sessionMedianReactionTimeMs: evaluation.sessionMedianReactionTimeMs,
      at: new Date().toISOString(),
    };
    const result = await sendSupervisorAlert(payload);
    webhookSent = result.sent;
    webhookError = result.error;
  } else if (ALERT_PHONE_NUMBER) {
    console.warn('[Fatigue Alert — phone not wired]', session.clockNumber, session.employeeName);
  }

  return {
    sent: true,
    adminNotified: true,
    notificationId: adminNotification.id,
    webhookSent,
    webhookError,
    placeholder: false,
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, adminConfigured: isAdminConfigured() });
});

app.get('/api/config', async (_req, res) => {
  const config = await loadCompanyConfig();
  res.json(toPublicConfig(config));
});

app.post('/api/kiosk/verify-exit', (req, res) => {
  const { pin } = req.body ?? {};
  if (!KIOSK_EXIT_PIN) {
    res.json({ ok: true, unrestricted: true });
    return;
  }
  if (String(pin) === KIOSK_EXIT_PIN) {
    res.json({ ok: true });
    return;
  }
  res.status(403).json({ ok: false, error: 'Invalid PIN' });
});

app.get('/api/company', async (_req, res) => {
  const data = await readEmployeesFile();
  const config = await loadCompanyConfig();
  res.json({
    companyId: data.companyId || config.clientCompanyId,
    companyName: data.companyName || config.clientCompanyName,
    employeeCount: data.employees?.length ?? 0,
  });
});

app.get('/api/employees/:clockNumber', async (req, res) => {
  const data = await readEmployeesFile();
  const employee = data.employees?.find((d) => d.clockNumber === req.params.clockNumber);
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  res.json({
    ...employee,
    companyId: data.companyId,
    companyName: data.companyName,
  });
});

app.get('/api/baselines/:clockNumber', async (req, res) => {
  const employeesData = await readEmployeesFile();
  const employee = employeesData.employees?.find((d) => d.clockNumber === req.params.clockNumber);
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  const sessions = listSessionsForBaselines(employeesData.companyId);
  const baselines = computeBaselines(sessions, employeesData.companyId, req.params.clockNumber);
  res.json({
    clockNumber: req.params.clockNumber,
    employeeName: employee.name,
    companyId: employeesData.companyId,
    companyName: employeesData.companyName,
    baselines,
  });
});

app.post('/api/sessions', async (req, res) => {
  const employeesData = await readEmployeesFile();
  const { clockNumber, durationMs, clicks, misses, startedAt, endedAt } = req.body ?? {};

  if (!clockNumber || !Array.isArray(clicks)) {
    res.status(400).json({ error: 'clockNumber and clicks array are required' });
    return;
  }

  const employee = employeesData.employees?.find((d) => d.clockNumber === String(clockNumber));
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  const priorSessions = listSessionsForBaselines(employeesData.companyId);
  const baselinesBefore = computeBaselines(
    priorSessions,
    employeesData.companyId,
    String(clockNumber),
  );

  const session = {
    id: crypto.randomUUID(),
    companyId: employeesData.companyId,
    clockNumber: String(clockNumber),
    employeeName: employee.name,
    durationMs: durationMs ?? 30_000,
    clicks: clicks.map((c, i) => ({
      index: i,
      reactionTimeMs: Number(c.reactionTimeMs),
      targetSizePx: c.targetSizePx,
    })),
    misses: Number(misses ?? 0),
    startedAt: startedAt ?? new Date().toISOString(),
    endedAt: endedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const evaluation = evaluateSession(session, baselinesBefore);
  evaluation.alertConfigured = true;
  evaluation.alertPhoneConfigured = Boolean(process.env.ALERT_WEBHOOK_URL || ALERT_PHONE_NUMBER);

  insertSession(session, evaluation);
  const alertResult = await deliverAlerts(session, evaluation);

  const baselinesAfter = computeBaselines(
    listSessionsForBaselines(employeesData.companyId),
    employeesData.companyId,
    String(clockNumber),
  );

  res.status(201).json({
    session,
    evaluation,
    alert: alertResult,
    baselines: baselinesAfter,
  });
});

app.get('/api/admin/employees/template.csv', requireAdmin, (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(buildEmployeesCsvTemplate());
});

app.post('/api/admin/employees/import/preview', requireAdmin, async (req, res) => {
  const { csvText } = req.body ?? {};
  if (!csvText || typeof csvText !== 'string') {
    res.status(400).json({ error: 'csvText is required' });
    return;
  }

  const parsed = parseEmployeesCsv(csvText);
  res.json({
    ok: parsed.errors.length === 0,
    errors: parsed.errors,
    summary: parsed.summary,
    preview: parsed.employees.slice(0, 10),
  });
});

app.post('/api/admin/employees/import', requireAdmin, async (req, res) => {
  const { csvText, companyId, companyName, replaceExisting = true } = req.body ?? {};
  if (!csvText || typeof csvText !== 'string') {
    res.status(400).json({ error: 'csvText is required' });
    return;
  }

  const result = await importEmployeesFromCsv({
    csvText,
    companyId,
    companyName,
    replaceExisting: Boolean(replaceExisting),
  });

  if (!result.ok) {
    res.status(400).json(result);
    return;
  }

  res.status(201).json(result);
});

app.get('/api/admin/sessions', requireAdmin, (req, res) => {
  const flaggedOnly = req.query.flaggedOnly === 'true';
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  res.json({ sessions: listAdminSessions({ flaggedOnly, limit }) });
});

app.get('/api/admin/sessions/export.csv', requireAdmin, (req, res) => {
  const flaggedOnly = req.query.flaggedOnly === 'true';
  const sessions = listAdminSessions({ flaggedOnly, limit: 5000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="shiftsmart-sessions.csv"');
  res.send(sessionsToCsv(sessions));
});

app.get('/api/admin/notifications', requireAdmin, (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  res.json({
    unreadCount: countUnreadNotifications(),
    notifications: listNotifications({ unreadOnly, limit: 100 }),
  });
});

app.patch('/api/admin/notifications/:id/read', requireAdmin, (req, res) => {
  const ok = markNotificationRead(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Notification not found or already read' });
    return;
  }
  res.json({ ok: true, unreadCount: countUnreadNotifications() });
});

app.post('/api/admin/notifications/read-all', requireAdmin, (_req, res) => {
  const updated = markAllNotificationsRead();
  res.json({ ok: true, updated, unreadCount: countUnreadNotifications() });
});

const PORT = Number(process.env.PORT ?? 3001);
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');

app.use(express.static(publicPath));
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

async function start() {
  await syncEmployeesCompanyMeta();
  const migration = migrateSessionsFromJsonIfNeeded();
  if (migration.migrated > 0) {
    console.log(`Migrated ${migration.migrated} session(s) from data/sessions.json to SQLite`);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Fatigue checker listening on http://0.0.0.0:${PORT}`);
    console.log(`Admin dashboard: http://0.0.0.0:${PORT}/admin`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
