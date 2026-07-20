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
  addEmployee,
  updateEmployee,
  deleteEmployee,
  listEmployees,
} from './employees.js';
import {
  loadCompanyConfig,
  syncEmployeesCompanyMeta,
  toPublicConfig,
  updateBrandingSettings,
  saveUploadedLogo,
  clearUploadedLogo,
  updateSites,
} from './config.js';
import { migrateSessionsFromJsonIfNeeded } from './db.js';
import { computeBaselines } from './baselines.js';
import { evaluateSession } from './evaluate.js';
import {
  insertSession,
  listAdminSessions,
  listSessionsForBaselines,
  listSessionSites,
  sessionsToCsv,
} from './sessionStore.js';
import {
  countUnreadNotifications,
  countUnreadRedNotifications,
  createAdminNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.js';
import { isAdminConfigured, requireAdmin } from './adminAuth.js';
import { createRateLimiter } from './rateLimit.js';
import { listAuditLogs, writeAuditLog } from './audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER ?? '';
const KIOSK_EXIT_PIN = process.env.KIOSK_EXIT_PIN ?? '';

function clientIp(req) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || '';
}

function audit(req, action, details = {}) {
  writeAuditLog({
    action,
    actor: req.header('x-admin-key') ? 'admin' : 'operator',
    ip: clientIp(req),
    details,
  });
}
async function deliverAlerts(session, evaluation) {
  // Every completed game notifies the supervisor dashboard
  const adminNotification = createAdminNotification({ session, evaluation });
  let webhookSent = false;
  let webhookError;

  // Optional external webhook only for red (concern) sessions
  if (evaluation.severity === 'red' && process.env.ALERT_WEBHOOK_URL) {
    const payload = {
      employee: session.employeeName,
      clockNumber: session.clockNumber,
      companyId: session.companyId,
      sessionId: session.id,
      severity: evaluation.severity,
      reasons: evaluation.alertReasons,
      slowHits: evaluation.slowHits,
      sessionMedianReactionTimeMs: evaluation.sessionMedianReactionTimeMs,
      at: new Date().toISOString(),
    };
    const result = await sendSupervisorAlert(payload);
    webhookSent = result.sent;
    webhookError = result.error;
  }

  return {
    sent: true,
    adminNotified: true,
    severity: evaluation.severity,
    notificationId: adminNotification.id,
    webhookSent,
    webhookError,
    placeholder: false,
  };
}

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const apiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_API_MAX ?? 180),
  message: 'Too many requests. Please wait a moment and try again.',
});
const sessionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_SESSION_MAX ?? 20),
  message: 'Too many game submissions from this device. Please wait a minute.',
});
const adminLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 240),
  message: 'Too many admin requests. Please wait a moment.',
});

