import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendSupervisorAlert } from './alert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DRIVERS_PATH = path.join(DATA_DIR, 'drivers.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');

/** Placeholder — wire to SMS/voice when number is available */
const ALERT_PHONE_NUMBER = process.env.ALERT_PHONE_NUMBER ?? '';

/** Reaction time (ms) above personal baseline + this margin triggers alert */
const ALERT_MARGIN_MS = Number(process.env.ALERT_MARGIN_MS ?? 150);

/** Default driver baseline when there is no driver history yet */
const DRIVER_BASELINE_START_MS = Number(process.env.DRIVER_BASELINE_START_MS ?? 550);

/** Default company baseline when there is no company history yet */
const COMPANY_BASELINE_START_MS = Number(process.env.COMPANY_BASELINE_START_MS ?? 550);

/** Sessions worse than company median by this factor also trigger alert */
const ALERT_COMPANY_FACTOR = Number(process.env.ALERT_COMPANY_FACTOR ?? 1.35);

const POOR_REACTION_MS = Number(process.env.POOR_REACTION_MS ?? 800);

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeBaselines(sessions, companyId, clockNumber) {
  const companySessions = sessions.filter((s) => s.companyId === companyId);
  const driverSessions = companySessions.filter((s) => s.clockNumber === clockNumber);

  const companyReactionTimes = companySessions.flatMap((s) =>
    s.clicks.map((c) => c.reactionTimeMs),
  );
  const driverReactionTimes = driverSessions.flatMap((s) =>
    s.clicks.map((c) => c.reactionTimeMs),
  );

  return {
    company: {
      sessionCount: companySessions.length,
      clickCount: companyReactionTimes.length,
      medianReactionTimeMs: median(companyReactionTimes) ?? COMPANY_BASELINE_START_MS,
      meanReactionTimeMs: mean(companyReactionTimes) ?? COMPANY_BASELINE_START_MS,
    },
    driver: {
      sessionCount: driverSessions.length,
      clickCount: driverReactionTimes.length,
      // When a driver has no history yet, use a reasonable starting baseline
      // so we can still evaluate their first run.
      medianReactionTimeMs: median(driverReactionTimes) ?? DRIVER_BASELINE_START_MS,
      meanReactionTimeMs: mean(driverReactionTimes) ?? DRIVER_BASELINE_START_MS,
    },
  };
}

function evaluateSession(session, baselinesBefore) {
  const reactionTimes = session.clicks.map((c) => c.reactionTimeMs);
  const sessionMedian = median(reactionTimes);
  const sessionMean = mean(reactionTimes);
  const misses = session.misses ?? 0;

  const reasons = [];
  let shouldAlert = false;

  if (reactionTimes.length === 0) {
    shouldAlert = true;
    reasons.push('No targets hit during the session.');
  }

  const poorClicks = reactionTimes.filter((rt) => rt >= POOR_REACTION_MS).length;
  if (poorClicks > 0) {
    shouldAlert = true;
    reasons.push(`${poorClicks} reaction(s) at or above ${POOR_REACTION_MS} ms.`);
  }

  if (misses >= 2) {
    shouldAlert = true;
    reasons.push(`${misses} missed targets (timeout).`);
  }

  const driverBaseline = baselinesBefore.driver.medianReactionTimeMs;
  if (
    driverBaseline != null &&
    sessionMedian != null &&
    sessionMedian > driverBaseline + ALERT_MARGIN_MS
  ) {
    shouldAlert = true;
    reasons.push(
      `Session median (${Math.round(sessionMedian)} ms) slower than your baseline (${Math.round(driverBaseline)} ms).`,
    );
  }

  const companyBaseline = baselinesBefore.company.medianReactionTimeMs;
  if (
    companyBaseline != null &&
    sessionMedian != null &&
    sessionMedian > companyBaseline * ALERT_COMPANY_FACTOR
  ) {
    shouldAlert = true;
    reasons.push(
      `Session median (${Math.round(sessionMedian)} ms) well above company baseline (${Math.round(companyBaseline)} ms).`,
    );
  }

  return {
    sessionMedianReactionTimeMs: sessionMedian,
    sessionMeanReactionTimeMs: sessionMean,
    shouldAlert,
    alertReasons: reasons,
    // For now we treat “alert configured” as webhook or phone configured.
    alertPhoneConfigured: Boolean(ALERT_PHONE_NUMBER || process.env.ALERT_WEBHOOK_URL),
  };
}

async function sendAlert(session, evaluation) {
  if (!evaluation.shouldAlert) return { sent: false };
  const payload = {
    to: ALERT_PHONE_NUMBER || '(not configured)',
    driver: session.driverName,
    clockNumber: session.clockNumber,
    companyId: session.companyId,
    sessionId: session.id,
    reasons: evaluation.alertReasons,
    sessionMedianReactionTimeMs: evaluation.sessionMedianReactionTimeMs,
    at: new Date().toISOString(),
  };

  // 1) Webhook (recommended for production; no code changes needed on your side)
  const webhookConfigured = Boolean(process.env.ALERT_WEBHOOK_URL);
  if (webhookConfigured) {
    const result = await sendSupervisorAlert(payload);
    if (result.sent) return { sent: true, payload, ...result };
    // If webhook is configured but fails, return failure (UI can show it)
    return { sent: false, placeholder: !result.sent, payload, ...result };
  }

  // 2) Phone integration not wired yet — keep a placeholder for operators
  if (ALERT_PHONE_NUMBER) {
    console.warn('[Fatigue Alert — placeholder phone not wired]', JSON.stringify(payload, null, 2));
    return { sent: false, placeholder: true, payload };
  }

  console.warn('[Fatigue Alert — placeholder]', JSON.stringify(payload, null, 2));
  return { sent: false, placeholder: true, payload };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/company', async (_req, res) => {
  const data = await readJson(DRIVERS_PATH, { companyId: '', companyName: '', drivers: [] });
  res.json({
    companyId: data.companyId,
    companyName: data.companyName,
    driverCount: data.drivers?.length ?? 0,
  });
});

app.get('/api/drivers/:clockNumber', async (req, res) => {
  const data = await readJson(DRIVERS_PATH, { drivers: [] });
  const driver = data.drivers?.find((d) => d.clockNumber === req.params.clockNumber);
  if (!driver) {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }
  res.json({
    ...driver,
    companyId: data.companyId,
    companyName: data.companyName,
  });
});

app.get('/api/baselines/:clockNumber', async (req, res) => {
  const driversData = await readJson(DRIVERS_PATH, { companyId: '', drivers: [] });
  const driver = driversData.drivers?.find((d) => d.clockNumber === req.params.clockNumber);
  if (!driver) {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }
  const sessionsData = await readJson(SESSIONS_PATH, { sessions: [] });
  const baselines = computeBaselines(
    sessionsData.sessions,
    driversData.companyId,
    req.params.clockNumber,
  );
  res.json({
    clockNumber: req.params.clockNumber,
    driverName: driver.name,
    companyId: driversData.companyId,
    companyName: driversData.companyName,
    baselines,
  });
});

app.post('/api/sessions', async (req, res) => {
  const driversData = await readJson(DRIVERS_PATH, { companyId: '', drivers: [] });
  const { clockNumber, durationMs, clicks, misses, startedAt, endedAt } = req.body ?? {};

  if (!clockNumber || !Array.isArray(clicks)) {
    res.status(400).json({ error: 'clockNumber and clicks array are required' });
    return;
  }

  const driver = driversData.drivers?.find((d) => d.clockNumber === String(clockNumber));
  if (!driver) {
    res.status(404).json({ error: 'Driver not found' });
    return;
  }

  const sessionsData = await readJson(SESSIONS_PATH, { sessions: [] });
  const baselinesBefore = computeBaselines(
    sessionsData.sessions,
    driversData.companyId,
    String(clockNumber),
  );

  const session = {
    id: crypto.randomUUID(),
    companyId: driversData.companyId,
    clockNumber: String(clockNumber),
    driverName: driver.name,
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
  const alertResult = await sendAlert(session, evaluation);

  sessionsData.sessions.push(session);
  await writeJson(SESSIONS_PATH, sessionsData);

  const baselinesAfter = computeBaselines(
    sessionsData.sessions,
    driversData.companyId,
    String(clockNumber),
  );

  res.status(201).json({
    session,
    evaluation,
    alert: alertResult,
    baselines: baselinesAfter,
  });
});

const PORT = Number(process.env.PORT ?? 3001);
const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fatigue checker listening on http://0.0.0.0:${PORT}`);
});