app.use('/api', apiLimiter);
app.use('/api/sessions', sessionLimiter);
app.use('/api/admin', adminLimiter);
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

  const session = {
    id: crypto.randomUUID(),
    companyId: employeesData.companyId,
    clockNumber: String(clockNumber),
    employeeName: employee.name,
    site: employee.site || '',
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

  const evaluation = evaluateSession(session);
  evaluation.alertConfigured = true;
  evaluation.alertPhoneConfigured = Boolean(process.env.ALERT_WEBHOOK_URL || ALERT_PHONE_NUMBER);

  insertSession(session, evaluation);
  const alertResult = await deliverAlerts(session, evaluation);
  audit(req, 'session.completed', {
    clockNumber: session.clockNumber,
    site: session.site,
    severity: evaluation.severity,
    slowHits: evaluation.slowHits,
    misses: session.misses,
  });

  const baselinesAfter = computeBaselines(
    [...priorSessions, session],
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

app.get('/api/admin/employees', requireAdmin, async (req, res) => {
  const site = typeof req.query.site === 'string' ? req.query.site : 'all';
  const listed = await listEmployees({ site });
  const config = await loadCompanyConfig();
  const sites = [...new Set([...(config.sites ?? []), ...(listed.sites ?? [])])].sort((a, b) =>
    a.localeCompare(b),
  );
  res.json({ ...listed, sites });
});

app.post('/api/admin/employees', requireAdmin, async (req, res) => {
  const { clockNumber, name, site } = req.body ?? {};
  const result = await addEmployee({ clockNumber, name, site });
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  audit(req, 'employee.created', result.employee);
  res.status(201).json(result);
});

app.put('/api/admin/employees/:clockNumber', requireAdmin, async (req, res) => {
  const { name, site, newClockNumber } = req.body ?? {};
  const result = await updateEmployee(req.params.clockNumber, { name, site, newClockNumber });
  if (!result.ok) {
    res.status(404).json(result);
    return;
  }
  audit(req, 'employee.updated', {
    from: req.params.clockNumber,
    employee: result.employee,
  });
  res.json(result);
});

app.delete('/api/admin/employees/:clockNumber', requireAdmin, async (req, res) => {
  const result = await deleteEmployee(req.params.clockNumber);
  if (!result.ok) {
    res.status(404).json(result);
    return;
  }
  audit(req, 'employee.deleted', result.deleted);
  res.json(result);
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

  audit(req, 'employee.import', {
    validEmployees: result.summary?.validEmployees,
    finalEmployeeCount: result.summary?.finalEmployeeCount,
    replacedExisting: result.summary?.replacedExisting,
  });
  res.status(201).json(result);
});

app.get('/api/admin/sessions', requireAdmin, (req, res) => {
  const flaggedOnly = req.query.flaggedOnly === 'true';
  const site = typeof req.query.site === 'string' ? req.query.site : 'all';
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  res.json({
    sessions: listAdminSessions({ flaggedOnly, site, limit }),
    sites: listSessionSites(),
  });
});

app.get('/api/admin/sessions/export.csv', requireAdmin, (req, res) => {
  const flaggedOnly = req.query.flaggedOnly === 'true';
  const site = typeof req.query.site === 'string' ? req.query.site : 'all';
  const sessions = listAdminSessions({ flaggedOnly, site, limit: 5000 });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="shiftsmart-sessions.csv"');
  res.send(sessionsToCsv(sessions));
});

app.get('/api/admin/notifications', requireAdmin, (req, res) => {
  const unreadOnly = req.query.unreadOnly === 'true';
  const site = typeof req.query.site === 'string' ? req.query.site : 'all';
  res.json({
    unreadCount: countUnreadNotifications(),
    unreadRedCount: countUnreadRedNotifications(),
    notifications: listNotifications({ unreadOnly, site, limit: 100 }),
    sites: listSessionSites(),
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

app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
  const config = await loadCompanyConfig();
  const publicConfig = toPublicConfig(config);
  res.json({
    // Company name is display-only — set by IT during hosting setup
    companyName: config.clientCompanyName,
    companyNameEditable: false,
    companyNameHint: 'Company name is set by IT in hosting setup (COMPANY_NAME / data/company.json).',
    branding: publicConfig.branding,
    sites: publicConfig.sites ?? [],
  });
});

app.put('/api/admin/settings/branding', requireAdmin, async (req, res) => {
  try {
    const { primaryColor, accentColor, targetColor } = req.body ?? {};
    const config = await updateBrandingSettings({ primaryColor, accentColor, targetColor });
    const branding = toPublicConfig(config).branding;
    audit(req, 'branding.updated', {
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      targetColor: branding.targetColor,
    });
    res.json({ ok: true, branding });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid branding' });
  }
});

app.put('/api/admin/settings/sites', requireAdmin, async (req, res) => {
  try {
    const { sites } = req.body ?? {};
    const config = await updateSites(sites);
    const nextSites = toPublicConfig(config).sites ?? [];
    audit(req, 'sites.updated', { sites: nextSites });
    res.json({ ok: true, sites: nextSites });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not update sites' });
  }
});

app.get('/api/admin/audit', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  res.json({ logs: listAuditLogs({ limit }) });
});

app.post('/api/admin/settings/logo', requireAdmin, async (req, res) => {
  try {
    const { filename, imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' });
      return;
    }
    const config = await saveUploadedLogo({ filename, base64Data: imageBase64 });
    const branding = toPublicConfig(config).branding;
    audit(req, 'branding.logo_upload', { logoUrl: branding.logoUrl });
    res.json({ ok: true, branding });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Logo upload failed' });
  }
});

app.delete('/api/admin/settings/logo', requireAdmin, async (req, res) => {
  try {
    const config = await clearUploadedLogo();
    audit(req, 'branding.logo_remove', {});
    res.json({ ok: true, branding: toPublicConfig(config).branding });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not remove logo' });
  }
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
